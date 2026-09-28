from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError
import os
import re
import logging
import uuid
import bcrypt
import jwt
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Annotated
from datetime import datetime, timezone, timedelta, date


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"
JWT_DAYS = 30
MASTER_USERNAME = os.environ['MASTER_USERNAME'].lower().strip()
MASTER_PASSWORD = os.environ['MASTER_PASSWORD']

app = FastAPI()
api_router = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8")[:72], hashed.encode("utf-8"))
    except Exception:
        return False


def make_token(user: dict) -> str:
    payload = {
        "sub": user["id"],
        "username": user["username"],
        "role": user["role"],
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "username": u["username"],
        "role": u["role"],
        "first_name": u.get("first_name", ""),
        "surname": u.get("surname", ""),
        "active": u.get("active", True),
    }


def make_username(first_name: str, surname: str) -> str:
    fn = first_name.strip()
    sn = surname.strip().lower().replace(" ", "")
    if not fn or not sn:
        raise HTTPException(400, "Nome e cognome sono obbligatori")
    return f"{fn[0].lower()}.{sn}"


async def current_user(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer)]
) -> dict:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Non autenticato")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token non valido o scaduto")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user or not user.get("active", True):
        raise HTTPException(status_code=401, detail="Utente inattivo o inesistente")
    return user


async def master_only(user: Annotated[dict, Depends(current_user)]) -> dict:
    if user["role"] != "master":
        raise HTTPException(status_code=403, detail="Accesso riservato al master")
    return user


# ----------------------------------------------------------------------------
# Models
# ----------------------------------------------------------------------------
class LoginIn(BaseModel):
    username: str
    password: str


class OfficialCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=60)
    surname: str = Field(min_length=1, max_length=60)
    password: str = Field(min_length=4, max_length=128)


class OfficialUpdate(BaseModel):
    first_name: Optional[str] = None
    surname: Optional[str] = None
    password: Optional[str] = None
    active: Optional[bool] = None


class CompetitionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=140)
    start_date: str  # YYYY-MM-DD
    end_date: str
    address: str = Field(min_length=1, max_length=240)
    notes: Optional[str] = ""
    required_officials: int = Field(ge=0, le=999, default=0)


class CompetitionUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    required_officials: Optional[int] = None


class RespondIn(BaseModel):
    status: str  # available | unavailable


class ConfirmIn(BaseModel):
    official_ids: List[str]


class AttendanceRecord(BaseModel):
    official_id: str
    attended: bool


class AttendanceIn(BaseModel):
    records: List[AttendanceRecord]


class SettingsIn(BaseModel):
    days_before: int = Field(ge=0, le=365)
    reminder_days_before: int = Field(ge=0, le=365, default=1)


# ----------------------------------------------------------------------------
# Notification helper
# ----------------------------------------------------------------------------
async def push_notification(user_id: str, ntype: str, title: str, body: str,
                            competition_id: Optional[str] = None):
    await db.notifications.insert_one({
        "id": new_id(),
        "user_id": user_id,
        "type": ntype,
        "title": title,
        "body": body,
        "competition_id": competition_id,
        "read": False,
        "created_at": now_iso(),
    })


async def get_settings() -> dict:
    s = await db.settings.find_one({"id": "global"})
    if not s:
        s = {"id": "global", "days_before": 7, "reminder_days_before": 1}
        await db.settings.insert_one(s)
    return {
        "days_before": s.get("days_before", 7),
        "reminder_days_before": s.get("reminder_days_before", 1),
    }


async def ensure_requests_sent():
    """Lazily send availability requests for competitions whose request window
    has opened (today >= start_date - days_before). Simulates a scheduler."""
    settings = await get_settings()
    days_before = settings["days_before"]
    today = date.today()
    comps = await db.competitions.find(
        {"deleted_at": None, "request_sent": False}
    ).to_list(1000)
    for comp in comps:
        try:
            start = date.fromisoformat(comp["start_date"])
        except Exception:
            continue
        if today >= (start - timedelta(days=days_before)):
            await _dispatch_requests(comp)


