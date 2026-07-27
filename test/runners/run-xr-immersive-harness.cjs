const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { buildAssembledRuntimes } = require('../manual/buildAssembledRuntimes.cjs');

const projectRoot = path.resolve(__dirname, '..', '..');
const harnessPath = path.join(projectRoot, 'test', 'manual', 'xr-immersive-harness.html');
buildAssembledRuntimes();

// ---------------------------------------------------------------------------
// Static contract: the REAL templates carry the immersive semantics the
// harness exercises. If a template edit moves hide-on-enter-ar, drops a
// pointer, or loses the rig adapter, this fails before any browser starts.
// ---------------------------------------------------------------------------

const fileTemplate = fs.readFileSync(
    path.join(projectRoot, 'templates', 'xr', 'file', 'xr-visualization.html'),
    'utf8',
);
const domTemplate = fs.readFileSync(
    path.join(projectRoot, 'templates', 'xr', 'html', 'dom-visualization-template.html'),
    'utf8',
);

function entityTag(html, idAttr) {
    const match = html.match(new RegExp(`<a-entity[^>]*id="${idAttr}"[^>]*>`));
    assert.ok(match, `template must declare an a-entity with id="${idAttr}"`);
    return match[0];
}

// AR hides exactly the environment and the room — nothing else.
assert.match(entityTag(fileTemplate, 'env'), /hide-on-enter-ar/);
assert.match(entityTag(fileTemplate, 'codexrRoom'), /hide-on-enter-ar/);
assert.equal(
    (fileTemplate.match(/hide-on-enter-ar/g) || []).length,
    2,
    'file template: hide-on-enter-ar must appear exactly twice (env + room); '
    + 'the pedestal, charts, panel, screens and rig stay visible in AR',
);
assert.equal(
    (domTemplate.match(/hide-on-enter-ar/g) || []).length,
    1,
    'DOM template: hide-on-enter-ar must appear exactly once (environment)',
);

// Both immersive modes are offered.
assert.match(fileTemplate, /xr-mode-ui="enabled: true; XRMode: xr"/);
assert.match(domTemplate, /xr-mode-ui="enabled: true; XRMode: xr"/);

// Pointer contract: policy on the scene, the three pointers, both lasers.
for (const [name, html] of [['file', fileTemplate], ['dom', domTemplate]]) {
    assert.match(html, /codexr-pointer-policy/, `${name}: pointer policy on the scene`);
    assert.match(html, /id="mouseCursor"/, `${name}: mouse cursor`);
    assert.match(html, /id="gazeCursor"/, `${name}: gaze cursor`);
    assert.match(html, /id="leftController"[\s\S]*?laser-controls="hand: left"/, `${name}: left laser`);
    assert.match(html, /id="rightController"[\s\S]*?laser-controls="hand: right"/, `${name}: right laser`);
    assert.match(html, /movement-controls/, `${name}: rig locomotion`);
    assert.match(html, /codexrImmersiveRigRuntime\.js/, `${name}: immersive-rig runtime loaded`);
}

// Rig adapter: AR recenter in the analysis scene, none in DOM.
assert.match(fileTemplate, /codexr-immersive-rig="arPosition: 0\.07 0 -14\.7"/);
assert.match(domTemplate, /codexr-immersive-rig="arRecenter: false"/);

// THE height contract. The rig stands on the floor and the eye offset lives on
// the camera entity, because look-controls zeroes the camera (not the rig) when
// a real headset session starts — see components/look-controls.js onEnterVR.
// Put the offset on the rig and the user either floats (offset + local-floor
// pose) or, once something drops the rig to the floor to compensate, ends up
// with their eyes at ground level. Both were shipped bugs.
assert.match(fileTemplate, /id="rig"[^>]*position="0\.07 0 -10\.75"/,
    'analysis rig must sit at floor level (y = 0)');
assert.match(fileTemplate, /id="head" camera position="0 1\.75 0"/,
    'analysis eye height must live on the camera entity');
assert.match(domTemplate, /id="cameraRig"[^>]*position="0 0 3"/,
    'DOM rig must sit at floor level (y = 0)');
assert.match(domTemplate, /id="head" camera position="0 1\.6 0"/,
    'DOM eye height must live on the camera entity');

// Nothing may reposition the rig back to eye height behind our backs.
const viewLifecycle = fs.readFileSync(
    path.join(projectRoot, 'templates', 'components', 'codexr', 'dependency-graph',
        'dependencyGraphRuntime', 'viewLifecycle.js'),
    'utf8',
);
assert.match(viewLifecycle, /setAttribute\?\.\('position', '0\.07 0 -10\.75'\)/,
    'dependency-graph resetView must return the rig to floor level, not eye height');

// The mapping panel never opts into hiding on AR.
const templateProcessor = fs.readFileSync(
    path.join(projectRoot, 'src', 'babia_templates', 'processing', 'templateProcessor.ts'),
    'utf8',
);
assert.match(templateProcessor, /hideOnEnterAr: false/);

