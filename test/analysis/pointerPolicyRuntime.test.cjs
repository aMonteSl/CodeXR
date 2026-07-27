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
    'pointer-policy',
    'codexrPointerPolicyRuntime.js',
);
const runtimeSource = fs.readFileSync(runtimePath, 'utf8');

function mockEntity(id) {
    return {
        id,
        attrs: {},
        listeners: {},
        setAttribute(name, keyOrValue, value) {
            if (arguments.length === 3) {
                const current = this.attrs[name];
                const base = current && typeof current === 'object' ? current : {};
                this.attrs[name] = Object.assign({}, base, { [keyOrValue]: value });
                return;
            }
            this.attrs[name] = keyOrValue;
        },
        getAttribute(name) {
            return name in this.attrs ? this.attrs[name] : null;
        },
        removeAttribute(name) {
            delete this.attrs[name];
        },
        addEventListener(name, handler) {
            if (!this.listeners[name]) {
                this.listeners[name] = [];
            }
            this.listeners[name].push(handler);
        },
        removeEventListener(name, handler) {
            const handlers = this.listeners[name] || [];
            const index = handlers.indexOf(handler);
            if (index >= 0) {
                handlers.splice(index, 1);
            }
        },
        emit(name, detail) {
            (this.listeners[name] || []).slice().forEach((handler) => handler({ detail }));
        },
    };
}

// The runtime defers applyPolicy with setTimeout(0) so it runs after
// laser-controls' own injection during the same event dispatch. The vm context
// gets a controllable timer queue so tests flush deterministically.
function createHarness() {
    const timers = [];
    const context = {
        AFRAME: {
            components: {},
            registerComponent(name, definition) {
                this.components[name] = definition;
            },
        },
        setTimeout(fn) {
            timers.push(fn);
            return timers.length;
        },
        clearTimeout(handle) {
            if (handle >= 1 && handle <= timers.length) {
                timers[handle - 1] = null;
            }
        },
    };
    context.window = context;
    context.globalThis = context;
    vm.runInNewContext(runtimeSource, context, { filename: runtimePath });

    const pointers = {
        mouse: mockEntity('mouseCursor'),
        gaze: mockEntity('gazeCursor'),
        left: mockEntity('leftController'),
        right: mockEntity('rightController'),
    };
    const selectorMap = {
        '#mouseCursor': pointers.mouse,
        '#gazeCursor': pointers.gaze,
        '#leftController': pointers.left,
        '#rightController': pointers.right,
    };
    const sceneEl = Object.assign(mockEntity('scene'), {
        hasLoaded: true,
        states: new Set(),
        is(state) {
            return this.states.has(state);
        },
        querySelector(selector) {
            return selectorMap[selector] || null;
        },
    });

    const definition = context.AFRAME.components['codexr-pointer-policy'];
    const component = Object.create(definition);
    component.el = sceneEl;
    component.data = {
        mouseSelector: '#mouseCursor',
        gazeSelector: '#gazeCursor',
        leftSelector: '#leftController',
        rightSelector: '#rightController',
        raycastSelector: '.babiaxraycasterclass',
    };
    component.init();

    function flush() {
        while (timers.length) {
            const pending = timers.splice(0, timers.length);
            pending.forEach((fn) => {
                if (typeof fn === 'function') {
                    fn();
                }
            });
        }
    }

    // What laser-controls does on controllerconnected/controllermodelready:
    // an unfiltered raycaster (objects: '' = the whole scene) plus a cursor.
    function simulateLaserControlsInjection(el) {
        el.setAttribute('raycaster', {
            objects: '', enabled: true, showLine: true,
        });
        el.setAttribute('cursor', { rayOrigin: 'entity', fuse: false });
    }

    return { context, component, sceneEl, pointers, flush, simulateLaserControlsInjection };
}

function raycasterEnabled(el) {
    const raycaster = el.attrs.raycaster;
    return !!(raycaster && raycaster.enabled === true);
}

function assertSingleActivePointer(pointers, activeName) {
    ['mouse', 'gaze', 'left', 'right'].forEach((name) => {
        assert.equal(
            raycasterEnabled(pointers[name]),
            name === activeName,
            `${name} raycaster enabled must be ${name === activeName} when ${activeName} is active`,
        );
    });
}