async def _dispatch_requests(comp: dict):
    officials = await db.users.find({"role": "official", "active": True}).to_list(1000)
    for off in officials:
        exists = await db.availabilities.find_one(
            {"competition_id": comp["id"], "official_id": off["id"]}
        )
        if exists:
            continue
        await db.availabilities.insert_one({
            "id": new_id(),
            "competition_id": comp["id"],
            "official_id": off["id"],
            "status": "pending",
            "confirmed": False,
            "attended": None,
            "responded_at": None,
            "confirmed_at": None,
            "created_at": now_iso(),
        })
        await push_notification(
            off["id"], "availability_request",
            "Richiesta disponibilità",
            f"È richiesta la tua disponibilità per «{comp['name']}» il {comp['start_date']}.",
            comp["id"],
        )
    await db.competitions.update_one(
        {"id": comp["id"]}, {"$set": {"request_sent": True, "request_sent_at": now_iso()}}
    )


async def ensure_reminders_sent():
    """Send a reminder to confirmed officials N days before the competition."""
    settings = await get_settings()
    reminder_days = settings["reminder_days_before"]
    today = date.today()
    comps = await db.competitions.find(
        {"deleted_at": None, "request_sent": True, "reminder_sent": {"$ne": True}}
    ).to_list(1000)
    for comp in comps:
        try:
            start = date.fromisoformat(comp["start_date"])
        except Exception:
            continue
        if start >= today and today >= (start - timedelta(days=reminder_days)):
            confirmed = await db.availabilities.find(
                {"competition_id": comp["id"], "confirmed": True}
            ).to_list(1000)
            # Only latch the flag once we actually have someone to remind,
            # otherwise reminders would be lost if the window opens before
            # the master confirms any official.
            if not confirmed:
                continue
            for a in confirmed:
                await push_notification(
                    a["official_id"], "reminder",
                    "Promemoria gara",
                    f"La gara «{comp['name']}» è in programma il {comp['start_date']}. "
                    f"Ricordati di presentarti all'indirizzo: {comp['address']}.",
                    comp["id"],
                )
            await db.competitions.update_one(
                {"id": comp["id"]},
                {"$set": {"reminder_sent": True, "reminder_sent_at": now_iso()}},
            )


# ----------------------------------------------------------------------------
# Auth routes
# ----------------------------------------------------------------------------
@api_router.post("/auth/login")
async def login(body: LoginIn):
    username = body.username.lower().strip()
    user = await db.users.find_one({"username": username, "deleted_at": None})
    if not user or not verify_password(body.password, user["password_hash"]) \
            or not user.get("active", True):
        raise HTTPException(status_code=401, detail="Username o password errati")
    return {"token": make_token(user), "user": public_user(user)}


@api_router.get("/auth/me")
async def me(user: Annotated[dict, Depends(current_user)]):
    return public_user(user)


# ----------------------------------------------------------------------------
# Settings (master)
# ----------------------------------------------------------------------------
@api_router.get("/settings")
async def read_settings(_: Annotated[dict, Depends(master_only)]):
    return await get_settings()


@api_router.put("/settings")
async def update_settings(body: SettingsIn, _: Annotated[dict, Depends(master_only)]):
    await db.settings.update_one(
        {"id": "global"},
        {"$set": {
            "days_before": body.days_before,
            "reminder_days_before": body.reminder_days_before,
        }},
        upsert=True,
    )
    return await get_settings()


# ----------------------------------------------------------------------------
# Officials (master)
# ----------------------------------------------------------------------------
@api_router.get("/officials")
async def list_officials(_: Annotated[dict, Depends(master_only)]):
    officials = await db.users.find(
        {"role": "official", "deleted_at": None}
    ).sort("surname", 1).to_list(1000)
    return [public_user(o) for o in officials]


@api_router.post("/officials", status_code=201)
async def create_official(body: OfficialCreate, _: Annotated[dict, Depends(master_only)]):
    username = make_username(body.first_name, body.surname)
    if await db.users.find_one({"username": username, "deleted_at": None}):
        raise HTTPException(409, f"Username «{username}» già esistente")
    doc = {
        "id": new_id(),
        "username": username,
        "role": "official",
        "first_name": body.first_name.strip(),
        "surname": body.surname.strip(),
        "password_hash": hash_password(body.password),
        "active": True,
        "deleted_at": None,
        "created_at": now_iso(),
    }
    try:
        await db.users.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(409, f"Username «{username}» già esistente")
    return public_user(doc)


