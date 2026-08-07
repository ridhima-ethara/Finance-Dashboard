"""End-to-end subscription request lifecycle and RBAC transition tests.

Drives the real FastAPI endpoints through the local (no-database) storage path,
isolated to a temporary runtime-data file so the suite never touches the shared
`.local_runtime_data.json`. Covers SUB-QA-03 (approval transition RBAC),
SUB-QA-04 (partial approval / returned request) and SUB-QA-07 (full lifecycle).
"""

import base64

import pytest
from starlette.testclient import TestClient

import backend.server as server


@pytest.fixture()
def client(tmp_path, monkeypatch):
    # Point every read_/write_local_section call at an isolated temp file and
    # force the no-database code path so tests are hermetic and deterministic.
    monkeypatch.setattr(server, "LOCAL_DATA_FILE", tmp_path / "runtime.json")
    monkeypatch.setattr(server, "db", None)
    with TestClient(server.app) as test_client:
        yield test_client


def draft_payload(**overrides):
    member = {"id": "member-1", "name": "Aarav Sharma", "email": "aarav@example.com"}
    payload = {
        "project_id": "kaiju",
        "project_name": "Kaiju",
        "phase_id": "phase-1",
        "phase_name": "Phase 1",
        "request_type": "initial",
        "justification": "Required for the delivery team.",
        "requester": {"name": "Aarav Sharma", "email": "aarav@example.com", "role": "TPM"},
        "eligible_members": [member],
        "lines": [
            {
                "id": "line-1",
                "plan_id": "claude-max",
                "seats": 2,
                "start_date": "2026-08-01",
                "end_date": "2026-08-30",
                "members": [member],
                "tax_pct": 10,
                "discount": 10,
            }
        ],
        "documents": [
            {
                "id": "doc-1",
                "name": "invoice.pdf",
                "content_type": "application/pdf",
                "size": 5,
                "data": "data:application/pdf;base64," + base64.b64encode(b"Hello").decode(),
            }
        ],
    }
    payload.update(overrides)
    return payload


def create_and_submit(client):
    created = client.post("/api/subscription-requests", json=draft_payload())
    assert created.status_code == 200, created.text
    request_id = created.json()["id"]
    submitted = client.post(f"/api/subscription-requests/{request_id}/submit")
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()["status"] == "cto-review"
    return request_id


def test_full_lifecycle_create_submit_cto_cfo_it(client):
    request_id = create_and_submit(client)

    # CTO approves -> moves to CFO review.
    cto = client.post(
        f"/api/subscription-requests/{request_id}/decision",
        json={"role": "CTO", "decision": "approve", "actor": {"role": "CTO"}},
    )
    assert cto.status_code == 200, cto.text
    assert cto.json()["status"] == "cfo-review"

    # CFO partially approves with a reduced amount -> fulfilment pending.
    cfo = client.post(
        f"/api/subscription-requests/{request_id}/decision",
        json={"role": "CFO", "decision": "partial", "approved_amount": 500, "actor": {"role": "CFO"}},
    )
    assert cfo.status_code == 200, cfo.text
    body = cfo.json()
    assert body["status"] == "fulfilment-pending"
    assert body["approved_amount"] == 500

    # IT activates the subscription.
    it = client.post(
        f"/api/subscription-requests/{request_id}/decision",
        json={"role": "IT", "decision": "activate", "actor": {"role": "IT"}},
    )
    assert it.status_code == 200, it.text
    activated = it.json()
    assert activated["status"] == "active"
    assert activated["activated_at"]

    # The audit history preserves every actor/action step of the workflow.
    actions = [entry["action"] for entry in activated["history"]]
    assert any("Submitted" in action for action in actions)
    assert any("CTO" in action for action in actions)
    assert any("CFO" in action for action in actions)


def test_public_request_never_leaks_document_bytes(client):
    request_id = create_and_submit(client)
    listed = client.get("/api/subscription-requests").json()
    document = listed[0]["documents"][0]
    assert "data" not in document  # raw base64 payload must never be serialised out


def test_document_download_returns_original_bytes(client):
    request_id = create_and_submit(client)
    download = client.get(f"/api/subscription-requests/{request_id}/documents/doc-1")
    assert download.status_code == 200
    assert download.content == b"Hello"
    assert "attachment" in download.headers.get("content-disposition", "")


def test_cfo_cannot_approve_while_in_cto_review(client):
    request_id = create_and_submit(client)
    # Still in cto-review: a CFO decision must be rejected by the state machine.
    premature = client.post(
        f"/api/subscription-requests/{request_id}/decision",
        json={"role": "CFO", "decision": "approve", "actor": {"role": "CFO"}},
    )
    assert premature.status_code == 409


def test_returned_request_can_be_edited_and_resubmitted(client):
    request_id = create_and_submit(client)
    client.post(
        f"/api/subscription-requests/{request_id}/decision",
        json={"role": "CTO", "decision": "return", "comment": "Reduce seats", "actor": {"role": "CTO"}},
    )
    returned = client.get(f"/api/subscription-requests/{request_id}").json()
    assert returned["status"] == "returned-to-requester"

    # A returned request is editable again, then can be resubmitted.
    edit = client.put(
        f"/api/subscription-requests/{request_id}",
        json={**draft_payload(), "id": request_id, "justification": "Reduced to one seat."},
    )
    assert edit.status_code == 200, edit.text
    resubmitted = client.post(f"/api/subscription-requests/{request_id}/submit")
    assert resubmitted.status_code == 200
    assert resubmitted.json()["status"] == "cto-review"