console.log('[xr-immersive-harness] static template contract passed.');

// ---------------------------------------------------------------------------
// Behavioral scenarios against real A-Frame 1.7.1 in Chromium.
// ---------------------------------------------------------------------------

async function runPlaywrightIfAvailable() {
    let chromium;
    try {
        ({ chromium } = require('playwright'));
    } catch {
        console.log('[xr-immersive-harness] Playwright is not installed; static validation passed.');
        return;
    }

    const browser = await chromium.launch();
    try {
        await runScenario(browser);
    } finally {
        await browser.close();
    }
    console.log('[xr-immersive-harness] AR/VR semantics validation passed.');
}

async function runScenario(browser) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', (error) => console.error('[page error]', error));
    await page.goto(pathToFileURL(harnessPath).toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#scene', { timeout: 15000 });
    await page.evaluate(() => new Promise((resolve) => {
        const scene = document.getElementById('scene');
        if (scene.hasLoaded) { resolve(); return; }
        scene.addEventListener('loaded', () => resolve(), { once: true });
    }));

    const snap = () => page.evaluate(() => window.CodeXRImmersiveHarness.snapshot());
    const run = (expression) => page.evaluate((code) => {
        // eslint-disable-next-line no-eval
        return eval(code);
    }, expression);

    // Pointer-policy applies on a deferred timer; give the queue a beat.
    const settle = () => page.waitForTimeout(80);

    // Every mode is checked against what the USER sees: how high the eye
    // actually is and whether it clears the tabletop. Asserting the rig's own
    // y instead is what let a shipped build put the eye on the floor with the
    // pedestal overhead while this harness stayed green.
    const EYE = 1.75;
    function assertStanding(state, label, expectedEye = EYE) {
        const g = state.geometry;
        assert.ok(
            Math.abs(g.eyeWorldY - expectedEye) < 0.02,
            `${label}: eye must be ${expectedEye} m above the floor, was ${g.eyeWorldY}`,
        );
        assert.equal(g.rigWorldY, 0, `${label}: the rig is the floor`);
        assert.equal(g.eyeAboveTable, true,
            `${label}: eye (${g.eyeWorldY}) must clear the tabletop (${g.tableTopY})`);
    }

    // --- Desktop baseline -------------------------------------------------
    let state = await snap();
    assert.equal(state.hidden.env, false, 'desktop: environment visible');
    assert.equal(state.hidden.room, false, 'desktop: room visible');
    assert.equal(state.pointers.mouse.enabled, true, 'desktop: mouse is the pointer');
    assert.equal(state.pointers.gaze.enabled, false, 'desktop: gaze off');
    assert.equal(state.movement.attached, true, 'movement-controls attached to the rig');
    assert.equal(state.movement.gamepadRegistered, true, 'aframe-extras gamepad-controls registered');
    assert.equal(state.movement.keyboardRegistered, true, 'aframe-extras keyboard-controls registered');
    assertStanding(state, 'desktop');
    const desktopPose = state.rig;

    // --- Desktop movement smoke (keyboard path of movement-controls) ------
    await page.keyboard.down('w');
    await page.waitForTimeout(600);
    await page.keyboard.up('w');
    state = await snap();
    assert.ok(
        state.rig.z < desktopPose.z - 0.05,
        `desktop: W must move the rig forward (z ${desktopPose.z} -> ${state.rig.z})`,
    );
    // Return the rig to the template pose so later assertions stay exact.
    await run('document.getElementById("rig").object3D.position.set(0.07, 0, -10.75)');

    // --- AR: hide set, kept set, recenter, laser, click -------------------
    await run('CodeXRImmersiveHarness.enterAR()');
    await settle();
    state = await snap();
    assert.equal(state.states.ar, true, 'AR state active');
    assert.equal(state.hidden.env, true, 'AR: environment hidden');
    assert.equal(state.hidden.room, true, 'AR: room hidden');
    for (const [name, value] of Object.entries(state.kept)) {
        assert.equal(value, true, `AR: ${name} must stay visible`);
    }
    assert.deepEqual(
        { x: state.rig.x, y: state.rig.y, z: state.rig.z, yaw: state.rig.yaw },
        { x: 0.07, y: 0, z: -14.7, yaw: 0 },
        'AR: rig recentered in front of the pedestal, on the floor',
    );
    // The bug the user hit: recentered correctly, but standing under the table.
    assertStanding(state, 'AR');
    assert.ok(
        Math.abs(state.geometry.horizontalToTable - 3.3) < 0.2,
        `AR: should stand ~3.3 m from the table centre, was ${state.geometry.horizontalToTable}`,
    );

    await run('CodeXRImmersiveHarness.connect("right")');
    await settle();
    state = await snap();
    assert.equal(state.pointers.right.enabled, true, 'AR + controller: right laser active');
    assert.equal(state.pointers.right.objects, '.babiaxraycasterclass', 'AR: laser stays filtered to babia targets');
    assert.equal(state.pointers.mouse.enabled, false, 'AR + controller: mouse off');
    assert.equal(state.pointers.gaze.enabled, false, 'AR + controller: gaze off');

    await run('CodeXRImmersiveHarness.click("panelStandIn")');
    await run('CodeXRImmersiveHarness.click("chartStandIn")');
    state = await snap();
    assert.equal(state.clicks.panelStandIn, 1, 'AR: panel receives clicks');
    assert.equal(state.clicks.chartStandIn, 1, 'AR: chart receives clicks');

    // --- Exit AR: everything restored -------------------------------------
    await run('CodeXRImmersiveHarness.disconnect("right")');
    await run('CodeXRImmersiveHarness.exit()');
    await settle();
    state = await snap();
    assert.equal(state.hidden.env, false, 'after AR: environment restored');
    assert.equal(state.hidden.room, false, 'after AR: room restored');
    assert.deepEqual(
        { x: state.rig.x, y: state.rig.y, z: state.rig.z },
        { x: 0.07, y: 0, z: -10.75 },
        'after AR: rig back at the desktop pose',
    );
    assertStanding(state, 'after AR');
    assert.equal(state.pointers.mouse.enabled, true, 'after AR: mouse pointer back');

    // --- VR: nothing hidden, gaze -> laser -> gaze -> mouse ---------------
    await run('CodeXRImmersiveHarness.enterVR()');
    await settle();
    state = await snap();
    assert.equal(state.states.vr, true, 'VR state active');
    assert.equal(state.hidden.env, false, 'VR: environment stays visible');
    assert.equal(state.hidden.room, false, 'VR: room stays visible');
    for (const [name, value] of Object.entries(state.kept)) {
        assert.equal(value, true, `VR: ${name} visible`);
    }
    assert.equal(state.rig.z, -10.75, 'VR: no recenter, the room is the point');
    assertStanding(state, 'VR');
    assert.equal(state.pointers.gaze.enabled, true, 'VR without controllers: gaze pointer');
    assert.equal(state.pointers.gaze.visible, true, 'VR: gaze reticle shown');
    assert.equal(state.pointers.mouse.enabled, false, 'VR: mouse off');

    await run('CodeXRImmersiveHarness.connect("left")');
    await settle();
    state = await snap();
    assert.equal(state.pointers.left.enabled, true, 'VR: lone left controller becomes the laser');
    assert.equal(state.pointers.left.objects, '.babiaxraycasterclass', 'VR: left laser filtered');
    assert.equal(state.pointers.gaze.enabled, false, 'VR + controller: gaze off');

    await run('CodeXRImmersiveHarness.connect("right")');
    await settle();
    state = await snap();
    assert.equal(state.pointers.right.enabled, true, 'VR: right controller takes preference');
    assert.equal(state.pointers.left.enabled, false, 'VR: left demoted with both connected');
    assert.equal(state.pointers.left.hasCursor, false, 'VR: demoted laser loses its cursor');

    await run('CodeXRImmersiveHarness.disconnect("right")');
    await run('CodeXRImmersiveHarness.disconnect("left")');
    await settle();
    state = await snap();
    assert.equal(state.pointers.gaze.enabled, true, 'VR: gaze returns when controllers drop');

    await run('CodeXRImmersiveHarness.exit()');
    await settle();
    state = await snap();
    assert.equal(state.pointers.mouse.enabled, true, 'after VR: mouse pointer back');
    assertStanding(state, 'after VR');

    // --- The real-headset path --------------------------------------------
    // Everything above runs the no-headset path, where look-controls leaves
    // the camera alone. With a headset it takes a different route: it zeroes
    // the camera's local position so the local-floor pose (which already
    // carries the user's real height) replaces the desktop offset. Both paths
    // must leave the user standing, which is exactly why the eye height lives
    // on the camera and not on the rig.
    await run('CodeXRImmersiveHarness.setHeadsetConnected(true)');
    await run('CodeXRImmersiveHarness.enterVR()');
    await settle();
    state = await snap();
    assert.ok(
        Math.abs(state.geometry.eyeWorldY) < 0.01,
        `headset VR: look-controls must zero the camera offset, eye was ${state.geometry.eyeWorldY}`,
    );

    // three.js then writes the XR viewer pose into that same camera entity.
    await run('CodeXRImmersiveHarness.fakeHeadsetPose(1.62)');
    state = await snap();
    assertStanding(state, 'headset VR (with pose)', 1.62);

    await run('CodeXRImmersiveHarness.exit()');
    await settle();
    state = await snap();
    assertStanding(state, 'after headset VR');
    await run('CodeXRImmersiveHarness.setHeadsetConnected(false)');
}

runPlaywrightIfAvailable().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
