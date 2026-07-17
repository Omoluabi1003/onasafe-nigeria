const corridorCoordinates = [
  [6.5768, 3.3833], [6.6500, 3.4550], [6.7350, 3.4450], [6.8200, 3.5200],
  [6.8390, 3.6315], [6.9500, 3.6650], [7.0750, 3.7650], [7.2200, 3.8400], [7.3950, 3.9300]
];

const severityWeight = { fatal: 10, serious: 6, minor: 2 };
const severityColor = { fatal: '#c93f3f', serious: '#e7852c', minor: '#2774ae' };

let map;
let corridorLayer;
let markerLayer;
let userMarker = null;
let incidentData = [];
let markerIndex = new Map();
let activeIncidentId = null;

const ui = {};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setStatus(message, tone = 'info') {
  if (!ui.appStatus) return;
  ui.appStatus.textContent = message;
  ui.appStatus.dataset.tone = tone;
  ui.appStatus.hidden = !message;
}

function coordinatesFor(item) {
  const latitude = Number(item?.latitude);
  const longitude = Number(item?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < 4.0 || latitude > 14.5 || longitude < 2.0 || longitude > 15.0) return null;
  return [latitude, longitude];
}

function loadLocalReports() {
  try {
    const reports = JSON.parse(localStorage.getItem('onasafeReports') || '[]');
    return Array.isArray(reports) ? reports : [];
  } catch {
    return [];
  }
}

function saveLocalReports(reports) {
  localStorage.setItem('onasafeReports', JSON.stringify(reports));
}

function normalizeIncident(item) {
  const capturedAt = item.captured_at || item.capturedAt || null;
  const coordinateAccuracy = Number(item.coordinate_accuracy_m);
  return {
    ...item,
    date: item.date || (typeof capturedAt === 'string' ? capturedAt.slice(0, 10) : 'Unknown date'),
    captured_at: capturedAt,
    provenance: item.provenance || null,
    coordinate_accuracy_m: Number.isFinite(coordinateAccuracy) && coordinateAccuracy > 0
      ? coordinateAccuracy
      : null
  };
}

async function loadData() {
  try {
    const response = await fetch('data/demo-crashes.geojson', { cache: 'no-store' });
    if (!response.ok) throw new Error('Unable to load the corridor demonstration data.');
    const geojson = await response.json();
    if (!Array.isArray(geojson.features)) throw new Error('The corridor dataset is not valid GeoJSON.');

    const demoRecords = geojson.features
      .filter(feature => feature && feature.properties)
      .map(feature => normalizeIncident({
      ...feature.properties,
      latitude: feature.geometry?.coordinates?.[1],
      longitude: feature.geometry?.coordinates?.[0]
    }));

    incidentData = [...loadLocalReports().map(normalizeIncident), ...demoRecords]
      .filter(item => coordinatesFor(item) && item.coordinate_accuracy_m && item.provenance);
    applyFilters();
    setStatus('Map ready. Demonstration incidents are simulated and clearly labelled.', 'success');
  } catch (error) {
    ui.incidentList.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    setStatus(error.message, 'error');
  }
}

function selectedSeverities() {
  return [...document.querySelectorAll('.severity-filter:checked')].map(input => input.value);
}

function getFilteredData() {
  const severities = selectedSeverities();
  const search = ui.searchInput.value.trim().toLowerCase();
  const verification = ui.verificationFilter.value;

  return incidentData.filter(item => {
    const severityMatch = severities.includes(item.severity);
    const verificationMatch = verification === 'all' || item.verification === verification;
    const haystack = `${item.id ?? ''} ${item.location ?? ''} ${item.cause ?? ''} ${item.description ?? ''}`.toLowerCase();
    return severityMatch && verificationMatch && (!search || haystack.includes(search));
  });
}

function markerRadius(severity) {
  return severity === 'fatal' ? 10 : severity === 'serious' ? 8 : 7;
}

function popupHtml(item) {
  const accuracy = item.coordinate_accuracy_m
    ? ` · ±${escapeHtml(Math.round(item.coordinate_accuracy_m))} m`
    : '';
  const provenance = item.provenance ? ` · ${escapeHtml(item.provenance)}` : '';
  return `
    <h3 class="popup-title">${escapeHtml(item.location)}</h3>
    <p class="popup-copy">${escapeHtml(item.description)}</p>
    <div class="popup-meta"><strong>${escapeHtml(item.severity.toUpperCase())}</strong> · ${escapeHtml(item.date)} · ${escapeHtml(item.id)}${accuracy}${provenance}</div>
  `;
}