test('registers the codexr-pointer-policy component once', () => {
    const { context } = createHarness();
    assert.ok(context.AFRAME.components['codexr-pointer-policy']);
    // Re-running the source must not redefine the component.
    const definition = context.AFRAME.components['codexr-pointer-policy'];
    vm.runInNewContext(runtimeSource, context, { filename: runtimePath });
    assert.equal(context.AFRAME.components['codexr-pointer-policy'], definition);
});

test('desktop: only the mouse cursor raycaster is enabled', () => {
    const { pointers } = createHarness();
    assertSingleActivePointer(pointers, 'mouse');
    assert.equal(pointers.gaze.attrs.visible, false);
    assert.equal(pointers.left.attrs.raycaster.showLine, false);
    assert.equal('cursor' in pointers.left.attrs, false);
});

test('VR without controllers: gaze becomes the single active pointer', () => {
    const { sceneEl, pointers, flush } = createHarness();
    sceneEl.emit('enter-vr');
    flush();
    assertSingleActivePointer(pointers, 'gaze');
    assert.equal(pointers.gaze.attrs.visible, true);
});

test('VR with controllers: right laser only; left is re-neutralized after every injection', () => {
    const { sceneEl, pointers, flush, simulateLaserControlsInjection } = createHarness();
    sceneEl.emit('enter-vr');
    flush();

    pointers.right.emit('controllerconnected', { name: 'meta-touch-controls' });
    simulateLaserControlsInjection(pointers.right);
    flush();
    assertSingleActivePointer(pointers, 'right');
    assert.equal(pointers.right.attrs.raycaster.showLine, true);
    assert.equal(pointers.gaze.attrs.visible, false);

    pointers.left.emit('controllerconnected', { name: 'meta-touch-controls' });
    simulateLaserControlsInjection(pointers.left);
    flush();
    assertSingleActivePointer(pointers, 'right');
    assert.equal('cursor' in pointers.left.attrs, false, 'left cursor injected by laser-controls must be removed');
    assert.equal(pointers.left.attrs.raycaster.enabled, false);
    assert.equal(pointers.left.attrs.raycaster.showLine, false);

    // controllermodelready re-injects cursor/raycaster — must be undone again.
    simulateLaserControlsInjection(pointers.left);
    pointers.left.emit('controllermodelready', {});
    flush();
    assert.equal('cursor' in pointers.left.attrs, false);
    assert.equal(pointers.left.attrs.raycaster.enabled, false);
});

test('single-controller headset: left becomes the pointer when right disconnects', () => {
    const { sceneEl, pointers, flush, simulateLaserControlsInjection } = createHarness();
    sceneEl.emit('enter-vr');
    pointers.right.emit('controllerconnected', { name: 'meta-touch-controls' });
    simulateLaserControlsInjection(pointers.right);
    pointers.left.emit('controllerconnected', { name: 'meta-touch-controls' });
    simulateLaserControlsInjection(pointers.left);
    flush();
    assertSingleActivePointer(pointers, 'right');

    pointers.right.emit('controllerdisconnected', { name: 'meta-touch-controls' });
    flush();
    assertSingleActivePointer(pointers, 'left');
    assert.ok(pointers.left.attrs.cursor, 'active left laser must have a cursor to emit hover events');
    assert.equal(
        pointers.left.attrs.raycaster.objects,
        '.babiaxraycasterclass',
        'the active laser must stay filtered to babia targets (laser-controls injects objects: "")',
    );

    pointers.left.emit('controllerdisconnected', { name: 'meta-touch-controls' });
    flush();
    assertSingleActivePointer(pointers, 'gaze');
});

test('using the left controller hands it the pointer, and back again', () => {
    const { sceneEl, pointers, flush, simulateLaserControlsInjection } = createHarness();
    sceneEl.emit('enter-vr');
    ['left', 'right'].forEach((side) => {
        pointers[side].emit('controllerconnected');
        simulateLaserControlsInjection(pointers[side]);
    });
    flush();
    assertSingleActivePointer(pointers, 'right');

    // Pull the trigger on the idle hand: it takes over, so the click that
    // follows on triggerup lands with the controller the user actually used.
    pointers.left.emit('triggerdown');
    flush();
    assertSingleActivePointer(pointers, 'left');

    // And back — neither hand is privileged.
    pointers.right.emit('triggerdown');
    flush();
    assertSingleActivePointer(pointers, 'right');
});

