"""Seed demo subscription requests that showcase the full lifecycle.

Attaches self-contained demo requests to real workspace projects (falling back to a
synthetic project if none exist) covering every stage — draft, CTO review, CFO review,
returned, rejected, fulfilment-pending, and active (company + self purchase) — plus a
duplicate/overlapping pair on one member to demonstrate the duplicate-subscription alert.

Usage (from repo root):
    backend/.venv311/bin/python -m backend.seed_demo_subscriptions        # seed
    backend/.venv311/bin/python -m backend.seed_demo_subscriptions clear  # remove demo rows

Idempotent: demo ids are prefixed "demo-subreq-" and re-seeding replaces them.
"""

import asyncio
import base64
import sys
from datetime import datetime, timedelta, timezone

import backend.server as server

DEMO_PREFIX = "demo-subreq-"
REQUESTER = {"name": "TPM Lead", "email": "tpm@ethara.ai", "role": "TPM"}
BASE = datetime(2026, 8, 1, 10, 0, tzinfo=timezone.utc)


def at(days):
    return (BASE + timedelta(days=days)).isoformat()


def demo_document(name, kind):
    payload = base64.b64encode(f"DEMO {kind.upper()} — {name}".encode()).decode()
    return {"id": f"{DEMO_PREFIX}doc-{kind}-{name}".replace(" ", "-").lower(), "name": name, "type": kind,
            "content_type": "application/pdf", "size": len(payload), "uploaded_at": at(30),
            "data": f"data:application/pdf;base64,{payload}"}


async def load_projects():
    if server.db is not None:
        doc = await server.db.workspace_state.find_one({}, {"_id": 0}) or {}
        return doc.get("customProjects") or []
    return (server.read_local_section("workspace_state", {}) or {}).get("customProjects") or []


def member_ref(member):
    return {"id": member.get("id"), "name": member.get("name"), "email": member.get("email")}


def tracker_entry(line, member, *, purchase_mode, verified, docs):
    per_seat = round(float(line.get("total") or 0) / max(int(line.get("seats") or 1), 1), 2)
    paid = per_seat if purchase_mode == "company" else round(per_seat * 0.95, 2)
    started = line.get("start_date")
    return {
        "id": f"track-{line.get('id')}-{member.get('id')}",
        "line_id": line.get("id"),
        "employee_code": (member.get("id") or "").upper(),
        "name": member.get("name") or "",
        "email": member.get("email") or "",
        "amount_usd": per_seat,
        "amount_inr": round(per_seat * 83, 2),
        "amount_paid": paid,
        "total_amount": per_seat,
        "difference": round(per_seat - paid, 2),
        "reimbursement_verified": "Verified" if verified else "Not Verified",
        "reimbursement_status": "Reimbursed" if verified else ("N/A — company card" if purchase_mode == "company" else "Pending"),
        "comments": "Company-billed" if purchase_mode == "company" else "Employee reimbursement",
        "account_number": "" if purchase_mode == "company" else "50100XXXX2291",
        "ifsc_code": "" if purchase_mode == "company" else "HDFC0001234",
        "subscription_type": line.get("subscription") or "",
        "model": line.get("model") or "",
        "phase": line.get("phase_name") or "",
        "status": "Active",
        "date": started,
        "month": datetime.fromisoformat(started).strftime("%b %Y") if started else "",
        "started": started,
        "ended": line.get("end_date"),
        "invoice_document_id": docs.get("invoice", ""),
        "receipt_document_id": docs.get("receipt", ""),
        "screenshot_document_id": docs.get("screenshot", ""),
    }


