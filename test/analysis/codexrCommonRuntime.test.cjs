const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..', '..');
const runtimePath = path.join(
    projectRoot,
    'templates',
    'components',
    'common',
    'codexrCommonRuntime.js',
);
const runtimeSource = fs.readFileSync(runtimePath, 'utf8');
const componentsInventoryPath = path.join(projectRoot, 'templates', 'components', 'COMPONENTS.md');
const manualHarnessPath = path.join(projectRoot, 'test', 'manual', 'xr-mode-cycle-harness.html');

function createElement(tagName) {
    const attributes = {};
    const children = [];
    return {
        tagName,
        attributes,
        children,
        object3D: {
            lookedAt: null,
            lookAt(position) {
                this.lookedAt = position;
            },
        },
        classList: {
            values: new Set(),
            add(value) {
                this.values.add(value);
            },
        },
        setAttribute(name, value) {
            attributes[name] = value;
        },
        getAttribute(name) {
            return attributes[name];
        },
        appendChild(child) {
            children.push(child);
            child.parentNode = this;
        },
        removeChild(child) {
            const index = children.indexOf(child);
            if (index >= 0) {
                children.splice(index, 1);
            }
            child.parentNode = null;
        },
        setObject3D(name, object) {
            this.object3D[name] = object;
        },
    };
}

function loadRuntime() {
    const context = {
        module: { exports: {} },
        document: {
            createElement,
        },
        THREE: {
            Vector3: class Vector3 {
                constructor(x = 0, y = 0, z = 0) {
                    this.x = x;
                    this.y = y;
                    this.z = z;
                }
            },
            MeshBasicMaterial: class MeshBasicMaterial {
                constructor(options) {
                    this.options = options;
                }
            },
            Mesh: class Mesh {
                constructor(geometry, material) {
                    this.geometry = geometry;
                    this.material = material;
                    this.position = {
                        set(x, y, z) {
                            this.x = x;
                            this.y = y;
                            this.z = z;
                        },
                    };
                }
            },
            BoxGeometry: class BoxGeometry {},
            SphereGeometry: class SphereGeometry {},
        },
    };
    context.window = context;
    context.globalThis = context;
    vm.runInNewContext(runtimeSource, context, { filename: runtimePath });
    return context;
}

test('common runtime exposes reusable component helpers', () => {
    const context = loadRuntime();
    const runtime = context.CodeXRCommonRuntime;

    assert.equal(typeof runtime.createTooltip, 'function');
    assert.equal(typeof runtime.updateTooltip, 'function');
    assert.equal(typeof runtime.updateTooltipConnector, 'function');
    assert.equal(typeof runtime.hideTooltip, 'function');
    assert.equal(typeof runtime.faceCamera, 'function');
    assert.equal(typeof runtime.attachPickHitbox, 'function');
    assert.equal(typeof runtime.truncateText, 'function');
    assert.equal(typeof runtime.createEntity, 'function');
});

test('common tooltip creates the shared visual legend structure and updates content', () => {
    const runtime = loadRuntime().CodeXRCommonRuntime;
    const tooltip = runtime.createTooltip({ accentColor: '#22d3ee' });

    assert.ok(tooltip.root);
    assert.equal(tooltip.root.children.length, 6);
    assert.equal(tooltip.root.getAttribute('visible'), false);

    runtime.updateTooltip(tooltip, {
        title: 'Dependency node',
        subtitle: 'src/service.ts',
        primary: 'Fan-in 4 | Fan-out 6',
        secondary: 'TypeScript | exact',
    }, { x: 1, y: 2, z: 3 }, { width: 4.35, height: 1.78 });

    assert.equal(tooltip.root.getAttribute('visible'), true);
    assert.equal(tooltip.root.getAttribute('position'), '1 2 3');
    assert.equal(tooltip.background.getAttribute('width'), 4.35);
    assert.equal(tooltip.background.getAttribute('height'), 1.78);
    assert.ok(tooltip.root.getAttribute('animation__codexr_tooltip_in'));
    assert.equal(tooltip.title.getAttribute('value'), 'Dependency node');
    assert.equal(tooltip.primary.getAttribute('visible'), true);

    runtime.hideTooltip(tooltip);
    assert.equal(tooltip.root.getAttribute('visible'), false);
});

test('common tooltip supports autosized label-value rows without breaking legacy fields', () => {
    const runtime = loadRuntime().CodeXRCommonRuntime;
    const tooltip = runtime.createTooltip({ accentColor: '#22d3ee', width: 4.5 });

    runtime.updateTooltip(tooltip, {
        title: 'auth.ts',
        subtitle: 'src/services/auth.ts',
        rows: [
            { label: 'Type', value: 'Building' },
            { label: 'lineCount', value: '420' },
            { label: 'complexity', value: '9' },
            { label: 'Visual height', value: '1.150' },
        ],
    }, { x: 1, y: 2, z: 3 }, { width: 5.25, minHeight: 1.1 });

    assert.equal(tooltip.root.getAttribute('visible'), true);
    assert.ok(tooltip.background.getAttribute('height') > 1.1);
    assert.ok(tooltip.rows.length >= 4);
    assert.equal(tooltip.rows[0].label.getAttribute('value'), 'Type');
    assert.equal(tooltip.rows[0].value.getAttribute('value'), 'Building');
    assert.equal(tooltip.primary.getAttribute('visible'), false);
    assert.equal(tooltip.secondary.getAttribute('visible'), false);

    runtime.updateTooltip(tooltip, {
        title: 'Fallback',
        primary: 'A',
        secondary: 'B',
    }, { x: 0, y: 0, z: 0 }, { width: 4.35, height: 1.2 });

    assert.equal(tooltip.primary.getAttribute('visible'), true);
    assert.equal(tooltip.secondary.getAttribute('visible'), true);
    assert.equal(tooltip.rows[0].label.getAttribute('visible'), false);
});

