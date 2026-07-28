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
    'xr-room',
    'codexrRoomRuntime.js',
);
const runtimeSource = fs.readFileSync(runtimePath, 'utf8');

// The room is a plain DOM-building component: the mock mirrors exactly what
// it touches — createElement('a-box'), attributes, classList, children, and
// the [raycaster] sweep used to refresh selectors after class changes.
function mockBox() {
    return {
        attrs: {},
        classes: new Set(),
        removed: false,
        setAttribute(name, value) {
            this.attrs[name] = value;
            if (name === 'class') {
                this.classes = new Set(String(value).split(/\s+/).filter(Boolean));
            }
        },
        classList: null, // filled below (needs `this`)
        remove() { this.removed = true; },
    };
}

function finishBox(box) {
    box.classList = {
        toggle(name, on) {
            if (on) { box.classes.add(name); } else { box.classes.delete(name); }
        },
        contains(name) { return box.classes.has(name); },
    };
    return box;
}

function createHarness() {
    const raycasterEls = [];
    let refreshCount = 0;
    function addRaycasterEl() {
        raycasterEls.push({
            components: { raycaster: { refreshObjects() { refreshCount += 1; } } },
        });
    }
    addRaycasterEl();
    addRaycasterEl();

    const doc = {
        createElement(tag) {
            assert.equal(tag, 'a-box');
            return finishBox(mockBox());
        },
        querySelectorAll(selector) {
            assert.equal(selector, '[raycaster]');
            return raycasterEls;
        },
    };

    const context = {
        AFRAME: {
            components: {},
            registerComponent(name, definition) {
                this.components[name] = definition;
            },
        },
        document: doc,
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
            const list = this.listeners[name] || [];
            const index = list.indexOf(handler);
            if (index >= 0) { list.splice(index, 1); }
        },
        emit(name) {
            (this.listeners[name] || []).slice().forEach((handler) => handler({}));
        },
    };

    const roomEl = {
        sceneEl,
        ownerDocument: doc,
        children: [],
        appendChild(child) { this.children.push(child); },
        querySelectorAll(selector) {
            assert.equal(selector, '[data-codexr-room-part]');
            this.children = this.children.filter((child) => !child.removed);
            return this.children.filter((child) => 'data-codexr-room-part' in child.attrs);
        },
    };

    const definition = context.AFRAME.components['codexr-room'];
    const component = Object.create(definition);
    component.el = roomEl;
    component.data = {
        width: 22, depth: 26, height: 11,
        wallThickness: 0.25, floorThickness: 0.18, ceilingThickness: 0.18,
        openSide: 'south', railingHeight: 1.2, railingThickness: 0.12,
        wallTexture: 'wall.svg', floorTexture: 'floor.svg',
        ceilingTexture: 'ceiling.svg', railingTexture: 'railing.svg',
        wallRepeat: '8 4', floorRepeat: '10 10', ceilingRepeat: '8 8', railingRepeat: '4 1',
        glassRailing: true, glassRailingOpacity: 0.34, glassRailingTint: '#d7ecff',
    };
    component.init();

    function parts() {
        return roomEl.querySelectorAll('[data-codexr-room-part]');
    }
    function classedParts() {
        return parts().filter((part) => part.classes.has('babiaxraycasterclass'));
    }

    return { component, sceneEl, roomEl, parts, classedParts, refreshes: () => refreshCount };
}

test('the room builds raycastable pieces (floor, ceiling, walls, railing)', () => {
    const { parts, classedParts } = createHarness();
    // south open: floor + ceiling + 3 walls + railing = 6 pieces.
    assert.equal(parts().length, 6);
    assert.equal(classedParts().length, 6, 'every piece is a raycast target by default');
});

test('entering AR strips the raycast class from every piece and refreshes raycasters', () => {
    const { sceneEl, parts, classedParts, refreshes } = createHarness();

    sceneEl.states.add('ar-mode');
    sceneEl.emit('enter-vr');

    // The room is hidden in AR but hiding is only visual (A-Frame raycasters
    // ignore `visible`) — without this, invisible walls truncate the lasers
    // and steal hover from the content behind them.
    assert.equal(classedParts().length, 0, 'AR: no invisible ray targets left');
    assert.equal(parts().length, 6, 'AR: the pieces themselves stay (hidden by hide-on-enter-ar)');
    assert.ok(refreshes() >= 2, 'AR: every raycaster re-read its objects selector');
});

test('a schema rebuild mid-AR does not resurrect the invisible colliders', () => {
    const { component, sceneEl, classedParts } = createHarness();
    sceneEl.states.add('ar-mode');
    sceneEl.emit('enter-vr');
    assert.equal(classedParts().length, 0);

    // update() recreates every piece from scratch with the class ON.
    component.update();
    assert.equal(classedParts().length, 0, 'rebuild during AR keeps the pieces declassed');
});

test('exiting AR restores the raycast class', () => {
    const { sceneEl, classedParts } = createHarness();
    sceneEl.states.add('ar-mode');
    sceneEl.emit('enter-vr');
    assert.equal(classedParts().length, 0);

    sceneEl.states.delete('ar-mode');
    sceneEl.emit('exit-vr');
    assert.equal(classedParts().length, 6, 'back on desktop the room is interactive again');
});

test('entering VR leaves the room raycastable — only AR removes it', () => {
    const { sceneEl, classedParts } = createHarness();
    sceneEl.states.add('vr-mode');
    sceneEl.emit('enter-vr');
    assert.equal(classedParts().length, 6, 'VR: the whole room stays, colliders included');
});

test('remove() detaches the scene listeners', () => {
    const { component, sceneEl, classedParts } = createHarness();
    component.remove();
    sceneEl.states.add('ar-mode');
    sceneEl.emit('enter-vr');
    // Parts are cleared by remove(); the point is no listener reacts.
    assert.equal(classedParts().length, 0);
    const remaining = Object.values(sceneEl.listeners)
        .reduce((total, handlers) => total + handlers.length, 0);
    assert.equal(remaining, 0);
});
