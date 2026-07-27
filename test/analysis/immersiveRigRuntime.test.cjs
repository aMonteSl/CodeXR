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

function createHarness({ arPosition, arRecenter = true } = {}) {
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

    // The rig stands on the floor: eye height lives on the camera entity,
    // which A-Frame's look-controls owns during an immersive session.
    const rigEl = {
        sceneEl,
        object3D: {
            position: vec3(0.07, 0, -10.75),
            rotation: vec3(0, 0.35, 0), // desktop yaw from movement-controls
        },
    };

    const definition = context.AFRAME.components['codexr-immersive-rig'];
    const component = Object.create(definition);
    component.el = rigEl;
    component.data = {
        arPosition: arPosition || { x: 0.07, y: 0, z: -14.7 },
        arRecenter,
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
        { x: 0.07, y: 0, z: -14.7 },
    );
    assert.equal(rigEl.object3D.rotation.y, 0, 'AR entry resets yaw so the table is in front');
});

test('the AR recenter never lifts the rig off the floor', () => {
    // Eye height belongs to the camera entity. A rig moved vertically is what
    // put a shipped build's user on the floor with the pedestal overhead.
    const { sceneEl, rigEl } = createHarness({ arPosition: { x: 1, y: 1.75, z: -14 } });

    sceneEl.states.add('ar-mode');
    sceneEl.emit('enter-vr');

    assert.equal(rigEl.object3D.position.y, 0, 'a y in arPosition is ignored on purpose');
});

test('entering VR leaves the rig exactly where it was', () => {
    const { sceneEl, rigEl } = createHarness();

    sceneEl.states.add('vr-mode');
    sceneEl.emit('enter-vr');

    assert.deepEqual(
        { x: rigEl.object3D.position.x, y: rigEl.object3D.position.y, z: rigEl.object3D.position.z },
        { x: 0.07, y: 0, z: -10.75 },
        'VR shows the whole room from where you already stood',
    );
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
        { x: 0.07, y: 0, z: -10.75 },
    );
    assert.equal(rigEl.object3D.rotation.y, 0.35, 'desktop yaw restored');
});

test('a second enter-vr without exit keeps the ORIGINAL desktop pose saved', () => {
    const { sceneEl, rigEl } = createHarness();

    sceneEl.states.add('ar-mode');
    sceneEl.emit('enter-vr');
    sceneEl.emit('enter-vr'); // headset visibility blip re-fires it

    sceneEl.emit('exit-vr');
    assert.equal(rigEl.object3D.position.z, -10.75, 'restored to the desktop spot, not the AR one');
});

test('arRecenter: false leaves the rig completely alone in AR', () => {
    const { sceneEl, rigEl } = createHarness({ arRecenter: false });

    sceneEl.states.add('ar-mode');
    sceneEl.emit('enter-vr');

    assert.equal(rigEl.object3D.position.z, -10.75, 'no recenter');
    assert.equal(rigEl.object3D.rotation.y, 0.35, 'yaw untouched without recenter');
});

test('exit without a prior enter is a no-op', () => {
    const { sceneEl, rigEl } = createHarness();
    sceneEl.emit('exit-vr');
    assert.equal(rigEl.object3D.position.z, -10.75);
});

test('remove() detaches the scene listeners', () => {
    const { component, sceneEl, rigEl } = createHarness();
    component.remove();

    sceneEl.states.add('ar-mode');
    sceneEl.emit('enter-vr');
    assert.equal(rigEl.object3D.position.z, -10.75, 'no reaction after remove');
});
