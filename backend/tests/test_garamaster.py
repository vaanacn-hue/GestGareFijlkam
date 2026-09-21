"""GaraMaster backend API tests"""
import os
import pytest
import requests
from datetime import date, timedelta

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://gara-presence-app.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

MASTER_USER = "master"
MASTER_PASS = "GaraMaster2026!"
OFFICIAL_USER = "m.rossi"
OFFICIAL_PASS = "test1234"


@pytest.fixture(scope="session")
def master_token():
    r = requests.post(f"{API}/auth/login", json={"username": MASTER_USER, "password": MASTER_PASS})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def master_headers(master_token):
    return {"Authorization": f"Bearer {master_token}"}


@pytest.fixture(scope="session")
def official_token():
    r = requests.post(f"{API}/auth/login", json={"username": OFFICIAL_USER, "password": OFFICIAL_PASS})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def official_headers(official_token):
    return {"Authorization": f"Bearer {official_token}"}


# --- Auth ---
class TestAuth:
    def test_login_master(self):
        r = requests.post(f"{API}/auth/login", json={"username": MASTER_USER, "password": MASTER_PASS})
        assert r.status_code == 200
        data = r.json()
        assert "token" in data and data["user"]["role"] == "master"

    def test_login_bad_pass(self):
        r = requests.post(f"{API}/auth/login", json={"username": MASTER_USER, "password": "wrong"})
        assert r.status_code == 401

    def test_me_master(self, master_headers):
        r = requests.get(f"{API}/auth/me", headers=master_headers)
        assert r.status_code == 200
        assert r.json()["role"] == "master"

    def test_me_official(self, official_headers):
        r = requests.get(f"{API}/auth/me", headers=official_headers)
        assert r.status_code == 200
        assert r.json()["role"] == "official"

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# --- Settings (RBAC) ---
class TestSettings:
    def test_get_settings_master(self, master_headers):
        r = requests.get(f"{API}/settings", headers=master_headers)
        assert r.status_code == 200
        assert "days_before" in r.json()

    def test_get_settings_official_403(self, official_headers):
        r = requests.get(f"{API}/settings", headers=official_headers)
        assert r.status_code == 403

    def test_put_settings(self, master_headers):
        r = requests.put(f"{API}/settings", headers=master_headers, json={"days_before": 5})
        assert r.status_code == 200
        assert r.json()["days_before"] == 5
        # restore
        requests.put(f"{API}/settings", headers=master_headers, json={"days_before": 7})


