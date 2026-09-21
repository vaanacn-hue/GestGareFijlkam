"""GaraMaster backend API tests"""
import os
import uuid
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
        requests.put(f"{API}/settings", headers=master_headers,
                     json={"days_before": 7, "reminder_days_before": 1})

    # iter3: reminder_days_before persisted + returned
    def test_get_settings_includes_reminder_days(self, master_headers):
        r = requests.get(f"{API}/settings", headers=master_headers)
        assert r.status_code == 200
        assert "reminder_days_before" in r.json()

    def test_put_settings_both_fields(self, master_headers):
        r = requests.put(f"{API}/settings", headers=master_headers,
                         json={"days_before": 10, "reminder_days_before": 3})
        assert r.status_code == 200
        d = r.json()
        assert d["days_before"] == 10 and d["reminder_days_before"] == 3
        # verify persistence via GET
        r2 = requests.get(f"{API}/settings", headers=master_headers).json()
        assert r2["days_before"] == 10 and r2["reminder_days_before"] == 3
        # restore
        requests.put(f"{API}/settings", headers=master_headers,
                     json={"days_before": 7, "reminder_days_before": 1})


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

    # Use a per-session unique surname to avoid collisions with soft-deleted leftovers
    # (backend does not filter deleted_at when checking username uniqueness — see bug).
    unique_surname = f"bianchi{uuid.uuid4().hex[:6]}"

    def test_create_official_and_verify(self, master_headers):
        expected_user = f"l.{TestOfficials.unique_surname}"
        payload = {"first_name": "Luca", "surname": TestOfficials.unique_surname, "password": "test1234"}
        r = requests.post(f"{API}/officials", headers=master_headers, json=payload)
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["username"] == expected_user
        TestOfficials.created_id = data["id"]
        listing = requests.get(f"{API}/officials", headers=master_headers).json()
        assert any(o["username"] == expected_user for o in listing)

    def test_create_duplicate_409(self, master_headers):
        r = requests.post(f"{API}/officials", headers=master_headers,
                          json={"first_name": "Luca", "surname": TestOfficials.unique_surname, "password": "test1234"})
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



# --- Iteration 2: Report, Reminder, Officials rename/password-reset/soft-delete ---
class TestOfficialsAdvanced:
    """Rename regenerates username, password reset works, soft-delete removes from list."""
    created_id = None
    _sfx = uuid.uuid4().hex[:6]
    surname_a = f"verdi{_sfx}"   # -> g.verdi<sfx>
    surname_b = f"neri{_sfx}"    # -> g.neri<sfx>

    def test_create_for_rename(self, master_headers):
        r = requests.post(f"{API}/officials", headers=master_headers,
                          json={"first_name": "Giulia", "surname": TestOfficialsAdvanced.surname_a,
                                "password": "test1234"})
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["username"] == f"g.{TestOfficialsAdvanced.surname_a}"
        TestOfficialsAdvanced.created_id = d["id"]

    def test_rename_regenerates_username(self, master_headers):
        oid = TestOfficialsAdvanced.created_id
        r = requests.patch(f"{API}/officials/{oid}", headers=master_headers,
                           json={"first_name": "Giulia", "surname": TestOfficialsAdvanced.surname_b})
        assert r.status_code == 200, r.text
        assert r.json()["username"] == f"g.{TestOfficialsAdvanced.surname_b}"
        # login with old username should fail
        old = requests.post(f"{API}/auth/login",
                            json={"username": f"g.{TestOfficialsAdvanced.surname_a}", "password": "test1234"})
        assert old.status_code == 401

    def test_password_reset_login(self, master_headers):
        oid = TestOfficialsAdvanced.created_id
        r = requests.patch(f"{API}/officials/{oid}", headers=master_headers,
                           json={"password": "newpass99"})
        assert r.status_code == 200
        login = requests.post(f"{API}/auth/login",
                              json={"username": f"g.{TestOfficialsAdvanced.surname_b}", "password": "newpass99"})
        assert login.status_code == 200, login.text

    def test_soft_delete_removes_from_list(self, master_headers):
        oid = TestOfficialsAdvanced.created_id
        r = requests.delete(f"{API}/officials/{oid}", headers=master_headers)
        assert r.status_code == 200
        listing = requests.get(f"{API}/officials", headers=master_headers).json()
        assert not any(o["id"] == oid for o in listing)
        login = requests.post(f"{API}/auth/login",
                              json={"username": f"g.{TestOfficialsAdvanced.surname_b}", "password": "newpass99"})
        assert login.status_code == 401


