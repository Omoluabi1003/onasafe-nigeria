# ADR 0001: Public Web and Operations API Boundary

- **Status:** Accepted
- **Date:** 2026-07-17
- **Decision owner:** Paul Iyogun, Project Architect
- **Governance:** Omoluabi1003/GeoAware-Core

## Context

Ọ̀nàSafe requires a functioning public product surface immediately while its restricted responder and verification infrastructure is still evolving. Combining unverified public reporting, sensitive operational evidence, and a static public deployment would create privacy, security, and deployment risk.

## Decision

1. Deploy the privacy-safe map and local demonstration reporting as a static GitHub Pages application.
2. Retain the FastAPI application as a separate operations contract for reporting, verification, responder status, and audit behavior.
3. Do not connect the public application to a production incident API until authentication, persistent storage, rate limiting, auditability, retention controls, and a Data Protection Impact Assessment are complete.
4. Treat all current mapped incidents as simulated records.
5. Require every spatial record to carry provenance, verification status, coordinate accuracy, and a full timestamp.
6. Remove premature offline caching because external map tiles and CDN assets create privacy, reliability, and storage concerns without a complete offline architecture.

## Consequences

- The public application becomes deployable and useful without exposing restricted data.
- Prototype reports remain local to the user's browser and are not emergency dispatch submissions.
- The API remains testable and available for controlled backend development.
- A future production integration requires a separate ADR covering hosting, PostGIS, authentication, evidence storage, and agency data-sharing.
