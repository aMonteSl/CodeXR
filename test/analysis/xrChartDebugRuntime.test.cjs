const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const { requireAssembledRuntime } = require(path.join(projectRoot, 'test', 'helpers', 'runtimeAssembly.cjs'));

class FakeClassList {
    constructor(owner) {
        this.owner = owner;
    }

    contains(name) {
        const current = this.owner.attributes.class || '';
        return current.split(/\s+/).includes(name);
    }
}

class FakeVector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
}

class FakeVector3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    copy(other) {
        this.x = other.x;
        this.y = other.y;
        this.z = other.z;
        return this;
    }

    set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }
}

class FakeBox3 {
    constructor() {
        this.size = new FakeVector3(0, 0, 0);
    }

    setFromObject(object3D) {
        const baseSize = object3D && object3D.baseSize ? object3D.baseSize : new FakeVector3(1, 1, 1);
        const scale = object3D && object3D.scale ? object3D.scale : new FakeVector3(1, 1, 1);
        this.size.set(baseSize.x * scale.x, baseSize.y * scale.y, baseSize.z * scale.z);
        return this;
    }

    getSize(target) {
        return target.copy(this.size);
    }
}

class FakeRaycaster {
    static nextIntersections = [];

    setFromCamera() {}

    intersectObjects() {
        return FakeRaycaster.nextIntersections;
    }
}

class FakeObject3DParent {
    worldToLocal(vector) {
        return vector;
    }
}

class FakeObject3D {
    constructor(x = 0, y = 0, z = 0) {
        this.position = new FakeVector3(x, y, z);
        this.scale = new FakeVector3(1, 1, 1);
        this.baseSize = new FakeVector3(2, 3, 4);
        this.parent = new FakeObject3DParent();
    }

    getWorldPosition(vector) {
        return vector.copy(this.position);
    }

    updateMatrixWorld() {}
}

function matchesSelector(element, selector) {
    if (!element || !selector) {
        return false;
    }

    if (selector.charAt(0) === '#') {
        return element.id === selector.slice(1);
    }

    if (selector.charAt(0) === '.') {
        return element.classList.contains(selector.slice(1));
    }

    if (selector.charAt(0) === '[' && selector.charAt(selector.length - 1) === ']') {
        return element.hasAttribute(selector.slice(1, -1));
    }

    return element.tagName === selector.toLowerCase();
}

class FakeElement {
    constructor(tagName, ownerDocument) {
        this.tagName = String(tagName || '').toLowerCase();
        this.ownerDocument = ownerDocument;
        this.children = [];
        this.parentElement = null;
        this.parentNode = null;
        this.attributes = {};
        this.listeners = {};
        this.nodeType = 1;
        this.object3D = null;
        this.classList = new FakeClassList(this);
        this.isConnected = true;
        this.id = '';
    }

    appendChild(child) {
        child.parentElement = this;
        child.parentNode = this;
        this.children.push(child);
        return child;
    }

    removeChild(child) {
        const index = this.children.indexOf(child);
        if (index >= 0) {
            this.children.splice(index, 1);
            child.parentElement = null;
            child.parentNode = null;
        }
        return child;
    }

    setAttribute(name, value) {
        this.attributes[name] = value;
        if (name === 'id') {
            this.id = String(value);
        }
        if (name === 'class') {
            this.attributes.class = String(value);
        }
    }

    getAttribute(name) {
        if (name === 'id') {
            return this.id || null;
        }
        return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
    }

    hasAttribute(name) {
        if (name === 'id') {
            return !!this.id;
        }
        return Object.prototype.hasOwnProperty.call(this.attributes, name);
    }

    addEventListener(type, handler) {
        if (!this.listeners[type]) {
            this.listeners[type] = [];
        }
        this.listeners[type].push(handler);
    }

    removeEventListener(type, handler) {
        if (!this.listeners[type]) {
            return;
        }
        this.listeners[type] = this.listeners[type].filter((listener) => listener !== handler);
    }

    dispatchEvent(event) {
        const payload = event || {};
        const type = payload.type;
        const listeners = this.listeners[type] || [];
        listeners.forEach((listener) => listener(payload));
    }

    querySelector(selector) {
        const matches = this.querySelectorAll(selector);
        return matches.length > 0 ? matches[0] : null;
    }