class TestReportAndReminder:
    """Full flow to verify /report endpoint and reminder notifications."""
    comp_id = None

    def test_setup_comp_and_confirm(self, master_headers, official_headers):
        today = date.today().isoformat()
        end = (date.today() + timedelta(days=1)).isoformat()
        r = requests.post(f"{API}/competitions", headers=master_headers, json={
            "name": "TEST_ReportGara",
            "start_date": today,
            "end_date": end,
            "address": "Palazzetto via Test 5, Roma",
            "notes": "iter2",
        })
        assert r.status_code == 201, r.text
        TestReportAndReminder.comp_id = r.json()["id"]

        # mark all master notifications read so reminder count assertion is deterministic
        reqs = requests.get(f"{API}/my/requests", headers=official_headers).json()
        target = [x for x in reqs if x["competition_id"] == TestReportAndReminder.comp_id]
        assert target, "Auto-dispatch failed to create availability for m.rossi"
        avail_id = target[0]["availability_id"]
        rr = requests.post(f"{API}/availabilities/{avail_id}/respond",
                           headers=official_headers, json={"status": "available"})
        assert rr.status_code == 200

        avails = requests.get(f"{API}/competitions/{TestReportAndReminder.comp_id}/availabilities",
                              headers=master_headers).json()
        m = [a for a in avails if a["username"] == "m.rossi"][0]
        rc = requests.post(f"{API}/competitions/{TestReportAndReminder.comp_id}/confirm",
                           headers=master_headers, json={"official_ids": [m["official_id"]]})
        assert rc.status_code == 200

    def test_report_master_only(self, master_headers, official_headers):
        cid = TestReportAndReminder.comp_id
        r = requests.get(f"{API}/competitions/{cid}/report", headers=master_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["name"] == "TEST_ReportGara"
        assert body["confirmed_count"] >= 1
        # before recording attendance, present=0
        assert body["present_count"] == 0
        assert body["absent_count"] == body["confirmed_count"]
        assert isinstance(body["officials"], list)
        assert any(o["username"] == "m.rossi" and o["attended"] is False for o in body["officials"])
        # 403 for official
        rf = requests.get(f"{API}/competitions/{cid}/report", headers=official_headers)
        assert rf.status_code == 403

    def test_report_after_attendance(self, master_headers):
        cid = TestReportAndReminder.comp_id
        avails = requests.get(f"{API}/competitions/{cid}/availabilities",
                              headers=master_headers).json()
        m = [a for a in avails if a["username"] == "m.rossi"][0]
        r = requests.post(f"{API}/competitions/{cid}/attendance", headers=master_headers,
                          json={"records": [{"official_id": m["official_id"], "attended": True}]})
        assert r.status_code == 200
        rep = requests.get(f"{API}/competitions/{cid}/report", headers=master_headers).json()
        assert rep["present_count"] == 1
        assert rep["absent_count"] == rep["confirmed_count"] - 1
        assert any(o["username"] == "m.rossi" and o["attended"] is True for o in rep["officials"])

    def test_reminder_notification_fires(self, master_headers, official_headers):
        # ensure_reminders_sent runs lazily; start_date=today -> today >= start-1
        # Trigger by hitting notifications endpoint as official
        r = requests.get(f"{API}/notifications", headers=official_headers)
        assert r.status_code == 200
        cid = TestReportAndReminder.comp_id
        notifs = r.json()
        reminders = [n for n in notifs
                     if n["type"] == "reminder" and n["competition_id"] == cid]
        assert reminders, "Reminder notification for confirmed official missing"

    def test_cleanup_comp2(self, master_headers):
        if TestReportAndReminder.comp_id:
            requests.delete(f"{API}/competitions/{TestReportAndReminder.comp_id}",
                            headers=master_headers)


# --- Iteration 3: my/stats + present_count in summary ---
class TestIter3StatsAndHistory:
    """Verifies /api/my/stats and present_count in competition summary."""
    comp_id = None

    def test_my_stats_shape_for_official(self, official_headers):
        r = requests.get(f"{API}/my/stats", headers=official_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("confirmed", "present", "absent", "percentage"):
            assert k in d, f"missing key {k} in stats"
        assert isinstance(d["percentage"], int)
        assert 0 <= d["percentage"] <= 100

    def test_my_stats_403_for_master_fallback(self, master_headers):
        # Master is not an official — endpoint returns zeros (role guard branch)
        r = requests.get(f"{API}/my/stats", headers=master_headers)
        assert r.status_code == 200
        assert r.json()["confirmed"] == 0

    def test_full_flow_updates_stats_and_present_count(self, master_headers, official_headers):
        # baseline stats
        before = requests.get(f"{API}/my/stats", headers=official_headers).json()
        today = date.today().isoformat()
        end = (date.today() + timedelta(days=1)).isoformat()
        r = requests.post(f"{API}/competitions", headers=master_headers, json={
            "name": "TEST_StatsGara",
            "start_date": today,
            "end_date": end,
            "address": "Via Stat 1, Torino",
            "notes": "iter3",
        })
        assert r.status_code == 201
        cid = r.json()["id"]
        TestIter3StatsAndHistory.comp_id = cid

        # official accepts
        reqs = requests.get(f"{API}/my/requests", headers=official_headers).json()
        target = [x for x in reqs if x["competition_id"] == cid]
        assert target, "auto-dispatch missing"
        avail_id = target[0]["availability_id"]
        rr = requests.post(f"{API}/availabilities/{avail_id}/respond",
                           headers=official_headers, json={"status": "available"})
        assert rr.status_code == 200

        # confirm
        avails = requests.get(f"{API}/competitions/{cid}/availabilities",
                              headers=master_headers).json()
        mrossi = [a for a in avails if a["username"] == "m.rossi"][0]
        rc = requests.post(f"{API}/competitions/{cid}/confirm",
                           headers=master_headers, json={"official_ids": [mrossi["official_id"]]})
        assert rc.status_code == 200
        # summary now must include present_count == 0 and confirmed_count >= 1
        assert "present_count" in rc.json(), "summary missing present_count"
        assert rc.json()["present_count"] == 0
        assert rc.json()["confirmed_count"] >= 1

        # record attendance
        ra = requests.post(f"{API}/competitions/{cid}/attendance", headers=master_headers,
                           json={"records": [{"official_id": mrossi["official_id"], "attended": True}]})
        assert ra.status_code == 200

        # /competitions list: this comp has present_count == 1
        listing = requests.get(f"{API}/competitions", headers=master_headers).json()
        this = [c for c in listing if c["id"] == cid][0]
        assert this["present_count"] == 1

        # stats grew
        after = requests.get(f"{API}/my/stats", headers=official_headers).json()
        assert after["confirmed"] >= before["confirmed"] + 1
        assert after["present"] >= before["present"] + 1
        assert 0 <= after["percentage"] <= 100

    def test_cleanup(self, master_headers):
        if TestIter3StatsAndHistory.comp_id:
            requests.delete(f"{API}/competitions/{TestIter3StatsAndHistory.comp_id}",
                            headers=master_headers)


# --- Iteration 3: regression on iter2 bugs (should now be fixed) ---
class TestIter2BugRegression:
    def test_soft_deleted_username_can_be_reused(self, master_headers):
        sfx = uuid.uuid4().hex[:6]
        surname = f"reuse{sfx}"
        payload = {"first_name": "Luca", "surname": surname, "password": "test1234"}
        r1 = requests.post(f"{API}/officials", headers=master_headers, json=payload)
        assert r1.status_code == 201, r1.text
        oid = r1.json()["id"]
        d = requests.delete(f"{API}/officials/{oid}", headers=master_headers)
        assert d.status_code == 200
        # re-create with same first/surname -> was 409 in iter2, expect 201 after fix
        r2 = requests.post(f"{API}/officials", headers=master_headers, json=payload)
        assert r2.status_code == 201, (
            f"KNOWN BUG (iter2 HIGH): soft-deleted username still blocked. status={r2.status_code} body={r2.text}"
        )
        # cleanup
        requests.delete(f"{API}/officials/{r2.json()['id']}", headers=master_headers)
