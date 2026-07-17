"""FastAPI MVP for privacy-safe crash and hazard reporting."""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import FastAPI, HTTPException, status

from .models import (
    PublicIncident,
    ReportIntake,
    ResponderStatus,
    Severity,
    VerificationDecision,
    VerificationLevel,
)

app = FastAPI(title="Ọ̀nàSafe Nigeria API", version="0.1.0")

_INCIDENTS: dict[UUID, PublicIncident] = {}
_AUDIT_LOG: list[dict[str, str]] = []


def _audit(action: str, actor: str, incident_id: UUID) -> None:
    _AUDIT_LOG.append(
        {
            "action": action,
            "actor": actor,
            "incident_id": str(incident_id),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "primary_emergency_action": "Call FRSC 122"}


@app.post("/reports", response_model=PublicIncident, status_code=status.HTTP_201_CREATED)
def create_report(report: ReportIntake) -> PublicIncident:
    incident = PublicIncident(
        incident_type=report.incident_type,
        severity=Severity.unknown,
        verification_level=VerificationLevel.unverified,
        provenance="public_report",
        location=report.location,
        responder_status=ResponderStatus.frsc_122_recommended,
        is_demo=False,
    )
    _INCIDENTS[incident.id] = incident
    _audit("report_created", "public", incident.id)
    return incident


@app.get("/public/incidents", response_model=list[PublicIncident])
def public_incidents() -> list[PublicIncident]:
    return list(_INCIDENTS.values())


@app.post("/operations/incidents/{incident_id}/verify", response_model=PublicIncident)
def verify_incident(incident_id: UUID, decision: VerificationDecision) -> PublicIncident:
    incident = _INCIDENTS.get(incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")

    next_level = {
        "confirm": VerificationLevel.verified,
        "reject": VerificationLevel.rejected,
        "merge": VerificationLevel.needs_review,
        "needs_review": VerificationLevel.needs_review,
    }[decision.decision]
    updated = incident.model_copy(update={"verification_level": next_level})
    _INCIDENTS[incident_id] = updated
    _audit(f"verification_{decision.decision}", decision.verifier_role, incident_id)
    return updated


@app.get("/operations/audit-log")
def audit_log() -> list[dict[str, str]]:
    return _AUDIT_LOG
