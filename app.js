const corridorCoordinates = [
  [6.5768, 3.3833], [6.6500, 3.4550], [6.7350, 3.4450], [6.8200, 3.5200],
  [6.8390, 3.6315], [6.9500, 3.6650], [7.0750, 3.7650], [7.2200, 3.8400], [7.3950, 3.9300]
];

const ROAD_ALIASES = ['lagos–ibadan expressway', 'lagos-ibadan expressway', 'a1', 'lagos ibadan'];
const ui = {};
let map;
let corridorLayer;
let fatalityLayer;
let fatalRecords = [];
let activeTime = 'all';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setStatus(message, tone = 'info') {
  ui.appStatus.textContent = message;
  ui.appStatus.dataset.tone = tone;
  ui.appStatus.hidden = !message;
}

function haversineKm(a, b) {
  const toRad = value => value * Math.PI / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function buildRouteMeasure() {
  const cumulative = [0];
  for (let index = 1; index < corridorCoordinates.length; index += 1) {
    cumulative.push(cumulative[index - 1] + haversineKm(corridorCoordinates[index - 1], corridorCoordinates[index]));
  }
  return { cumulative, totalKm: cumulative.at(-1) };
}

const routeMeasure = buildRouteMeasure();

function pointAtDistance(distanceKm) {
  const target = Math.max(0, Math.min(distanceKm, routeMeasure.totalKm));
  for (let index = 1; index < routeMeasure.cumulative.length; index += 1) {
    const segmentEnd = routeMeasure.cumulative[index];
    if (target <= segmentEnd) {
      const segmentStart = routeMeasure.cumulative[index - 1];
      const ratio = segmentEnd === segmentStart ? 0 : (target - segmentStart) / (segmentEnd - segmentStart);
      const start = corridorCoordinates[index - 1];
      const end = corridorCoordinates[index];
      return [start[0] + ((end[0] - start[0]) * ratio), start[1] + ((end[1] - start[1]) * ratio)];
    }
  }
  return corridorCoordinates.at(-1);
}

function approximateRoadDistance(record) {
  const point = [record.latitude, record.longitude];
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  corridorCoordinates.forEach((coordinate, index) => {
    const distance = haversineKm(point, coordinate);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });
  return routeMeasure.cumulative[nearestIndex];
}

function normalizeRecord(feature) {
  const properties = feature?.properties || {};
  const coordinates = feature?.geometry?.coordinates || [];
  const capturedAt = typeof properties.captured_at === 'string' ? properties.captured_at : null;
  const latitude = Number(coordinates[1]);
  const longitude = Number(coordinates[0]);
  const accuracy = Number(properties.coordinate_accuracy_m);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (!capturedAt || !Number.isFinite(accuracy) || accuracy <= 0) return null;
  if (!properties.provenance || properties.verification !== 'simulated') return null;

  return {
    ...properties,
    latitude,
    longitude,
    captured_at: capturedAt,
    coordinate_accuracy_m: accuracy,
    road_distance_km: 0
  };
}

function periodFor(record) {
  const month = Number(record.captured_at.slice(5, 7));
  if (month === 3 || month === 4) return 'mar-apr';
  if (month === 5 || month === 6) return 'may-jun';
  return 'other';
}

function timeFor(record) {
  const hour = new Date(record.captured_at).getUTCHours();
  return hour >= 6 && hour < 18 ? 'day' : 'night';
}

function currentPeriod() {
  return document.querySelector('input[name="period"]:checked')?.value || 'all';
}

function filteredFatalities() {
  const period = currentPeriod();
  return fatalRecords.filter(record => {
    const periodMatch = period === 'all' || periodFor(record) === period;
    const timeMatch = activeTime === 'all' || timeFor(record) === activeTime;
    return periodMatch && timeMatch;
  });
}

function groupIntoBins(records, binSizeKm) {
  const bins = new Map();
  records.forEach(record => {
    const binIndex = Math.floor(record.road_distance_km / binSizeKm);
    if (!bins.has(binIndex)) bins.set(binIndex, []);
    bins.get(binIndex).push(record);
  });
  return [...bins.entries()].map(([binIndex, items]) => ({
    binIndex,
    items,
    midpointKm: Math.min((binIndex * binSizeKm) + (binSizeKm / 2), routeMeasure.totalKm)
  }));
}

function humanFigures(count) {
  return Array.from({ length: count }, () => '<span class="human-figure" aria-hidden="true"></span>').join('');
}

function binPopup(bin, binSizeKm) {
  const startKm = bin.binIndex * binSizeKm;
  const endKm = Math.min(startKm + binSizeKm, routeMeasure.totalKm);
  const records = bin.items.map(record => `<li>${escapeHtml(record.location)} · ${escapeHtml(record.captured_at.slice(0, 10))} · ${escapeHtml(record.provenance)}</li>`).join('');
  return `<strong>${bin.items.length} simulated ${bin.items.length === 1 ? 'death' : 'deaths'}</strong><p>Approx. road segment ${startKm.toFixed(0)}–${endKm.toFixed(0)} km</p><ul>${records}</ul>`;
}

function renderDensity() {
  fatalityLayer.clearLayers();
  const binSizeKm = Number(ui.binSlider.value);
  const records = filteredFatalities();
  const bins = groupIntoBins(records, binSizeKm);

  bins.forEach(bin => {
    const coordinate = pointAtDistance(bin.midpointKm);
    const icon = L.divIcon({
      className: 'fatality-bin',
      html: `<div class="fatality-stack" role="img" aria-label="${bin.items.length} simulated ${bin.items.length === 1 ? 'death' : 'deaths'} in this road segment"><div class="bin-label">${bin.items.length}</div>${humanFigures(bin.items.length)}</div>`,
      iconSize: [1, 1],
      iconAnchor: [0, 0]
    });
    L.marker(coordinate, { icon, keyboard: true })
      .bindPopup(binPopup(bin, binSizeKm), { maxWidth: 320 })
      .addTo(fatalityLayer);
  });

  setStatus(`${records.length} simulated fatal ${records.length === 1 ? 'record' : 'records'} displayed in ${bins.length} road ${bins.length === 1 ? 'bin' : 'bins'}.`, 'success');
}

function updateCounts() {
  ui.allCount.textContent = fatalRecords.length;
  ui.marAprCount.textContent = fatalRecords.filter(record => periodFor(record) === 'mar-apr').length;
  ui.mayJunCount.textContent = fatalRecords.filter(record => periodFor(record) === 'may-jun').length;
}

async function loadData() {
  const response = await fetch('data/demo-crashes.geojson', { cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to load the simulated corridor dataset.');
  const geojson = await response.json();
  if (!Array.isArray(geojson.features)) throw new Error('The corridor dataset is not valid GeoJSON.');

  fatalRecords = geojson.features
    .map(normalizeRecord)
    .filter(record => record && record.severity === 'fatal')
    .map(record => ({ ...record, road_distance_km: approximateRoadDistance(record) }));

  updateCounts();
  renderDensity();
}

function loadRoad() {
  const query = ui.roadInput.value.trim().toLowerCase();
  if (!ROAD_ALIASES.includes(query)) {
    setStatus('This MVP currently supports only the Lagos–Ibadan Expressway pilot corridor.', 'error');
    return;
  }
  map.fitBounds(corridorLayer.getBounds(), { padding: [70, 70] });
  renderDensity();
}

function bindEvents() {
  ui.loadRoadBtn.addEventListener('click', loadRoad);
  ui.roadInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') loadRoad();
  });
  ui.binSlider.addEventListener('input', () => {
    ui.binValue.textContent = `${ui.binSlider.value} km`;
    renderDensity();
  });
  document.querySelectorAll('input[name="period"]').forEach(input => {
    input.addEventListener('change', () => {
      document.querySelectorAll('.period-choice').forEach(label => label.classList.toggle('active', label.contains(input) && input.checked));
      renderDensity();
    });
  });
  document.querySelectorAll('.clock-button').forEach(button => {
    button.addEventListener('click', () => {
      activeTime = button.dataset.time;
      document.querySelectorAll('.clock-button').forEach(candidate => candidate.classList.toggle('active', candidate === button));
      renderDensity();
    });
  });
  ui.drawerToggle.addEventListener('click', () => ui.drawer.classList.toggle('closed'));
  ui.methodBtn.addEventListener('click', () => ui.methodDialog.showModal());
}

function boot() {
  Object.assign(ui, {
    appStatus: document.getElementById('appStatus'),
    roadInput: document.getElementById('roadInput'),
    loadRoadBtn: document.getElementById('loadRoadBtn'),
    allCount: document.getElementById('allCount'),
    marAprCount: document.getElementById('marAprCount'),
    mayJunCount: document.getElementById('mayJunCount'),
    binSlider: document.getElementById('binSlider'),
    binValue: document.getElementById('binValue'),
    drawerToggle: document.getElementById('drawerToggle'),
    drawer: document.querySelector('.control-drawer'),
    methodBtn: document.getElementById('methodBtn'),
    methodDialog: document.getElementById('methodDialog')
  });

  if (!window.L) {
    document.getElementById('map').innerHTML = '<p>The mapping library could not load. Check the connection and reload.</p>';
    setStatus('The mapping library could not load.', 'error');
    return;
  }

  map = L.map('map', { zoomControl: false, preferCanvas: true }).setView([6.95, 3.63], 9);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  L.polyline(corridorCoordinates, { color: '#ffffff', weight: 10, opacity: .9 }).addTo(map);
  corridorLayer = L.polyline(corridorCoordinates, { color: '#75336f', weight: 6, opacity: .95 }).addTo(map);
  corridorLayer.bindTooltip('Lagos–Ibadan Expressway · simulated pilot corridor', { sticky: true });
  fatalityLayer = L.layerGroup().addTo(map);
  map.fitBounds(corridorLayer.getBounds(), { padding: [70, 70] });

  bindEvents();
  loadData().catch(error => setStatus(error.message, 'error'));
}

boot();
