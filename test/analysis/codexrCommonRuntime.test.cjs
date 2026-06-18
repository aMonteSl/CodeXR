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
    }, { x: 1, y: 2, z: 3 }, { height: 1.78 });

    assert.equal(tooltip.root.getAttribute('visible'), true);
    assert.equal(tooltip.root.getAttribute('position'), '1 2 3');
    assert.equal(tooltip.background.getAttribute('height'), 1.78);
    assert.equal(tooltip.title.getAttribute('value'), 'Dependency node');

    runtime.hideTooltip(tooltip);
    assert.equal(tooltip.root.getAttribute('visible'), false);
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
