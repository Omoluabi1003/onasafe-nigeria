# Ọ̀nàSafe Nigeria

Ọ̀nàSafe Nigeria is a GeoAware Core governed crash-intelligence and emergency-response platform for Nigerian road corridors, beginning with a 90-day Lagos–Ibadan Expressway pilot.

> This repository inherits engineering governance from `Omoluabi1003/GeoAware-Core` at commit `9a205fa287c3cd4bf868f099c0551fc67d8e96b5`.

## Current product surfaces

### Public web application

The root application is a functioning privacy-safe map with:

- Interactive Lagos–Ibadan corridor visualization
- Severity, verification, and search filters
- Severity-weighted corridor risk index
- GPS capture with coordinate accuracy and full timestamps
- Local browser-only prototype reporting
- Direct FRSC 122 emergency escalation
- Clearly labelled simulated demonstration records

After the deployment workflow completes on `main`, the expected GitHub Pages address is:

`https://omoluabi1003.github.io/onasafe-nigeria/`

### Operations API contract

`apps/api` retains the FastAPI contract for reports, verification, public incidents, responder status, and audit behavior. It is intentionally separate from the public static surface until production authentication, PostGIS persistence, rate limiting, evidence controls, and data-protection requirements are implemented.

## Run locally

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

Run validation:

```bash
pip install -r requirements.txt
pytest -q
python scripts/validate_static.py
node --check app.js
```

## Governance and decision memory

- `AGENTS.md` defines AI and automation behavior.
- `ENGINEERING_PRINCIPLES.md` defines product-specific non-negotiables.
- `.geoaware/product.json` is the product passport and system-boundary contract.
- `docs/adr/0001-public-web-and-api-boundary.md` records the deployment and data-boundary decision.
- `.github/workflows/quality.yml` enforces tests, validation, syntax checks, and dependency auditing.
- `.github/workflows/pages.yml` publishes only the approved public assets.

## Safety rules

Demonstration data must never be represented as verified crash data. Do not publish victim names, phone numbers, vehicle registration plates, exact home addresses, or graphic evidence. The browser report form is not an emergency dispatch channel. Call FRSC 122 for immediate response.