    querySelectorAll(selector) {
        const results = [];

        function walk(node) {
            for (const child of node.children) {
                if (matchesSelector(child, selector)) {
                    results.push(child);
                }
                walk(child);
            }
        }

        walk(this);
        return results;
    }
}

class FakeDocument {
    constructor() {
        this.readyState = 'complete';
        this.listeners = {};
        this.body = new FakeElement('body', this);
        this.scene = new FakeElement('a-scene', this);
        this.scene.canvas = {
            getBoundingClientRect() {
                return { left: 0, top: 0, width: 100, height: 100 };
            },
        };
        this.scene.camera = {};
        this.body.appendChild(this.scene);
    }

    createElement(tagName) {
        return new FakeElement(tagName, this);
    }

    querySelector(selector) {
        if (selector === 'a-scene') {
            return this.scene;
        }
        return this.body.querySelector(selector);
    }

    querySelectorAll(selector) {
        return this.body.querySelectorAll(selector);
    }

    getElementById(id) {
        function walk(node) {
            if (node.id === id) {
                return node;
            }
            for (const child of node.children) {
                const found = walk(child);
                if (found) {
                    return found;
                }
            }
            return null;
        }

        return walk(this.body);
    }

    addEventListener(type, handler) {
        if (!this.listeners[type]) {
            this.listeners[type] = [];
        }
        this.listeners[type].push(handler);
    }

    removeEventListener(type, handler) {
        if (!this.listeners[type]) {
            return;
        }
        this.listeners[type] = this.listeners[type].filter((listener) => listener !== handler);
    }
}

function createChart(document, id, componentName, position, size) {
    const chart = document.createElement('a-entity');
    chart.id = id;
    chart.setAttribute('id', id);
    chart.setAttribute(componentName, '');
    chart.object3D = new FakeObject3D(position.x, position.y, position.z);
    if (size) {
        chart.object3D.baseSize = new FakeVector3(size.width, size.height, size.depth);
    }
    document.scene.appendChild(chart);
    return chart;
}

function dispatchPointerOnTarget(document, target, button) {
    FakeRaycaster.nextIntersections = [{ object: { el: target } }];
    const listeners = document.listeners.pointerdown || [];
    listeners.forEach((listener) => {
        listener({
            button,
            clientX: 20,
            clientY: 20,
            preventDefault() {},
        });
    });
    FakeRaycaster.nextIntersections = [];
}

function withRuntime(setup) {
    const previousDocument = global.document;
    const previousAframe = global.AFRAME;
    const previousChartDebug = global.CodeXRChartDebug;
    const previousLog = console.log;
    const document = new FakeDocument();
    const logs = [];

    console.log = (...args) => {
        logs.push(args.map((value) => String(value)).join(' '));
    };

    global.document = document;
    global.AFRAME = {
        THREE: {
            Vector2: FakeVector2,
            Vector3: FakeVector3,
            Box3: FakeBox3,
            Raycaster: FakeRaycaster,
        },
    };

    // requireAssembledRuntime evaluates a fresh copy per call, so no
    // require-cache busting is needed.
    FakeRaycaster.nextIntersections = [];
    const runtime = requireAssembledRuntime('xr-chart-debug', 'xrChartDebugRuntime.js');

    try {
        return setup({ runtime, document, logs });
    } finally {
        console.log = previousLog;
        if (previousDocument === undefined) {
            delete global.document;
        } else {
            global.document = previousDocument;
        }
        if (previousAframe === undefined) {
            delete global.AFRAME;
        } else {
            global.AFRAME = previousAframe;
        }
        if (previousChartDebug === undefined) {
            delete global.CodeXRChartDebug;
        } else {
            global.CodeXRChartDebug = previousChartDebug;
        }
    }
}