function renderMarkers(data) {
  markerLayer.clearLayers();
  markerIndex.clear();

  data.forEach(item => {
    const coordinates = coordinatesFor(item);
    if (!coordinates) return;
    const marker = L.circleMarker(coordinates, {
      radius: markerRadius(item.severity),
      color: '#ffffff',
      weight: 2.5,
      fillColor: severityColor[item.severity] || '#5c6d6d',
      fillOpacity: 0.92
    }).addTo(markerLayer);

    marker.bindPopup(popupHtml(item));
    marker.on('click', () => setActiveIncident(item.id, false));
    markerIndex.set(item.id, marker);
  });
}

function renderIncidentList(data) {
  if (!data.length) {
    ui.incidentList.innerHTML = '<div class="empty-state">No incidents match the current filters.</div>';
    return;
  }

  ui.incidentList.innerHTML = data.map(item => `
    <button class="incident-card ${item.id === activeIncidentId ? 'active' : ''}" data-id="${escapeHtml(item.id)}" type="button">
      <div class="incident-card-top">
        <span class="severity-label"><i class="dot ${escapeHtml(item.severity)}"></i>${escapeHtml(item.severity)}</span>
        <span class="status-pill">${escapeHtml(item.verification)}</span>
      </div>
      <h4>${escapeHtml(item.location)}</h4>
      <p>${escapeHtml(item.cause)}</p>
      <div class="incident-meta"><span>${escapeHtml(item.date)}</span><span>${escapeHtml(item.id)}</span></div>
    </button>
  `).join('');

  ui.incidentList.querySelectorAll('.incident-card').forEach(card => {
    card.addEventListener('click', () => setActiveIncident(card.dataset.id, true));
  });
}

function updateRisk(data) {
  const raw = data.reduce((sum, item) => sum + (severityWeight[item.severity] || 0), 0);
  const normalized = Math.min(100, Math.round((raw / Math.max(1, data.length * 10)) * 100));
  ui.riskScore.textContent = normalized;
  ui.riskFill.style.width = `${normalized}%`;

  if (!data.length) ui.riskNarrative.textContent = 'No visible records are available for risk calculation.';
  else if (normalized >= 70) ui.riskNarrative.textContent = 'High visible severity. Prioritize engineering review and targeted enforcement.';
  else if (normalized >= 45) ui.riskNarrative.textContent = 'Elevated visible severity. Investigate repeat causes and response coverage.';
  else ui.riskNarrative.textContent = 'Moderate visible severity. Continue monitoring and verify incoming reports.';
}

function applyFilters() {
  const filtered = getFilteredData();
  ui.visibleCount.textContent = `${filtered.length} incident${filtered.length === 1 ? '' : 's'}`;
  renderMarkers(filtered);
  renderIncidentList(filtered);
  updateRisk(filtered);
}

function setActiveIncident(id, openPopup) {
  const item = incidentData.find(record => record.id === id);
  const coordinates = coordinatesFor(item);
  if (!item || !coordinates) {
    setStatus('This incident does not contain a valid map coordinate.', 'error');
    return;
  }

  activeIncidentId = id;
  map.flyTo(coordinates, 13, { duration: 0.7 });
  const marker = markerIndex.get(id);
  if (marker && openPopup) marker.openPopup();
  renderIncidentList(getFilteredData());
}

