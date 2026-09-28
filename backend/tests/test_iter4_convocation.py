"""Iteration 4: Direct convocation feature tests.

Verifies:
- GET /api/competitions/{id}/availabilities returns ALL active officials
  (records-less officials appear with status='not_requested', confirmed=False).
- POST /api/competitions/{id}/confirm can convoke an official with no record
  (creates status='convoked', confirmed=True, dispatches a 'confirmation'
  notification titled 'Sei stato convocato!').
- Removing a purely-convoked official from the selection deletes the record.
- Convoked official sees the competition in /api/my/competitions with
  confirmed=True, and receives the convocation notification.
"""
import os
import uuid
import pytest
import requests
from datetime import date, timedelta

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL")
            or "https://gara-presence-app.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

MASTER_USER = "master"
MASTER_PASS = "GaraMaster2026!"


@pytest.fixture(scope="module")
def master_headers():
    r = requests.post(f"{API}/auth/login",
                      json={"username": MASTER_USER, "password": MASTER_PASS})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def fresh_official(master_headers):
    """Create a fresh official that has NEVER been sent an availability
    request — perfect target for a direct convocation."""
    sfx = uuid.uuid4().hex[:6]
    surname = f"neri{sfx}"
    payload = {"first_name": "Sara", "surname": surname, "password": "test1234"}
    r = requests.post(f"{API}/officials", headers=master_headers, json=payload)
    assert r.status_code == 201, r.text
    off = r.json()
    yield {
        "id": off["id"],
        "username": off["username"],
        "password": "test1234",
        "surname": surname,
    }
    # cleanup
    requests.delete(f"{API}/officials/{off['id']}", headers=master_headers)


@pytest.fixture(scope="module")
def future_comp(master_headers):
    """Create a far-future competition so auto-dispatch does NOT fire yet."""
    r = requests.post(f"{API}/competitions", headers=master_headers, json={
        "name": "TEST_ConvocationGara",
        "start_date": "2027-11-15",
        "end_date": "2027-11-16",
        "address": "Palazzetto Convocazione 12, Bologna",
        "notes": "iter4 convocation",
    })
    assert r.status_code == 201, r.text
    comp = r.json()
    assert comp["request_sent"] is False, "future comp should NOT auto-dispatch"
    yield comp
    requests.delete(f"{API}/competitions/{comp['id']}", headers=master_headers)


@pytest.fixture(scope="module")
def official_headers(fresh_official):
    r = requests.post(f"{API}/auth/login", json={
        "username": fresh_official["username"],
        "password": fresh_official["password"],
    })
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


# ---------------------------------------------------------------------------
# 1. Availabilities lists ALL active officials
# ---------------------------------------------------------------------------
class TestAvailabilitiesListsAllOfficials:
    def test_list_includes_fresh_official_as_not_requested(
        self, master_headers, future_comp, fresh_official
    ):
        r = requests.get(f"{API}/competitions/{future_comp['id']}/availabilities",
                         headers=master_headers)
        assert r.status_code == 200, r.text
        avails = r.json()
        # fresh official must appear even though request_sent=False
        mine = [a for a in avails if a["official_id"] == fresh_official["id"]]
        assert mine, f"fresh official {fresh_official['username']} missing from list"
        row = mine[0]
        assert row["status"] == "not_requested"
        assert row["confirmed"] is False
        assert row["attended"] is None
        assert row["username"] == fresh_official["username"]

    def test_list_covers_all_active_officials(self, master_headers, future_comp):
        officials = requests.get(f"{API}/officials", headers=master_headers).json()
        active_ids = {o["id"] for o in officials if o.get("active", True)}
        avails = requests.get(
            f"{API}/competitions/{future_comp['id']}/availabilities",
            headers=master_headers,
        ).json()
        avail_ids = {a["official_id"] for a in avails}
        # every active official must be present in the row list
        missing = active_ids - avail_ids
        assert not missing, f"active officials missing from availabilities: {missing}"


# ---------------------------------------------------------------------------
# 2. Direct convocation creates a 'convoked' record + notification
# ---------------------------------------------------------------------------
class TestDirectConvocation:
    def test_confirm_convokes_official_without_prior_record(
        self, master_headers, future_comp, fresh_official
    ):
        r = requests.post(
            f"{API}/competitions/{future_comp['id']}/confirm",
            headers=master_headers,
            json={"official_ids": [fresh_official["id"]]},
        )
        assert r.status_code == 200, r.text
        summary = r.json()
        assert summary["confirmed_count"] >= 1

        # verify record now exists with status='convoked', confirmed=True
        avails = requests.get(
            f"{API}/competitions/{future_comp['id']}/availabilities",
            headers=master_headers,
        ).json()
        row = [a for a in avails if a["official_id"] == fresh_official["id"]][0]
        assert row["status"] == "convoked"
        assert row["confirmed"] is True

    def test_convocation_notification_sent(self, official_headers, future_comp):
        r = requests.get(f"{API}/notifications", headers=official_headers)
        assert r.status_code == 200
        notifs = r.json()
        convoke = [n for n in notifs
                   if n["type"] == "confirmation"
                   and n["competition_id"] == future_comp["id"]]
        assert convoke, "no convocation notification received by fresh official"
        n = convoke[0]
        # title is 'Sei stato convocato!' for direct convocation
        assert n["title"] == "Sei stato convocato!", f"unexpected title: {n['title']}"
        # body must include the address
        assert future_comp["address"] in n["body"], f"address missing from body: {n['body']}"

    def test_convoked_official_sees_comp_in_my_competitions(
        self, official_headers, future_comp
    ):
        r = requests.get(f"{API}/my/competitions", headers=official_headers)
        assert r.status_code == 200
        mine = [c for c in r.json() if c["competition_id"] == future_comp["id"]]
        assert mine, "convoked competition missing from /my/competitions"
        assert mine[0]["confirmed"] is True
        assert mine[0]["status"] == "convoked"


# ---------------------------------------------------------------------------
# 3. Un-convoking (removed from selection) deletes the purely-convoked record
# ---------------------------------------------------------------------------
class TestUnconvoke:
    def test_removing_purely_convoked_deletes_record(
        self, master_headers, future_comp, fresh_official
    ):
        # confirm with EMPTY selection -> should remove the convoked-only record
        r = requests.post(
            f"{API}/competitions/{future_comp['id']}/confirm",
            headers=master_headers,
            json={"official_ids": []},
        )
        assert r.status_code == 200, r.text
        summary = r.json()

        avails = requests.get(
            f"{API}/competitions/{future_comp['id']}/availabilities",
            headers=master_headers,
        ).json()
        row = [a for a in avails if a["official_id"] == fresh_official["id"]][0]
        # record deleted -> official reverts to not_requested / not confirmed
        assert row["status"] == "not_requested", \
            f"purely-convoked record was not deleted (status={row['status']})"
        assert row["confirmed"] is False
        # confirmed_count should have dropped
        assert summary["confirmed_count"] == 0