test('chart debug runtime exposes the expected public API', () => {
    withRuntime(({ runtime }) => {
        assert.equal(typeof runtime.enable, 'function');
        assert.equal(typeof runtime.disable, 'function');
        assert.equal(typeof runtime.toggle, 'function');
        assert.equal(typeof runtime.select, 'function');
        assert.equal(typeof runtime.deactivate, 'function');
        assert.equal(typeof runtime.listCharts, 'function');
        assert.equal(typeof runtime.getActiveChartId, 'function');
        assert.equal(typeof runtime.isEnabled, 'function');
        assert.equal(typeof runtime.setStep, 'function');
        assert.equal(typeof runtime.getState, 'function');
        assert.equal(typeof runtime.restoreState, 'function');
        assert.equal(typeof runtime.getActiveChart, 'function');
        assert.equal(typeof runtime.getActiveChartPosition, 'function');
        assert.equal(typeof runtime.actualScale, 'function');
        assert.equal(typeof runtime.actualDimensions, 'function');
        assert.equal(typeof runtime.actualWidth, 'function');
        assert.equal(typeof runtime.actualHeight, 'function');
        assert.equal(typeof runtime.actualDepth, 'function');
        assert.equal(typeof runtime.scale, 'function');
        assert.equal(typeof runtime.setPosition, 'function');
        assert.equal(typeof runtime.setFlight, 'function');
        assert.equal(typeof runtime.toggleFlight, 'function');
        assert.equal(typeof runtime.getRigPosition, 'function');
        assert.equal(typeof runtime.getCameraPosition, 'function');
        assert.equal(typeof runtime.getUserPosition, 'function');
        assert.equal(typeof runtime.teardown, 'function');
        assert.equal(typeof runtime.commands, 'function');
        assert.equal(typeof runtime.help, 'function');
    });
});

test('flight commands mutate rig movement-controls fly flag', () => {
    withRuntime(({ runtime, document }) => {
        const rig = document.createElement('a-entity');
        rig.setAttribute('id', 'rig');
        rig.setAttribute('movement-controls', 'fly: false; speed: 0.15');
        rig.object3D = new FakeObject3D(0, 1.75, 2);
        document.scene.appendChild(rig);

        assert.equal(runtime.setFlight(true), true);
        assert.match(String(rig.getAttribute('movement-controls')), /fly:\s*true/i);

        assert.equal(runtime.toggleFlight(), false);
        assert.match(String(rig.getAttribute('movement-controls')), /fly:\s*false/i);
    });
});

test('user position commands return rig and camera world positions', () => {
    withRuntime(({ runtime, document }) => {
        const rig = document.createElement('a-entity');
        rig.setAttribute('id', 'rig');
        rig.setAttribute('movement-controls', 'fly: false');
        rig.object3D = new FakeObject3D(3.2, 1.75, -4.1);
        document.scene.appendChild(rig);

        const camera = document.createElement('a-entity');
        camera.setAttribute('camera', '');
        camera.object3D = new FakeObject3D(3.2, 2.0, -4.1);
        rig.appendChild(camera);

        assert.deepEqual(runtime.getRigPosition(), { x: 3.2, y: 1.75, z: -4.1 });
        assert.deepEqual(runtime.getCameraPosition(), { x: 3.2, y: 2, z: -4.1 });
        assert.deepEqual(runtime.getUserPosition(), {
            rig: { x: 3.2, y: 1.75, z: -4.1 },
            camera: { x: 3.2, y: 2, z: -4.1 },
        });
    });
});

test('enable, disable, toggle and isEnabled manage runtime state', () => {
    withRuntime(({ runtime }) => {
        assert.equal(runtime.isEnabled(), false);
        runtime.enable();
        assert.equal(runtime.isEnabled(), true);
        runtime.toggle();
        assert.equal(runtime.isEnabled(), false);
        runtime.toggle();
        assert.equal(runtime.isEnabled(), true);
        runtime.disable();
        assert.equal(runtime.isEnabled(), false);
    });
});

test('select and enable resolve targets by id, alias, and css selector', () => {
    withRuntime(({ runtime, document }) => {
        createChart(document, 'chart-bars', 'babia-bars', { x: 1, y: 2, z: 3 });
        createChart(document, 'chart-pie', 'babia-pie', { x: 4, y: 5, z: 6 });

        assert.equal(runtime.select('chart-bars'), true);
        assert.equal(runtime.getActiveChartId(), 'chart-bars');

        runtime.enable('pie');
        assert.equal(runtime.getActiveChartId(), 'chart-pie');

        assert.equal(runtime.select('[babia-bars]'), true);
        assert.equal(runtime.getActiveChartId(), 'chart-bars');
    });
});