@api_router.patch("/officials/{official_id}")
async def update_official(official_id: str, body: OfficialUpdate,
                          _: Annotated[dict, Depends(master_only)]):
    user = await db.users.find_one({"id": official_id, "role": "official", "deleted_at": None})
    if not user:
        raise HTTPException(404, "Ufficiale non trovato")
    updates = {}
    fn = body.first_name if body.first_name is not None else user["first_name"]
    sn = body.surname if body.surname is not None else user["surname"]
    if body.first_name is not None or body.surname is not None:
        new_username = make_username(fn, sn)
        if new_username != user["username"] and await db.users.find_one(
            {"username": new_username, "deleted_at": None}
        ):
            raise HTTPException(409, f"Username «{new_username}» già esistente")
        updates["first_name"] = fn.strip()
        updates["surname"] = sn.strip()
        updates["username"] = new_username
    if body.password:
        updates["password_hash"] = hash_password(body.password)
    if body.active is not None:
        updates["active"] = body.active
    if updates:
        await db.users.update_one({"id": official_id}, {"$set": updates})
    user = await db.users.find_one({"id": official_id})
    return public_user(user)


@api_router.delete("/officials/{official_id}")
async def delete_official(official_id: str, _: Annotated[dict, Depends(master_only)]):
    user = await db.users.find_one({"id": official_id, "role": "official", "deleted_at": None})
    if not user:
        raise HTTPException(404, "Ufficiale non trovato")
    await db.users.update_one(
        {"id": official_id},
        {"$set": {"deleted_at": now_iso(), "active": False}},
    )
    return {"ok": True}


# ----------------------------------------------------------------------------
# Competitions (master)
# ----------------------------------------------------------------------------
async def competition_summary(comp: dict) -> dict:
    avails = await db.availabilities.find({"competition_id": comp["id"]}).to_list(1000)
    available = sum(1 for a in avails if a["status"] == "available")
    confirmed = sum(1 for a in avails if a.get("confirmed"))
    pending = sum(1 for a in avails if a["status"] == "pending")
    unavailable = sum(1 for a in avails if a["status"] == "unavailable")
    present = sum(1 for a in avails if a.get("attended") is True)
    return {
        "id": comp["id"],
        "name": comp["name"],
        "start_date": comp["start_date"],
        "end_date": comp["end_date"],
        "address": comp["address"],
        "notes": comp.get("notes", ""),
        "required_officials": comp.get("required_officials", 0),
        "request_sent": comp.get("request_sent", False),
        "created_at": comp.get("created_at"),
        "total_requests": len(avails),
        "available_count": available,
        "confirmed_count": confirmed,
        "pending_count": pending,
        "unavailable_count": unavailable,
        "present_count": present,
    }


@api_router.get("/competitions")
async def list_competitions(_: Annotated[dict, Depends(master_only)]):
    await ensure_requests_sent()
    await ensure_reminders_sent()
    comps = await db.competitions.find({"deleted_at": None}).sort("start_date", 1).to_list(1000)
    return [await competition_summary(c) for c in comps]


@api_router.post("/competitions", status_code=201)
async def create_competition(body: CompetitionCreate, _: Annotated[dict, Depends(master_only)]):
    doc = {
        "id": new_id(),
        "name": body.name.strip(),
        "start_date": body.start_date,
        "end_date": body.end_date,
        "address": body.address.strip(),
        "notes": (body.notes or "").strip(),
        "required_officials": body.required_officials,
        "request_sent": False,
        "deleted_at": None,
        "created_at": now_iso(),
    }
    await db.competitions.insert_one(doc)
    await ensure_requests_sent()
    comp = await db.competitions.find_one({"id": doc["id"]})
    return await competition_summary(comp)


@api_router.get("/competitions/{comp_id}")
async def get_competition(comp_id: str, _: Annotated[dict, Depends(master_only)]):
    comp = await db.competitions.find_one({"id": comp_id, "deleted_at": None})
    if not comp:
        raise HTTPException(404, "Gara non trovata")
    return await competition_summary(comp)


