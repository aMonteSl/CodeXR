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
// clone/copy/set and direct x/y/z access.
function vec3(x, y, z) {
    return {
        x, y, z,
        set(nx, ny, nz) { this.x = nx; this.y = ny; this.z = nz; },
        clone() { return vec3(this.x, this.y, this.z); },
        copy(other) { this.x = other.x; this.y = other.y; this.z = other.z; },
    };
}

function createHarness({ arX = 0.07, arZ = -14.7, arRecenter = true, autoFly = true } = {}) {
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
        // A-Frame sets this before emitting enter-vr for a REAL WebXR session;
        // it stays undefined for the simulated entries. Tests flip it to
        // exercise both paths.
        xrSession: undefined,
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

    // Height lives on the rig's own y — this harness never touches it, which
    // is exactly the point: nothing in this component should either.
    const rigEl = {
        sceneEl,
        attrs: { 'movement-controls': { fly: false } },
        object3D: {
            position: vec3(0.07, 1.75, -10.75),
            rotation: vec3(0, 0.35, 0), // desktop yaw from movement-controls
        },
        getAttribute(name) {
            return this.attrs[name];
        },
        setAttribute(name, keyOrValue, value) {
            if (arguments.length === 3) {
                const current = this.attrs[name] || {};
                this.attrs[name] = Object.assign({}, current, { [keyOrValue]: value });
                return;
            }
            this.attrs[name] = keyOrValue;
        },
    };

    const definition = context.AFRAME.components['codexr-immersive-rig'];
    const component = Object.create(definition);
    component.el = rigEl;
    component.data = { arX, arZ, arRecenter, autoFly };
    component.init();

    return { component, sceneEl, rigEl };
}

test('entering AR recenters the rig at (arX, arZ), facing -Z, height untouched', () => {
    const { sceneEl, rigEl } = createHarness();

    sceneEl.states.add('ar-mode');
    sceneEl.emit('enter-vr');

    assert.deepEqual(
        { x: rigEl.object3D.position.x, y: rigEl.object3D.position.y, z: rigEl.object3D.position.z },
        { x: 0.07, y: 1.75, z: -14.7 },
    );
    assert.equal(rigEl.object3D.rotation.y, 0, 'AR entry resets yaw so the table is in front');
});

test('entering VR leaves the rig position exactly where it was', () => {
    const { sceneEl, rigEl } = createHarness();

    sceneEl.states.add('vr-mode');
    sceneEl.emit('enter-vr');

    assert.deepEqual(
        { x: rigEl.object3D.position.x, y: rigEl.object3D.position.y, z: rigEl.object3D.position.z },
        { x: 0.07, y: 1.75, z: -10.75 },
        'VR shows the whole room from where you already stood',
    );
    assert.equal(rigEl.object3D.rotation.y, 0.35, 'VR keeps the desktop yaw');
});

test('exiting restores the exact desktop pose after AR', () => {
    const { sceneEl, rigEl } = createHarness();

    sceneEl.states.add('ar-mode');
    sceneEl.emit('enter-vr');
    // The user flew around while inside.
    rigEl.object3D.position.set(3, 2.4, -14);

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

    sceneEl.states.add('ar-mode');
    sceneEl.emit('enter-vr');
    sceneEl.emit('enter-vr'); // headset visibility blip re-fires it

    sceneEl.emit('exit-vr');
    assert.equal(rigEl.object3D.position.z, -10.75, 'restored to the desktop spot, not the AR one');
});

