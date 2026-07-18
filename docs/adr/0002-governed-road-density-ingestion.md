# ADR 0002: Governed road-density ingestion boundaries

## Status
Accepted

## Context
Ọ̀nàSafe Nigeria currently ships a public road-density explorer backed by simulated demonstration incidents. Future data may include FRSC incident-level records, NBS aggregate road-safety statistics, and state VIO inspection records, but those sources have different meanings and must not be mixed in fatality rendering.

## Decision
The public web application keeps four explicit dataset contracts: `simulation_incidents`, `frsc_incidents`, `nbs_aggregates`, and `state_vio_inspections`. Only spatial incident datasets (`simulation_incidents` and validated future `frsc_incidents`) may enter map icons and road-bin fatality calculations. NBS aggregates are reserved for aggregate summaries at their supplied geography and time period. VIO inspection records are reserved for a separate roadworthiness layer and never contribute to crash or fatality totals.

Simulation disclosure remains mandatory in the control panel, map stage, summary area, detail panel, and methodology copy until verified agency incident records are actually present and validated.

## Consequences
This preserves public-safety trust by preventing aggregate totals or vehicle-inspection records from becoming invented crash coordinates. It also lets the static explorer ship useful road-density behavior now while keeping a durable path for future FRSC, NBS, and state VIO ingestion.
