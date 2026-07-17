#!/usr/bin/env python3
"""Validate the deployable Ọ̀nàSafe static surface and GeoAware contract."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REQUIRED = [
    "index.html",
    "styles.css",
    "status.css",
    "app.js",
    "data/demo-crashes.geojson",
    "AGENTS.md",
    "ENGINEERING_PRINCIPLES.md",
    "CONTRIBUTING.md",
    ".geoaware/product.json",
    "docs/adr/0001-public-web-and-api-boundary.md",
]


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def main() -> None:
    for relative in REQUIRED:
        require((ROOT / relative).is_file(), f"Missing required file: {relative}")

    index = (ROOT / "index.html").read_text(encoding="utf-8")
    require("tel:122" in index, "FRSC 122 emergency action is missing")
    require("GeoAware Core governed" in index, "Visible GeoAware governance marker is missing")
    require("app.js" in index and "data/demo-crashes.geojson" not in index, "Static asset wiring is invalid")
    require("sw.js" not in index and "manifest.webmanifest" not in index, "Premature offline/PWA wiring must remain removed")

    passport = json.loads((ROOT / ".geoaware/product.json").read_text(encoding="utf-8"))
    governance = passport.get("governance", {})
    require(governance.get("inherits_from") == "Omoluabi1003/GeoAware-Core", "GeoAware Core inheritance is missing")
    require(len(governance.get("pinned_commit", "")) == 40, "GeoAware Core commit must be pinned")
    require(governance.get("human_final_approval") is True, "Human final approval must remain enabled")

    data = json.loads((ROOT / "data/demo-crashes.geojson").read_text(encoding="utf-8"))
    require(data.get("type") == "FeatureCollection", "Crash data must be a GeoJSON FeatureCollection")
    require("simulated" in data.get("metadata", {}).get("disclaimer", "").lower(), "Simulation disclaimer is missing")
    features = data.get("features")
    require(isinstance(features, list) and features, "At least one demonstration feature is required")

    ids: set[str] = set()
    for feature in features:
        props = feature.get("properties") or {}
        geometry = feature.get("geometry") or {}
        coordinates = geometry.get("coordinates", [])
        require(geometry.get("type") == "Point" and len(coordinates) == 2, "Every incident must be a Point")
        longitude, latitude = coordinates
        require(2.0 <= longitude <= 15.0 and 4.0 <= latitude <= 14.5, "Incident coordinate falls outside Nigeria")
        require(props.get("verification") == "simulated", "Demonstration records must remain simulated")
        require(props.get("provenance") == "simulated_demo", "Demonstration record provenance is required")
        require(props.get("id") and props["id"] not in ids, "Incident IDs must be unique")
        ids.add(props["id"])
        require(float(props.get("coordinate_accuracy_m", 0)) > 0, "Coordinate accuracy is required")
        captured_at = props.get("captured_at", "")
        datetime.fromisoformat(captured_at.replace("Z", "+00:00"))

    print(f"Validated {len(features)} simulated incidents and the GeoAware product contract.")


if __name__ == "__main__":
    main()
