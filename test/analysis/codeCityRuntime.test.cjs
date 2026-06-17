const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..', '..');
const commonPath = path.join(projectRoot, 'src', 'codexr-components', 'graphs', 'common', 'graphCommonRuntime.js');
const runtimePath = path.join(projectRoot, 'src', 'codexr-components', 'graphs', 'code-city', 'codeCityRuntime.js');
const commonSource = fs.readFileSync(commonPath, 'utf8');
const runtimeSource = fs.readFileSync(runtimePath, 'utf8');

function loadRuntime() {
    const sandbox = {
        console: {
            log() {},
            warn() {},
            error() {},
        },
        module: { exports: {} },
        exports: {},
        Date,
    };
    sandbox.globalThis = sandbox;
    vm.runInNewContext(commonSource, sandbox, { filename: commonPath });
    vm.runInNewContext(runtimeSource, sandbox, { filename: runtimePath });
    return {
        common: sandbox.CodeXRGraphCommonRuntime.__testing,
        city: sandbox.CodeXRCodeCityRuntime.__testing,
    };
}

test('CodeXR Code City detects file and directory payloads', () => {
    const { city: helpers } = loadRuntime();

    assert.equal(helpers.inferMode([{ functionName: 'parse', lineCount: 12 }]), 'file');
    assert.equal(helpers.inferMode([{ fileName: 'index.ts', totalLines: 120 }]), 'directory');
});

test('CodeXR Code City builds nested city paths from file and directory records', () => {
    const { city: helpers } = loadRuntime();

    assert.deepEqual(
        Array.from(helpers.pathPartsForRecord({
            treePath: 'src/service/authenticate',
            functionName: 'authenticate',
        }, 'file')),
        ['src', 'service', 'authenticate'],
    );

    assert.deepEqual(
        Array.from(helpers.pathPartsForRecord({
            relativePath: 'src/tools/render.ts',
            fileName: 'render.ts',
        }, 'directory')),
        ['src', 'tools', 'render.ts'],
    );
});

test('CodeXR Code City lays out districts for nested directories and preserves URL revision parameters', () => {
    const { city: helpers } = loadRuntime();
    const leaves = helpers.buildLeaves([
        { relativePath: 'src/index.ts', totalLines: 10 },
        { relativePath: 'src/tools/render.ts', totalLines: 20 },
        { relativePath: 'test/render.test.ts', totalLines: 15 },
    ], 'directory');
    const layout = helpers.layoutLeaves(leaves);

    assert.equal(layout.leaves.length, 3);
    assert.ok(layout.districts.some((district) => district.id === 'district:src'));
    assert.ok(layout.districts.some((district) => district.id === 'district:src/tools'));
    assert.ok(layout.districts.some((district) => district.id === 'district:test'));
    assert.ok(layout.districts.every((district) => district.width > 0.1 && district.depthSize > 0.1));
    assert.ok(layout.leaves.every((leaf) => Math.abs(leaf.x) <= 2.7 && Math.abs(leaf.z) <= 1.6));
    assert.match(helpers.withCacheBust('left.json?revision=4'), /^left\.json\?revision=4&t=\d+$/);
});

test('CodeXR Code City produces a balanced 3D view model with title and tooltips above the city', () => {
    const { city: helpers } = loadRuntime();
    const records = [
        {
            relativePath: 'src/index.ts',
            functionCount: 8,
            totalLines: 220,
            cyclomaticComplexityNumber: 12,
            language: 'TypeScript',
        },
        {
            relativePath: 'src/tools/render.ts',
            functionCount: 2,
            totalLines: 40,
            cyclomaticComplexityNumber: 3,
            language: 'TypeScript',
        },
    ];

    const view = helpers.buildCityView(records, 'directory', {
        area: 'functionCount',
        height: 'totalLines',
        color: 'cyclomaticComplexityNumber',
    });

    assert.equal(view.valid, true);
    assert.equal(view.buildings.length, 2);
    assert.ok(view.districts.length >= 1);
    assert.ok(view.maxY > 1);
    assert.ok(view.titleY >= view.maxY + 0.5);
    assert.ok(view.tooltipY >= view.maxY + 0.6);
    assert.ok(view.base.width > 5.25);
    assert.ok(view.base.depthSize > 3.05);
    assert.ok(view.buildings.every((building) => building.buildingHeight >= 0.12 && building.buildingHeight <= 1.11));
    assert.ok(view.buildings.every((building) => building.footprint >= 0.008));
    assert.ok(view.buildings.every((building) => {
        const halfRoof = (building.footprint * 1.12) / 2;
        return building.x - halfRoof >= building.bounds.xMin - 0.0001
            && building.x + halfRoof <= building.bounds.xMax + 0.0001
            && building.z - halfRoof >= building.bounds.zMin - 0.0001
            && building.z + halfRoof <= building.bounds.zMax + 0.0001;
    }));
    assert.ok(view.bounds.maxY >= view.maxY);
    assert.ok(view.titleY >= view.bounds.maxY + 0.5);
    assert.ok(view.tooltipY >= view.bounds.maxY + 0.7);
});