test('select returns false and enable keeps runtime active when target is missing', () => {
    withRuntime(({ runtime }) => {
        assert.equal(runtime.select('missing-chart'), false);
        runtime.enable('missing-chart');
        assert.equal(runtime.isEnabled(), true);
        assert.equal(runtime.getActiveChartId(), null);
    });
});

test('listCharts returns detected charts and logs a summary', () => {
    withRuntime(({ runtime, document, logs }) => {
        createChart(document, 'chart-bars', 'babia-bars', { x: 0, y: 0, z: 0 });
        createChart(document, 'chart-boats', 'babia-boats', { x: 0, y: 0, z: 0 });

        const charts = runtime.listCharts();

        assert.equal(charts.length, 2);
        assert.equal(charts[0].id, 'chart-bars');
        assert.equal(charts[1].id, 'chart-boats');
        assert.ok(logs.some((line) => line.includes('Available charts (2)')));
    });
});

test('getActiveChart and getActiveChartPosition return active chart state', () => {
    withRuntime(({ runtime, document }) => {
        const chart = createChart(document, 'chart-bars', 'babia-bars', { x: 1.25, y: 2.5, z: -3.75 });
        runtime.select('chart-bars');

        assert.equal(runtime.getActiveChart(), chart);
        assert.deepEqual(runtime.getActiveChartPosition(), { x: 1.25, y: 2.5, z: -3.75 });
        assert.equal(runtime.getActiveChartId(), 'chart-bars');
    });
});

test('setStep updates signed per-axis steps and validates axis usage', () => {
    withRuntime(({ runtime }) => {
        assert.equal(runtime.setStep('x', 0.5), 0.5);
        assert.equal(runtime.setStep('y', -0.75), -0.75);
        assert.equal(runtime.setStep('z'), 0.25);
        assert.equal(runtime.setStep('bad-axis', 1), null);
        assert.equal(runtime.setStep('x', 'oops'), 0.5);
        assert.deepEqual(runtime.getState().step, { x: 0.5, y: -0.75, z: 0.25 });
    });
});

test('getState, restoreState, deactivate and teardown preserve and reset state as expected', () => {
    withRuntime(({ runtime, document }) => {
        createChart(document, 'chart-bars', 'babia-bars', { x: 2, y: 3, z: 4 });

        runtime.enable();
        runtime.setStep('x', 0.75);
        runtime.setStep('y', -0.5);
        runtime.select('chart-bars');
        const snapshot = runtime.getState();

        assert.deepEqual(snapshot, {
            enabled: true,
            step: { x: 0.75, y: -0.5, z: 0.25 },
            activeChartId: 'chart-bars',
            debugActive: true,
        });

        runtime.deactivate();
        assert.equal(runtime.getActiveChartId(), null);
        assert.equal(runtime.getState().debugActive, false);

        runtime.restoreState(snapshot);
        assert.equal(runtime.getActiveChartId(), 'chart-bars');
        assert.deepEqual(runtime.getState().step, { x: 0.75, y: -0.5, z: 0.25 });

        assert.ok((document.listeners.pointerdown || []).length > 0);
        assert.ok((document.listeners.contextmenu || []).length > 0);
        runtime.teardown();
        assert.equal(runtime.isEnabled(), false);
        assert.equal((document.listeners.pointerdown || []).length, 0);
        assert.equal((document.listeners.contextmenu || []).length, 0);
    });
});

test('commands returns command descriptions and help logs usage guidance', () => {
    withRuntime(({ runtime, logs }) => {
        const commandList = runtime.commands();
        const logCountBeforeHelp = logs.length;

        assert.ok(Array.isArray(commandList));
        assert.ok(commandList.some((entry) => entry.includes('enable(target?)')));
        assert.ok(commandList.some((entry) => entry.includes('listCharts()')));
        assert.ok(commandList.some((entry) => entry.includes('actualScale()')));
        assert.ok(commandList.some((entry) => entry.includes('actualDimensions()')));
        assert.ok(commandList.some((entry) => entry.includes('actualWidth()')));
        assert.ok(commandList.some((entry) => entry.includes('actualHeight()')));
        assert.ok(commandList.some((entry) => entry.includes('actualDepth()')));
        assert.ok(commandList.some((entry) => entry.includes('scale(x, y, z)')));
        assert.ok(commandList.some((entry) => entry.includes('setPosition(x, y, z)')));
        assert.ok(commandList.some((entry) => entry.includes('setFlight(enabled)')));
        assert.ok(commandList.some((entry) => entry.includes('toggleFlight()')));
        assert.ok(commandList.some((entry) => entry.includes('getUserPosition()')));

        runtime.help();
        assert.ok(logs.some((line) => line.includes('Available API commands')));
        assert.ok(logs.slice(logCountBeforeHelp).some((line) => line.includes('Target formats accepted by enable(target)')));
        assert.ok(logs.slice(logCountBeforeHelp).some((line) => line.includes('CodeXRChartDebug.listCharts()')));
        assert.ok(logs.slice(logCountBeforeHelp).some((line) => line.includes('Right click red/green/blue arrows')));
    });
});

