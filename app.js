const ROAD_DATASETS = {
  simulation_incidents: {
    datasetType: 'simulation_incidents',
    name: 'Lagos–Ibadan Expressway simulated demonstration dataset',
    label: 'SIMULATED DEMONSTRATION DATA',
    sourceName: 'Ọ̀nàSafe Nigeria demonstration dataset',
    sourceReference: 'data/demo-crashes.geojson',
    verificationStatus: 'simulated',
    isSimulated: true,
    temporalStart: '2026-03-14',
    temporalEnd: '2026-06-28',
    ingestedAt: '2026-07-17T04:00:00Z',
    updatedAt: '2026-07-17T04:00:00Z'
  },
  frsc_incidents: { datasetType: 'frsc_incidents', name: 'FRSC incident-level adapter', enabled: false },
  nbs_aggregates: { datasetType: 'nbs_aggregates', name: 'NBS aggregate adapter', enabled: false },
  state_vio_inspections: { datasetType: 'state_vio_inspections', name: 'State VIO inspection adapter', enabled: false }
};

const ROADS = [{
  id: 'lagos-ibadan-a1',
  name: 'Lagos–Ibadan Expressway',
  routeIdentifier: 'A1',
  binLengthKm: 5,
  coordinates: [[6.5768, 3.3833], [6.6500, 3.4550], [6.7350, 3.4450], [6.8200, 3.5200], [6.8390, 3.6315], [6.9500, 3.6650], [7.0750, 3.7650], [7.2200, 3.8400], [7.3950, 3.9300]]
}];

const BASEMAPS = {
  streets: { label: 'Streets', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap contributors' },
  light: { label: 'Light', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attribution: '&copy; OpenStreetMap contributors &copy; CARTO' }
};

const ui = {};
let map, baseLayer, corridorHaloLayer, corridorLayer, fatalityLayer, actualPointLayer;
let selectedRoad = ROADS[0];
let fatalRecords = [];
let validationReport = { rejected: [] };
let activeBins = [];
let activeIconMode = 'persons';
let hasFitSelectedRoad = false;

function escapeHtml(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
function toDisplayDate(value) { return new Date(`${value}T00:00:00Z`).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }); }
function haversineKm(a, b) { const r = 6371; const rad = v => v * Math.PI / 180; const dLat = rad(b[0] - a[0]); const dLon = rad(b[1] - a[1]); const lat1 = rad(a[0]); const lat2 = rad(b[0]); const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2; return 2 * r * Math.asin(Math.sqrt(h)); }
function buildRouteMeasure(road = selectedRoad) { const cumulative = [0]; for (let i = 1; i < road.coordinates.length; i += 1) cumulative.push(cumulative[i - 1] + haversineKm(road.coordinates[i - 1], road.coordinates[i])); return { cumulative, totalKm: cumulative.at(-1) }; }
function projectRecordToRoute(record, road = selectedRoad) { const measure = buildRouteMeasure(road); const point = { x: record.longitude, y: record.latitude }; let best = { distanceKm: Infinity, routeKm: 0 }; for (let i = 1; i < road.coordinates.length; i += 1) { const start = { x: road.coordinates[i - 1][1], y: road.coordinates[i - 1][0] }; const end = { x: road.coordinates[i][1], y: road.coordinates[i][0] }; const dx = end.x - start.x; const dy = end.y - start.y; const t = Math.max(0, Math.min(1, (((point.x - start.x) * dx) + ((point.y - start.y) * dy)) / ((dx * dx) + (dy * dy) || 1))); const projected = { x: start.x + (dx * t), y: start.y + (dy * t) }; const crossTrackKm = haversineKm([point.y, point.x], [projected.y, projected.x]); if (crossTrackKm < best.distanceKm) best = { distanceKm: crossTrackKm, routeKm: measure.cumulative[i - 1] + ((measure.cumulative[i] - measure.cumulative[i - 1]) * t) }; } return best; }

