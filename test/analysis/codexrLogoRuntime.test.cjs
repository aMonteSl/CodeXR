const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..', '..');
const { readAssembledRuntime } = require(path.join(projectRoot, 'test', 'helpers', 'runtimeAssembly.cjs'));
const runtimeSource = readAssembledRuntime('logo', 'codexrLogoRuntime.js');

// Minimal three.js surface the component touches. The stubs record what they
// were given so the geometry contract can be asserted without a GPU.
function createThreeStub() {
    class Path {
        constructor() { this.commands = []; this.holes = []; }
        moveTo(x, y) { this.commands.push(['moveTo', x, y]); }
        lineTo(x, y) { this.commands.push(['lineTo', x, y]); }
        closePath() { this.commands.push(['closePath']); }
    }
    class ExtrudeGeometry {
        constructor(shape, options) {
            this.shape = shape;
            this.options = options;
            this.translated = null;
            this.disposed = false;
        }
        translate(x, y, z) { this.translated = [x, y, z]; }
        dispose() { this.disposed = true; }
    }
    class MeshStandardMaterial {
        constructor(params) { Object.assign(this, params); this.disposed = false; }
        dispose() { this.disposed = true; }
    }
    class Mesh {
        constructor(geometry, material) { this.geometry = geometry; this.material = material; }
    }
    return { Shape: Path, Path, ExtrudeGeometry, MeshStandardMaterial, Mesh };
}

function createVector() {
    const vector = {
        x: 0,
        y: 0,
        z: 0,
        set(x, y, z) { vector.x = x; vector.y = y; vector.z = z; return vector; },
    };
    return vector;
}

function createEntity(id) {
    const attributes = {};
    const listeners = {};
    return {
        id: id || '',
        hasLoaded: true,
        object3D: { position: createVector(), rotation: createVector(), scale: createVector() },
        children: [],
        parentNode: null,
        objects: {},
        attributes,
        listeners,
        setAttribute(name, value) { attributes[name] = value; },
        getAttribute(name) { return Object.prototype.hasOwnProperty.call(attributes, name) ? attributes[name] : null; },
        removeAttribute(name) { delete attributes[name]; },
        setObject3D(key, object) { this.objects[key] = object; },
        removeObject3D(key) { delete this.objects[key]; },
        appendChild(child) { this.children.push(child); child.parentNode = this; return child; },
        removeChild(child) {
            this.children = this.children.filter((candidate) => candidate !== child);
            return child;
        },
        addEventListener(type, handler) { (listeners[type] = listeners[type] || []).push(handler); },
        removeEventListener(type, handler) {
            listeners[type] = (listeners[type] || []).filter((candidate) => candidate !== handler);
        },
        emit(type, detail) { (listeners[type] || []).forEach((handler) => handler({ detail })); },
    };
}

function loadRuntime(options) {
    const settings = options || {};
    const timers = new Map();
    let nextTimer = 1;
    const budgetSubscribers = [];
    let budgetUnsubscribed = false;

    const tableEl = createEntity('codexrAnalysisTable');
    tableEl.setAttribute('codexr-analysis-table', { mode: settings.initialMode || 'single' });
    const logoEl = createEntity('codexrBrandLogo');
    logoEl.sceneEl = { hasLoaded: true, addEventListener() {} };

    const context = {
        console: { log() {}, warn() {}, error() {} },
        setTimeout(fn, delay) { const id = nextTimer; nextTimer += 1; timers.set(id, { fn, delay }); return id; },
        clearTimeout(id) { timers.delete(id); },
        document: {
            createElement: () => createEntity(),
            querySelector(selector) { return selector === '#codexrAnalysisTable' ? tableEl : null; },
        },
        AFRAME: {
            components: {},
            THREE: createThreeStub(),
            registerComponent(name, definition) { this.components[name] = definition; },
        },
        CodeXRRenderBudgetRuntime: {
            subscribe(subscriber) {
                budgetSubscribers.push(subscriber);
                subscriber({ quality: 'full' });
                return function () { budgetUnsubscribed = true; };
            },
        },
    };
    context.window = context;
    context.globalThis = context;
    vm.runInNewContext(runtimeSource, context, { filename: 'codexrLogoRuntime.js' });

    const definition = context.AFRAME.components['codexr-logo'];
    const data = Object.assign(
        Object.fromEntries(Object.entries(definition.schema).map(([key, value]) => [key, value.default])),
        settings.data || {},
    );
    const component = Object.assign(Object.create(definition), { el: logoEl, data });

    return {
        context,
        definition,
        component,
        logoEl,
        tableEl,
        timers,
        publishBudget(snapshot) { budgetSubscribers.forEach((subscriber) => subscriber(snapshot)); },
        wasBudgetUnsubscribed() { return budgetUnsubscribed; },
        runTimers() {
            [...timers.entries()].forEach(([id, entry]) => { timers.delete(id); entry.fn(); });
        },
    };
}

