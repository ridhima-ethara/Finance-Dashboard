from fastapi import FastAPI, APIRouter, Body
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import json
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import Any, Dict, List
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
