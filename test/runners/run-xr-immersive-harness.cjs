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
// pointer, excludes gamepad from movement-controls, or loses the rig
// adapter, this fails before any browser starts.
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

    // VR/AR locomotion is entirely native aframe-extras (movement-controls +
    // its own gamepad-controls: left stick walks, right stick turns, both by
    // quaternion). No CodeXR locomotion component exists — a custom one with
    // hand-rolled vector math shipped once and was removed.
    assert.doesNotMatch(html, /codexr-xr-locomotion/, `${name}: no custom locomotion component`);
    assert.doesNotMatch(html, /codexrXrLocomotionRuntime/, `${name}: no custom locomotion runtime`);
    // The bug that silently killed it the first time: excluding 'gamepad'
    // from movement-controls' controls list. Never override that list.
    assert.doesNotMatch(html, /movement-controls="[^"]*controls:/,
        `${name}: movement-controls must keep its default controls list (includes gamepad)`);

    // THE controller contract. laser-controls owns each controller entirely:
    // it adds the per-device component itself AND supplies the raycaster's
    // origin/direction. Touch controllers are held at an angle to where they
    // point (A-Frame pivots their model ~40°), so a hand-written raycaster
    // with no direction fires the ray well above the visible aim — that was
    // the "the laser points upward" bug. Both hands must be declared alike.
    for (const side of ['left', 'right']) {
        const tag = html.match(new RegExp(`<a-entity id="${side}Controller"[^>]*>`));
        assert.ok(tag, `${name}: ${side} controller entity`);
        assert.doesNotMatch(tag[0], /raycaster=/,
            `${name}: ${side} controller must NOT hand-author a raycaster — laser-controls owns origin/direction`);
        assert.doesNotMatch(tag[0], /cursor=/,
            `${name}: ${side} controller must NOT hand-author a cursor — laser-controls owns it`);
        assert.doesNotMatch(tag[0], /(meta-touch|vive|windows-motion|generic-tracked-controller|valve-index|oculus-go|daydream|gearvr|magicleap|hp-mixed-reality|vive-focus)-controls=/,
            `${name}: ${side} controller must not re-declare what laser-controls already adds`);
    }
}

// Rig adapter: AR recenter (x/z only) in the analysis scene, none in DOM.
assert.match(fileTemplate, /codexr-immersive-rig="arX: 0\.07; arZ: -14\.7"/);
assert.match(domTemplate, /codexr-immersive-rig="arRecenter: false"/);

// THE height contract. Eye height lives on the RIG, permanently — never on
// the camera. WebXR only ever touches the CAMERA entity's local transform
// (look-controls zeroes it for a real headset session, restores it on exit);
// the rig is never moved vertically by anything CodeXR owns, so a height set
// here survives every enter-vr/exit-vr untouched, with or without a device.
// An offset parked on the camera instead depends on the device supplying a
// matching pose — inconsistent across emulators and real headsets, and the
// source of two rounds of "why am I on the floor" bugs before this settled.
assert.match(fileTemplate, /id="rig"[^>]*position="0\.07 1\.75 -10\.75"/,
    'analysis rig must carry eye height');
assert.match(fileTemplate, /id="head" camera position="0 0 0"/,
    'analysis camera must be at local origin');
assert.match(domTemplate, /id="cameraRig"[^>]*position="0 1\.6 3"/,
    'DOM rig must carry eye height');
assert.match(domTemplate, /id="head" camera position="0 0 0"/,
    'DOM camera must be at local origin');

// Nothing may reposition the rig back to floor level behind our backs.
const viewLifecycle = fs.readFileSync(
    path.join(projectRoot, 'templates', 'components', 'codexr', 'dependency-graph',
        'dependencyGraphRuntime', 'viewLifecycle.js'),
    'utf8',
);
assert.match(viewLifecycle, /setAttribute\?\.\('position', '0\.07 1\.75 -10\.75'\)/,
    'dependency-graph resetView must return the rig to the eye-height desktop pose');

// The mapping panel never opts into hiding on AR.
const templateProcessor = fs.readFileSync(
    path.join(projectRoot, 'src', 'babia_templates', 'processing', 'templateProcessor.ts'),
    'utf8',
);
assert.match(templateProcessor, /hideOnEnterAr: false/);

console.log('[xr-immersive-harness] static template contract passed.');

