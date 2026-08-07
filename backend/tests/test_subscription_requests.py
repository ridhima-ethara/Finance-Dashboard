from backend.server import app, calculate_subscription_request, public_subscription_request


def request_payload(**overrides):
    payload = {
        "project_id": "kaiju",
        "project_name": "Kaiju",
        "phase_id": "phase-1",
        "phase_name": "Phase 1",
        "justification": "Required for the delivery team.",
        "eligible_members": [{"id": "member-1", "name": "Aarav Sharma", "email": "aarav@example.com"}],
        "lines": [{
            "id": "line-1",
            "plan_id": "claude-max",
            "seats": 2,
            "start_date": "2026-08-01",
            "end_date": "2026-08-30",
            "members": [{"id": "member-1", "name": "Aarav Sharma", "email": "aarav@example.com"}],
            "tax_pct": 10,
            "discount": 10,
        }],
    }
    payload.update(overrides)
    return payload


def test_catalogue_cost_is_prorated_and_totalled():
    calculated, errors = calculate_subscription_request(request_payload(), [], submitting=True)

    assert errors == []
    assert calculated["lines"][0]["duration_days"] == 30
    assert calculated["lines"][0]["subtotal"] == 800
    assert calculated["lines"][0]["tax_amount"] == 80
    assert calculated["requested_amount"] == 870


def test_selected_members_cannot_exceed_seats():
    payload = request_payload()
    payload["eligible_members"].append({"id": "member-2", "name": "Meera Nair", "email": "meera@example.com"})
    payload["lines"][0]["seats"] = 1
    payload["lines"][0]["members"].append(payload["eligible_members"][1])

    _, errors = calculate_subscription_request(payload, [], submitting=True)

    assert any("cannot exceed requested seats" in error for error in errors)


def test_active_overlapping_member_subscription_is_rejected():
    current = request_payload(id="new-request")
    active = request_payload(id="active-request")
    active.update({"status": "active"})

    _, errors = calculate_subscription_request(current, [active], submitting=True)

    assert any("already has this active subscription" in error for error in errors)


def test_document_content_is_not_returned_in_list_payload():
    safe = public_subscription_request({"id": "subreq-1", "documents": [{"id": "doc-1", "name": "invoice.pdf", "data": "secret"}]})

    assert safe["documents"] == [{"id": "doc-1", "name": "invoice.pdf"}]


def test_subscription_api_routes_are_registered():
    paths = {route.path for route in app.routes}

    assert "/api/subscription-plans" in paths
    assert "/api/subscription-requests" in paths
    assert "/api/subscription-requests/{request_id}/submit" in paths
    assert "/api/subscription-requests/{request_id}/decision" in paths