test('arRecenter: false leaves the rig position completely alone in AR', () => {
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

// --- autoFly: the whole point of flying in VR/AR without any custom vector
// math is that movement-controls already knows how, once `fly` is true. ---

test('entering VR turns movement-controls fly on', () => {
    const { sceneEl, rigEl } = createHarness();

    sceneEl.states.add('vr-mode');
    sceneEl.emit('enter-vr');

    assert.equal(rigEl.getAttribute('movement-controls').fly, true);
});

test('entering AR also turns fly on', () => {
    const { sceneEl, rigEl } = createHarness();

    sceneEl.states.add('ar-mode');
    sceneEl.emit('enter-vr');

    assert.equal(rigEl.getAttribute('movement-controls').fly, true);
});

test('exiting restores whatever fly was before entering', () => {
    const { sceneEl, rigEl } = createHarness();
    rigEl.setAttribute('movement-controls', 'fly', false); // desktop baseline

    sceneEl.states.add('vr-mode');
    sceneEl.emit('enter-vr');
    assert.equal(rigEl.getAttribute('movement-controls').fly, true);

    sceneEl.states.delete('vr-mode');
    sceneEl.emit('exit-vr');
    assert.equal(rigEl.getAttribute('movement-controls').fly, false, 'back to grounded on desktop');
});

test('autoFly: false never touches movement-controls', () => {
    const { sceneEl, rigEl } = createHarness({ autoFly: false });

    sceneEl.states.add('vr-mode');
    sceneEl.emit('enter-vr');

    assert.equal(rigEl.getAttribute('movement-controls').fly, false, 'left exactly as configured');
});

test('a double enter-vr does not clobber the saved fly value with "true"', () => {
    const { sceneEl, rigEl } = createHarness();

    sceneEl.states.add('vr-mode');
    sceneEl.emit('enter-vr');
    sceneEl.emit('enter-vr'); // visibility blip

    sceneEl.emit('exit-vr');
    assert.equal(rigEl.getAttribute('movement-controls').fly, false, 'restored to the real desktop baseline');
});

// --- Real WebXR sessions: the device's local-floor pose already carries the
// user's height, written into the CAMERA on top of the rig. The rig must stop
// supplying its desktop height or the two stack (1.75 + ~1.6 ≈ 3.35 m — the
// floating entry the WebXR emulator exposed). ---

test('a REAL session drops the rig to the floor and restores it on exit', () => {
    const { sceneEl, rigEl } = createHarness();

    sceneEl.xrSession = {};
    sceneEl.states.add('vr-mode');
    sceneEl.emit('enter-vr');
    assert.equal(rigEl.object3D.position.y, 0, 'the device pose supplies the height now');

    sceneEl.states.delete('vr-mode');
    sceneEl.xrSession = undefined;
    sceneEl.emit('exit-vr');
    assert.equal(rigEl.object3D.position.y, 1.75, 'desktop height back on exit');
});

test('a SIMULATED entry keeps the desktop height — no pose will replace it', () => {
    const { sceneEl, rigEl } = createHarness();

    sceneEl.states.add('vr-mode'); // no xrSession: CodeXRDebug.simulateVR path
    sceneEl.emit('enter-vr');

    assert.equal(rigEl.object3D.position.y, 1.75, 'nothing writes a pose, so the rig keeps the eye height');
});

test('real AR session: recentered at (arX, arZ) AND standing on the real floor', () => {
    const { sceneEl, rigEl } = createHarness();

    sceneEl.xrSession = {};
    sceneEl.states.add('ar-mode');
    sceneEl.emit('enter-vr');

    assert.deepEqual(
        { x: rigEl.object3D.position.x, y: rigEl.object3D.position.y, z: rigEl.object3D.position.z },
        { x: 0.07, y: 0, z: -14.7 },
        'pedestal in front of you, on your own floor',
    );

    sceneEl.states.delete('ar-mode');
    sceneEl.xrSession = undefined;
    sceneEl.emit('exit-vr');
    assert.deepEqual(
        { x: rigEl.object3D.position.x, y: rigEl.object3D.position.y, z: rigEl.object3D.position.z },
        { x: 0.07, y: 1.75, z: -10.75 },
        'full desktop pose restored',
    );
});

test('a double enter-vr in a real session keeps the ORIGINAL height saved', () => {
    const { sceneEl, rigEl } = createHarness();

    sceneEl.xrSession = {};
    sceneEl.states.add('vr-mode');
    sceneEl.emit('enter-vr');
    sceneEl.emit('enter-vr'); // visibility blip: y is already 0 here

    sceneEl.emit('exit-vr');
    assert.equal(rigEl.object3D.position.y, 1.75, 'restored to 1.75, not to the adapted 0');
});
