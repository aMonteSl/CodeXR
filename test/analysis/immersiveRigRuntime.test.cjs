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

test('exiting VR restores the desktop pose after flying — not just the height', () => {
    const { sceneEl, rigEl } = createHarness();

    sceneEl.xrSession = {};
    sceneEl.states.add('vr-mode');
    sceneEl.emit('enter-vr');

    // The user walked with the sticks, turned, and flew out of the room —
    // all of it moves the RIG (movement-controls), and desktop mode (fly
    // off, walls solid to the eye) cannot recover from out there.
    rigEl.object3D.position.set(9.4, 3.1, 4.2);
    rigEl.object3D.rotation.set(0, 2.4, 0);

    sceneEl.states.delete('vr-mode');
    sceneEl.xrSession = undefined;
    sceneEl.emit('exit-vr');

    assert.deepEqual(
        { x: rigEl.object3D.position.x, y: rigEl.object3D.position.y, z: rigEl.object3D.position.z },
        { x: 0.07, y: 1.75, z: -10.75 },
        'the desktop spot comes back, however far the user flew',
    );
    assert.equal(rigEl.object3D.rotation.y, 0.35, 'desktop yaw restored too');
});

test('a SIMULATED VR exit also restores the pose (CodeXRDebug parity)', () => {
    const { sceneEl, rigEl } = createHarness();

    sceneEl.states.add('vr-mode'); // no xrSession: simulateVR path
    sceneEl.emit('enter-vr');
    rigEl.object3D.position.set(2, 1.75, -3);

    sceneEl.states.delete('vr-mode');
    sceneEl.emit('exit-vr');
    assert.equal(rigEl.object3D.position.z, -10.75, 'simulated exits restore the same way');
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

// --- The gamepad-controls compatibility patch: aframe-extras gates ALL stick
// input on `gamepad.connected`, and Meta's Immersive Web Emulator leaves that
// flag false on session start (its runtime only syncs it inside a setter
// nothing invokes). Per the WebXR Gamepads Module an input source the session
// lists is connected by definition, so the runtime teaches isConnected to
// trust the tracked-controls system's list. Found live: lasers and triggers
// worked while both sticks were dead in the emulator. ---

function gamepadPatchContext() {
    // A-Frame's real shape: AFRAME.components[name].Component.prototype.
    function GamepadControls() {}
    GamepadControls.prototype.isConnected = function () {
        const gamepad = this.getGamepad();
        return !!(gamepad && gamepad.connected);
    };
    GamepadControls.prototype.getGamepad = function () {
        const controllers = (this.system && this.system.controllers) || [];
        const entry = controllers.find((c) => c && c.handedness === 'left') || controllers[0];
        return entry ? entry.gamepad : null;
    };

    const context = {
        AFRAME: {
            components: { 'gamepad-controls': { Component: GamepadControls } },
            registerComponent(name, definition) {
                this.components[name] = definition;
            },
        },
    };
    context.window = context;
    context.globalThis = context;
    vm.runInNewContext(runtimeSource, context, { filename: runtimePath });
    return { GamepadControls };
}

test('IWER-shaped gamepads (connected:false) still count as connected', () => {
    const { GamepadControls } = gamepadPatchContext();
    const instance = new GamepadControls();
    instance.system = {
        controllers: [
            { handedness: 'left', gamepad: { connected: false, axes: [null, null, 0, 0] } },
            { handedness: 'right', gamepad: { connected: false, axes: [null, null, 0, 0] } },
        ],
    };
    assert.equal(instance.isConnected(), true,
        'an input source the session lists is connected by definition');
});

test('no controllers listed: isConnected stays false', () => {
    const { GamepadControls } = gamepadPatchContext();
    const instance = new GamepadControls();
    instance.system = { controllers: [] };
    assert.equal(instance.isConnected(), false);
});

test('a well-behaved gamepad (connected:true) still passes through the original check', () => {
    const { GamepadControls } = gamepadPatchContext();
    const instance = new GamepadControls();
    instance.system = {
        controllers: [{ handedness: 'left', gamepad: { connected: true } }],
    };
    assert.equal(instance.isConnected(), true);
});

// --- The per-hand stick gate: while a controller drags a virtual screen its
// thumbstick pushes/pulls the screen, so that hand's locomotion function must
// go quiet — aframe-extras polls the gamepads directly (events cannot stop
// it), so the claim is honoured inside a getJoystick patch. The scheme is
// fixed upstream: joystick 1 (MOVEMENT) reads the LEFT gamepad, joystick 2
// (ROTATION) reads the RIGHT one, so a claim silences only its own hand. ---

function stickGateContext() {
    function GamepadControls() {}
    GamepadControls.prototype.isConnected = function () { return true; };
    GamepadControls.prototype.getJoystick = function (index, target) {
        // Stand-in for the real read: full deflection on whatever is asked.
        target.set(1, 1);
        return target;
    };
    const context = {
        AFRAME: {
            components: { 'gamepad-controls': { Component: GamepadControls } },
            registerComponent(name, definition) { this.components[name] = definition; },
        },
    };
    context.window = context;
    context.globalThis = context;
    vm.runInNewContext(runtimeSource, context, { filename: runtimePath });
    const target = {
        x: null, y: null,
        set(x, y) { this.x = x; this.y = y; return this; },
    };
    return { gate: context.CodeXRStickGateRuntime, instance: new GamepadControls(), target };
}

test('the stick gate silences MOVEMENT while the left hand is claimed', () => {
    const { gate, instance, target } = stickGateContext();
    assert.ok(gate, 'rig runtime must expose CodeXRStickGateRuntime');

    gate.claim('left');
    instance.getJoystick(1, target); // MOVEMENT reads the left gamepad
    assert.deepEqual({ x: target.x, y: target.y }, { x: 0, y: 0 }, 'left claimed: no walking');
    instance.getJoystick(2, target); // ROTATION reads the right gamepad
    assert.deepEqual({ x: target.x, y: target.y }, { x: 1, y: 1 }, 'left claimed: turning still works');

    gate.release('left');
    instance.getJoystick(1, target);
    assert.deepEqual({ x: target.x, y: target.y }, { x: 1, y: 1 }, 'released: walking is back');
});

test('the stick gate silences ROTATION while the right hand is claimed', () => {
    const { gate, instance, target } = stickGateContext();
    gate.claim('right');
    instance.getJoystick(2, target);
    assert.deepEqual({ x: target.x, y: target.y }, { x: 0, y: 0 }, 'right claimed: no turning');
    instance.getJoystick(1, target);
    assert.deepEqual({ x: target.x, y: target.y }, { x: 1, y: 1 }, 'right claimed: walking still works');
    gate.release('right');
    instance.getJoystick(2, target);
    assert.deepEqual({ x: target.x, y: target.y }, { x: 1, y: 1 }, 'released: turning is back');
});

test('the stick gate ignores unknown hands and stays a passthrough by default', () => {
    const { gate, instance, target } = stickGateContext();
    gate.claim('head'); // nonsense claims must not wedge anything
    instance.getJoystick(1, target);
    assert.deepEqual({ x: target.x, y: target.y }, { x: 1, y: 1 });
    instance.getJoystick(2, target);
    assert.deepEqual({ x: target.x, y: target.y }, { x: 1, y: 1 });
});

// --- The AR fill light: aframe-environment-component parents its lights
// under #env, #env hides in AR, and three.js does not descend into invisible
// nodes — so in AR only the root ambient survives and standard-material
// content (charts, pedestal, logo) goes flat. codexr-ar-fill-light sits on a
// root-level directional that idles at 0 and only comes on for AR. ---

function fillLightHarness() {
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
        removeEventListener() {},
        emit(name) {
            (this.listeners[name] || []).slice().forEach((handler) => handler({}));
        },
    };
    const lightEl = {
        sceneEl,
        attrs: { light: { type: 'directional', intensity: 0 } },
        setAttribute(name, key, value) {
            const current = this.attrs[name] || {};
            this.attrs[name] = Object.assign({}, current, { [key]: value });
        },
    };
    const definition = context.AFRAME.components['codexr-ar-fill-light'];
    assert.ok(definition, 'rig runtime must register codexr-ar-fill-light');
    const component = Object.create(definition);
    component.el = lightEl;
    component.data = { intensity: 0.55 };
    component.init();
    return { sceneEl, lightEl };
}

test('AR turns the fill light on; exiting turns it back off', () => {
    const { sceneEl, lightEl } = fillLightHarness();

    sceneEl.states.add('ar-mode');
    sceneEl.emit('enter-vr');
    assert.equal(lightEl.attrs.light.intensity, 0.55,
        'AR: the fill directional restores the modelling the hidden #env lights provided');

    sceneEl.states.delete('ar-mode');
    sceneEl.emit('exit-vr');
    assert.equal(lightEl.attrs.light.intensity, 0, 'desktop look untouched after exit');
});

test('VR never touches the fill light — the environment lights are visible there', () => {
    const { sceneEl, lightEl } = fillLightHarness();
    sceneEl.states.add('vr-mode');
    sceneEl.emit('enter-vr');
    assert.equal(lightEl.attrs.light.intensity, 0);
});

test('the patch is applied exactly once', () => {
    function GamepadControls() {}
    GamepadControls.prototype.isConnected = function () { return false; };
    const context = {
        AFRAME: {
            components: { 'gamepad-controls': { Component: GamepadControls } },
            registerComponent(name, definition) { this.components[name] = definition; },
        },
    };
    context.window = context;
    context.globalThis = context;
    vm.runInNewContext(runtimeSource, context, { filename: runtimePath });
    const patched = GamepadControls.prototype.isConnected;
    // A second component registration (another scene, a re-injected script)
    // must not wrap the wrapper.
    delete context.AFRAME.components['codexr-immersive-rig'];
    vm.runInNewContext(runtimeSource, context, { filename: runtimePath });
    assert.equal(GamepadControls.prototype.isConnected, patched, 'no double wrap');
});
