from fastapi import FastAPI, APIRouter, Body, HTTPException, Depends, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import json
import requests as http_requests
import base64
import bcrypt
import jwt
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import Any, Dict, List, Optional, Tuple
import uuid
from datetime import datetime, timezone, timedelta
from fastapi.responses import Response

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


@api_router.get("/task-log/analytics")
def task_log_analytics(request: Request):
    """Proxy the serving team's automated daily task analytics contract.

    TASK_LOG_API_URL may be either the full analytics endpoint or the upstream
    service base URL. The dashboard never writes task activity manually.
    """
    project_id = request.query_params.get("project_id")
    if not project_id:
        raise HTTPException(status_code=422, detail="project_id is required")
    configured_url = str(os.environ.get("TASK_LOG_API_URL") or "").strip()
    if not configured_url:
        raise HTTPException(
            status_code=503,
            detail="Task log API is not configured. Set TASK_LOG_API_URL on the backend.",
        )
    upstream_url = configured_url.rstrip("/")
    if not upstream_url.endswith("/task-log/analytics"):
        upstream_url = f"{upstream_url}/task-log/analytics"
    params = {
        key: request.query_params.get(key)
        for key in ("project_id", "phase_id", "from", "to")
        if request.query_params.get(key)
    }
    headers = {"Accept": "application/json"}
    configured_token = str(os.environ.get("TASK_LOG_API_TOKEN") or "").strip()
    incoming_auth = request.headers.get("Authorization")
    if configured_token:
        headers["Authorization"] = f"Bearer {configured_token}"
    elif incoming_auth:
        headers["Authorization"] = incoming_auth
    try:
        response = http_requests.get(upstream_url, params=params, headers=headers, timeout=20)
        response.raise_for_status()
        return response.json()
    except http_requests.Timeout as exc:
        raise HTTPException(status_code=504, detail="Task log API timed out") from exc
    except http_requests.RequestException as exc:
        status_code = getattr(exc.response, "status_code", None) or 502
        detail = "Task log API request failed"
        if getattr(exc, "response", None) is not None:
            try:
                detail = exc.response.json().get("detail") or detail
            except (ValueError, AttributeError):
                detail = exc.response.text[:300] or detail
        raise HTTPException(status_code=status_code, detail=detail) from exc
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Task log API returned invalid JSON") from exc


# ---------------------------------------------------------------------------
# Subscription catalogue and request workflow
# ---------------------------------------------------------------------------
SUBSCRIPTION_REQUESTS_LOCAL_SECTION = "subscription_requests"
SUBSCRIPTION_PLANS = [
    {"id": "claude-max", "provider": "Anthropic", "subscription": "Claude Max", "plan": "Max", "unit_cost": 400.0, "currency": "USD", "billing_cycle": "monthly", "effective_from": "2026-01-01", "effective_to": None},
    {"id": "chatgpt-team", "provider": "OpenAI", "subscription": "ChatGPT Team", "plan": "Team", "unit_cost": 300.0, "currency": "USD", "billing_cycle": "monthly", "effective_from": "2026-01-01", "effective_to": None},
    {"id": "cursor-pro", "provider": "Cursor", "subscription": "Cursor Pro", "plan": "Pro", "unit_cost": 40.0, "currency": "USD", "billing_cycle": "monthly", "effective_from": "2026-01-01", "effective_to": None},
    {"id": "github-enterprise", "provider": "GitHub", "subscription": "GitHub Enterprise", "plan": "Enterprise", "unit_cost": 21.0, "currency": "USD", "billing_cycle": "monthly", "effective_from": "2026-01-01", "effective_to": None},
    {"id": "figma-org", "provider": "Figma", "subscription": "Figma Organization", "plan": "Organization", "unit_cost": 45.0, "currency": "USD", "billing_cycle": "monthly", "effective_from": "2026-01-01", "effective_to": None},
    {"id": "notion-plus", "provider": "Notion", "subscription": "Notion Plus", "plan": "Plus", "unit_cost": 15.0, "currency": "USD", "billing_cycle": "monthly", "effective_from": "2026-01-01", "effective_to": None},
    {"id": "linear-standard", "provider": "Linear", "subscription": "Linear Standard", "plan": "Standard", "unit_cost": 12.0, "currency": "USD", "billing_cycle": "monthly", "effective_from": "2026-01-01", "effective_to": None},
]


