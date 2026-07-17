from datetime import datetime, timezone

from fastapi.testclient import TestClient

from apps.api.main import app


client = TestClient(app)


def test_public_report_response_is_privacy_safe_and_frsc_first():
    response = client.post(
        "/reports",
        json={
            "incident_type": "crash",
            "location": {
                "latitude": 6.83,
                "longitude": 3.65,
                "coordinate_accuracy_m": 18,
                "captured_at": datetime.now(timezone.utc).isoformat(),
            },
            "description": "Two vehicles blocking one lane near Sagamu interchange.",
            "reporter_contact": "+2340000000000",
            "vehicle_plate": "ABC-123DE",
            "has_graphic_evidence": True,
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["verification_level"] == "unverified"
    assert body["provenance"] == "public_report"
    assert body["emergency_action"] == "Call FRSC 122"
    assert body["is_demo"] is False
    assert "reporter_contact" not in body
    assert "vehicle_plate" not in body
    assert "has_graphic_evidence" not in body


def test_verifier_can_confirm_and_audit_decision():
    created = client.post(
        "/reports",
        json={
            "incident_type": "hazard",
            "location": {
                "latitude": 6.9,
                "longitude": 3.7,
                "coordinate_accuracy_m": 25,
                "captured_at": datetime.now(timezone.utc).isoformat(),
            },
            "description": "Broken-down truck on shoulder.",
        },
    ).json()

    verified = client.post(
        f"/operations/incidents/{created['id']}/verify",
        json={
            "decision": "confirm",
            "verifier_role": "frsc",
            "rationale": "Matched responder radio update.",
        },
    )

    assert verified.status_code == 200
    assert verified.json()["verification_level"] == "verified"
    audit = client.get("/operations/audit-log").json()
    assert any(entry["action"] == "verification_confirm" for entry in audit)