def build_record(idx, project, phase, members, spec):
    eligible = [member_ref(m) for m in members]
    line = {
        "id": f"{DEMO_PREFIX}{idx}-line",
        "plan_id": spec["plan_id"],
        "model": spec.get("model", ""),
        "seats": spec["seats"],
        "start_date": spec["start"],
        "end_date": spec["end"],
        "members": [member_ref(m) for m in spec["members"]],
        "tax_pct": spec.get("tax_pct", 0),
        "discount": spec.get("discount", 0),
        "justification": spec.get("line_justification", "Team tooling for delivery."),
    }
    record = {
        "id": f"{DEMO_PREFIX}{idx}",
        "request_number": spec["number"],
        "project_id": project["id"],
        "project_name": project.get("name"),
        "phase_id": phase.get("id"),
        "phase_name": phase.get("name"),
        "request_type": spec.get("request_type", "initial"),
        "justification": spec["justification"],
        "requester": REQUESTER,
        "eligible_members": eligible,
        "lines": [line],
        "documents": spec.get("documents", []),
        "created_at": at(0),
        "updated_at": at(spec.get("updated_day", 5)),
    }
    calc, errors = server.calculate_subscription_request(record, [], submitting=False)
    if errors:
        raise SystemExit(f"Demo record {idx} invalid: {errors}")
    calc.update(spec.get("overrides", {}))
    return calc


async def clear():
    for record in await server.read_subscription_requests():
        if str(record.get("id", "")).startswith(DEMO_PREFIX):
            await server.delete_subscription_request_record(record["id"])
    print("Removed demo subscription requests.")


