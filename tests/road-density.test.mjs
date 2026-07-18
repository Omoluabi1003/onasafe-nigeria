import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8') + '\n({ ROAD_DATASETS, ROADS, normalizeIncident, normalizeFeatureCollection, groupIntoBins, calculateMetrics, createPersonFigures });';
const api = vm.runInNewContext(source, { console });
const demo = JSON.parse(readFileSync(new URL('../data/demo-crashes.geojson', import.meta.url), 'utf8'));

const { accepted, rejected } = api.normalizeFeatureCollection(demo, api.ROAD_DATASETS.simulation_incidents, api.ROADS[0]);
const fatal = accepted.filter(record => record.fatalities > 0);
const bins = api.groupIntoBins(fatal, 5, api.ROADS[0]);
const metrics = api.calculateMetrics(fatal, bins, api.ROADS[0]);

assert.equal(accepted.length, 12, 'all valid demonstration point records normalize');
assert.equal(rejected.length, 0, 'valid demonstration dataset has no rejected records');
assert.equal(fatal.length, 4, 'fatal crashes are calculated from fatality-bearing incident records');
assert.equal(metrics.totalFatalities, 4, 'total fatalities are calculated from normalized records');
assert.equal(metrics.peakBinDeaths, Math.max(...bins.map(bin => bin.fatalities)), 'peak bin deaths comes from bins');
assert.equal(bins.reduce((sum, bin) => sum + bin.fatalities, 0), metrics.totalFatalities, 'bin fatality sum equals selected-road total');
assert.equal((api.createPersonFigures(metrics.totalFatalities).match(/human-figure/g) || []).length, metrics.totalFatalities, 'one icon is generated per fatality');
assert.ok(accepted.every(record => record.is_simulated && record.verification_status === 'simulated'), 'simulation flag is preserved');

const aggregateFeature = { type: 'Feature', properties: { id: 'NBS-1', fatalities: 10, captured_at: '2026-01-01T00:00:00Z', coordinate_accuracy_m: 10, verification: 'source_reported' }, geometry: { type: 'Point', coordinates: [3.4, 6.5] } };
assert.equal(api.normalizeIncident(aggregateFeature, { datasetType: 'nbs_aggregates' }, api.ROADS[0]), null, 'aggregate records cannot enter incident renderer');
assert.equal(api.normalizeIncident(aggregateFeature, { datasetType: 'state_vio_inspections' }, api.ROADS[0]), null, 'VIO records cannot enter fatality calculations');

const invalidCoordinate = { type: 'Feature', properties: { id: 'BAD-1', severity: 'fatal', captured_at: '2026-01-01T00:00:00Z', coordinate_accuracy_m: 10, verification: 'simulated' }, geometry: { type: 'Point', coordinates: [999, 999] } };
assert.equal(api.normalizeIncident(invalidCoordinate, api.ROAD_DATASETS.simulation_incidents, api.ROADS[0]), null, 'invalid coordinates are excluded');

const metricsBefore = JSON.stringify(metrics);
const metricsAfterBasemapChoice = JSON.stringify(api.calculateMetrics(fatal, bins, api.ROADS[0]));
assert.equal(metricsAfterBasemapChoice, metricsBefore, 'basemap selection cannot change metrics');

console.log('road-density governance tests passed');