def test_only_draft_requests_can_be_deleted(client):
    request_id = create_and_submit(client)
    # Already submitted (cto-review): deletion must be blocked.
    blocked = client.delete(f"/api/subscription-requests/{request_id}")
    assert blocked.status_code == 409


def test_draft_delete_succeeds(client):
    created = client.post("/api/subscription-requests", json=draft_payload())
    request_id = created.json()["id"]
    deleted = client.delete(f"/api/subscription-requests/{request_id}")
    assert deleted.status_code == 200
    assert client.get(f"/api/subscription-requests/{request_id}").status_code == 404


def reach_fulfilment_pending(client):
    request_id = create_and_submit(client)
    client.post(
        f"/api/subscription-requests/{request_id}/decision",
        json={"role": "CTO", "decision": "approve", "actor": {"role": "CTO"}},
    )
    client.post(
        f"/api/subscription-requests/{request_id}/decision",
        json={"role": "CFO", "decision": "approve", "actor": {"role": "CFO"}},
    )
    assert client.get(f"/api/subscription-requests/{request_id}").json()["status"] == "fulfilment-pending"
    return request_id


def test_line_model_field_is_preserved(client):
    payload = draft_payload()
    payload["lines"][0]["model"] = "Claude Opus 4.8 · Anthropic"
    created = client.post("/api/subscription-requests", json=payload)
    assert created.status_code == 200
    assert created.json()["lines"][0]["model"] == "Claude Opus 4.8 · Anthropic"


def test_fulfilment_records_tracker_and_activates(client):
    request_id = reach_fulfilment_pending(client)
    fulfilment = client.post(
        f"/api/subscription-requests/{request_id}/fulfilment",
        json={
            "purchase_mode": "self",
            "actor": {"role": "TPM"},
            "tracker_entries": [
                {
                    "line_id": "line-1",
                    "employee_code": "EMP-1",
                    "name": "Aarav Sharma",
                    "email": "aarav@example.com",
                    "amount_usd": 400,
                    "amount_paid": 380,
                    "reimbursement_verified": "Not Verified",
                    "account_number": "12345678",
                    "ifsc_code": "HDFC0001",
                }
            ],
            "documents": [
                {
                    "id": "invoice-1",
                    "name": "invoice.pdf",
                    "type": "invoice",
                    "content_type": "application/pdf",
                    "size": 5,
                    "data": "data:application/pdf;base64," + base64.b64encode(b"World").decode(),
                }
            ],
        },
    )
    assert fulfilment.status_code == 200, fulfilment.text
    body = fulfilment.json()
    assert body["status"] == "active"
    assert body["purchase_mode"] == "self"
    assert body["fulfilment_status"] == "submitted"
    entry = body["tracker_entries"][0]
    assert entry["difference"] == 20  # total (400) - paid (380)
    assert entry["employee_code"] == "EMP-1"
    # Fulfilment documents are merged and their bytes are downloadable, never inlined.
    assert all("data" not in document for document in body["documents"])
    download = client.get(f"/api/subscription-requests/{request_id}/documents/invoice-1")
    assert download.status_code == 200
    assert download.content == b"World"


def test_fulfilment_before_approval_is_blocked(client):
    request_id = create_and_submit(client)  # still cto-review
    blocked = client.post(
        f"/api/subscription-requests/{request_id}/fulfilment",
        json={"purchase_mode": "company", "tracker_entries": []},
    )
    assert blocked.status_code == 409


def test_cto_can_edit_lines_during_review(client):
    request_id = create_and_submit(client)  # cto-review
    edited = draft_payload()
    edited["lines"][0]["seats"] = 3
    edit = client.put(
        f"/api/subscription-requests/{request_id}",
        json={**edited, "id": request_id, "editor_role": "CTO", "actor": {"role": "CTO"}, "comment": "Reduced scope"},
    )
    assert edit.status_code == 200, edit.text
    body = edit.json()
    assert body["status"] == "cto-review"  # stage unchanged by a technical edit
    assert body["lines"][0]["seats"] == 3
    assert any("CTO technical edit" in entry["action"] for entry in body["history"])


def test_non_cto_cannot_edit_during_review(client):
    request_id = create_and_submit(client)
    blocked = client.put(f"/api/subscription-requests/{request_id}", json={**draft_payload(), "id": request_id})
    assert blocked.status_code == 409


def test_snapshots_are_captured_at_each_stage(client):
    request_id = create_and_submit(client)
    client.post(f"/api/subscription-requests/{request_id}/decision", json={"role": "CTO", "decision": "approve", "actor": {"role": "CTO"}})
    body = client.get(f"/api/subscription-requests/{request_id}").json()
    stages = [snap["stage"] for snap in body.get("snapshots", [])]
    assert "Submitted" in stages
    assert "CTO approve" in stages
    assert body["cto_forwarded_amount"] == body["requested_amount"]