test('left and right pointer clicks on gizmo children move the active chart with signed axis steps', () => {
    withRuntime(({ runtime, document }) => {
        const chart = createChart(document, 'chart-bars', 'babia-bars', { x: 1, y: 2, z: 3 });
        runtime.enable('chart-bars');
        runtime.setStep('x', 0.5);

        const gizmo = document.getElementById('codexrChartDebugGizmo');
        assert.ok(gizmo);

        const xArrow = gizmo.children[1];
        const shaft = xArrow.children[0];
        const tip = xArrow.children[1];

        dispatchPointerOnTarget(document, shaft, 0);
        assert.deepEqual(runtime.getActiveChartPosition(), { x: 1.5, y: 2, z: 3 });

        dispatchPointerOnTarget(document, tip, 2);
        assert.deepEqual(runtime.getActiveChartPosition(), { x: 1, y: 2, z: 3 });

        assert.equal(chart.getAttribute('position'), '1 2 3');
    });
});

test('actualScale and scale read and update the active chart scale', () => {
    withRuntime(({ runtime, document, logs }) => {
        const chart = createChart(document, 'chart-bars', 'babia-bars', { x: 0, y: 0, z: 0 });
        runtime.enable('chart-bars');

        assert.deepEqual(runtime.actualScale(), { x: 1, y: 1, z: 1 });
        assert.deepEqual(runtime.scale(2, 0.5, -1), { x: 2, y: 0.5, z: -1 });
        assert.deepEqual(runtime.actualScale(), { x: 2, y: 0.5, z: -1 });
        assert.equal(chart.getAttribute('scale'), '2 0.5 -1');
        assert.ok(logs.some((line) => line.includes('Current chart scale')));
        assert.ok(logs.some((line) => line.includes('Updated chart scale')));
    });
});

test('actualDimensions and per-axis dimension commands report chart size', () => {
    withRuntime(({ runtime, document, logs }) => {
        createChart(document, 'chart-bars', 'babia-bars', { x: 0, y: 0, z: 0 }, { width: 6, height: 2, depth: 5 });
        runtime.enable('chart-bars');

        assert.deepEqual(runtime.actualDimensions(), { width: 6, height: 2, depth: 5 });
        assert.equal(runtime.actualWidth(), 6);
        assert.equal(runtime.actualHeight(), 2);
        assert.equal(runtime.actualDepth(), 5);

        runtime.scale(0.5, 2, 1.5);
        assert.deepEqual(runtime.actualDimensions(), { width: 3, height: 4, depth: 7.5 });
        assert.equal(runtime.actualWidth(), 3);
        assert.equal(runtime.actualHeight(), 4);
        assert.equal(runtime.actualDepth(), 7.5);
        assert.ok(logs.some((line) => line.includes('Current chart dimensions')));
    });
});

test('setPosition updates active chart world position quickly', () => {
    withRuntime(({ runtime, document, logs }) => {
        const chart = createChart(document, 'chart-bars', 'babia-bars', { x: 0, y: 0, z: 0 });
        runtime.enable('chart-bars');

        assert.deepEqual(runtime.setPosition(4, -1.5, 2.25), { x: 4, y: -1.5, z: 2.25 });
        assert.deepEqual(runtime.getActiveChartPosition(), { x: 4, y: -1.5, z: 2.25 });
        assert.equal(chart.getAttribute('position'), '4 -1.5 2.25');
        assert.ok(logs.some((line) => line.includes('Updated chart position')));
    });
});