@api_router.patch("/competitions/{comp_id}")
async def update_competition(comp_id: str, body: CompetitionUpdate,
                             _: Annotated[dict, Depends(master_only)]):
    comp = await db.competitions.find_one({"id": comp_id, "deleted_at": None})
    if not comp:
        raise HTTPException(404, "Gara non trovata")
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if "name" in updates:
        updates["name"] = updates["name"].strip()
    if "address" in updates:
        updates["address"] = updates["address"].strip()
    if updates:
        await db.competitions.update_one({"id": comp_id}, {"$set": updates})
    comp = await db.competitions.find_one({"id": comp_id})
    return await competition_summary(comp)


@api_router.delete("/competitions/{comp_id}")
async def delete_competition(comp_id: str, _: Annotated[dict, Depends(master_only)]):
    res = await db.competitions.update_one(
        {"id": comp_id}, {"$set": {"deleted_at": now_iso()}}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Gara non trovata")
    return {"ok": True}


@api_router.post("/competitions/{comp_id}/send-request")
async def send_request(comp_id: str, _: Annotated[dict, Depends(master_only)]):
    comp = await db.competitions.find_one({"id": comp_id, "deleted_at": None})
    if not comp:
        raise HTTPException(404, "Gara non trovata")
    await _dispatch_requests(comp)
    comp = await db.competitions.find_one({"id": comp_id})
    return await competition_summary(comp)


@api_router.get("/competitions/{comp_id}/availabilities")
async def competition_availabilities(comp_id: str, _: Annotated[dict, Depends(master_only)]):
    comp = await db.competitions.find_one({"id": comp_id, "deleted_at": None})
    if not comp:
        raise HTTPException(404, "Gara non trovata")
    avails = await db.availabilities.find({"competition_id": comp_id}).to_list(1000)
    avail_by_off = {a["official_id"]: a for a in avails}
    # Include ALL active officials so the master can convoke anyone directly,
    # even those who have not (yet) declared their availability.
    officials = await db.users.find(
        {"role": "official", "active": True, "deleted_at": None}
    ).to_list(1000)
    result = []
    for off in officials:
        a = avail_by_off.get(off["id"])
        result.append({
            "id": a["id"] if a else off["id"],
            "official_id": off["id"],
            "official_name": f"{off['first_name']} {off['surname']}",
            "username": off["username"],
            "status": a["status"] if a else "not_requested",
            "confirmed": a.get("confirmed", False) if a else False,
            "attended": a.get("attended") if a else None,
            "responded_at": a.get("responded_at") if a else None,
        })
    order = {"available": 0, "convoked": 1, "pending": 2, "not_requested": 3, "unavailable": 4}
    result.sort(key=lambda r: (order.get(r["status"], 9), r["official_name"]))
    return result


@api_router.post("/competitions/{comp_id}/confirm")
async def confirm_officials(comp_id: str, body: ConfirmIn,
                            _: Annotated[dict, Depends(master_only)]):
    comp = await db.competitions.find_one({"id": comp_id, "deleted_at": None})
    if not comp:
        raise HTTPException(404, "Gara non trovata")
    avails = await db.availabilities.find({"competition_id": comp_id}).to_list(1000)
    avail_by_off = {a["official_id"]: a for a in avails}
    selected = set(body.official_ids)

    async def notify_confirm(official_id: str, direct: bool):
        title = "Sei stato convocato!" if direct else "Presenza confermata!"
        await push_notification(
            official_id, "confirmation", title,
            f"Sei convocato per «{comp['name']}» il {comp['start_date']}. "
            f"Presentati all'indirizzo: {comp['address']}.",
            comp["id"],
        )

    # Confirm / convoke selected officials (create a record if none exists).
    for off_id in selected:
        a = avail_by_off.get(off_id)
        if a:
            if not a.get("confirmed"):
                await db.availabilities.update_one(
                    {"id": a["id"]},
                    {"$set": {"confirmed": True, "confirmed_at": now_iso()}},
                )
                await notify_confirm(off_id, a["status"] not in ("available",))
        else:
            off = await db.users.find_one(
                {"id": off_id, "role": "official", "active": True, "deleted_at": None}
            )
            if not off:
                continue
            await db.availabilities.insert_one({
                "id": new_id(),
                "competition_id": comp_id,
                "official_id": off_id,
                "status": "convoked",
                "confirmed": True,
                "attended": None,
                "responded_at": None,
                "confirmed_at": now_iso(),
                "created_at": now_iso(),
            })
            await notify_confirm(off_id, True)

    # Un-confirm officials that were removed from the selection.
    for a in avails:
        if a["official_id"] not in selected and a.get("confirmed"):
            if a.get("status") == "convoked":
                # purely-convoked (no real response) -> drop the record entirely
                await db.availabilities.delete_one({"id": a["id"]})
            else:
                await db.availabilities.update_one(
                    {"id": a["id"]},
                    {"$set": {"confirmed": False, "confirmed_at": None}},
                )
    comp = await db.competitions.find_one({"id": comp_id})
    return await competition_summary(comp)


@api_router.post("/competitions/{comp_id}/attendance")
async def record_attendance(comp_id: str, body: AttendanceIn,
                            _: Annotated[dict, Depends(master_only)]):
    comp = await db.competitions.find_one({"id": comp_id, "deleted_at": None})
    if not comp:
        raise HTTPException(404, "Gara non trovata")
    for rec in body.records:
        await db.availabilities.update_one(
            {"competition_id": comp_id, "official_id": rec.official_id},
            {"$set": {"attended": rec.attended}},
        )
    return {"ok": True}


@api_router.get("/competitions/{comp_id}/report")
async def competition_report(comp_id: str, _: Annotated[dict, Depends(master_only)]):
    comp = await db.competitions.find_one({"id": comp_id, "deleted_at": None})
    if not comp:
        raise HTTPException(404, "Gara non trovata")
    avails = await db.availabilities.find(
        {"competition_id": comp_id, "confirmed": True}
    ).to_list(1000)
    officials = []
    present = 0
    for a in avails:
        off = await db.users.find_one({"id": a["official_id"]})
        if not off:
            continue
        attended = a.get("attended") is True
        if attended:
            present += 1
        officials.append({
            "official_name": f"{off['first_name']} {off['surname']}",
            "username": off["username"],
            "attended": attended,
        })
    officials.sort(key=lambda r: r["official_name"])
    return {
        "id": comp["id"],
        "name": comp["name"],
        "start_date": comp["start_date"],
        "end_date": comp["end_date"],
        "address": comp["address"],
        "notes": comp.get("notes", ""),
        "confirmed_count": len(officials),
        "present_count": present,
        "absent_count": len(officials) - present,
        "officials": officials,
    }


# ----------------------------------------------------------------------------
# Official-facing routes
# ----------------------------------------------------------------------------
async def official_availability_view(a: dict) -> dict:
    comp = await db.competitions.find_one({"id": a["competition_id"], "deleted_at": None})
    if not comp:
        return None
    return {
        "availability_id": a["id"],
        "competition_id": comp["id"],
        "name": comp["name"],
        "start_date": comp["start_date"],
        "end_date": comp["end_date"],
        "address": comp["address"],
        "notes": comp.get("notes", ""),
        "status": a["status"],
        "confirmed": a.get("confirmed", False),
        "attended": a.get("attended"),
    }


@api_router.get("/my/requests")
async def my_requests(user: Annotated[dict, Depends(current_user)]):
    if user["role"] != "official":
        return []
    await ensure_requests_sent()
    avails = await db.availabilities.find(
        {"official_id": user["id"], "status": "pending"}
    ).to_list(1000)
    out = []
    for a in avails:
        v = await official_availability_view(a)
        if v:
            out.append(v)
    out.sort(key=lambda r: r["start_date"])
    return out


@api_router.get("/my/competitions")
async def my_competitions(user: Annotated[dict, Depends(current_user)]):
    if user["role"] != "official":
        return []
    await ensure_requests_sent()
    avails = await db.availabilities.find(
        {"official_id": user["id"]}
    ).to_list(1000)
    out = []
    for a in avails:
        if a["status"] == "pending":
            continue
        v = await official_availability_view(a)
        if v:
            out.append(v)
    out.sort(key=lambda r: r["start_date"])
    return out


@api_router.get("/my/stats")
async def my_stats(user: Annotated[dict, Depends(current_user)]):
    if user["role"] != "official":
        return {"confirmed": 0, "present": 0, "absent": 0, "percentage": 0}
    avails = await db.availabilities.find(
        {"official_id": user["id"], "confirmed": True}
    ).to_list(1000)
    total = len(avails)
    present = sum(1 for a in avails if a.get("attended") is True)
    recorded = sum(1 for a in avails if a.get("attended") is not None)
    percentage = round((present / recorded) * 100) if recorded else 0
    return {
        "confirmed": total,
        "present": present,
        "absent": recorded - present,
        "percentage": percentage,
    }


@api_router.post("/availabilities/{avail_id}/respond")
async def respond_availability(avail_id: str, body: RespondIn,
                               user: Annotated[dict, Depends(current_user)]):
    if body.status not in ("available", "unavailable"):
        raise HTTPException(400, "Stato non valido")
    a = await db.availabilities.find_one({"id": avail_id, "official_id": user["id"]})
    if not a:
        raise HTTPException(404, "Richiesta non trovata")
    await db.availabilities.update_one(
        {"id": avail_id},
        {"$set": {"status": body.status, "responded_at": now_iso()}},
    )
    comp = await db.competitions.find_one({"id": a["competition_id"]})
    if comp:
        master = await db.users.find_one({"role": "master"})
        label = "disponibile" if body.status == "available" else "NON disponibile"
        if master:
            await push_notification(
                master["id"], "response",
                "Risposta disponibilità",
                f"{user['first_name']} {user['surname']} è {label} per «{comp['name']}».",
                comp["id"],
            )
    a = await db.availabilities.find_one({"id": avail_id})
    return await official_availability_view(a)


# ----------------------------------------------------------------------------
# Notifications
# ----------------------------------------------------------------------------
@api_router.get("/notifications")
async def list_notifications(user: Annotated[dict, Depends(current_user)]):
    if user["role"] == "official":
        await ensure_requests_sent()
    await ensure_reminders_sent()
    notifs = await db.notifications.find(
        {"user_id": user["id"]}
    ).sort("created_at", -1).to_list(200)
    return [{
        "id": n["id"],
        "type": n["type"],
        "title": n["title"],
        "body": n["body"],
        "competition_id": n.get("competition_id"),
        "read": n.get("read", False),
        "created_at": n["created_at"],
    } for n in notifs]


@api_router.get("/notifications/unread-count")
async def unread_count(user: Annotated[dict, Depends(current_user)]):
    if user["role"] == "official":
        await ensure_requests_sent()
    await ensure_reminders_sent()
    count = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return {"count": count}


@api_router.post("/notifications/{notif_id}/read")
async def mark_read(notif_id: str, user: Annotated[dict, Depends(current_user)]):
    await db.notifications.update_one(
        {"id": notif_id, "user_id": user["id"]}, {"$set": {"read": True}}
    )
    return {"ok": True}


@api_router.post("/notifications/read-all")
async def mark_all_read(user: Annotated[dict, Depends(current_user)]):
    await db.notifications.update_many(
        {"user_id": user["id"], "read": False}, {"$set": {"read": True}}
    )
    return {"ok": True}


@api_router.get("/")
async def root():
    return {"message": "GaraMaster API"}


# ----------------------------------------------------------------------------
# Startup: seed master + indexes
# ----------------------------------------------------------------------------
@app.on_event("startup")
async def seed_master():
    # Username is unique only among non-deleted users (partial index), so a
    # soft-deleted official's username can be reused when re-created.
    try:
        await db.users.drop_index("username_1")
    except Exception:
        pass
    await db.users.create_index(
        "username",
        unique=True,
        partialFilterExpression={"deleted_at": None},
    )
    await db.users.create_index("id", unique=True)
    existing = await db.users.find_one({"username": MASTER_USERNAME})
    if not existing:
        await db.users.insert_one({
            "id": new_id(),
            "username": MASTER_USERNAME,
            "role": "master",
            "first_name": "Master",
            "surname": "Admin",
            "password_hash": hash_password(MASTER_PASSWORD),
            "active": True,
            "deleted_at": None,
            "created_at": now_iso(),
        })
        logger.info("Master user seeded: %s", MASTER_USERNAME)
    await get_settings()


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