/** Normalize raw source records into governed incident records; returns null for unsafe render inputs. */
function normalizeIncident(feature, dataset = ROAD_DATASETS.simulation_incidents, road = selectedRoad) {
  const p = feature?.properties || {}; const c = feature?.geometry?.coordinates || [];
  if (!['simulation_incidents', 'frsc_incidents'].includes(dataset.datasetType)) return null;
  const latitude = Number(c[1]); const longitude = Number(c[0]); const fatalities = p.fatalities === undefined ? (p.severity === 'fatal' ? 1 : 0) : Number(p.fatalities);
  const incidentDatetime = p.incident_datetime || p.captured_at || (p.date ? `${p.date}T00:00:00Z` : ''); const accuracy = Number(p.coordinate_accuracy_m);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  if (!Number.isInteger(fatalities) || fatalities < 0) return null;
  if (!incidentDatetime || Number.isNaN(Date.parse(incidentDatetime))) return null;
  if (!Number.isFinite(accuracy) || accuracy <= 0) return null;
  if (dataset.isSimulated && p.verification !== 'simulated') return null;
  const projected = projectRecordToRoute({ latitude, longitude }, road);
  return { record_id: p.id || p.record_id, incident_id: p.incident_id || p.id, dataset_type: dataset.datasetType, source_name: dataset.sourceName, source_reference: dataset.sourceReference, verification_status: dataset.verificationStatus, is_simulated: Boolean(dataset.isSimulated), temporal_start: dataset.temporalStart, temporal_end: dataset.temporalEnd, ingested_at: dataset.ingestedAt, updated_at: dataset.updatedAt, road_id: road.id, road_name: road.name, route_identifier: road.routeIdentifier, incident_datetime: incidentDatetime, latitude, longitude, fatalities, injuries: Number.isFinite(Number(p.injuries)) ? Number(p.injuries) : undefined, severity: p.severity || (fatalities > 0 ? 'fatal' : 'unknown'), coordinate_accuracy_m: accuracy, coordinate_method: p.coordinate_method || 'demonstration point placement', location_description: p.location || p.location_description, road_distance_km: projected.routeKm, cross_track_distance_km: projected.distanceKm };
}

/** Validate and normalize a FeatureCollection for incident rendering. */
function normalizeFeatureCollection(geojson, dataset = ROAD_DATASETS.simulation_incidents, road = selectedRoad) {
  const accepted = []; const rejected = [];
  if (!Array.isArray(geojson?.features)) return { accepted, rejected: [{ reason: 'not_feature_collection' }] };
  geojson.features.forEach((feature, index) => { const record = normalizeIncident(feature, dataset, road); if (record) accepted.push(record); else rejected.push({ index, reason: 'invalid_or_not_renderable_incident' }); });
  return { accepted, rejected };
}