function getLocation({ fillForm = false } = {}) {
  if (!navigator.geolocation) {
    const message = 'Location services are unavailable in this browser.';
    if (fillForm) ui.formMessage.textContent = message;
    setStatus(message, 'error');
    return;
  }

  setStatus('Requesting your device location…');
  navigator.geolocation.getCurrentPosition(position => {
    const { latitude, longitude, accuracy } = position.coords;
    const capturedAt = new Date(position.timestamp || Date.now()).toISOString();

    if (fillForm) {
      ui.latitudeInput.value = latitude.toFixed(6);
      ui.longitudeInput.value = longitude.toFixed(6);
      ui.accuracyInput.value = Number.isFinite(accuracy) ? Math.round(accuracy) : '';
      ui.capturedAtInput.value = capturedAt;
      ui.formMessage.textContent = 'Coordinates, accuracy, and timestamp captured.';
    } else {
      if (userMarker) map.removeLayer(userMarker);
      userMarker = L.marker([latitude, longitude])
        .addTo(map)
        .bindPopup(`Your approximate device location${Number.isFinite(accuracy) ? ` (±${Math.round(accuracy)} m)` : ''}`)
        .openPopup();
      map.flyTo([latitude, longitude], 14);
    }
    setStatus('Device location captured. It remains in your browser unless you save a report.', 'success');
  }, error => {
    const message = `Location could not be captured: ${error.message}`;
    if (fillForm) ui.formMessage.textContent = message;
    setStatus(message, 'error');
  }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
}

function openReportDialog() {
  ui.formMessage.textContent = '';
  ui.reportDialog.showModal();
}

function closeReportDialog() {
  ui.reportDialog.close();
}

function bindEvents() {
  document.querySelectorAll('.severity-filter').forEach(input => input.addEventListener('change', applyFilters));
  ui.searchInput.addEventListener('input', applyFilters);
  ui.verificationFilter.addEventListener('change', applyFilters);

  document.getElementById('resetBtn').addEventListener('click', () => {
    ui.searchInput.value = '';
    ui.verificationFilter.value = 'all';
    document.querySelectorAll('.severity-filter').forEach(input => { input.checked = true; });
    activeIncidentId = null;
    applyFilters();
    map.fitBounds(corridorLayer.getBounds(), { padding: [28, 28] });
  });

  document.getElementById('focusCorridorBtn').addEventListener('click', () => {
    map.fitBounds(corridorLayer.getBounds(), { padding: [28, 28] });
    document.querySelector('.workspace').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.getElementById('reportBtn').addEventListener('click', openReportDialog);
  document.getElementById('closeDialogBtn').addEventListener('click', closeReportDialog);
  document.getElementById('locateBtn').addEventListener('click', () => getLocation());
  document.getElementById('formLocateBtn').addEventListener('click', () => getLocation({ fillForm: true }));

  ui.reportForm.addEventListener('submit', event => {
    event.preventDefault();
    const formData = new FormData(ui.reportForm);
    const latitude = Number(formData.get('latitude'));
    const longitude = Number(formData.get('longitude'));
    const location = (formData.get('location') || '').toString().trim();
    const description = (formData.get('description') || '').toString().trim();
    const severity = (formData.get('severity') || '').toString();
    const accuracy = Number(formData.get('accuracy'));
    const capturedAtValue = (formData.get('captured_at') || '').toString();

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !coordinatesFor({ latitude, longitude })) {
      ui.formMessage.textContent = 'Please provide valid coordinates.';
      return;
    }
    if (!location || !description || !severity) {
      ui.formMessage.textContent = 'Complete the location, severity, and description fields.';
      return;
    }
    if (!Number.isFinite(accuracy) || accuracy <= 0) {
      ui.formMessage.textContent = 'Coordinate accuracy is required. Capture your location or enter a positive accuracy estimate.';
      return;
    }

    const capturedAt = capturedAtValue || new Date().toISOString();
    const report = normalizeIncident({
      id: `LOCAL-${Date.now().toString().slice(-7)}`,
      location,
      severity,
      date: capturedAt.slice(0, 10),
      cause: 'Community-submitted prototype report',
      verification: 'pending',
      provenance: 'browser_local_report',
      description,
      latitude,
      longitude,
      coordinate_accuracy_m: accuracy,
      captured_at: capturedAt
    });

    const reports = loadLocalReports();
    reports.unshift(report);
    saveLocalReports(reports);
    incidentData.unshift(report);
    ui.reportForm.reset();
    closeReportDialog();
    applyFilters();
    setActiveIncident(report.id, true);
    setStatus('Prototype report saved locally on this device. Call FRSC 122 for emergency response.', 'success');
  });
}

function boot() {
  Object.assign(ui, {
    appStatus: document.getElementById('appStatus'),
    visibleCount: document.getElementById('visibleCount'),
    incidentList: document.getElementById('incidentList'),
    searchInput: document.getElementById('searchInput'),
    verificationFilter: document.getElementById('verificationFilter'),
    riskScore: document.getElementById('riskScore'),
    riskFill: document.getElementById('riskFill'),
    riskNarrative: document.getElementById('riskNarrative'),
    reportDialog: document.getElementById('reportDialog'),
    reportForm: document.getElementById('reportForm'),
    formMessage: document.getElementById('formMessage'),
    latitudeInput: document.getElementById('latitudeInput'),
    longitudeInput: document.getElementById('longitudeInput'),
    accuracyInput: document.getElementById('accuracyInput'),
    capturedAtInput: document.getElementById('capturedAtInput')
  });

  if (!window.L) {
    document.getElementById('map').innerHTML = '<div class="map-fallback">The mapping library could not load. Check the connection and reload the page.</div>';
    setStatus('The mapping library could not load.', 'error');
    return;
  }

  map = L.map('map', { zoomControl: false }).setView([6.95, 3.63], 9);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  corridorLayer = L.polyline(corridorCoordinates, {
    color: '#10504e', weight: 7, opacity: 0.83, lineCap: 'round'
  }).addTo(map);
  corridorLayer.bindTooltip('Lagos–Ibadan pilot corridor', { sticky: true });
  markerLayer = L.layerGroup().addTo(map);

  bindEvents();
  map.fitBounds(corridorLayer.getBounds(), { padding: [28, 28] });
  loadData();
}

boot();
