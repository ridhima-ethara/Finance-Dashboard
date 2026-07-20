from fastapi import FastAPI, APIRouter, Body, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import json
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import Any, Dict, List, Optional, Tuple
import uuid
from datetime import datetime, timezone

try:
    from motor.motor_asyncio import AsyncIOMotorClient
except ModuleNotFoundError:  # Local fallback mode does not require Mongo.
    AsyncIOMotorClient = None


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')
LOCAL_DATA_FILE = ROOT_DIR / ".local_runtime_data.json"

# MongoDB connection
mongo_url = os.environ.get("MONGO_URL")
db_name = os.environ.get("DB_NAME")
client = AsyncIOMotorClient(mongo_url) if AsyncIOMotorClient is not None and mongo_url and db_name else None
db = client[db_name] if client and db_name else None

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str


class GatewayExecuteRequest(BaseModel):
    token: str
    model: Optional[str] = None
    identity: Optional[str] = None
    device: Optional[str] = None
    network: Optional[str] = None
    estimated_cost: float = 0
    input_tokens: int = 0
    output_tokens: int = 0
    prompt: Optional[str] = None


def read_local_runtime_data() -> Dict[str, Any]:
    if not LOCAL_DATA_FILE.exists():
        return {}
    try:
        return json.loads(LOCAL_DATA_FILE.read_text())
    except json.JSONDecodeError:
        return {}


def write_local_runtime_data(payload: Dict[str, Any]) -> None:
    LOCAL_DATA_FILE.write_text(json.dumps(payload, indent=2))


def read_local_section(key: str, fallback: Any) -> Any:
    return read_local_runtime_data().get(key, fallback)


def write_local_section(key: str, value: Any) -> None:
    payload = read_local_runtime_data()
    payload[key] = value
    write_local_runtime_data(payload)


async def read_workspace_state() -> Dict[str, Any]:
    if db is not None:
        doc = await db.app_state.find_one({"_id": "workspace-state"}, {"_id": 0})
        if not doc:
            return {}
        return doc.get("state") or {}
    return read_local_section("app_state", {}) or {}


async def write_workspace_state(state: Dict[str, Any]) -> str:
    updated_at = datetime.now(timezone.utc).isoformat()
    if db is not None:
        await db.app_state.update_one(
            {"_id": "workspace-state"},
            {"$set": {"state": state or {}, "updated_at": updated_at}},
            upsert=True,
        )
    else:
        write_local_section("app_state", state or {})
        write_local_section("app_state_updated_at", updated_at)
    return updated_at


def parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def normalize_policy_list(value: Any) -> List[str]:
    if isinstance(value, list):
        return [str(entry).strip() for entry in value if str(entry).strip()]
    if isinstance(value, str):
        return [entry.strip() for entry in value.split(",") if entry.strip()]
    return []


def find_gateway_token(state: Dict[str, Any], token: str) -> Optional[Tuple[int, int, Dict[str, Any], Dict[str, Any]]]:
    records = state.get("modelKeyRecords") or []
    for record_index, record in enumerate(records):
        access_tokens = record.get("accessTokens") or []
        for token_index, access_token in enumerate(access_tokens):
            if str(access_token.get("internalToken") or "").strip() == token:
                return record_index, token_index, record, access_token
    return None

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    if db is not None:
        _ = await db.status_checks.insert_one(doc)
    else:
        status_checks = read_local_section("status_checks", [])
        status_checks.append(doc)
        write_local_section("status_checks", status_checks)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    if db is not None:
        status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    else:
        status_checks = read_local_section("status_checks", [])
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks


@api_router.get("/app-state")
async def get_app_state():
    if db is not None:
        doc = await db.app_state.find_one({"_id": "workspace-state"}, {"_id": 0})
        if not doc:
            return {"state": None, "updated_at": None}
        return {
            "state": doc.get("state") or {},
            "updated_at": doc.get("updated_at"),
        }
    return {
        "state": read_local_section("app_state", None),
        "updated_at": read_local_section("app_state_updated_at", None),
    }