test('logo contours describe the three brand pieces, normalized and closed', () => {
    const { context } = loadRuntime();
    const { LOGO_CONTOURS, LOGO_PIECE_ORDER } = context.CodeXRLogoRuntime.__testing;

    // Spread it into this realm: the runtime runs in its own vm context, so a
    // strict deep-equal against a foreign Array prototype would fail.
    assert.deepEqual([...LOGO_PIECE_ORDER], ['frame', 'x', 'r']);
    assert.deepEqual(Object.keys(LOGO_CONTOURS).sort(), ['frame', 'r', 'x']);

    // The counters are what make the mark readable: the visor window and the
    // strap tab in the frame, the bowl of the R. The X has none.
    assert.equal(LOGO_CONTOURS.frame.holes.length, 2);
    assert.equal(LOGO_CONTOURS.r.holes.length, 1);
    assert.equal(LOGO_CONTOURS.x.holes.length, 0);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const piece of Object.values(LOGO_CONTOURS)) {
        for (const contour of [piece.outline, ...piece.holes]) {
            // Flat [x0, y0, x1, y1, ...] lists, implicitly closed.
            assert.equal(contour.length % 2, 0, 'contours hold coordinate pairs');
            assert.ok(contour.length >= 6, 'a contour needs at least three points');
            for (let i = 0; i < contour.length; i += 2) {
                assert.ok(Number.isFinite(contour[i]) && Number.isFinite(contour[i + 1]));
                minX = Math.min(minX, contour[i]);
                maxX = Math.max(maxX, contour[i]);
                minY = Math.min(minY, contour[i + 1]);
                maxY = Math.max(maxY, contour[i + 1]);
            }
        }
    }
    // Normalized to width 1 and centred on the origin, so the component can
    // scale the whole mark with a single `width` factor.
    assert.equal(Number((maxX - minX).toFixed(3)), 1);
    assert.ok(Math.abs(minX + maxX) < 0.002, 'the mark is centred horizontally');
    assert.ok(Math.abs(minY + maxY) < 0.002, 'the mark is centred vertically');
    assert.ok((maxY - minY) > 0.5 && (maxY - minY) < 0.7, 'the mark keeps its landscape aspect');
});

test('the component extrudes one mesh per piece, with holes and a two-material split', () => {
    const { component, logoEl } = loadRuntime();
    component.init();

    assert.equal(component.pieces.length, 3);
    assert.equal(logoEl.children.length, 3);

    const frame = component.getPiece('frame');
    assert.ok(frame.mesh.geometry.shape.holes.length === 2, 'the frame keeps its two counters');
    // Caps and walls take different materials: graphite body, cyan edge.
    assert.equal(Array.isArray(frame.mesh.material), true);
    assert.equal(frame.mesh.material.length, 2);
    assert.equal(frame.mesh.material[0].color, component.data.bodyColor);
    assert.equal(frame.mesh.material[1].emissive, component.data.accentColor);
    // The extrusion is recentred so the mark's plane sits on the entity origin.
    assert.equal(frame.mesh.geometry.translated[2], -component.data.thickness / 2);

    // Contours are scaled by `width` as they are traced, so the extrusion
    // bevel stays in metres.
    const firstMove = frame.mesh.geometry.shape.commands[0];
    assert.equal(firstMove[0], 'moveTo');
    assert.ok(Math.abs(firstMove[1]) <= component.data.width / 2 + 0.001);

    assert.equal(logoEl.getAttribute('visible'), false, 'the logo starts hidden');
    assert.deepEqual(
        [logoEl.object3D.position.x, logoEl.object3D.position.y, logoEl.object3D.position.z],
        [component.data.anchorX, component.data.anchorY, component.data.anchorZ],
    );
});

test('the logo follows the table into and out of the empty selection state', () => {
    const { component, logoEl, tableEl, runTimers } = loadRuntime();
    component.init();
    assert.equal(component.active, false);

    // The table runtime writes its mode on a real change; A-Frame turns that
    // into componentchanged, which is the only trigger this component needs.
    tableEl.setAttribute('codexr-analysis-table', { mode: 'selection' });
    tableEl.emit('componentchanged', { name: 'codexr-analysis-table' });
    assert.equal(component.active, true);
    assert.equal(logoEl.getAttribute('visible'), true);
    assert.match(
        String(component.getPiece('frame').el.getAttribute('animation__codexr_logo_frame').property),
        /scale/,
    );
    assert.equal(component.getPiece('x').el.getAttribute('animation__codexr_logo_x').to, '0 0 0');

    // An unrelated component changing on the table must not touch the logo.
    tableEl.emit('componentchanged', { name: 'position' });
    assert.equal(component.active, true);

    tableEl.setAttribute('codexr-analysis-table', { mode: 'single' });
    tableEl.emit('componentchanged', { name: 'codexr-analysis-table' });
    assert.equal(component.active, false);
    runTimers();
    assert.equal(logoEl.getAttribute('visible'), false);
    // Nothing is left flung apart or mid-animation once it is hidden.
    assert.equal(component.getPiece('x').el.object3D.position.x, 0);
    assert.equal(component.getPiece('frame').el.getAttribute('animation__codexr_logo_frame'), null);
});

