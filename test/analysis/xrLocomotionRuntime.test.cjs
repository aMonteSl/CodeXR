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
    'xr-locomotion',
    'codexrXrLocomotionRuntime.js',
);
const runtimeSource = fs.readFileSync(runtimePath, 'utf8');

function mockEntity(id) {
    return {
        id,
        listeners: {},
        object3D: {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
        },
        addEventListener(name, handler) {
            (this.listeners[name] = this.listeners[name] || []).push(handler);
        },
        removeEventListener(name, handler) {
            const handlers = this.listeners[name] || [];
            const index = handlers.indexOf(handler);
            if (index >= 0) { handlers.splice(index, 1); }
        },
        emit(name, detail) {
            (this.listeners[name] || []).slice().forEach((handler) => handler({ detail }));
        },
    };
}

function createHarness(overrides = {}) {
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

    const left = mockEntity('leftController');
    const right = mockEntity('rightController');
    const camera = mockEntity('head');
    const selectorMap = {
        '#leftController': left,
        '#rightController': right,
        '[camera]': camera,
    };
    const sceneEl = Object.assign(mockEntity('scene'), {
        hasLoaded: true,
        querySelector(selector) { return selectorMap[selector] || null; },
    });

    const rigEl = mockEntity('rig');
    rigEl.sceneEl = sceneEl;

    const definition = context.AFRAME.components['codexr-xr-locomotion'];
    const component = Object.create(definition);
    component.el = rigEl;
    component.data = Object.assign({
        speed: 2.2,
        deadzone: 0.15,
        turnThreshold: 0.6,
        turnAngle: 30,
        strafe: false,
        cameraSelector: '[camera]',
        controllerSelectors: '#leftController,#rightController',
    }, overrides);
    component.init();

    // One 100 ms frame.
    const frame = (ms = 100) => component.tick(0, ms);

    return { component, left, right, camera, rigEl, frame };
}

test('pushing the LEFT stick forward walks the rig forward', () => {
    const { left, rigEl, frame } = createHarness();

    left.emit('thumbstickmoved', { x: 0, y: -1 });
    frame();

    assert.ok(rigEl.object3D.position.z < -0.2, `expected forward motion, z=${rigEl.object3D.position.z}`);
    assert.ok(Math.abs(rigEl.object3D.position.x) < 1e-6, 'no sideways drift');
});

test('pushing the RIGHT stick forward walks exactly the same', () => {
    const withLeft = createHarness();
    withLeft.left.emit('thumbstickmoved', { x: 0, y: -1 });
    withLeft.frame();

    const withRight = createHarness();
    withRight.right.emit('thumbstickmoved', { x: 0, y: -1 });
    withRight.frame();

    assert.equal(
        withRight.rigEl.object3D.position.z,
        withLeft.rigEl.object3D.position.z,
        'both controllers must move you identically',
    );
});

test('walking follows where the camera is looking', () => {
    const { left, camera, rigEl, frame } = createHarness();

    camera.object3D.rotation.y = Math.PI / 2; // looking down -X
    left.emit('thumbstickmoved', { x: 0, y: -1 });
    frame();

    assert.ok(rigEl.object3D.position.x < -0.2, `expected motion along -X, x=${rigEl.object3D.position.x}`);
    assert.ok(Math.abs(rigEl.object3D.position.z) < 1e-6, 'no motion along Z when facing -X');
});

test('walking never changes the rig height', () => {
    const { left, rigEl, frame } = createHarness();

    left.emit('thumbstickmoved', { x: 0, y: -1 });
    frame();

    assert.equal(rigEl.object3D.position.y, 0, 'the rig is the floor; y belongs to the camera');
});

test('a stick inside the deadzone does nothing', () => {
    const { left, rigEl, frame } = createHarness();

    left.emit('thumbstickmoved', { x: 0.1, y: -0.1 });
    frame();

    assert.deepEqual(
        { x: rigEl.object3D.position.x, z: rigEl.object3D.position.z },
        { x: 0, z: 0 },
    );
});

test('sideways snap-turns once per push, not once per frame', () => {
    const { right, rigEl, frame } = createHarness();

    right.emit('thumbstickmoved', { x: 1, y: 0 });
    frame();
    const afterFirst = rigEl.object3D.rotation.y;
    frame();
    frame();

    assert.ok(Math.abs(afterFirst + (30 * Math.PI / 180)) < 1e-9, 'one 30 degree snap');
    assert.equal(rigEl.object3D.rotation.y, afterFirst, 'holding the stick does not keep spinning');

    // Release and push again.
    right.emit('thumbstickmoved', { x: 0, y: 0 });
    frame();
    right.emit('thumbstickmoved', { x: 1, y: 0 });
    frame();

    assert.ok(Math.abs(rigEl.object3D.rotation.y - 2 * afterFirst) < 1e-9, 'a second push turns again');
});

test('both sticks pushed together do not double the speed', () => {
    const single = createHarness();
    single.left.emit('thumbstickmoved', { x: 0, y: -1 });
    single.frame();

    const both = createHarness();
    both.left.emit('thumbstickmoved', { x: 0, y: -1 });
    both.right.emit('thumbstickmoved', { x: 0, y: -1 });
    both.frame();

    assert.equal(both.rigEl.object3D.position.z, single.rigEl.object3D.position.z);
});

test('strafe: true turns the sideways axis into sidestepping', () => {
    const { left, rigEl, frame } = createHarness({ strafe: true });

    left.emit('thumbstickmoved', { x: 1, y: 0 });
    frame();

    assert.ok(rigEl.object3D.position.x > 0.2, `expected a sidestep, x=${rigEl.object3D.position.x}`);
    assert.equal(rigEl.object3D.rotation.y, 0, 'no turning while strafing');
});

test('raw axismove is accepted as a fallback (thumbstick on axes 2 and 3)', () => {
    const { right, rigEl, frame } = createHarness();

    right.emit('axismove', { axis: [0, 0, 0, -1] });
    frame();

    assert.ok(rigEl.object3D.position.z < -0.2, 'axes 2/3 drive movement too');
});

test('remove() detaches the controller listeners', () => {
    const { component, left, rigEl, frame } = createHarness();
    component.remove();

    left.emit('thumbstickmoved', { x: 0, y: -1 });
    frame();

    assert.equal(rigEl.object3D.position.z, 0, 'no reaction after remove');
});