@api_router.put("/app-state")
async def upsert_app_state(payload: Dict[str, Any] = Body(default={})):
    updated_at = datetime.now(timezone.utc).isoformat()
    if db is not None:
        await db.app_state.update_one(
            {"_id": "workspace-state"},
            {"$set": {"state": payload or {}, "updated_at": updated_at}},
            upsert=True,
        )
    else:
        write_local_section("app_state", payload or {})
        write_local_section("app_state_updated_at", updated_at)
    return {"ok": True, "updated_at": updated_at}


@api_router.post("/gateway/execute")
async def execute_gateway_request(payload: GatewayExecuteRequest):
    state = await read_workspace_state()
    match = find_gateway_token(state, payload.token.strip())
    if not match:
        raise HTTPException(status_code=404, detail="Unknown platform token")

    record_index, token_index, record, access_token = match
    status = str(access_token.get("status") or "").lower()
    if status and status != "active":
        raise HTTPException(status_code=403, detail="Token is not active")

    identity = str(payload.identity or "").strip().lower()
    allowed_identities = {
        str(access_token.get("memberId") or "").strip().lower(),
        str(access_token.get("memberEmail") or "").strip().lower(),
        str(access_token.get("memberName") or "").strip().lower(),
    }
    if identity and identity not in allowed_identities:
        raise HTTPException(status_code=403, detail="Token owner mismatch")

    allowed_model_values = {
        str(access_token.get("allowedModelId") or "").strip().lower(),
        str(access_token.get("allowedModelLabel") or "").strip().lower(),
        str(record.get("modelId") or "").strip().lower(),
        str(record.get("model") or "").strip().lower(),
    }
    requested_model = str(payload.model or "").strip().lower()
    if requested_model and requested_model not in allowed_model_values:
        raise HTTPException(status_code=403, detail="Requested model is not allowed for this token")

    now = datetime.now(timezone.utc)
    expires_at = parse_iso_datetime(access_token.get("expiresAt"))
    if expires_at and expires_at <= now:
        raise HTTPException(status_code=403, detail="Token has expired")

    allowed_networks = normalize_policy_list(access_token.get("allowedNetworks"))
    requested_network = str(payload.network or "").strip()
    if allowed_networks:
        if not requested_network:
            raise HTTPException(status_code=400, detail="Network is required for this token")
        if requested_network not in allowed_networks:
            raise HTTPException(status_code=403, detail="Network is not allowed for this token")

    allowed_devices = normalize_policy_list(access_token.get("allowedDevices"))
    requested_device = str(payload.device or "").strip()
    if allowed_devices:
        if not requested_device:
            raise HTTPException(status_code=400, detail="Device is required for this token")
        if requested_device not in allowed_devices:
            raise HTTPException(status_code=403, detail="Device is not allowed for this token")

    rate_limit = int(access_token.get("rateLimitPerMinute") or 0)
    window_started_at = parse_iso_datetime(access_token.get("windowStartedAt"))
    window_requests = int(access_token.get("windowRequests") or 0)
    if rate_limit > 0 and window_started_at and (now - window_started_at).total_seconds() < 60 and window_requests >= rate_limit:
        raise HTTPException(status_code=429, detail="Rate limit exceeded for this token")

    estimated_cost = max(float(payload.estimated_cost or 0), 0.0)
    remaining_budget = float(access_token.get("remainingBudget") or 0.0)
    if estimated_cost > remaining_budget:
        raise HTTPException(status_code=402, detail="Remaining budget is not enough for this request")

    provider_key = str(record.get("fullKey") or "").strip()
    if not provider_key:
        raise HTTPException(status_code=500, detail="Provider key is not available for this record")

    next_window_requests = 1
    next_window_started_at = now.isoformat()
    if rate_limit > 0 and window_started_at and (now - window_started_at).total_seconds() < 60:
        next_window_requests = window_requests + 1
        next_window_started_at = window_started_at.isoformat()

    next_remaining_budget = max(0.0, remaining_budget - estimated_cost)
    usage = access_token.get("usage") or {}
    next_usage = {
        "requests": int(usage.get("requests") or 0) + 1,
        "totalCost": round(float(usage.get("totalCost") or 0.0) + estimated_cost, 4),
        "inputTokens": int(usage.get("inputTokens") or 0) + max(int(payload.input_tokens or 0), 0),
        "outputTokens": int(usage.get("outputTokens") or 0) + max(int(payload.output_tokens or 0), 0),
    }

    state.setdefault("gatewayUsageLogs", [])
    state["gatewayUsageLogs"] = [
        {
            "id": f"glog-{uuid.uuid4().hex[:10]}",
            "at": now.isoformat(),
            "projectId": record.get("project"),
            "projectName": record.get("projectName"),
            "provider": record.get("provider"),
            "model": record.get("model"),
            "memberId": access_token.get("memberId"),
            "memberName": access_token.get("memberName"),
            "memberEmail": access_token.get("memberEmail"),
            "estimatedCost": round(estimated_cost, 4),
            "inputTokens": max(int(payload.input_tokens or 0), 0),
            "outputTokens": max(int(payload.output_tokens or 0), 0),
            "network": requested_network,
            "device": requested_device,
        },
        *state["gatewayUsageLogs"],
    ][:500]

    model_key_records = state.get("modelKeyRecords") or []
    model_key_records[record_index]["lastUsed"] = now.isoformat()
    model_key_records[record_index]["usage"] = int(model_key_records[record_index].get("usage") or 0) + 1
    gateway_policy = model_key_records[record_index].get("gatewayPolicy") or {}
    gateway_policy["remainingBudget"] = round(max(float(gateway_policy.get("remainingBudget") or 0.0) - estimated_cost, 0.0), 4)
    model_key_records[record_index]["gatewayPolicy"] = gateway_policy
    model_key_records[record_index]["accessTokens"][token_index] = {
        **access_token,
        "lastUsed": now.isoformat(),
        "remainingBudget": round(next_remaining_budget, 4),
        "spentBudget": round(float(access_token.get("spentBudget") or 0.0) + estimated_cost, 4),
        "windowStartedAt": next_window_started_at,
        "windowRequests": next_window_requests,
        "usage": next_usage,
    }
    state["modelKeyRecords"] = model_key_records
    updated_at = await write_workspace_state(state)

    return {
        "ok": True,
        "updated_at": updated_at,
        "gateway": {
            "route": access_token.get("gatewayRoute") or record.get("gatewayRoute") or "/api/gateway/execute",
            "validated": {
                "token_status": "active",
                "token_owner": access_token.get("memberName"),
                "identity": payload.identity or access_token.get("memberEmail"),
                "device": requested_device or "managed",
                "network": requested_network or "managed",
                "allowed_model": access_token.get("allowedModelLabel") or record.get("model"),
                "remaining_budget": round(next_remaining_budget, 4),
                "rate_limit_per_minute": rate_limit,
                "expires_at": access_token.get("expiresAt"),
            },
        },
        "usage_recorded": {
            "employee": access_token.get("memberName"),
            "employee_email": access_token.get("memberEmail"),
            "project": record.get("projectName"),
            "provider": record.get("provider"),
            "model": record.get("model"),
            "estimated_cost": round(estimated_cost, 4),
            "request_count": next_usage["requests"],
        },
        "provider_call": {
            "provider": record.get("provider"),
            "model": record.get("model"),
            "provider_key_suffix": provider_key[-4:],
        },
        "response": {
            "id": f"gw-{uuid.uuid4().hex[:10]}",
            "content": f"Mock response routed to {record.get('provider')} {record.get('model')} through the internal gateway.",
        },
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    if client is not None:
        client.close()