async def read_subscription_requests() -> List[Dict[str, Any]]:
    if db is not None:
        return await db.subscription_requests.find({}, {"_id": 0}).sort("updated_at", -1).to_list(5000)
    return read_local_section(SUBSCRIPTION_REQUESTS_LOCAL_SECTION, []) or []


async def write_subscription_request(record: Dict[str, Any]) -> None:
    if db is not None:
        await db.subscription_requests.replace_one({"id": record["id"]}, record, upsert=True)
        return
    records = await read_subscription_requests()
    next_records = [record, *[entry for entry in records if entry.get("id") != record["id"]]]
    write_local_section(SUBSCRIPTION_REQUESTS_LOCAL_SECTION, next_records)


async def delete_subscription_request_record(request_id: str) -> None:
    if db is not None:
        await db.subscription_requests.delete_one({"id": request_id})
        return
    records = await read_subscription_requests()
    write_local_section(SUBSCRIPTION_REQUESTS_LOCAL_SECTION, [entry for entry in records if entry.get("id") != request_id])


def subscription_plan(plan_id: str) -> Optional[Dict[str, Any]]:
    return next((plan for plan in SUBSCRIPTION_PLANS if plan["id"] == str(plan_id or "").strip()), None)


def subscription_date(value: Any) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(str(value or "").strip()[:10])
    except (TypeError, ValueError):
        return None


def ranges_overlap(start_a: Any, end_a: Any, start_b: Any, end_b: Any) -> bool:
    a_start, a_end = subscription_date(start_a), subscription_date(end_a)
    b_start, b_end = subscription_date(start_b), subscription_date(end_b)
    if not all((a_start, a_end, b_start, b_end)):
        return False
    return a_start <= b_end and b_start <= a_end


def public_subscription_request(record: Dict[str, Any]) -> Dict[str, Any]:
    safe = dict(record)
    safe["documents"] = [
        {key: value for key, value in document.items() if key != "data"}
        for document in (record.get("documents") or [])
    ]
    return safe