# --- Officials ---
class TestOfficials:
    created_id = None

    def test_list_officials_master(self, master_headers):
        r = requests.get(f"{API}/officials", headers=master_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_officials_official_403(self, official_headers):
        r = requests.get(f"{API}/officials", headers=official_headers)
        assert r.status_code == 403

    def test_create_official_and_verify(self, master_headers):
        payload = {"first_name": "Luca", "surname": "Bianchi", "password": "test1234"}
        # cleanup possible previous run
        listing = requests.get(f"{API}/officials", headers=master_headers).json()
        for o in listing:
            if o["username"] == "l.bianchi":
                requests.delete(f"{API}/officials/{o['id']}", headers=master_headers)
        r = requests.post(f"{API}/officials", headers=master_headers, json=payload)
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["username"] == "l.bianchi"
        TestOfficials.created_id = data["id"]
        # verify via list
        listing = requests.get(f"{API}/officials", headers=master_headers).json()
        assert any(o["username"] == "l.bianchi" for o in listing)

    def test_create_duplicate_409(self, master_headers):
        r = requests.post(f"{API}/officials", headers=master_headers,
                          json={"first_name": "Luca", "surname": "Bianchi", "password": "x"})
        assert r.status_code == 409

    def test_patch_official_toggle_active(self, master_headers):
        oid = TestOfficials.created_id
        r = requests.patch(f"{API}/officials/{oid}", headers=master_headers, json={"active": False})
        assert r.status_code == 200
        assert r.json()["active"] is False
        r = requests.patch(f"{API}/officials/{oid}", headers=master_headers, json={"active": True})
        assert r.json()["active"] is True

    def test_delete_official(self, master_headers):
        oid = TestOfficials.created_id
        r = requests.delete(f"{API}/officials/{oid}", headers=master_headers)
        assert r.status_code == 200
        # verify not in list
        listing = requests.get(f"{API}/officials", headers=master_headers).json()
        assert not any(o["id"] == oid for o in listing)


# --- Competitions + full flow ---
class TestCompetitionFlow:
    comp_id = None

    def test_create_competition_today(self, master_headers):
        today = date.today().isoformat()
        end = (date.today() + timedelta(days=1)).isoformat()
        r = requests.post(f"{API}/competitions", headers=master_headers, json={
            "name": "TEST_Torneo",
            "start_date": today,
            "end_date": end,
            "address": "Via Roma 1, Milano",
            "notes": "test"
        })
        assert r.status_code == 201, r.text
        data = r.json()
        TestCompetitionFlow.comp_id = data["id"]
        # since start_date=today, requests should have been auto-dispatched
        assert data["request_sent"] is True

    def test_get_competition(self, master_headers):
        r = requests.get(f"{API}/competitions/{TestCompetitionFlow.comp_id}", headers=master_headers)
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Torneo"

    def test_list_competitions(self, master_headers):
        r = requests.get(f"{API}/competitions", headers=master_headers)
        assert r.status_code == 200
        assert any(c["id"] == TestCompetitionFlow.comp_id for c in r.json())

    def test_patch_competition(self, master_headers):
        r = requests.patch(f"{API}/competitions/{TestCompetitionFlow.comp_id}",
                           headers=master_headers, json={"notes": "aggiornato"})
        assert r.status_code == 200
        r2 = requests.get(f"{API}/competitions/{TestCompetitionFlow.comp_id}", headers=master_headers)
        assert r2.json()["notes"] == "aggiornato"

    def test_competitions_official_403(self, official_headers):
        r = requests.get(f"{API}/competitions", headers=official_headers)
        assert r.status_code == 403

    def test_official_my_requests_has_pending(self, official_headers):
        r = requests.get(f"{API}/my/requests", headers=official_headers)
        assert r.status_code == 200
        reqs = r.json()
        assert any(x["competition_id"] == TestCompetitionFlow.comp_id for x in reqs), "No pending request for m.rossi"

    def test_official_respond_available(self, official_headers):
        r = requests.get(f"{API}/my/requests", headers=official_headers).json()
        target = [x for x in r if x["competition_id"] == TestCompetitionFlow.comp_id][0]
        avail_id = target["availability_id"]
        rr = requests.post(f"{API}/availabilities/{avail_id}/respond",
                           headers=official_headers, json={"status": "available"})
        assert rr.status_code == 200
        assert rr.json()["status"] == "available"

    def test_master_sees_availability(self, master_headers):
        r = requests.get(f"{API}/competitions/{TestCompetitionFlow.comp_id}/availabilities",
                         headers=master_headers)
        assert r.status_code == 200
        avails = r.json()
        mine = [a for a in avails if a["username"] == "m.rossi"]
        assert mine and mine[0]["status"] == "available"

    def test_confirm_official(self, master_headers):
        avails = requests.get(f"{API}/competitions/{TestCompetitionFlow.comp_id}/availabilities",
                              headers=master_headers).json()
        mrossi = [a for a in avails if a["username"] == "m.rossi"][0]
        r = requests.post(f"{API}/competitions/{TestCompetitionFlow.comp_id}/confirm",
                          headers=master_headers, json={"official_ids": [mrossi["official_id"]]})
        assert r.status_code == 200
        assert r.json()["confirmed_count"] >= 1

    def test_confirmation_notification_for_official(self, official_headers):
        r = requests.get(f"{API}/notifications", headers=official_headers)
        assert r.status_code == 200
        notifs = r.json()
        assert any(n["type"] == "confirmation" and n["competition_id"] == TestCompetitionFlow.comp_id
                   for n in notifs)

    def test_record_attendance(self, master_headers):
        avails = requests.get(f"{API}/competitions/{TestCompetitionFlow.comp_id}/availabilities",
                              headers=master_headers).json()
        mrossi = [a for a in avails if a["username"] == "m.rossi"][0]
        r = requests.post(f"{API}/competitions/{TestCompetitionFlow.comp_id}/attendance",
                          headers=master_headers,
                          json={"records": [{"official_id": mrossi["official_id"], "attended": True}]})
        assert r.status_code == 200
        avails2 = requests.get(f"{API}/competitions/{TestCompetitionFlow.comp_id}/availabilities",
                               headers=master_headers).json()
        mrossi2 = [a for a in avails2 if a["username"] == "m.rossi"][0]
        assert mrossi2["attended"] is True

    def test_official_my_competitions(self, official_headers):
        r = requests.get(f"{API}/my/competitions", headers=official_headers)
        assert r.status_code == 200
        assert any(c["competition_id"] == TestCompetitionFlow.comp_id and c["confirmed"] for c in r.json())

    def test_send_request_idempotent(self, master_headers):
        r = requests.post(f"{API}/competitions/{TestCompetitionFlow.comp_id}/send-request",
                          headers=master_headers)
        assert r.status_code == 200

    def test_delete_competition(self, master_headers):
        r = requests.delete(f"{API}/competitions/{TestCompetitionFlow.comp_id}", headers=master_headers)
        assert r.status_code == 200
        r2 = requests.get(f"{API}/competitions/{TestCompetitionFlow.comp_id}", headers=master_headers)
        assert r2.status_code == 404


# --- Notifications ---
class TestNotifications:
    def test_list_notifications(self, master_headers):
        r = requests.get(f"{API}/notifications", headers=master_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_unread_count(self, master_headers):
        r = requests.get(f"{API}/notifications/unread-count", headers=master_headers)
        assert r.status_code == 200
        assert "count" in r.json()

    def test_mark_all_read(self, master_headers):
        r = requests.post(f"{API}/notifications/read-all", headers=master_headers)
        assert r.status_code == 200
        r2 = requests.get(f"{API}/notifications/unread-count", headers=master_headers)
        assert r2.json()["count"] == 0

    def test_official_notifications(self, official_headers):
        r = requests.get(f"{API}/notifications", headers=official_headers)
        assert r.status_code == 200