test('any deliberate use counts: buttons and a pushed thumbstick', () => {
    const { sceneEl, pointers, flush, simulateLaserControlsInjection } = createHarness();
    sceneEl.emit('enter-vr');
    ['left', 'right'].forEach((side) => {
        pointers[side].emit('controllerconnected');
        simulateLaserControlsInjection(pointers[side]);
    });
    flush();

    pointers.left.emit('buttondown');
    flush();
    assertSingleActivePointer(pointers, 'left');

    pointers.right.emit('thumbstickmoved', { x: 0, y: -1 });
    flush();
    assertSingleActivePointer(pointers, 'right');

    // Stick noise must not steal the pointer mid-gesture.
    pointers.left.emit('thumbstickmoved', { x: 0.05, y: -0.02 });
    flush();
    assertSingleActivePointer(pointers, 'right');
});

test('the hand you last used keeps the pointer through a laser-controls re-injection', () => {
    const { sceneEl, pointers, flush, simulateLaserControlsInjection } = createHarness();
    sceneEl.emit('enter-vr');
    ['left', 'right'].forEach((side) => {
        pointers[side].emit('controllerconnected');
        simulateLaserControlsInjection(pointers[side]);
    });
    flush();

    pointers.left.emit('triggerdown');
    flush();

    // laser-controls re-injects an unfiltered raycaster on model load.
    simulateLaserControlsInjection(pointers.right);
    pointers.right.emit('controllermodelready');
    flush();

    assertSingleActivePointer(pointers, 'left');
    assert.equal(pointers.left.attrs.raycaster.objects, '.babiaxraycasterclass');
});

test('exit-vr hands the pointer back to the mouse', () => {
    const { sceneEl, pointers, flush, simulateLaserControlsInjection } = createHarness();
    sceneEl.emit('enter-vr');
    pointers.right.emit('controllerconnected', { name: 'meta-touch-controls' });
    simulateLaserControlsInjection(pointers.right);
    flush();
    assertSingleActivePointer(pointers, 'right');

    sceneEl.emit('exit-vr');
    flush();
    assertSingleActivePointer(pointers, 'mouse');
    assert.equal(pointers.gaze.attrs.visible, false);
});

test('remove() detaches every listener', () => {
    const { component, sceneEl, pointers, flush } = createHarness();
    component.remove();
    sceneEl.emit('enter-vr');
    flush();
    // With listeners gone the policy no longer reacts: mouse stays active.
    assertSingleActivePointer(pointers, 'mouse');
    const remaining = [sceneEl, pointers.left, pointers.right]
        .flatMap((el) => Object.values(el.listeners))
        .reduce((total, handlers) => total + handlers.length, 0);
    assert.equal(remaining, 0);
});

test('scene templates declare the policy, the pointer ids and the gaze cursor', () => {
    const xrTemplate = fs.readFileSync(
        path.join(projectRoot, 'templates', 'xr', 'file', 'xr-visualization.html'),
        'utf8',
    );
    const domTemplate = fs.readFileSync(
        path.join(projectRoot, 'templates', 'xr', 'html', 'dom-visualization-template.html'),
        'utf8',
    );

    [xrTemplate, domTemplate].forEach((template) => {
        assert.match(template, /codexr-pointer-policy/);
        assert.match(template, /id="mouseCursor"/);
        assert.match(template, /id="gazeCursor"/);
        // The gaze cursor starts disabled and hover-only (no fuse clicks).
        assert.match(template, /id="gazeCursor"[\s\S]*?cursor="rayOrigin: entity; fuse: false"[\s\S]*?enabled: false/);
        assert.match(template, /codexrPointerPolicyRuntime\.js/);
    });

    // babia-camera created a duplicate mouse cursor + hand raycasters.
    assert.doesNotMatch(domTemplate, /babia-camera=/);
});

test('COMPONENTS.md lists the pointer-policy runtime', () => {
    const inventory = fs.readFileSync(
        path.join(projectRoot, 'templates', 'components', 'COMPONENTS.md'),
        'utf8',
    );
    assert.match(inventory, /codexr\/pointer-policy\/codexrPointerPolicyRuntime\.js/);
    assert.match(inventory, /codexr-pointer-policy/);
});