def calculate_subscription_request(payload: Dict[str, Any], existing: List[Dict[str, Any]], submitting: bool = False) -> Tuple[Dict[str, Any], List[str]]:
    errors: List[str] = []
    project_id = str(payload.get("project_id") or "").strip()
    phase_id = str(payload.get("phase_id") or "").strip()
    if not project_id:
        errors.append("Project is required")
    if not phase_id:
        errors.append("Phase is required")
    if submitting and not str(payload.get("justification") or "").strip():
        errors.append("Business justification is required")
    eligible = {
        str(value).strip().lower()
        for member in (payload.get("eligible_members") or [])
        for value in (member.get("id"), member.get("name"), member.get("email"))
        if str(value or "").strip()
    }
    normalized_lines = []
    documents = []
    for document in payload.get("documents") or []:
        size = int(document.get("size") or 0)
        if size > 5 * 1024 * 1024:
            errors.append(f"{document.get('name') or 'Document'} exceeds the 5 MB limit")
            continue
        documents.append({
            **document,
            "id": str(document.get("id") or f"sub-doc-{uuid.uuid4().hex[:8]}"),
            "name": str(document.get("name") or "Subscription document")[:180],
            "content_type": str(document.get("content_type") or "application/octet-stream")[:120],
            "size": size,
        })
    for index, raw_line in enumerate(payload.get("lines") or []):
        plan = subscription_plan(raw_line.get("plan_id"))
        prefix = f"Subscription {index + 1}"
        if not plan:
            errors.append(f"{prefix}: valid catalogue plan is required")
            continue
        seats = max(int(raw_line.get("seats") or 0), 0)
        if seats < 1:
            errors.append(f"{prefix}: seats must be at least 1")
        start = subscription_date(raw_line.get("start_date"))
        end = subscription_date(raw_line.get("end_date"))
        if not start or not end or end < start:
            errors.append(f"{prefix}: valid start and end dates are required")
            duration_days = 0
        else:
            duration_days = (end - start).days + 1
        members = raw_line.get("members") or []
        if len(members) > seats:
            errors.append(f"{prefix}: selected members cannot exceed requested seats")
        for member in members:
            member_values = {str(member.get(key) or "").strip().lower() for key in ("id", "name", "email") if str(member.get(key) or "").strip()}
            if eligible and not member_values.intersection(eligible):
                errors.append(f"{prefix}: {member.get('name') or member.get('email') or 'member'} is not allocated to this project")
            for previous in existing:
                if previous.get("id") == payload.get("id") or previous.get("status") not in {"fulfilment-pending", "active", "expiring"}:
                    continue
                for previous_line in previous.get("lines") or []:
                    if previous_line.get("plan_id") != plan["id"] or not ranges_overlap(raw_line.get("start_date"), raw_line.get("end_date"), previous_line.get("start_date"), previous_line.get("end_date")):
                        continue
                    previous_member_keys = {
                        str(item.get("email") or item.get("id") or item.get("name") or "").strip().lower()
                        for item in (previous_line.get("members") or [])
                    }
                    key = str(member.get("email") or member.get("id") or member.get("name") or "").strip().lower()
                    if key and key in previous_member_keys:
                        errors.append(f"{prefix}: {member.get('name') or key} already has this active subscription for an overlapping period")
        unit_cost = float(plan["unit_cost"])
        subtotal = unit_cost * seats * (duration_days / 30 if duration_days else 0)
        tax_pct = max(float(raw_line.get("tax_pct") or 0), 0)
        discount = max(float(raw_line.get("discount") or 0), 0)
        tax = subtotal * tax_pct / 100
        total = max(subtotal + tax - discount, 0)
        normalized_lines.append({
            **raw_line,
            "id": str(raw_line.get("id") or f"sub-line-{uuid.uuid4().hex[:8]}"),
            "plan_id": plan["id"],
            "provider": plan["provider"],
            "subscription": plan["subscription"],
            "plan": plan["plan"],
            "unit_cost": unit_cost,
            "currency": plan["currency"],
            "billing_cycle": plan["billing_cycle"],
            "seats": seats,
            "duration_days": duration_days,
            "subtotal": round(subtotal, 2),
            "tax_amount": round(tax, 2),
            "discount": round(discount, 2),
            "total": round(total, 2),
        })
    if submitting and not normalized_lines:
        errors.append("Add at least one subscription")
    calculated = {
        **payload,
        "lines": normalized_lines,
        "documents": documents,
        "requested_amount": round(sum(float(line.get("total") or 0) for line in normalized_lines), 2),
        "currency": normalized_lines[0]["currency"] if normalized_lines else "USD",
    }
    return calculated, list(dict.fromkeys(errors))


@api_router.get("/subscription-plans")
async def get_subscription_plans() -> List[Dict[str, Any]]:
    return SUBSCRIPTION_PLANS


@api_router.get("/subscription-requests")
async def get_subscription_requests(request: Request) -> List[Dict[str, Any]]:
    records = await read_subscription_requests()
    project_id = request.query_params.get("project_id")
    requester_email = request.query_params.get("requester_email")
    status = request.query_params.get("status")
    if project_id:
        records = [entry for entry in records if entry.get("project_id") == project_id]
    if requester_email:
        records = [entry for entry in records if str(entry.get("requester", {}).get("email") or "").lower() == requester_email.lower()]
    if status:
        records = [entry for entry in records if entry.get("status") == status]
    return [public_subscription_request(entry) for entry in records]


@api_router.get("/subscription-requests/{request_id}")
async def get_subscription_request(request_id: str) -> Dict[str, Any]:
    record = next((entry for entry in await read_subscription_requests() if entry.get("id") == request_id), None)
    if not record:
        raise HTTPException(status_code=404, detail="Subscription request not found")
    return public_subscription_request(record)