// ---------------------------------------------------------------------------
// Behavioral scenarios against real A-Frame 1.7.1 + aframe-extras 7.5.4 in
// Chromium — including the actual gamepad-controls locomotion code, fed
// through a fake tracked-controls system (see the harness page).
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
    const active = () => page.evaluate(() => window.CodeXRImmersiveHarness.activePointer());

    // Pointer-policy applies on a deferred timer; give the queue a beat.
    const settle = () => page.waitForTimeout(80);

    // Every mode is checked against what the USER sees: how high the eye
    // actually is and whether it clears the tabletop, not the raw rig.y a
    // shipped build could write incorrectly and still pass its own check.
    const EYE = 1.75;
    function assertStanding(state, label) {
        const g = state.geometry;
        assert.ok(
            Math.abs(g.eyeWorldY - EYE) < 0.02,
            `${label}: eye must be ${EYE} m above the floor, was ${g.eyeWorldY}`,
        );
        assert.equal(g.rigWorldY, EYE, `${label}: height lives on the rig`);
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
    assert.equal(state.movement.usingOurTrackedControlsSystem, true,
        'gamepad-controls must have picked up the fake tracked-controls system this harness seeds — '
        + 'if this is false, every stick-axis assertion below is meaningless');
    assert.equal(state.movement.fly, false, 'desktop: grounded');
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
    await run('document.getElementById("rig").object3D.position.set(0.07, 1.75, -10.75)');

    // --- AR: hide set, kept set, recenter (x/z only), fly, laser, click ---
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
        { x: state.rig.x, z: state.rig.z, yaw: state.rig.yaw },
        { x: 0.07, z: -14.7, yaw: 0 },
        'AR: rig recentered in front of the pedestal',
    );
    // The bug the user hit: recentered correctly, but standing under the table.
    assertStanding(state, 'AR');
    assert.equal(state.movement.fly, true, 'AR: flying turns on automatically');
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

    // --- Exit AR: everything restored, fly off again ----------------------
    await run('CodeXRImmersiveHarness.disconnect("right")');
    await run('CodeXRImmersiveHarness.exit()');
    await settle();
    state = await snap();
    assert.equal(state.hidden.env, false, 'after AR: environment restored');
    assert.equal(state.hidden.room, false, 'after AR: room restored');
    assert.deepEqual(
        { x: state.rig.x, z: state.rig.z },
        { x: 0.07, z: -10.75 },
        'after AR: rig back at the desktop pose',
    );
    assertStanding(state, 'after AR');
    assert.equal(state.movement.fly, false, 'after AR: grounded again on desktop');
    assert.equal(state.pointers.mouse.enabled, true, 'after AR: mouse pointer back');

    // --- VR: nothing hidden, flying on, gaze -> laser -> gaze -> mouse ----
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
    assert.equal(state.movement.fly, true, 'VR: flying turns on automatically');
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

    // --- Pointer handover by trigger: both hands equal, unrelated to
    //     locomotion (driven by the raw controller DOM event, not axes). ---
    await run('CodeXRImmersiveHarness.connect("left")');
    await run('CodeXRImmersiveHarness.connect("right")');
    await settle();
    await run('CodeXRImmersiveHarness.trigger("left")');
    await settle();
    assert.equal(await active(), 'left', 'using the left controller hands it the pointer');
    await run('CodeXRImmersiveHarness.trigger("right")');
    await settle();
    assert.equal(await active(), 'right', 'and back — neither hand is privileged');

    const clicksBefore = (await snap()).clicks.panelStandIn;
    await run('CodeXRImmersiveHarness.click("panelStandIn")');
    state = await snap();
    assert.equal(state.clicks.panelStandIn, clicksBefore + 1, 'clicks land after a handover');

    // --- Native VR/AR locomotion: aframe-extras' real gamepad-controls,
    //     fed through the fake tracked-controls system. Left stick walks,
    //     right stick turns — a fixed scheme the library itself enforces,
    //     not something CodeXR configures. ------------------------------
    await run('CodeXRImmersiveHarness.clearStickAxes()');

    let before = (await snap()).rig;
    await run('CodeXRImmersiveHarness.setStickAxes("left", 0, -1)'); // push forward
    await page.waitForTimeout(300);
    await run('CodeXRImmersiveHarness.setStickAxes("left", 0, 0)');
    let after = (await snap()).rig;
    assert.ok(
        before.z - after.z > 0.3,
        `left stick must walk the rig forward (z ${before.z} -> ${after.z})`,
    );

    // Right stick does NOT walk — it turns. This is aframe-extras' own fixed
    // scheme (getJoystick: MOVEMENT always reads the left gamepad, ROTATION
    // always reads the right one), not a CodeXR choice.
    before = (await snap()).rig;
    await run('CodeXRImmersiveHarness.setStickAxes("right", 1, 0)');
    await page.waitForTimeout(250);
    await run('CodeXRImmersiveHarness.setStickAxes("right", 0, 0)');
    after = (await snap()).rig;
    const turn = after.yaw - before.yaw;
    assert.ok(Math.abs(after.z - before.z) < 0.05, 'the right stick must not walk the rig');
    assert.ok(turn < -0.15 && turn > -1.2, `right stick must smooth-turn the rig (Δyaw ${turn})`);

    // Flying: enter VR (fly turns on automatically), look up, push forward.
    // The direction comes from the camera's actual quaternion — the same
    // mechanism the compass/heading math already avoided the Euler-order bug
    // with once — so this also covers a turned heading, not just yaw 0.
    await run('CodeXRImmersiveHarness.pitchCamera(Math.PI / 4)'); // 45° up
    before = (await snap()).rig;
    await run('CodeXRImmersiveHarness.setStickAxes("left", 0, -1)');
    await page.waitForTimeout(350);
    await run('CodeXRImmersiveHarness.setStickAxes("left", 0, 0)');
    after = (await snap()).rig;
    assert.ok(
        after.y > before.y + 0.15,
        `looking up and pushing forward must fly (y ${before.y} -> ${after.y})`,
    );

    await run('CodeXRImmersiveHarness.pitchCamera(0)');
    await run('CodeXRImmersiveHarness.clearStickAxes()');
    await run('document.getElementById("rig").object3D.position.set(0.07, 1.75, -10.75)');
    await run('document.getElementById("rig").object3D.rotation.set(0, 0, 0)');

    await run('CodeXRImmersiveHarness.exit()');
    await settle();
    state = await snap();
    assert.equal(state.pointers.mouse.enabled, true, 'after VR: mouse pointer back');
    assert.equal(state.movement.fly, false, 'after VR: grounded again on desktop');
    assertStanding(state, 'after VR');

    // --- The debug simulate commands run the exact same real components ---
    for (const [command, label] of [['simulateAR', 'AR'], ['simulateVR', 'VR']]) {
        await run(`CodeXRDebug.${command}()`);
        await settle();
        state = await snap();
        assert.equal(state.states[label.toLowerCase()], true, `${command}: ${label} state set`);
        assertStanding(state, `${command}`);
        assert.equal(state.movement.fly, true, `${command}: flying turns on`);

        await run('CodeXRDebug.exitSimulated()');
        await settle();
        state = await snap();
        assertStanding(state, `after ${command}`);
        assert.equal(state.movement.fly, false, `after ${command}: grounded again`);
        assert.equal(state.hidden.room, false, `after ${command}: room restored`);
    }

    // --- A REAL WebXR session (emulator / headset), emulated faithfully ---
    // A-Frame sets sceneEl.xrSession before emitting enter-vr, and three.js
    // then writes the device's local-floor pose — the user's height above
    // their physical floor — into the CAMERA entity. The rig must therefore
    // stop supplying its own height, or the two stack: 1.75 + 1.6 = 3.35 m,
    // the floating entry the user's emulator screenshots showed.
    const DEVICE = 1.6;

    // VR.
    await run('CodeXRImmersiveHarness.setRealSession(true)');
    await run('CodeXRImmersiveHarness.enterVR()');
    await settle();
    await run(`CodeXRImmersiveHarness.fakeHeadsetPose(${DEVICE})`);
    state = await snap();
    assert.equal(state.rig.y, 0, 'real VR: the rig stops supplying height');
    assert.ok(
        Math.abs(state.geometry.eyeWorldY - DEVICE) < 0.02,
        `real VR: eye must be at the DEVICE height (${DEVICE}), not stacked at 3.35 — was ${state.geometry.eyeWorldY}`,
    );
    assert.equal(state.geometry.eyeAboveTable, true, 'real VR: still above the tabletop');
    assert.equal(state.movement.fly, true, 'real VR: flying on');

    await run('CodeXRImmersiveHarness.exit()');
    // What look-controls' restoreCameraPose does with a real headset: the
    // camera returns to the local origin it had before the session.
    await run('CodeXRImmersiveHarness.fakeHeadsetPose(0)');
    await run('CodeXRImmersiveHarness.setRealSession(false)');
    await settle();
    state = await snap();
    assertStanding(state, 'after real VR');
    assert.equal(state.movement.fly, false, 'after real VR: grounded');

    // AR: recentered at the pedestal AND standing on your own floor.
    await run('CodeXRImmersiveHarness.setRealSession(true)');
    await run('CodeXRImmersiveHarness.enterAR()');
    await settle();
    await run(`CodeXRImmersiveHarness.fakeHeadsetPose(${DEVICE})`);
    state = await snap();
    assert.deepEqual(
        { x: state.rig.x, y: state.rig.y, z: state.rig.z },
        { x: 0.07, y: 0, z: -14.7 },
        'real AR: pedestal in front of you, on your own floor',
    );
    assert.ok(
        Math.abs(state.geometry.eyeWorldY - DEVICE) < 0.02,
        `real AR: eye at device height, was ${state.geometry.eyeWorldY}`,
    );
    assert.equal(state.hidden.room, true, 'real AR: room hidden');

    await run('CodeXRImmersiveHarness.exit()');
    await run('CodeXRImmersiveHarness.fakeHeadsetPose(0)');
    await run('CodeXRImmersiveHarness.setRealSession(false)');
    await settle();
    state = await snap();
    assertStanding(state, 'after real AR');
    assert.equal(state.hidden.room, false, 'after real AR: room back');
    assert.deepEqual(
        { x: state.rig.x, z: state.rig.z },
        { x: 0.07, z: -10.75 },
        'after real AR: desktop spot restored',
    );
}

runPlaywrightIfAvailable().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