test('a scene that boots straight into selection shows the logo without animating it in', () => {
    const { component, logoEl } = loadRuntime({ initialMode: 'selection' });
    component.init();

    assert.equal(component.active, true);
    assert.equal(logoEl.getAttribute('visible'), true);
    assert.equal(component.getPiece('frame').el.getAttribute('animation__codexr_logo_frame'), null);
});

test('idle motion is time-based and stops dead when the render budget says static', () => {
    const { component, logoEl, tableEl, publishBudget } = loadRuntime({ initialMode: 'selection' });
    component.init();

    component.tick(0, 16);
    const afterOneFrame = logoEl.object3D.rotation.y;
    assert.ok(
        Math.abs(afterOneFrame - (component.data.spinSpeed * 0.016)) < 0.000001,
        'the spin advances with the frame delta, not per frame',
    );
    // A tab that was backgrounded resumes with a huge delta; the clamp is what
    // stops the mark from teleporting a full turn on the first frame back.
    component.tick(0, 100000);
    assert.ok((logoEl.object3D.rotation.y - afterOneFrame) <= (component.data.spinSpeed * 0.05) + 0.000001);
    assert.notEqual(logoEl.object3D.position.y, component.data.anchorY, 'it floats around the anchor');
    assert.ok(
        Math.abs(logoEl.object3D.position.y - component.data.anchorY) <= component.data.floatAmplitude,
        'the float stays inside its declared amplitude',
    );

    // 'static' is both the low-frame-rate verdict and how the render budget
    // reports prefers-reduced-motion.
    publishBudget({ quality: 'static' });
    assert.equal(component.motionEnabled, false);
    assert.equal(logoEl.object3D.rotation.y, 0, 'the spin is reset, not left mid-turn');
    const restingY = logoEl.object3D.position.y;
    component.tick(0, 1000);
    assert.equal(logoEl.object3D.rotation.y, 0);
    assert.equal(logoEl.object3D.position.y, restingY);

    // And a switch while static lands in place instead of animating.
    tableEl.setAttribute('codexr-analysis-table', { mode: 'single' });
    tableEl.emit('componentchanged', { name: 'codexr-analysis-table' });
    assert.equal(logoEl.getAttribute('visible'), false);
});

test('remove() releases the table listener, the budget subscription and the meshes', () => {
    const { component, tableEl, wasBudgetUnsubscribed, logoEl } = loadRuntime({ initialMode: 'selection' });
    component.init();
    const meshes = component.pieces.map((piece) => piece.mesh);

    component.remove();

    assert.equal(wasBudgetUnsubscribed(), true);
    assert.equal((tableEl.listeners.componentchanged || []).length, 0);
    assert.equal(component.pieces.length, 0);
    assert.equal(logoEl.children.length, 0);
    meshes.forEach((mesh) => {
        assert.equal(mesh.geometry.disposed, true);
        mesh.material.forEach((material) => assert.equal(material.disposed, true));
    });
});

test('the logo is decoration: it never joins the raycaster or the analysis surface', () => {
    const sceneTemplate = require('node:fs').readFileSync(
        path.join(projectRoot, 'templates', 'xr', 'file', 'xr-visualization.html'),
        'utf8',
    );
    const entity = /<a-entity\s+id="codexrBrandLogo"[\s\S]*?<\/a-entity>/.exec(sceneTemplate);
    assert.ok(entity, 'the scene declares the brand logo entity');
    // A raycaster class here would let the mark swallow clicks meant for the
    // table; living inside the analysis surface would hand it to the
    // selection sweep that empties the table.
    assert.doesNotMatch(entity[0], /babiaxraycasterclass|data-codexr-interactive/);
    assert.ok(
        sceneTemplate.indexOf('id="codexrBrandLogo"') < sceneTemplate.indexOf('id="codexrAnalysisSurface"'),
        'the logo is a sibling of the table, not a child of the analysis surface',
    );
    assert.match(sceneTemplate, /src="\.\/codexrLogoRuntime\.js\?v=\$\{nonce\}"/);
});