test('CodeXR Code City uses stepped district terraces and places buildings on their final district', () => {
    const { city: helpers } = loadRuntime();
    const records = [
        { relativePath: 'src/index.ts', functionCount: 2, totalLines: 40, cyclomaticComplexityNumber: 1 },
        { relativePath: 'src/tools/render.ts', functionCount: 3, totalLines: 55, cyclomaticComplexityNumber: 2 },
        { relativePath: 'src/tools/deep/trace.ts', functionCount: 4, totalLines: 80, cyclomaticComplexityNumber: 3 },
    ];

    const view = helpers.buildCityView(records, 'directory', {
        area: 'functionCount',
        height: 'totalLines',
        color: 'cyclomaticComplexityNumber',
    });

    const src = view.districts.find((district) => district.path === 'src');
    const tools = view.districts.find((district) => district.path === 'src/tools');
    const deep = view.districts.find((district) => district.path === 'src/tools/deep');
    assert.ok(src && tools && deep);
    assert.ok(src.terraceTopY < tools.terraceTopY);
    assert.ok(tools.terraceTopY < deep.terraceTopY);
    for (const building of view.buildings) {
        const district = view.districts.find((candidate) => candidate.path === building.containerPath);
        assert.ok(district, `Missing final district for ${building.path}`);
        assert.ok(building.baseY > district.terraceTopY);
        assert.equal(building.terraceTopY, district.terraceTopY);
    }
});

test('CodeXR Code City keeps dense buildings inside their assigned cells', () => {
    const { city: helpers } = loadRuntime();
    const records = Array.from({ length: 80 }, (_, index) => ({
        relativePath: `src/feature-${index % 8}/component-${index}.ts`,
        functionCount: 1 + (index % 5),
        totalLines: 20 + index,
        cyclomaticComplexityNumber: index % 9,
    }));

    const view = helpers.buildCityView(records, 'directory', {
        area: 'functionCount',
        height: 'totalLines',
        color: 'cyclomaticComplexityNumber',
    });

    assert.equal(view.valid, true);
    assert.equal(view.buildings.length, records.length);
    assert.ok(view.buildings.every((building) => {
        const halfRoof = (building.footprint * 1.12) / 2;
        return building.x - halfRoof >= building.bounds.xMin - 0.0001
            && building.x + halfRoof <= building.bounds.xMax + 0.0001
            && building.z - halfRoof >= building.bounds.zMin - 0.0001
            && building.z + halfRoof <= building.bounds.zMax + 0.0001;
    }));
    assert.ok(view.districts.every((district) => Math.abs(district.x) + district.width / 2 <= 2.565 + 0.0001));
    assert.ok(view.districts.every((district) => Math.abs(district.z) + district.depthSize / 2 <= 1.465 + 0.0001));
    assert.ok(view.districts.every((district) => {
        const aspect = Math.max(district.width / district.depthSize, district.depthSize / district.width);
        return aspect <= 2;
    }));
    assert.ok(view.buildings.every((building) => {
        const aspect = Math.max(building.cellWidth / building.cellDepth, building.cellDepth / building.cellWidth);
        return aspect <= 8;
    }));
});

test('CodeXR Code City rejects invalid numeric mappings without requiring a destructive rebuild', () => {
    const { city: helpers } = loadRuntime();
    const invalidView = helpers.buildCityView([
        { relativePath: 'src/index.ts', fileName: 'index.ts', totalLines: 100, functionCount: 4 },
    ], 'directory', {
        area: 'fileName',
        height: 'totalLines',
        color: 'language',
    });

    assert.equal(invalidView.valid, false);
    assert.equal(invalidView.reason, 'invalid-numeric-mapping');
    assert.match(runtimeSource, /renderCity\(\{ reason: 'mapping-update', preserveOnInvalid: true \}\)/);
    assert.doesNotMatch(runtimeSource, /renderCity: function \(mappingOnly\)[\s\S]*this\.clearCity\(\)/);
});

test('CodeXR graph common exposes shared tooltip, hitbox, scale and animation helpers', () => {
    const { common } = loadRuntime();

    assert.equal(typeof common.hitboxGeometry, 'function');
    assert.match(common.hitboxGeometry({ shape: 'district', width: 1, height: 0.2, depth: 1 }), /primitive: box/);
    assert.deepEqual(
        [common.resolveMetricScale([{ value: 0 }, { value: 10 }], 'value').normalize(0),
            common.resolveMetricScale([{ value: 0 }, { value: 10 }], 'value').normalize(10)],
        [0, 1],
    );
    assert.equal(common.normalizePath('/src//tools\\render.ts'), 'src/tools/render.ts');
});

test('CodeXR Code City maps visual state without requiring BabiaXR', () => {
    const { city: helpers } = loadRuntime();

    assert.equal(helpers.resolveChangeState({ status: 'modified' }), 'modified');
    assert.equal(helpers.resolveChangeState({ added: true }), 'added');
    assert.match(helpers.colorForValue(10, [{ metric: 0 }, { metric: 10 }], 'metric'), /^#[0-9a-f]{6}$/);
});

test('CodeXR Code City keeps hover tooltips in scene space above scaled charts', () => {
    assert.match(runtimeSource, /this\.el\.sceneEl \|\| this\.el/);
    assert.match(runtimeSource, /localToWorld\(position\)/);
    assert.match(runtimeSource, /data-codexr-code-city-tooltip/);
});

test('CodeXR Code City avoids transparent ring halos that cause visual shimmer', () => {
    assert.doesNotMatch(runtimeSource, /a-ring/);
    assert.match(runtimeSource, /data-codexr-role': 'building-plot'/);
    assert.match(runtimeSource, /data-codexr-role': 'building-plot-accent'/);
});

test('CodeXR Code City renders procedural building texture without external assets', () => {
    assert.match(runtimeSource, /data-codexr-role': 'building-base-trim'/);
    assert.match(runtimeSource, /data-codexr-role': 'building-front-band'/);
    assert.match(runtimeSource, /data-codexr-role': 'building-side-band'/);
    assert.match(runtimeSource, /data-codexr-role': 'building-age-mark'/);
    assert.match(runtimeSource, /mixColor\(leaf\.color, '#ffffff', 0\.07\)/);
    assert.match(runtimeSource, /setBoxGeometry\(entry\.body/);
    assert.doesNotMatch(runtimeSource, /texture|src:\s*url/i);
});
