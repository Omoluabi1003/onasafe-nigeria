const corridorCoordinates = [
  [6.5768, 3.3833], [6.6500, 3.4550], [6.7350, 3.4450], [6.8200, 3.5200],
  [6.8390, 3.6315], [6.9500, 3.6650], [7.0750, 3.7650], [7.2200, 3.8400], [7.3950, 3.9300]
];

const severityWeight = { fatal: 10, serious: 6, minor: 2 };
const severityColor = { fatal: '#c93f3f', serious: '#e7852c', minor: '#2774ae' };

const map = L.map('map', { zoomControl: false }).setView([6.95, 3.63], 9);
L.control.zoom({ position: 'bottomright' }).addTo(map);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const corridorLayer = L.polyline(corridorCoordinates, {
  color: '#10504e', weight: 7, opacity: 0.83, lineCap: 'round'
}).addTo(map);

corridorLayer.bindTooltip('Lagos–Ibadan pilot corridor', { sticky: true });

const markerLayer = L.layerGroup().addTo(map);
let incidentData = [];
let markerIndex = new Map();
let activeIncidentId = null;
let userMarker = null;

const visibleCount = document.getElementById('visibleCount');
const incidentList = document.getElementById('incidentList');
const searchInput = document.getElementById('searchInput');
const verificationFilter = document.getElementById('verificationFilter');
const riskScore = document.getElementById('riskScore');
const riskFill = document.getElementById('riskFill');
const riskNarrative = document.getElementById('riskNarrative');
const reportDialog = document.getElementById('reportDialog');
const reportForm = document.getElementById('reportForm');
const formMessage = document.getElementById('formMessage');

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function loadLocalReports() {
  try {
    return JSON.parse(localStorage.getItem('onasafeReports') || '[]');
  } catch {
    return [];
  }
}

function saveLocalReports(reports) {
  localStorage.setItem('onasafeReports', JSON.stringify(reports));
}

async function loadData() {
  try {
    const response = await fetch('data/demo-crashes.geojson');
    if (!response.ok) throw new Error('Unable to load demo data.');
    const geojson = await response.json();
    const demoRecords = geojson.features.map(feature => ({
      ...feature.properties,
      latitude: feature.geometry.coordinates[1],
      longitude: feature.geometry.coordinates[0]
    }));
    incidentData = [...loadLocalReports(), ...demoRecords];
    applyFilters();
  } catch (error) {
    incidentList.innerHTML = `<div class="empty-state">${escapeHtml(error.message)} Open this prototype through a local web server rather than directly from the file system.</div>`;
  }
}

function selectedSeverities() {
  return [...document.querySelectorAll('.severity-filter:checked')].map(input => input.value);
}

function getFilteredData() {
  const severities = selectedSeverities();
  const search = searchInput.value.trim().toLowerCase();
  const verification = verificationFilter.value;

  return incidentData.filter(item => {
    const severityMatch = severities.includes(item.severity);
    const verificationMatch = verification === 'all' || item.verification === verification;
    const haystack = `${item.id} ${item.location} ${item.cause} ${item.description}`.toLowerCase();
    const searchMatch = !search || haystack.includes(search);
    return severityMatch && verificationMatch && searchMatch;
  });
}

function markerRadius(severity) {
  return severity === 'fatal' ? 10 : severity === 'serious' ? 8 : 7;
}

function popupHtml(item) {
  return `
    <h3 class="popup-title">${escapeHtml(item.location)}</h3>
    <p class="popup-copy">${escapeHtml(item.description)}</p>
    <div class="popup-meta"><strong>${escapeHtml(item.severity.toUpperCase())}</strong> · ${escapeHtml(item.date)} · ${escapeHtml(item.id)}</div>
  `;
}

function renderMarkers(data) {
  markerLayer.clearLayers();
  markerIndex.clear();

  data.forEach(item => {
    const marker = L.circleMarker([Number(item.latitude), Number(item.longitude)], {
      radius: markerRadius(item.severity),
      color: '#ffffff',
      weight: 2.5,
      fillColor: severityColor[item.severity],
      fillOpacity: 0.92
    }).addTo(markerLayer);

    marker.bindPopup(popupHtml(item));
    marker.on('click', () => setActiveIncident(item.id, false));
    markerIndex.set(item.id, marker);
  });
}

