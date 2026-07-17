# Ọ̀nàSafe Nigeria Product Charter

## Product thesis

Nigeria does not need another passive accident map. It needs a spatial operating system that converts fragmented crash reports into verified incidents, faster emergency escalation, corridor-risk intelligence, and measurable prevention decisions.

## North-star outcome

Reduce the time between crash occurrence, reliable location capture, responder notification, and arrival while generating evidence that helps agencies prevent repeat incidents.

## Initial customer and beneficiary groups

1. FRSC command and rescue teams
2. Federal and state road authorities
3. State emergency-management agencies
4. Fleet and logistics operators
5. Insurers and risk managers
6. Road users and communities

## Pilot boundary

Lagos–Ibadan Expressway, selected because it combines high traffic volume, commercial transport, inter-state movement, complex interchanges, and strong visibility for a national proof of value.

## MVP modules

### 1. Public safety map

- Crash and hazard points
- Severity, date, road segment, contributing factor, and verification status
- Nearby response assets and hospitals in the production release
- Mobile-first, low-bandwidth experience

### 2. Structured reporting

- GPS capture
- Time, severity, vehicle category, road condition, weather, and narrative
- Optional evidence upload in production
- No victim identity or plate publication
- Automatic duplicates and confidence scoring

### 3. Responder console

- New incident queue
- Location confidence
- Callback status
- Dispatch, en route, on scene, transported, and closed states
- FRSC 122 escalation bridge

### 4. Corridor intelligence

- Hotspot detection by road segment
- Severity-weighted risk index
- Temporal pattern analysis
- Commercial vehicle and fleet exposure
- Before-and-after intervention evaluation

### 5. Executive dashboard

- Response times
- Fatal and serious crash trends
- Repeat hotspots
- Cause distribution
- Road authority action register
- State, LGA, route, and corridor comparisons

## Data model

Core entities:

- `incident`
- `incident_location`
- `casualty_summary`
- `vehicle_summary`
- `road_condition`
- `weather_observation`
- `report_source`
- `verification_event`
- `response_action`
- `road_segment`
- `risk_score`
- `intervention`

Every published incident should carry provenance, verification level, coordinate accuracy, creation time, update time, and responsible reviewing organization.

## Verification framework

- Level 0: unverified public submission
- Level 1: corroborated by two independent signals
- Level 2: verified partner or responder report
- Level 3: agency-confirmed official incident

The public map should expose the verification level without exposing restricted evidence.

## AI responsibilities

Use AI for extraction, classification, geocoding assistance, deduplication, anomaly detection, and prioritization. AI must not independently declare fatalities, assign legal fault, or publish personally identifiable information.

## Privacy and governance

Precise location data may become personal data when linked to an identifiable person. Production design therefore requires privacy-by-design, role-based access, data minimization, encryption, audit logs, retention rules, breach response, and a Data Protection Impact Assessment under Nigeria's data-protection framework.

## 90-day delivery model

### Days 1–15: Foundation

- Incorporate product identity and governance
- Confirm pilot partners and corridor extent
- Define canonical crash schema
- Establish data-sharing and privacy terms
- Build design system and spatial base layers

### Days 16–45: MVP build

- Public map
- Reporting workflow
- Verification queue
- Basic responder console
- Corridor dashboard
- Authentication and audit trail

### Days 46–70: Data and field integration

- Load available historical aggregates and verified records
- Test FRSC escalation workflow
- Add road segments, hospitals, response posts, and weather
- Conduct field usability testing

### Days 71–90: Pilot operations

- Controlled launch
- Daily data-quality review
- Response-time measurement
- Hotspot analysis
- Pilot findings and scale recommendation

## Commercial model

- Government platform licensing and implementation
- Fleet risk subscriptions
- Insurer portfolio analytics
- Sponsored corridor-safety programs
- Consulting for crash-data modernization and road-safety analytics

Public reporting and emergency access should remain free.

## Success metrics

- Percentage of reports geolocated within 50 metres
- Median report-to-verification time
- Median verification-to-escalation time
- Duplicate detection precision
- Number of repeat hotspots identified
- Number of interventions tracked
- Change in fatal and serious crash rate on treated segments
- Active partner organizations

## Immediate backlog

1. Establish the repository as `onasafe-nigeria`.
2. Convert this prototype to Next.js and TypeScript.
3. Create a PostGIS schema and seeded demonstration database.
4. Build authenticated verifier and responder roles.
5. Implement a report API with validation and rate limiting.
6. Add H3 or linear-referenced road-segment hotspot analysis.
7. Create an agency data-import template for CSV, Excel, and API sources.
8. Produce the FRSC and state-government pilot proposal.
9. Conduct a privacy and threat-model workshop.
10. Recruit one corridor partner and one fleet operator for the pilot.
