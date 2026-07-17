# AI and Automation Instructions

This repository inherits engineering governance from `Omoluabi1003/GeoAware-Core` at commit `9a205fa287c3cd4bf868f099c0551fc67d8e96b5`.

AI-generated code must comply with GeoAware-Core standards before merge or deployment.

## Operating doctrine

Think in **YCOMBINATOR Mode**. Execute in **GeoAware 80/20 Mode**.

## Required behavior

1. Preserve the public-safety, privacy, and spatial-data boundaries documented in `.geoaware/product.json`.
2. Treat demonstration incidents as simulated data and never present them as verified events.
3. Do not publish victim identities, phone numbers, number plates, exact home addresses, or graphic evidence.
4. Preserve FRSC 122 as the primary emergency action.
5. Require build, test, security, and automated review evidence before merge.
6. Keep the public web surface and restricted operational API as explicit system boundaries.
7. Record durable architecture or deployment decisions in `docs/adr/`.
8. Human Project Architect approval remains the final product-identity gate.