test('common tooltip supports compact pinned connectors to selected geometry', () => {
    const runtime = loadRuntime().CodeXRCommonRuntime;
    const host = createElement('a-entity');
    const tooltip = runtime.createTooltip({ accentColor: '#22d3ee', width: 3.6 });
    host.appendChild(tooltip.root);

    runtime.updateTooltip(tooltip, {
        title: 'Pinned',
        subtitle: 'src/file.ts',
        rows: [
            { label: 'Type', value: 'Building' },
            { label: 'Lines', value: '42' },
        ],
    }, { x: 1, y: 2, z: 3 }, {
        width: 3.6,
        minHeight: .9,
        connectorTarget: { x: .25, y: .4, z: -.5 },
        connectorColor: '#86efac',
    });

    assert.equal(tooltip.root.getAttribute('visible'), true);
    assert.ok(tooltip.background.getAttribute('width') <= 3.6);
    assert.ok(tooltip.connectorRoot);
    assert.equal(tooltip.connectorRoot.getAttribute('visible'), true);
    assert.equal(tooltip.connectorMarker.getAttribute('position'), '0.25 0.445 -0.5');
    assert.match(tooltip.connectorLine.getAttribute('line').start, /1 /);
    assert.match(tooltip.connectorLine.getAttribute('line').end, /0\.25 0\.445 -0\.5/);

    runtime.hideTooltip(tooltip);
    assert.equal(tooltip.connectorRoot.getAttribute('visible'), false);
});

test('common tooltip reserves footer room for action buttons', () => {
    const runtime = loadRuntime().CodeXRCommonRuntime;
    const tooltip = runtime.createTooltip({ accentColor: '#f59e0b', width: 3.55 });

    runtime.updateTooltip(tooltip, {
        title: 'folder',
        subtitle: 'src/tools',
        primary: 'Fan-in 2   Fan-out 4',
        secondary: 'Relations 12   Cycle 0   Lines 884',
    }, { x: 0, y: 1, z: 0 }, {
        width: 3.55,
        height: 1.52,
        footerReserve: .28,
    });

    const primaryY = Number(String(tooltip.primary.getAttribute('position')).split(' ')[1]);
    const secondaryY = Number(String(tooltip.secondary.getAttribute('position')).split(' ')[1]);
    assert.ok(primaryY > secondaryY);
    assert.ok(secondaryY > -0.42);
});

test('common faceCamera and hitbox helpers tolerate missing scene state', () => {
    const context = loadRuntime();
    const runtime = context.CodeXRCommonRuntime;
    const entity = createElement('a-entity');

    assert.equal(runtime.faceCamera(entity, null), false);
    assert.equal(runtime.faceCamera(entity, {
        camera: {
            getWorldPosition(position) {
                position.x = 4;
                position.y = 5;
                position.z = 6;
            },
        },
    }), true);
    assert.equal(entity.object3D.lookedAt.x, 4);
    assert.equal(entity.object3D.lookedAt.y, 5);
    assert.equal(entity.object3D.lookedAt.z, 6);

    const hitbox = runtime.attachPickHitbox(entity, {
        shape: 'box',
        radius: 0.2,
        height: 0.4,
        raycastClass: 'babiaxraycasterclass',
    });
    assert.ok(hitbox);
    assert.ok(entity.classList.values.has('babiaxraycasterclass'));
    assert.equal(entity.getAttribute('data-codexr-interactive'), 'true');
});

test('components inventory documents common runtime and load-order rules', () => {
    const inventory = fs.readFileSync(componentsInventoryPath, 'utf8');

    assert.match(inventory, /common\/codexrCommonRuntime\.js/);
    assert.match(inventory, /CodeXRCommonRuntime/);
    assert.match(inventory, /dependency-graph\/dependencyGraphRuntime\.js/);
    assert.match(inventory, /Recommended Load Order/);
    assert.ok(inventory.indexOf('common/codexrCommonRuntime.js') < inventory.indexOf('codexr/dependency-graph/dependencyGraphRuntime.js'));
    assert.match(inventory, /logic that is useful to more than one component/);
});

test('manual XR mode harness loads common runtime before component runtimes that consume it', () => {
    const harness = fs.readFileSync(manualHarnessPath, 'utf8');

    assert.ok(harness.indexOf('templates/components/common/codexrCommonRuntime.js') < harness.indexOf('xrChartMappingUiRuntime.js'));
    assert.ok(harness.indexOf('templates/components/common/codexrCommonRuntime.js') < harness.indexOf('historicalComparisonRuntime.js'));
    assert.ok(harness.indexOf('templates/components/common/codexrCommonRuntime.js') < harness.indexOf('dependencyGraphRuntime.js'));
});
