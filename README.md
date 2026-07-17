# Ọ̀nàSafe Nigeria

Ọ̀nàSafe Nigeria is a crash-intelligence and emergency-response spatial operating system for Nigerian corridors, beginning with a 90-day Lagos-Ibadan Expressway pilot.

This repository contains an MVP product scaffold with:

- A privacy-safe public incident and hazard map specification.
- Structured GPS-enabled reporting requirements.
- Operations workflows for verification, duplicate handling, responder status, role-based access, and auditability.
- Analytics requirements for hotspots, road-segment risk, temporal patterns, and intervention tracking.

## Non-negotiable safety and trust rules

1. Public map records must show provenance and verification level.
2. Demonstration data must never be presented as verified crash data.
3. Victim names, phone numbers, number plates, and graphic evidence must never be public.
4. FRSC 122 remains the primary emergency escalation action.
5. AI may assist review but must not declare fatalities or legal fault.
6. The interface must work on low-bandwidth mobile connections.
7. All spatial records must include coordinate accuracy and timestamps.

## Pilot

- **Corridor:** Lagos-Ibadan Expressway
- **Duration:** 90 days
- **Primary users:** FRSC, road authorities, emergency agencies, fleets, and insurers
- **North star:** Reduce report-to-verification-to-escalation time and generate actionable prevention intelligence.

## Definition of done

- A user can report a crash with GPS coordinates.
- A verifier can review, merge, reject, or confirm the report.
- A responder can update operational status.
- The public can view only privacy-safe incident information.
- The system produces corridor hotspots and intervention-ready evidence.
- All changes are auditable.