@api_router.post("/subscription-requests")
async def create_subscription_request(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    record = {
        **payload,
        "id": str(payload.get("id") or f"subreq-{uuid.uuid4().hex[:10]}"),
        "request_number": str(payload.get("request_number") or f"SUB-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"),
        "status": "draft",
        "created_at": now,
        "updated_at": now,
        "history": [{"at": now, "action": "Draft created", "actor": payload.get("requester") or {}}],
    }
    record, errors = calculate_subscription_request(record, await read_subscription_requests())
    if errors:
        raise HTTPException(status_code=422, detail=errors)
    await write_subscription_request(record)
    return public_subscription_request(record)


def subscription_snapshot(record: Dict[str, Any], stage: str, actor: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Preserve the full request state (lines, members, amounts) at a decision point."""
    return {
        "at": datetime.now(timezone.utc).isoformat(),
        "stage": stage,
        "actor": actor or {},
        "requested_amount": record.get("requested_amount"),
        "approved_amount": record.get("approved_amount"),
        "lines": [
            {
                "id": line.get("id"),
                "subscription": line.get("subscription"),
                "plan": line.get("plan"),
                "model": line.get("model"),
                "seats": line.get("seats"),
                "start_date": line.get("start_date"),
                "end_date": line.get("end_date"),
                "total": line.get("total"),
                "members": [{"name": m.get("name"), "email": m.get("email"), "id": m.get("id")} for m in (line.get("members") or [])],
            }
            for line in (record.get("lines") or [])
        ],
    }


@api_router.put("/subscription-requests/{request_id}")
async def update_subscription_request(request_id: str, payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    records = await read_subscription_requests()
    current = next((entry for entry in records if entry.get("id") == request_id), None)
    if not current:
        raise HTTPException(status_code=404, detail="Subscription request not found")
    editor_role = str(payload.get("editor_role") or "").upper()
    payload = {key: value for key, value in payload.items() if key != "editor_role"}
    is_cto_edit = current.get("status") == "cto-review" and editor_role == "CTO"
    if current.get("status") not in {"draft", "returned-to-requester"} and not is_cto_edit:
        raise HTTPException(status_code=409, detail="Only draft or returned requests can be edited")
    current_documents = {entry.get("id"): entry for entry in (current.get("documents") or [])}
    incoming_documents = []
    for document in payload.get("documents", current.get("documents") or []):
        previous = current_documents.get(document.get("id"), {})
        incoming_documents.append({**previous, **document, "data": document.get("data") or previous.get("data")})
    # A CTO technical edit must never change the workflow stage — it stays in cto-review.
    record = {**current, **payload, "documents": incoming_documents, "id": request_id, "status": current.get("status"), "updated_at": datetime.now(timezone.utc).isoformat()}
    record, errors = calculate_subscription_request(record, records)
    if errors:
        raise HTTPException(status_code=422, detail=errors)
    if is_cto_edit:
        now = record["updated_at"]
        record["history"] = [*(record.get("history") or []), {"at": now, "action": "CTO technical edit", "actor": payload.get("actor") or {"role": "CTO"}, "comment": str(payload.get("comment") or "").strip()}]
        record["snapshots"] = [*(record.get("snapshots") or []), subscription_snapshot(record, "CTO technical edit", payload.get("actor") or {"role": "CTO"})]
    await write_subscription_request(record)
    return public_subscription_request(record)


@api_router.delete("/subscription-requests/{request_id}")
async def delete_subscription_request(request_id: str) -> Dict[str, Any]:
    record = next((entry for entry in await read_subscription_requests() if entry.get("id") == request_id), None)
    if not record:
        raise HTTPException(status_code=404, detail="Subscription request not found")
    if record.get("status") != "draft":
        raise HTTPException(status_code=409, detail="Only draft requests can be deleted")
    await delete_subscription_request_record(request_id)
    return {"ok": True}


@api_router.post("/subscription-requests/{request_id}/submit")
async def submit_subscription_request(request_id: str) -> Dict[str, Any]:
    records = await read_subscription_requests()
    current = next((entry for entry in records if entry.get("id") == request_id), None)
    if not current:
        raise HTTPException(status_code=404, detail="Subscription request not found")
    if current.get("status") not in {"draft", "returned-to-requester"}:
        raise HTTPException(status_code=409, detail="Request has already been submitted")
    record, errors = calculate_subscription_request(current, records, submitting=True)
    if errors:
        raise HTTPException(status_code=422, detail=errors)
    now = datetime.now(timezone.utc).isoformat()
    record.update({"status": "cto-review", "submitted_at": now, "updated_at": now})
    record["history"] = [*(record.get("history") or []), {"at": now, "action": "Submitted for CTO review", "actor": record.get("requester") or {}}]
    record["snapshots"] = [*(record.get("snapshots") or []), subscription_snapshot(record, "Submitted", record.get("requester") or {})]
    await write_subscription_request(record)
    return public_subscription_request(record)


@api_router.post("/subscription-requests/{request_id}/decision")
async def decide_subscription_request(request_id: str, payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    records = await read_subscription_requests()
    record = next((entry for entry in records if entry.get("id") == request_id), None)
    if not record:
        raise HTTPException(status_code=404, detail="Subscription request not found")
    role = str(payload.get("role") or "").upper()
    decision = str(payload.get("decision") or "").lower()
    current_status = record.get("status")
    transitions = {
        ("CTO", "cto-review", "approve"): "cfo-review",
        ("CTO", "cto-review", "return"): "returned-to-requester",
        ("CTO", "cto-review", "reject"): "rejected",
        ("CFO", "cfo-review", "approve"): "fulfilment-pending",
        ("CFO", "cfo-review", "partial"): "fulfilment-pending",
        ("CFO", "cfo-review", "return"): "returned-to-requester",
        ("CFO", "cfo-review", "reject"): "rejected",
        ("IT", "fulfilment-pending", "activate"): "active",
    }
    next_status = transitions.get((role, current_status, decision))
    if not next_status:
        raise HTTPException(status_code=409, detail="Decision is not valid for the current stage and role")
    now = datetime.now(timezone.utc).isoformat()
    approved_amount = float(payload.get("approved_amount") or record.get("requested_amount") or 0) if role == "CFO" and decision in {"approve", "partial"} else record.get("approved_amount")
    updates = {"status": next_status, "updated_at": now, "approved_amount": round(approved_amount, 2) if approved_amount is not None else None}
    if role == "CFO" and decision in {"approve", "partial"}:
        updates["cfo_decision"] = decision
    if role == "CTO" and decision == "approve":
        updates["cto_forwarded_amount"] = record.get("requested_amount")
    record.update(updates)
    record["history"] = [*(record.get("history") or []), {"at": now, "action": f"{role} {decision}", "actor": payload.get("actor") or {"role": role}, "comment": str(payload.get("comment") or "").strip(), "approved_amount": approved_amount}]
    record["snapshots"] = [*(record.get("snapshots") or []), subscription_snapshot(record, f"{role} {decision}", payload.get("actor") or {"role": role})]
    if next_status == "active":
        record["activated_at"] = now
    await write_subscription_request(record)
    return public_subscription_request(record)


@api_router.get("/subscription-requests/{request_id}/documents/{document_id}")
async def download_subscription_document(request_id: str, document_id: str) -> Response:
    record = next((entry for entry in await read_subscription_requests() if entry.get("id") == request_id), None)
    document = next((entry for entry in (record or {}).get("documents") or [] if entry.get("id") == document_id), None)
    if not document or not document.get("data"):
        raise HTTPException(status_code=404, detail="Document not found")
    raw = str(document["data"])
    encoded = raw.split(",", 1)[1] if "," in raw else raw
    try:
        content = base64.b64decode(encoded)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail="Stored document is invalid") from exc
    headers = {"Content-Disposition": f'attachment; filename="{str(document.get("name") or "subscription-document").replace(chr(34), "")}"'}
    return Response(content=content, media_type=document.get("content_type") or "application/octet-stream", headers=headers)


def normalize_tracker_entry(entry: Dict[str, Any]) -> Dict[str, Any]:
    """Normalise a post-approval tracker row (one per allocated member/seat)."""
    amount_usd = round(max(float(entry.get("amount_usd") or 0), 0), 2)
    amount_inr = round(max(float(entry.get("amount_inr") or 0), 0), 2)
    amount_paid = round(max(float(entry.get("amount_paid") or 0), 0), 2)
    total_amount = round(float(entry.get("total_amount") or amount_usd or amount_paid or 0), 2)
    return {
        **entry,
        "id": str(entry.get("id") or f"track-{uuid.uuid4().hex[:8]}"),
        "line_id": str(entry.get("line_id") or "").strip(),
        "employee_code": str(entry.get("employee_code") or "").strip(),
        "name": str(entry.get("name") or "").strip(),
        "email": str(entry.get("email") or "").strip(),
        "amount_usd": amount_usd,
        "amount_inr": amount_inr,
        "amount_paid": amount_paid,
        "total_amount": total_amount,
        "difference": round(total_amount - amount_paid, 2),
        "reimbursement_verified": str(entry.get("reimbursement_verified") or "Not Verified").strip(),
        "reimbursement_status": str(entry.get("reimbursement_status") or "").strip(),
        "comments": str(entry.get("comments") or "").strip(),
        "account_number": str(entry.get("account_number") or "").strip(),
        "ifsc_code": str(entry.get("ifsc_code") or "").strip(),
        "subscription_type": str(entry.get("subscription_type") or "").strip(),
        "model": str(entry.get("model") or "").strip(),
        "phase": str(entry.get("phase") or "").strip(),
        "status": str(entry.get("status") or "Active").strip(),
        "date": str(entry.get("date") or "").strip(),
        "month": str(entry.get("month") or "").strip(),
        "started": str(entry.get("started") or "").strip(),
        "ended": str(entry.get("ended") or "").strip(),
        "invoice_document_id": str(entry.get("invoice_document_id") or "").strip(),
        "receipt_document_id": str(entry.get("receipt_document_id") or "").strip(),
        "screenshot_document_id": str(entry.get("screenshot_document_id") or "").strip(),
    }


@api_router.post("/subscription-requests/{request_id}/fulfilment")
async def submit_subscription_fulfilment(request_id: str, payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Record post-approval fulfilment: purchase mode, per-member tracker rows and evidence documents."""
    records = await read_subscription_requests()
    record = next((entry for entry in records if entry.get("id") == request_id), None)
    if not record:
        raise HTTPException(status_code=404, detail="Subscription request not found")
    if record.get("status") not in {"fulfilment-pending", "active"}:
        raise HTTPException(status_code=409, detail="Fulfilment can only be recorded after CFO approval")
    purchase_mode = str(payload.get("purchase_mode") or "company").strip().lower()
    if purchase_mode not in {"self", "company"}:
        raise HTTPException(status_code=422, detail="Purchase mode must be 'self' or 'company'")
    entries = [normalize_tracker_entry(entry) for entry in (payload.get("tracker_entries") or [])]
    existing_documents = {document.get("id"): document for document in (record.get("documents") or [])}
    for document in payload.get("documents") or []:
        if int(document.get("size") or 0) > 5 * 1024 * 1024:
            raise HTTPException(status_code=422, detail=f"{document.get('name') or 'Document'} exceeds the 5 MB limit")
        doc_id = str(document.get("id") or f"sub-doc-{uuid.uuid4().hex[:8]}")
        previous = existing_documents.get(doc_id, {})
        existing_documents[doc_id] = {
            **previous,
            **document,
            "id": doc_id,
            "name": str(document.get("name") or previous.get("name") or "Fulfilment document")[:180],
            "type": str(document.get("type") or previous.get("type") or "document")[:40],
            "content_type": str(document.get("content_type") or previous.get("content_type") or "application/octet-stream")[:120],
            "data": document.get("data") or previous.get("data"),
        }
    now = datetime.now(timezone.utc).isoformat()
    was_pending = record.get("status") == "fulfilment-pending"
    record.update({
        "purchase_mode": purchase_mode,
        "tracker_entries": entries,
        "documents": list(existing_documents.values()),
        "fulfilment_status": "submitted",
        "fulfilled_at": record.get("fulfilled_at") or now,
        "status": "active",
        "activated_at": record.get("activated_at") or now,
        "updated_at": now,
    })
    record["history"] = [
        *(record.get("history") or []),
        {
            "at": now,
            "action": "Fulfilment recorded" if was_pending else "Fulfilment updated",
            "actor": payload.get("actor") or record.get("requester") or {},
            "comment": str(payload.get("comment") or "").strip(),
            "purchase_mode": purchase_mode,
        },
    ]
    await write_subscription_request(record)
    return public_subscription_request(record)


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


# ---------------------------------------------------------------------------
# Workspace state (shared across all users of the shared workspace)
# ---------------------------------------------------------------------------
# The frontend persists all ~15 workspace slices (customProjects, taskLogs,
# topupRequests, budgets, batchDeliveries, budgetReviews, changeRequests,
# teamRemovals, modelKeys, itProvisioning, itMonthlyActuals, bufferPool,
# buffers, recoveries, customModels) as ONE snapshot document. GET returns
# the full snapshot; PUT upsert-replaces it.
#
# Concurrency: last-write-wins. Frontend debounces writes (800 ms) and
# refetches on tab focus so multiple roles/devices see each other's updates.
#
# When Mongo is not configured we fall back to a local JSON file (dev/tests).
# ---------------------------------------------------------------------------

WORKSPACE_DOC_ID = "singleton"
WORKSPACE_LOCAL_SECTION = "workspace_state"


@api_router.get("/workspace")
async def get_workspace_state() -> Dict[str, Any]:
    """Return the full workspace state snapshot. Empty dict if not yet initialised."""
    if db is not None:
        doc = await db.workspace_state.find_one({"_id": WORKSPACE_DOC_ID}, {"_id": 0})
        return doc or {}
    return read_local_section(WORKSPACE_LOCAL_SECTION, {}) or {}


@api_router.put("/workspace")
async def put_workspace_state(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Replace the workspace state snapshot with the provided payload."""
    payload = dict(payload or {})
    payload["updatedAt"] = datetime.now(timezone.utc).isoformat()
    if db is not None:
        await db.workspace_state.update_one(
            {"_id": WORKSPACE_DOC_ID},
            {"$set": payload},
            upsert=True,
        )
    else:
        write_local_section(WORKSPACE_LOCAL_SECTION, payload)
    return {"ok": True, "updatedAt": payload["updatedAt"]}



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

# -------------------------- Auth (JWT + bcrypt) --------------------------
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_TTL_MIN = 60 * 12  # 12 hours — matches a shared workspace day

def _jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def _hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def _verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def _create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_TTL_MIN),
        "type": "access",
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)

class LoginPayload(BaseModel):
    email: EmailStr
    password: str

# Pre-seeded role users. Same password across all 5 role accounts by design (single-team
# shared workspace) — users can rotate later via a password-change endpoint if needed.
DEFAULT_PASSWORD = "Ethara@2026"
SEED_USERS = [
    {"email": "cto@ethara.ai", "name": "CTO Admin",   "role": "CTO"},
    {"email": "cfo@ethara.ai", "name": "Shubham Garg","role": "CFO"},
    {"email": "tpm@ethara.ai", "name": "TPM Lead",    "role": "TPM"},
    {"email": "rd@ethara.ai",  "name": "R&D Lead 1",  "role": "R&D"},
    {"email": "it@ethara.ai",  "name": "IT Admin",    "role": "IT"},
]

async def seed_role_users():
    if db is None:
        return
    hashed = _hash_password(DEFAULT_PASSWORD)
    for u in SEED_USERS:
        existing = await db.users.find_one({"email": u["email"]})
        if not existing:
            await db.users.insert_one({**u, "password_hash": hashed, "created_at": datetime.now(timezone.utc).isoformat()})
        elif not _verify_password(DEFAULT_PASSWORD, existing.get("password_hash", "")):
            await db.users.update_one({"email": u["email"]}, {"$set": {"password_hash": hashed}})

async def get_current_user(request: Request) -> Dict[str, Any]:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    if db is not None:
        user = await db.users.find_one({"email": payload.get("email")}, {"password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user.get("_id", ""))
        return {"email": user["email"], "name": user["name"], "role": user["role"]}
    return {"email": payload["email"], "name": payload.get("email"), "role": payload.get("role")}

@api_router.post("/auth/login")
async def login(payload: LoginPayload):
    if db is None:
        raise HTTPException(status_code=503, detail="Auth backend unavailable")
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not _verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = _create_access_token(str(user.get("_id", "")), user["email"], user["role"])
    return {
        "token": token,
        "user": {"email": user["email"], "name": user["name"], "role": user["role"]},
    }

@api_router.get("/auth/me")
async def me(current: Dict[str, Any] = Depends(get_current_user)):
    return current

@app.on_event("startup")
async def _startup():
    await seed_role_users()

# ------------------------ end Auth ------------------------

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
