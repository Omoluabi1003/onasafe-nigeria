# Ọ̀nàSafe Nigeria MVP

Ọ̀nàSafe Nigeria is a functional front-end prototype for a national crash-intelligence and emergency-response platform. The initial pilot is scoped to the Lagos–Ibadan Expressway corridor.

## What is included

- Interactive Leaflet crash map
- Severity and verification filters
- Corridor risk score
- Incident search and operational feed
- FRSC 122 emergency call action
- Browser geolocation
- Privacy-conscious community crash form
- Local device storage for prototype reports
- Responsive interface and basic PWA support
- Clearly labelled simulated map records

## Run locally

Because the app loads GeoJSON through `fetch`, open it through a local web server:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Deploy

This package can be deployed as a static site to GitHub Pages, Cloudflare Pages, Netlify, or Vercel without a build step.

## Data status

The national KPI panel uses the National Bureau of Statistics Road Transport Report Q1 2026 aggregate figures. The mapped incident records are simulated and must not be represented as verified real-world crashes.

Primary dataset catalog:
https://microdata.nigerianstat.gov.ng/index.php/catalog/164/related-materials

FRSC emergency information:
https://frsc.gov.ng/

Nigeria Data Protection Commission:
https://ndpc.gov.ng/

## Recommended production stack

- Front end: Next.js, TypeScript, MapLibre GL JS
- API: FastAPI or NestJS
- Spatial database: PostgreSQL/PostGIS
- Queue and cache: Redis
- Object evidence storage: S3-compatible encrypted bucket
- Authentication: Keycloak, Auth0, or Microsoft Entra External ID
- Analytics: Python, GeoPandas, scikit-learn, H3
- Hosting: Nigerian-region capable cloud or approved government infrastructure
- Observability: OpenTelemetry, Sentry, Grafana

## Production safeguards

Do not publish victim names, phone numbers, vehicle registration plates, exact home addresses, or graphic images. Separate public visualization data from restricted responder evidence, implement retention rules, and complete a Data Protection Impact Assessment before production processing of precise location or media evidence.
