"""Domain models for the Ọ̀nàSafe Nigeria MVP.

The models intentionally separate public incident fields from sensitive report intake
fields so demonstration or personally identifying data cannot leak to public maps.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, field_validator


class VerificationLevel(str, Enum):
    demo = "demo"
    unverified = "unverified"
    needs_review = "needs_review"
    verified = "verified"
    rejected = "rejected"


class Severity(str, Enum):
    hazard = "hazard"
    minor = "minor"
    serious = "serious"
    critical = "critical"
    unknown = "unknown"


class ResponderStatus(str, Enum):
    not_escalated = "not_escalated"
    frsc_122_recommended = "frsc_122_recommended"
    dispatched = "dispatched"
    on_scene = "on_scene"
    cleared = "cleared"


class Location(BaseModel):
    latitude: float = Field(ge=4.0, le=14.5)
    longitude: float = Field(ge=2.5, le=15.0)
    coordinate_accuracy_m: float = Field(gt=0, le=5000)
    captured_at: datetime


class ReportIntake(BaseModel):
    incident_type: Literal["crash", "hazard"]
    location: Location
    description: str = Field(min_length=5, max_length=500)
    reporter_contact: str | None = Field(default=None, max_length=120)
    vehicle_plate: str | None = Field(default=None, max_length=30)
    has_graphic_evidence: bool = False

    @field_validator("location")
    @classmethod
    def reject_future_locations(cls, location: Location) -> Location:
        if location.captured_at > datetime.now(timezone.utc):
            raise ValueError("captured_at cannot be in the future")
        return location


class PublicIncident(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    incident_type: Literal["crash", "hazard"]
    severity: Severity = Severity.unknown
    verification_level: VerificationLevel
    provenance: str
    location: Location
    responder_status: ResponderStatus = ResponderStatus.frsc_122_recommended
    emergency_action: Literal["Call FRSC 122"] = "Call FRSC 122"
    is_demo: bool
    published_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class VerificationDecision(BaseModel):
    decision: Literal["confirm", "reject", "merge", "needs_review"]
    verifier_role: Literal["frsc", "road_authority", "emergency_agency", "admin"]
    rationale: str = Field(min_length=5, max_length=500)
    duplicate_of: UUID | None = None
    reviewed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


SENSITIVE_PUBLIC_FIELDS = {"reporter_contact", "vehicle_plate", "has_graphic_evidence"}