function renderIncidentList(data) {
  if (!data.length) {
    incidentList.innerHTML = '<div class="empty-state">No incidents match the current filters.</div>';
    return;
  }

  incidentList.innerHTML = data.map(item => `
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

  incidentList.querySelectorAll('.incident-card').forEach(card => {
    card.addEventListener('click', () => setActiveIncident(card.dataset.id, true));
  });
}

function updateRisk(data) {
  const raw = data.reduce((sum, item) => sum + (severityWeight[item.severity] || 0), 0);
  const normalized = Math.min(100, Math.round((raw / Math.max(1, data.length * 10)) * 100));
  riskScore.textContent = normalized;
  riskFill.style.width = `${normalized}%`;

  if (!data.length) riskNarrative.textContent = 'No visible records are available for risk calculation.';
  else if (normalized >= 70) riskNarrative.textContent = 'High visible severity. Prioritize engineering review and targeted enforcement.';
  else if (normalized >= 45) riskNarrative.textContent = 'Elevated visible severity. Investigate repeat causes and response coverage.';
  else riskNarrative.textContent = 'Moderate visible severity. Continue monitoring and verify incoming reports.';
}

function applyFilters() {
  const filtered = getFilteredData();
  visibleCount.textContent = `${filtered.length} incident${filtered.length === 1 ? '' : 's'}`;
  renderMarkers(filtered);
  renderIncidentList(filtered);
  updateRisk(filtered);
}

function setActiveIncident(id, openPopup) {
  activeIncidentId = id;
  const item = incidentData.find(record => record.id === id);
  if (!item) return;
  map.flyTo([Number(item.latitude), Number(item.longitude)], 13, { duration: 0.7 });
  const marker = markerIndex.get(id);
  if (marker && openPopup) marker.openPopup();
  renderIncidentList(getFilteredData());
}

function getLocation({ fillForm = false } = {}) {
  if (!navigator.geolocation) {
    formMessage.textContent = 'Location services are unavailable in this browser.';
    return;
  }

  navigator.geolocation.getCurrentPosition(position => {
    const { latitude, longitude } = position.coords;
    if (fillForm) {
      document.getElementById('latitudeInput').value = latitude.toFixed(6);
      document.getElementById('longitudeInput').value = longitude.toFixed(6);
      formMessage.textContent = 'Coordinates captured successfully.';
    } else {
      if (userMarker) map.removeLayer(userMarker);
      userMarker = L.marker([latitude, longitude]).addTo(map).bindPopup('Your approximate device location').openPopup();
      map.flyTo([latitude, longitude], 14);
    }
  }, error => {
    formMessage.textContent = `Location could not be captured: ${error.message}`;
  }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
}

function openReportDialog() {
  formMessage.textContent = '';
  reportDialog.showModal();
}

function closeReportDialog() {
  reportDialog.close();
}

document.querySelectorAll('.severity-filter').forEach(input => input.addEventListener('change', applyFilters));
searchInput.addEventListener('input', applyFilters);
verificationFilter.addEventListener('change', applyFilters);

document.getElementById('resetBtn').addEventListener('click', () => {
  searchInput.value = '';
  verificationFilter.value = 'all';
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

reportForm.addEventListener('submit', event => {
  event.preventDefault();
  const formData = new FormData(reportForm);
  const latitude = Number(formData.get('latitude'));
  const longitude = Number(formData.get('longitude'));

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    formMessage.textContent = 'Please provide valid coordinates.';
    return;
  }

  const report = {
    id: `LOCAL-${Date.now().toString().slice(-7)}`,
    location: formData.get('location').trim(),
    severity: formData.get('severity'),
    date: new Date().toISOString().slice(0, 10),
    cause: 'Community-submitted prototype report',
    verification: 'pending',
    description: formData.get('description').trim(),
    latitude,
    longitude
  };

  const reports = loadLocalReports();
  reports.unshift(report);
  saveLocalReports(reports);
  incidentData.unshift(report);
  reportForm.reset();
  closeReportDialog();
  applyFilters();
  setActiveIncident(report.id, true);
});

map.fitBounds(corridorLayer.getBounds(), { padding: [28, 28] });
loadData();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