/** Build ordered fatality bins along the selected road. */
function groupIntoBins(records, binSizeKm, road = selectedRoad) { const measure = buildRouteMeasure(road); const count = Math.ceil(measure.totalKm / binSizeKm); const bins = Array.from({ length: count }, (_, i) => ({ binIndex: i, startKm: i * binSizeKm, endKm: Math.min((i + 1) * binSizeKm, measure.totalKm), records: [], fatalities: 0, injuries: 0, incidentIds: [] })); records.forEach(record => { const index = Math.min(count - 1, Math.max(0, Math.floor(record.road_distance_km / binSizeKm))); const bin = bins[index]; bin.records.push(record); bin.fatalities += record.fatalities; bin.injuries += record.injuries || 0; bin.incidentIds.push(record.incident_id); }); return bins.map(bin => ({ ...bin, latitude: bin.records.length ? bin.records.reduce((s, r) => s + r.latitude, 0) / bin.records.length : road.coordinates[Math.min(road.coordinates.length - 1, Math.floor((bin.binIndex / Math.max(1, count - 1)) * (road.coordinates.length - 1)))][0], longitude: bin.records.length ? bin.records.reduce((s, r) => s + r.longitude, 0) / bin.records.length : road.coordinates[Math.min(road.coordinates.length - 1, Math.floor((bin.binIndex / Math.max(1, count - 1)) * (road.coordinates.length - 1)))][1] })).sort((a, b) => a.startKm - b.startKm); }
function calculateMetrics(records, bins, road = selectedRoad) { return { fatalCrashes: records.filter(r => r.fatalities > 0).length, totalFatalities: records.reduce((s, r) => s + r.fatalities, 0), roadLengthKm: buildRouteMeasure(road).totalKm, peakBinDeaths: Math.max(0, ...bins.map(bin => bin.fatalities)) }; }
function createPersonFigures(count) { return Array.from({ length: count }, (_, i) => `<span class="human-figure" style="animation-delay:${i * 50}ms" aria-hidden="true"></span>`).join(''); }
function setStatus(message, tone = 'info') { ui.appStatus.textContent = message; ui.appStatus.dataset.tone = tone; ui.appStatus.hidden = !message; }
function renderDisclosure() { const d = ROAD_DATASETS.simulation_incidents; ui.datasetName.textContent = d.name; ui.verificationStatus.textContent = d.verificationStatus; ui.temporalCoverage.textContent = `${toDisplayDate(d.temporalStart)} – ${toDisplayDate(d.temporalEnd)}`; ui.simulationStatus.textContent = d.label; ui.sourceReference.textContent = d.sourceReference; }
function renderMetrics(records, bins) { const m = calculateMetrics(records, bins); ui.fatalCrashes.textContent = m.fatalCrashes; ui.roadLength.textContent = m.roadLengthKm.toFixed(1); ui.peakBinDeaths.textContent = m.peakBinDeaths; ui.totalFatalities.textContent = m.totalFatalities; ui.narrative.textContent = `${selectedRoad.name} (${selectedRoad.routeIdentifier}) contains ${m.fatalCrashes} fatal simulated demonstration crashes and ${m.totalFatalities} simulated deaths across ${m.roadLengthKm.toFixed(1)} km for ${ui.temporalCoverage.textContent}. Verification status: simulated; these are not official agency records.`; }
function binPopup(bin) { const dateRange = bin.records.length ? `${bin.records.map(r => r.incident_datetime.slice(0, 10)).sort()[0]} – ${bin.records.map(r => r.incident_datetime.slice(0, 10)).sort().at(-1)}` : 'No records'; return `<strong>${bin.startKm.toFixed(0)}–${bin.endKm.toFixed(0)} km · ${bin.fatalities} simulated deaths</strong><p>${bin.records.length} fatal crashes · injuries: ${bin.injuries || 'not provided'} · ${dateRange}</p><p>Source: ${escapeHtml(ROAD_DATASETS.simulation_incidents.sourceName)} · ${ROAD_DATASETS.simulation_incidents.verificationStatus} · ${ROAD_DATASETS.simulation_incidents.label}</p><p>Coordinate accuracy: ${bin.records.map(r => `${r.coordinate_accuracy_m}m`).join(', ') || 'n/a'}</p>`; }
function renderActualPoints(records) { actualPointLayer.clearLayers(); records.forEach(record => L.circleMarker([record.latitude, record.longitude], { radius: 4, color: '#fff', weight: 2, fillColor: '#75336f', fillOpacity: .95 }).bindTooltip(`${escapeHtml(record.location_description)} · ${record.incident_datetime.slice(0,10)}`).addTo(actualPointLayer)); }
function renderSegmentSummary(bins) { const occupied = bins.filter(bin => bin.fatalities > 0); ui.segmentTotal.textContent = occupied.length; ui.segmentList.innerHTML = occupied.length ? occupied.map(bin => `<button class="segment-row" type="button" data-bin="${bin.binIndex}"><span class="segment-km">${bin.startKm.toFixed(0)}–${bin.endKm.toFixed(0)} km</span><span class="segment-bar"><i style="width:${Math.max(12, (bin.fatalities / Math.max(...occupied.map(b => b.fatalities))) * 100)}%"></i></span><strong>${bin.fatalities}</strong></button>`).join('') : '<div class="segment-empty">No occupied road bins for this selection.</div>'; ui.segmentList.querySelectorAll('button').forEach(button => button.addEventListener('click', () => openBinDetail(activeBins.find(bin => String(bin.binIndex) === button.dataset.bin)))); }
function openBinDetail(bin) { if (!bin) return; ui.detailPanel.hidden = false; ui.detailPanel.innerHTML = `<button class="detail-close" type="button" aria-label="Close details">×</button><h2>${escapeHtml(selectedRoad.name)}</h2><p class="simulation-chip">${ROAD_DATASETS.simulation_incidents.label}</p>${binPopup(bin)}<p>Contributing incident IDs: ${bin.incidentIds.map(escapeHtml).join(', ') || 'None'}</p>`; ui.detailPanel.querySelector('button').addEventListener('click', () => { ui.detailPanel.hidden = true; }); if (bin.fatalities) map.flyTo([bin.latitude, bin.longitude], Math.max(map.getZoom(), 11), { duration: .4 }); }
function renderDensity() { fatalityLayer.clearLayers(); const binSize = Number(ui.binSlider.value); const records = fatalRecords.filter(r => r.fatalities > 0); const bins = groupIntoBins(records, binSize); activeBins = bins; renderActualPoints(records); bins.filter(b => b.fatalities > 0).forEach(bin => { const html = activeIconMode === 'persons' ? `<div class="fatality-stack"><div class="bin-label">${bin.fatalities}</div>${createPersonFigures(bin.fatalities)}<span class="bin-stem" aria-hidden="true"></span></div>` : activeIconMode === 'circles' ? `<div class="fatality-circle" style="--size:${Math.max(34, 24 + bin.fatalities * 12)}px">${bin.fatalities}</div>` : `<div class="fatality-density" style="--intensity:${Math.min(1, bin.fatalities / Math.max(1, ...bins.map(b => b.fatalities)))}">${bin.fatalities}</div>`; const marker = L.marker([bin.latitude, bin.longitude], { keyboard: true, riseOnHover: true, icon: L.divIcon({ className: 'fatality-bin', html: `<button class="stack-button" type="button" aria-label="${bin.fatalities} simulated deaths, ${bin.records.length} fatal crashes, ${bin.startKm.toFixed(0)} to ${bin.endKm.toFixed(0)} kilometres. Open details.">${html}</button>`, iconSize: [1,1], iconAnchor: [0,0] }) }).bindPopup(binPopup(bin), { maxWidth: 340 }).addTo(fatalityLayer); marker.on('click keypress', () => openBinDetail(bin)); }); renderMetrics(records, bins); renderSegmentSummary(bins); ui.mapEmptyState.hidden = records.length !== 0; setStatus(`${records.length} simulated fatal crashes displayed across ${bins.filter(b => b.fatalities).length} occupied road bins.`, 'success'); }
function switchBasemap(key) { if (!BASEMAPS[key]) return; if (baseLayer) baseLayer.remove(); baseLayer = L.tileLayer(BASEMAPS[key].url, { maxZoom: 19, attribution: BASEMAPS[key].attribution }).addTo(map); baseLayer.bringToBack(); renderDensity(); }
function fitSelectedRoad(force = false) { if (!force && hasFitSelectedRoad) return; map.fitBounds(corridorLayer.getBounds(), { padding: [70, 70], animate: false }); hasFitSelectedRoad = true; }
async function loadData() { const response = await fetch(ROAD_DATASETS.simulation_incidents.sourceReference, { cache: 'no-store' }); if (!response.ok) throw new Error('Unable to load the simulated corridor dataset.'); validationReport = normalizeFeatureCollection(await response.json()); fatalRecords = validationReport.accepted; ui.invalidCount.textContent = validationReport.rejected.length; renderDensity(); }
function bindEvents() { ui.resetExtent.addEventListener('click', () => fitSelectedRoad(true)); ui.binSlider.addEventListener('input', () => { ui.binValue.textContent = `${ui.binSlider.value} km`; renderDensity(); }); ui.iconMode.addEventListener('change', () => { activeIconMode = ui.iconMode.value; renderDensity(); }); ui.basemap.addEventListener('change', () => switchBasemap(ui.basemap.value)); ui.drawerToggle.addEventListener('click', () => { ui.drawer.classList.toggle('closed'); ui.drawerToggle.setAttribute('aria-expanded', String(!ui.drawer.classList.contains('closed'))); }); ui.methodBtn.addEventListener('click', () => ui.methodDialog.showModal()); ui.roadSelect.addEventListener('change', () => { selectedRoad = ROADS.find(road => road.id === ui.roadSelect.value) || ROADS[0]; hasFitSelectedRoad = false; renderDensity(); fitSelectedRoad(true); }); }
function boot() { Object.assign(ui, { appStatus: document.getElementById('appStatus'), drawer: document.querySelector('.control-drawer'), drawerToggle: document.getElementById('drawerToggle'), methodBtn: document.getElementById('methodBtn'), methodDialog: document.getElementById('methodDialog'), datasetName: document.getElementById('datasetName'), verificationStatus: document.getElementById('verificationStatus'), temporalCoverage: document.getElementById('temporalCoverage'), simulationStatus: document.getElementById('simulationStatus'), sourceReference: document.getElementById('sourceReference'), roadSelect: document.getElementById('roadSelect'), iconMode: document.getElementById('iconMode'), basemap: document.getElementById('basemap'), fatalCrashes: document.getElementById('fatalCrashes'), roadLength: document.getElementById('roadLength'), peakBinDeaths: document.getElementById('peakBinDeaths'), totalFatalities: document.getElementById('totalFatalities'), narrative: document.getElementById('narrative'), invalidCount: document.getElementById('invalidCount'), binSlider: document.getElementById('binSlider'), binValue: document.getElementById('binValue'), segmentTotal: document.getElementById('segmentTotal'), segmentList: document.getElementById('segmentList'), mapEmptyState: document.getElementById('mapEmptyState'), resetExtent: document.getElementById('resetExtent'), detailPanel: document.getElementById('detailPanel') }); renderDisclosure(); if (!window.L) { document.getElementById('map').innerHTML = '<p>The mapping library could not load. Check the connection and reload.</p>'; return; } map = L.map('map', { zoomControl: false, preferCanvas: true }).setView([6.95, 3.63], 9); L.control.zoom({ position: 'bottomright' }).addTo(map); switchBasemap('streets'); corridorHaloLayer = L.polyline(selectedRoad.coordinates, { color: '#ffffff', weight: 12, opacity: .94 }).addTo(map); corridorLayer = L.polyline(selectedRoad.coordinates, { color: '#155b52', weight: 7, opacity: .98 }).addTo(map).bindTooltip(`${selectedRoad.name} · ${selectedRoad.routeIdentifier}`); actualPointLayer = L.layerGroup().addTo(map); fatalityLayer = L.layerGroup().addTo(map); bindEvents(); fitSelectedRoad(true); loadData().catch(error => setStatus(error.message, 'error')); }

if (typeof window !== 'undefined') window.OnasafeRoadDensity = { ROAD_DATASETS, ROADS, normalizeIncident, normalizeFeatureCollection, groupIntoBins, calculateMetrics, createPersonFigures, buildRouteMeasure };
if (typeof document !== 'undefined') boot();