async def seed():
    projects = await load_projects()
    # Prefer real delivery projects (real member names) over the seeded budget demo project.
    real = [p for p in projects if p.get("phases") and p.get("teamMembers") and p.get("id") != "budget-visualization-demo"]
    real = real or [p for p in projects if (p.get("phases") and p.get("teamMembers"))]
    if len(real) >= 2:
        tron, zoro = real[0], real[1]
    elif real:
        tron = zoro = real[0]
    else:
        synthetic = {"id": "demo-aurora", "name": "Aurora Copilot",
                     "phases": [{"id": "p1", "name": "Phase 1"}],
                     "teamMembers": [{"id": f"emp-90{i}", "name": n, "email": e} for i, (n, e) in enumerate(
                         [("Aarav Sharma", "aarav@ethara.ai"), ("Meera Nair", "meera@ethara.ai"),
                          ("Rohan Gupta", "rohan@ethara.ai"), ("Diya Patel", "diya@ethara.ai")], start=1)]}
        tron = zoro = synthetic

    tron_phase = tron["phases"][0]
    zoro_phase = zoro["phases"][0]
    tm = tron["teamMembers"]
    zm = zoro["teamMembers"]
    dup_member = tm[0]

    invoice = demo_document("invoice-2026-08.pdf", "invoice")
    receipt = demo_document("receipt-2026-08.pdf", "receipt")
    screenshot = demo_document("payment-2026-08.pdf", "screenshot")

    specs = [
        ("01", tron, tron_phase, dict(number="SUB-20260801-DRAF", plan_id="cursor-pro", seats=2, model="",
            start=at(2), end=at(180), members=tm[1:3], justification="Cursor Pro for two delivery engineers.",
            overrides={"status": "draft", "history": [{"at": at(0), "action": "Draft created", "actor": REQUESTER}]})),
        ("02", tron, tron_phase, dict(number="SUB-20260801-CTOR", plan_id="chatgpt-team", seats=2,
            start=at(3), end=at(190), members=tm[2:4], justification="ChatGPT Team for research support.",
            overrides={"status": "cto-review",
                       "history": [{"at": at(0), "action": "Draft created", "actor": REQUESTER},
                                   {"at": at(1), "action": "Submitted for CTO review", "actor": REQUESTER}]})),
        ("03", zoro, zoro_phase, dict(number="SUB-20260801-CFOR", plan_id="github-enterprise", seats=3,
            start=at(4), end=at(200), members=zm[0:3], justification="GitHub Enterprise seats for the Zoro squad.")),
        ("04", tron, tron_phase, dict(number="SUB-20260801-RETN", plan_id="figma-org", seats=2,
            start=at(5), end=at(160), members=[tm[1], tm[3]], justification="Figma Organization for design reviews.",
            overrides={"status": "returned-to-requester",
                       "history": [{"at": at(1), "action": "Submitted for CTO review", "actor": REQUESTER},
                                   {"at": at(2), "action": "CTO return", "actor": {"role": "CTO"}, "comment": "Reduce to 1 seat and add cost justification."}]})),
        ("05", zoro, zoro_phase, dict(number="SUB-20260801-REJT", plan_id="notion-plus", seats=2,
            start=at(5), end=at(150), members=[zm[3]], justification="Notion Plus for documentation.",
            overrides={"status": "rejected",
                       "history": [{"at": at(1), "action": "Submitted for CTO review", "actor": REQUESTER},
                                   {"at": at(2), "action": "CTO approve", "actor": {"role": "CTO"}},
                                   {"at": at(3), "action": "CFO reject", "actor": {"role": "CFO"}, "comment": "Not budgeted this quarter."}]})),
        ("06", tron, tron_phase, dict(number="SUB-20260801-FULF", plan_id="chatgpt-team", seats=2,
            start=at(6), end=at(210), members=[tm[1]], justification="ChatGPT Team — partially approved pending renewal review.")),
    ]

    records = []
    for idx, project, phase, spec in specs:
        records.append(build_record(idx, project, phase, project["teamMembers"], spec))

    # Post-process the request-review chain records that need computed amounts.
    cfo_review = records[2]
    cfo_review.update({
        "status": "cfo-review",
        "cto_forwarded_amount": cfo_review["requested_amount"],
        "history": [{"at": at(1), "action": "Submitted for CTO review", "actor": REQUESTER},
                    {"at": at(2), "action": "CTO approve", "actor": {"role": "CTO"}, "comment": "Technically justified — forwarding to CFO."}],
        "snapshots": [server.subscription_snapshot(cfo_review, "Submitted", REQUESTER),
                      server.subscription_snapshot(cfo_review, "CTO approve", {"role": "CTO"})],
    })
    fulfilment = records[5]
    partial = round(fulfilment["requested_amount"] * 0.6, 2)
    fulfilment.update({
        "status": "fulfilment-pending",
        "approved_amount": partial,
        "cfo_decision": "partial",
        "cto_forwarded_amount": fulfilment["requested_amount"],
        "history": [{"at": at(1), "action": "Submitted for CTO review", "actor": REQUESTER},
                    {"at": at(2), "action": "CTO approve", "actor": {"role": "CTO"}},
                    {"at": at(3), "action": "CFO partial", "actor": {"role": "CFO"}, "comment": "Approved 60% for this cycle.", "approved_amount": partial}],
    })

    # Active — company purchase (Zoro / Linear).
    active_company = build_record("07", zoro, zoro_phase, zoro["teamMembers"], dict(
        number="SUB-20260801-ACTV", plan_id="linear-standard", seats=2, start=at(2), end=at(210),
        members=zm[0:2], justification="Linear Standard for issue tracking.",
        documents=[invoice, receipt]))
    line_c = active_company["lines"][0]
    for m in line_c["members"]:
        m_full = next((x for x in zm if x.get("id") == m.get("id")), m)
    active_company.update({
        "status": "active", "purchase_mode": "company", "fulfilment_status": "submitted",
        "activated_at": at(8), "fulfilled_at": at(8),
        "tracker_entries": [tracker_entry({**line_c, "phase_name": zoro_phase.get("name")}, m, purchase_mode="company", verified=True,
                                           docs={"invoice": invoice["id"], "receipt": receipt["id"]}) for m in line_c["members"]],
        "history": [{"at": at(1), "action": "Submitted for CTO review", "actor": REQUESTER},
                    {"at": at(2), "action": "CTO approve", "actor": {"role": "CTO"}},
                    {"at": at(4), "action": "CFO approve", "actor": {"role": "CFO"}},
                    {"at": at(8), "action": "Fulfilment recorded", "actor": REQUESTER, "purchase_mode": "company"}],
    })

    # Active — self purchase / reimbursement (Tron / Cursor).
    active_self = build_record("08", tron, tron_phase, tron["teamMembers"], dict(
        number="SUB-20260801-SELF", plan_id="cursor-pro", seats=1, start=at(3), end=at(200),
        members=[tm[3]], justification="Cursor Pro purchased by member — reimbursement pending.",
        documents=[invoice, receipt, screenshot]))
    line_s = active_self["lines"][0]
    active_self.update({
        "status": "active", "purchase_mode": "self", "fulfilment_status": "submitted",
        "activated_at": at(9), "fulfilled_at": at(9),
        "tracker_entries": [tracker_entry({**line_s, "phase_name": tron_phase.get("name")}, tm[3], purchase_mode="self", verified=False,
                                          docs={"invoice": invoice["id"], "receipt": receipt["id"], "screenshot": screenshot["id"]})],
        "history": [{"at": at(1), "action": "Submitted for CTO review", "actor": REQUESTER},
                    {"at": at(2), "action": "CTO approve", "actor": {"role": "CTO"}},
                    {"at": at(4), "action": "CFO approve", "actor": {"role": "CFO"}},
                    {"at": at(9), "action": "Fulfilment recorded", "actor": REQUESTER, "purchase_mode": "self"}],
    })

    # Duplicate / overlapping pair — same member + plan + project, overlapping dates → alert.
    dup_a = build_record("09", tron, tron_phase, tron["teamMembers"], dict(
        number="SUB-20260801-DUPA", plan_id="claude-max", model="Claude Opus 4.8 · Anthropic", seats=1,
        start=at(1), end=at(120), members=[dup_member], justification="Claude Max for lead engineer."))
    dup_a.update({"status": "active", "purchase_mode": "company", "activated_at": at(6),
                  "tracker_entries": [tracker_entry({**dup_a["lines"][0], "phase_name": tron_phase.get("name")}, dup_member, purchase_mode="company", verified=True,
                                                     docs={"invoice": invoice["id"]})],
                  "documents": [invoice],
                  "history": [{"at": at(1), "action": "Submitted for CTO review", "actor": REQUESTER},
                              {"at": at(2), "action": "CTO approve", "actor": {"role": "CTO"}},
                              {"at": at(4), "action": "CFO approve", "actor": {"role": "CFO"}},
                              {"at": at(6), "action": "Fulfilment recorded", "actor": REQUESTER, "purchase_mode": "company"}]})
    dup_b = build_record("10", tron, tron_phase, tron["teamMembers"], dict(
        number="SUB-20260801-DUPB", plan_id="claude-max", model="Claude Opus 4.8 · Anthropic", seats=1,
        start=at(70), end=at(240), members=[dup_member], justification="Second Claude Max raised before the first expired."))
    dup_b.update({"status": "active", "purchase_mode": "company", "activated_at": at(72),
                  "tracker_entries": [tracker_entry({**dup_b["lines"][0], "phase_name": tron_phase.get("name")}, dup_member, purchase_mode="company", verified=False,
                                                     docs={"invoice": invoice["id"]})],
                  "documents": [invoice],
                  "history": [{"at": at(65), "action": "Submitted for CTO review", "actor": REQUESTER},
                              {"at": at(66), "action": "CTO approve", "actor": {"role": "CTO"}},
                              {"at": at(68), "action": "CFO approve", "actor": {"role": "CFO"}},
                              {"at": at(72), "action": "Fulfilment recorded", "actor": REQUESTER, "purchase_mode": "company"}]})

    all_records = records + [active_company, active_self, dup_a, dup_b]
    for record in all_records:
        await server.write_subscription_request(record)
    print(f"Seeded {len(all_records)} demo subscription requests:")
    for record in all_records:
        print(f"  - {record['request_number']:<22} {record['status']:<20} {record['project_name']}")


if __name__ == "__main__":
    asyncio.run(clear() if len(sys.argv) > 1 and sys.argv[1] == "clear" else seed())
