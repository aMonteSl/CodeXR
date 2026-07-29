const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..', '..');
const runtimePath = path.join(projectRoot, 'templates', 'components', 'common', 'codexrVisualStyleRuntime.js');
const runtimeSource = fs.readFileSync(runtimePath, 'utf8');

function loadRuntime() {
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console: { log() {}, warn() {}, error() {} },
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(runtimeSource, sandbox, { filename: runtimePath });
  return sandbox.module.exports;
}

test('visual style runtime parses CodeXR timestamps and numeric mtimes', () => {
  const runtime = loadRuntime();

  assert.equal(runtime.parseModifiedTime(1700000000000), 1700000000000);
  assert.equal(runtime.parseModifiedTime(1700000000), 1700000000000);
  assert.equal(runtime.parseModifiedTime('2026-06-08 17:47:02'), Date.parse('2026-06-08T17:47:02'));
  assert.equal(runtime.parseModifiedTime('bad-date'), null);
});

test('visual style runtime classifies temporal tiers by relative recency', () => {
  const runtime = loadRuntime();
  const records = [
    { modifiedAtMs: 1000 },
    { modifiedAtMs: 2000 },
    { modifiedAtMs: 3000 },
    { modifiedAtMs: 4000 },
    { modifiedAtMs: 5000 },
  ];
  const stats = runtime.buildTemporalStats(records);

  assert.equal(runtime.classifyTemporalTier(records[0], stats).tier, 'legacy');
  assert.equal(runtime.classifyTemporalTier(records[1], stats).tier, 'aged');
  assert.equal(runtime.classifyTemporalTier(records[2], stats).tier, 'current');
  assert.equal(runtime.classifyTemporalTier(records[4], stats).tier, 'fresh');
});

test('visual style runtime falls back to current when temporal range is missing', () => {
  const runtime = loadRuntime();
  const stats = runtime.buildTemporalStats([{ modifiedAtMs: 1000 }, { modifiedAtMs: 1000 }]);
  const classified = runtime.classifyTemporalTier({ modifiedAtMs: 1000 }, stats);

  assert.equal(stats.available, false);
  assert.equal(classified.tier, 'current');
  assert.equal(classified.recency, 0.5);
});

test('visual style runtime separates metric body material from temporal skin overlays', () => {
  const runtime = loadRuntime();
  const body = runtime.buildMetricBodyMaterialString('#13528a');
  const fresh = runtime.getTemporalSkinProfile('fresh');
  const skin = runtime.buildSkinMaterialString(fresh);

  assert.match(body, /color: #13528a/);
  assert.match(body, /opacity: 1/);
  assert.match(body, /transparent: false/);
  assert.doesNotMatch(skin, /#13528a/);
  assert.match(skin, /transparent: true/);
  assert.match(skin, /depthWrite: false/);
});

test('visual style runtime exposes distinct temporal skin profiles', () => {
  const runtime = loadRuntime();
  const skins = runtime.TEMPORAL_TIERS.map((tier) => runtime.getTemporalSkinProfile(tier));

  assert.equal(skins.map((profile) => profile.skin).join(','), 'legacy,aged,current,fresh');
  assert.equal(new Set(skins.map((profile) => profile.accent)).size, 4);
});

test('visual style runtime exposes stable temporal building shapes', () => {
  const runtime = loadRuntime();
  const shapes = runtime.TEMPORAL_TIERS.map((tier) => runtime.getTemporalSkinProfile(tier).shape);

  assert.equal(shapes.join(','), 'heritage,ruin,standard,modern');
  assert.equal(new Set(shapes).size, 4);
  assert.equal(runtime.classifyTemporalTier({ modifiedAtMs: 1000 }, runtime.buildTemporalStats([{ modifiedAtMs: 1000 }])).tier, 'current');
  assert.equal(runtime.getTemporalSkinProfile('current').shape, 'standard');
});

test('visual style runtime resolves wall and roof SVG assets per temporal tier', () => {
  const runtime = loadRuntime();
  const assets = runtime.TEMPORAL_TIERS.map((tier) => runtime.getTemporalSkinAssets(tier, './skins'));

  assert.equal(new Set(assets.map((asset) => asset.wall)).size, 4);
  assert.equal(new Set(assets.map((asset) => asset.roof)).size, 4);
  assert.equal(
    JSON.stringify(assets.map((asset) => [asset.tier, asset.wall, asset.roof])),
    JSON.stringify([
      ['legacy', './skins/legacy-wall.svg', './skins/legacy-roof.svg'],
      ['aged', './skins/aged-wall.svg', './skins/aged-roof.svg'],
      ['current', './skins/current-wall.svg', './skins/current-roof.svg'],
      ['fresh', './skins/fresh-wall.svg', './skins/fresh-roof.svg'],
    ]),
  );
  assert.ok(assets.every((asset) => asset.wallOpacity > 0 && asset.roofOpacity > 0));
});
