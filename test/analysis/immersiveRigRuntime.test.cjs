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
    'codexr',
    'immersive-rig',
    'codexrImmersiveRigRuntime.js',
);
const runtimeSource = fs.readFileSync(runtimePath, 'utf8');

// Minimal three.js-shaped vector/euler stand-ins: the component only uses
// clone/copy/set and direct x/y/z (and rotation y) access.
function vec3(x, y, z) {
    return {
        x, y, z,
        set(nx, ny, nz) { this.x = nx; this.y = ny; this.z = nz; },
        clone() { return vec3(this.x, this.y, this.z); },
        copy(other) { this.x = other.x; this.y = other.y; this.z = other.z; },
    };
}

function createHarness({ arPosition, arRecenter = true, alignFloor = true } = {}) {
    const context = {
        AFRAME: {
            components: {},
            registerComponent(name, definition) {
                this.components[name] = definition;
            },
        },
    };
    context.window = context;
    context.globalThis = context;
    vm.runInNewContext(runtimeSource, context, { filename: runtimePath });

    const sceneEl = {
        states: new Set(),
        listeners: {},
        is(state) { return this.states.has(state); },
        addEventListener(name, handler) {
            (this.listeners[name] = this.listeners[name] || []).push(handler);
        },
        removeEventListener(name, handler) {
            const handlers = this.listeners[name] || [];
            const index = handlers.indexOf(handler);
            if (index >= 0) { handlers.splice(index, 1); }
        },
        emit(name) {
            (this.listeners[name] || []).slice().forEach((handler) => handler({}));
        },
    };

    const rigEl = {
        sceneEl,
        object3D: {
            position: vec3(0.07, 1.75, -10.75),
            rotation: vec3(0, 0.35, 0), // desktop yaw from movement-controls
        },
    };

    const definition = context.AFRAME.components['codexr-immersive-rig'];
    const component = Object.create(definition);
    component.el = rigEl;
    component.data = {
        arPosition: arPosition || { x: 0.07, y: 0, z: -15.6 },
        arRecenter,
        alignFloor,
    };
    component.init();

    return { component, sceneEl, rigEl };
}

test('entering AR recenters the rig at arPosition on the floor, facing -Z', () => {
    const { sceneEl, rigEl } = createHarness();

    sceneEl.states.add('ar-mode');
    sceneEl.emit('enter-vr');

    assert.deepEqual(
        { x: rigEl.object3D.position.x, y: rigEl.object3D.position.y, z: rigEl.object3D.position.z },
        { x: 0.07, y: 0, z: -15.6 },
    );
    assert.equal(rigEl.object3D.rotation.y, 0, 'AR entry resets yaw so the table is in front');
});

test('entering VR only drops the rig to floor level, keeping x/z and yaw', () => {
    const { sceneEl, rigEl } = createHarness();

    sceneEl.states.add('vr-mode');
    sceneEl.emit('enter-vr');

    assert.equal(rigEl.object3D.position.y, 0, 'floor alignment');
    assert.equal(rigEl.object3D.position.x, 0.07, 'x untouched');
    assert.equal(rigEl.object3D.position.z, -10.75, 'z untouched');
    assert.equal(rigEl.object3D.rotation.y, 0.35, 'VR keeps the desktop yaw');
});

test('exiting restores the exact desktop pose after AR', () => {
    const { sceneEl, rigEl } = createHarness();

    sceneEl.states.add('ar-mode');
    sceneEl.emit('enter-vr');
    // The user moved with the thumbstick while inside.
    rigEl.object3D.position.set(3, 0, -14);

    sceneEl.states.delete('ar-mode');
    sceneEl.emit('exit-vr');

    assert.deepEqual(
        { x: rigEl.object3D.position.x, y: rigEl.object3D.position.y, z: rigEl.object3D.position.z },
        { x: 0.07, y: 1.75, z: -10.75 },
    );
    assert.equal(rigEl.object3D.rotation.y, 0.35, 'desktop yaw restored');
});

test('a second enter-vr without exit keeps the ORIGINAL desktop pose saved', () => {
    const { sceneEl, rigEl } = createHarness();

    sceneEl.states.add('vr-mode');
    sceneEl.emit('enter-vr');
    sceneEl.emit('enter-vr'); // headset visibility blip re-fires it

    sceneEl.emit('exit-vr');
    assert.equal(rigEl.object3D.position.y, 1.75, 'restored to desktop height, not the adapted 0');
});

test('arRecenter: false leaves AR at floor-aligned current position', () => {
    const { sceneEl, rigEl } = createHarness({ arRecenter: false });

    sceneEl.states.add('ar-mode');
    sceneEl.emit('enter-vr');

    assert.equal(rigEl.object3D.position.y, 0, 'still floor-aligned');
    assert.equal(rigEl.object3D.position.z, -10.75, 'no recenter');
    assert.equal(rigEl.object3D.rotation.y, 0.35, 'yaw untouched without recenter');
});

test('exit without a prior enter is a no-op', () => {
    const { sceneEl, rigEl } = createHarness();
    sceneEl.emit('exit-vr');
    assert.equal(rigEl.object3D.position.y, 1.75);
});

test('remove() detaches the scene listeners', () => {
    const { component, sceneEl, rigEl } = createHarness();
    component.remove();

    sceneEl.states.add('ar-mode');
    sceneEl.emit('enter-vr');
    assert.equal(rigEl.object3D.position.y, 1.75, 'no reaction after remove');
});
