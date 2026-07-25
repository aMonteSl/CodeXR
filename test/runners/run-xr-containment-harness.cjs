const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const { buildAssembledRuntimes } = require('../manual/buildAssembledRuntimes.cjs');

const projectRoot = path.resolve(__dirname, '..', '..');
const harnessPath = path.join(projectRoot, 'test', 'manual', 'xr-containment-harness.html');
buildAssembledRuntimes();
const html = fs.readFileSync(harnessPath, 'utf8');

assert.match(html, /analysisTableRuntime\.js/);
assert.match(html, /CodeXRContainmentHarness/);
assert.match(html, /getContainmentProfile\(profileId\(\)\)/);
assert.match(html, /applyContainmentProfile\(target, profileId\(\)\)/);
assert.match(html, /getActiveContainmentDiagnostics\('#harnessChart'\)/);
assert.match(html, /getActiveContainmentDiagnostics\(\)/);
assert.match(html, /id="codexrDependencyGraph"/);
assert.match(html, /project-evolution/);
assert.match(html, /historical-right/);
assert.match(html, /no chart/i);

async function runPlaywrightIfAvailable() {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    console.log('[xr-harness] Playwright is not installed; static harness validation passed.');
    return;
  }

  // Close the browser even when an assertion fails: leaked pages keep the
  // process alive forever, turning a red run into a silent hang.
  const browser = await chromium.launch();
  try {
    await runScenario(browser);
  } finally {
    await browser.close();
  }
  console.log('[xr-harness] Playwright harness validation passed.');
}

async function runScenario(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const url = pathToFileURL(harnessPath).toString();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="containment-status"]', { timeout: 10000 });
  // Interacting before the A-Frame scene finishes loading wedges entity
  // initialization (children created pre-load never init, so components get
  // no init()/tick() and the containment machinery never runs).
  await page.evaluate(() => new Promise((resolve) => {
    const scene = document.getElementById('scene');
    if (scene.hasLoaded) { resolve(); return; }
    scene.addEventListener('loaded', () => resolve(), { once: true });
  }));
  await page.waitForTimeout(1500);
  const statusText = await page.locator('[data-testid="containment-status"]').textContent();
  assert.match(statusText || '', /"diagnostics"/);
  assert.doesNotMatch(statusText || '', /"reason":\s*"chart-not-found"/);

  await page.getByText('boats tiny').click();
  await page.waitForTimeout(1500);
  const tinyStatus = await page.locator('[data-testid="containment-status"]').textContent();
  assert.match(tinyStatus || '', /"chartType":\s*"boats"/);

  await page.getByText('evolution frame').click();
  await page.waitForTimeout(1500);
  const evolutionStatus = await page.locator('[data-testid="containment-status"]').textContent();
  assert.match(evolutionStatus || '', /"mode":\s*"project-evolution"/);
  assert.match(evolutionStatus || '', /"profile":\s*"project-evolution"/);

  await page.getByText('dependencies').click();
  await page.waitForTimeout(700);
  const dependencyStatus = await page.locator('[data-testid="containment-status"]').textContent();
  assert.match(dependencyStatus || '', /"mode":\s*"dependency-graph"/);
  assert.match(dependencyStatus || '', /"reason":\s*"dependency-graph-visible"/);

  await runWarningStabilityScenario(page);
  await runSettledQuietScenario(page);
}

// ── Settled state: a converged chart goes QUIET ──────────────────────────────
//
// A camera-facing legend (a `babiaxrLegend` container whose visible mesh is an
// ANONYMOUS child plane, exactly Babia's structure) spins inside the chart —
// pure measurement noise. Once settled the scale must stay bit-identical
// across ≥6 watch periods (the user-visible "stop resizing"); a REAL content
// change must re-fit and re-settle at a different scale.
async function runSettledQuietScenario(page) {
  await page.getByText('bars', { exact: true }).click();
  await page.evaluate(() => window.CodeXRAnalysisTableRuntime.waitForChartsStable('#harnessChart', { timeoutMs: 12000 }));

  await page.evaluate(() => {
    const chart = document.getElementById('harnessChart');
    const legend = document.createElement('a-entity');
    legend.setAttribute('class', 'babiaxrLegend');
    const plane = document.createElement('a-plane');
    plane.setAttribute('width', 2);
    plane.setAttribute('height', 1);
    plane.setAttribute('position', '0 2.2 0');
    legend.appendChild(plane);
    chart.appendChild(legend);
    let angle = 0;
    window.__legendSpin = setInterval(() => {
      angle = (angle + 23) % 360;
      legend.setAttribute('rotation', `0 ${angle} 0`);
    }, 120);
  });

  const settled = await page.waitForFunction(() => {
    const component = document.getElementById('harnessChart').components['codexr-chart-containment'];
    return !!(component && component.settled === true);
  }, null, { timeout: 15000 }).catch(() => null);
  assert.ok(settled, 'chart must reach the settled state with a spinning legend inside');

  const readScale = () => page.evaluate(() => {
    const scale = document.getElementById('harnessChart').object3D.scale;
    return `${scale.x}|${scale.y}|${scale.z}`;
  });
  const samples = [];
  for (let i = 0; i < 6; i += 1) {
    samples.push(await readScale());
    await page.waitForTimeout(750);
  }
  assert.ok(
    samples.every((value) => value === samples[0]),
    `settled scale must stay bit-identical, got ${JSON.stringify(samples)}`,
  );

  // A REAL change: content grows well past the resume threshold → the watch
  // re-engages the controller, which re-fits and re-settles.
  const scaleBeforeGrowth = samples[0];
  await page.evaluate(() => {
    const chart = document.getElementById('harnessChart');
    const box = document.createElement('a-box');
    box.setAttribute('width', 3);
    box.setAttribute('depth', 3);
    box.setAttribute('height', 0.5);
    box.setAttribute('position', '4 0.25 0');
    chart.appendChild(box);
  });
  const stable = await page.evaluate(() => window.CodeXRAnalysisTableRuntime.waitForChartsStable('#harnessChart', { timeoutMs: 15000 }));
  assert.equal(stable.valid, true, 'chart must become valid again after a real content change');
  const resettled = await page.waitForFunction(() => {
    const component = document.getElementById('harnessChart').components['codexr-chart-containment'];
    return !!(component && component.settled === true);
  }, null, { timeout: 15000 }).catch(() => null);
  assert.ok(resettled, 'chart must re-settle after the correction');
  const scaleAfterGrowth = await readScale();
  assert.notEqual(scaleAfterGrowth, scaleBeforeGrowth, 'a real content change must produce a different fit');
  await page.evaluate(() => { clearInterval(window.__legendSpin); });
}

// ── Warning-surface stability across chart data changes ──────────────────────
//
// The table's warning readout must always converge to the live chart state:
// no message may stick around after the chart settles (the historical bug),
// transient rebuilds must not flash warnings, and a genuinely stuck rebuild
// must eventually surface — then clear as soon as geometry returns.
async function runWarningStabilityScenario(page) {
  function isWarningVisible() {
    const group = document.getElementById('codexr-analysis-table-warning');
    if (!group) { return null; }
    const attr = group.getAttribute('visible');
    return !(attr === false || attr === 'false');
  }

  async function waitForWarningState(expected, timeoutMs, label) {
    const deadline = Date.now() + timeoutMs;
    let visible = null;
    while (Date.now() < deadline) {
      visible = await page.evaluate(isWarningVisible);
      if (visible === expected) { return; }
      await page.waitForTimeout(200);
    }
    assert.fail(`${label}: warning visibility stayed ${visible}, expected ${expected}`);
  }

  async function waitStableAndAssertContained(label) {
    const result = await page.evaluate(() => window.CodeXRAnalysisTableRuntime.waitForChartsStable(
      '#harnessChart', { timeoutMs: 12000 },
    ));
    assert.equal(result.valid, true, `${label}: chart never became valid (${result.reason || result.state})`);
    const status = await page.evaluate(() => window.CodeXRAnalysisTableRuntime.getChartStatus('#harnessChart'));
    const details = status.details || {};
    // Containment invariant: the settled chart sits inside the X/Z and height bands.
    for (const [axis, ratio] of [['x', details.xRatio], ['z', details.zRatio], ['height', details.heightRatio]]) {
      if (Number.isFinite(ratio)) {
        assert.ok(ratio <= 1.05, `${label}: ${axis} ratio ${ratio} exceeds the containment band`);
      }
    }
    await waitForWarningState(false, 4000, `${label}: settled chart must show no warning`);
  }

  await page.getByText('normal', { exact: true }).click();
  await page.getByText('bars', { exact: true }).click();
  await waitStableAndAssertContained('initial render');

  // A data update (re-analysis style rebuild) settles without leaving warnings.
  await page.getByText('bubbles').click();
  await waitStableAndAssertContained('data update');

  // A brief geometry gap is graced: stripping and quickly restoring the chart
  // must not flash the rebuilding warning.
  await page.evaluate(() => { document.getElementById('harnessChart').replaceChildren(); });
  await page.waitForTimeout(1200);
  const gracedVisible = await page.evaluate(isWarningVisible);
  assert.equal(gracedVisible, false, 'brief rebuild must stay graced (no warning flash)');
  await page.getByText('bars', { exact: true }).click();
  await waitStableAndAssertContained('recovery from brief rebuild');

  // A rebuild that persists must surface honestly...
  await page.evaluate(() => { document.getElementById('harnessChart').replaceChildren(); });
  await waitForWarningState(true, 8000, 'persistent rebuild must surface a warning');
  const warningText = await page.evaluate(() => {
    const textEl = document.querySelector('[data-codexr-warning-edge="front"]');
    return textEl ? String(textEl.getAttribute('value') || '') : '';
  });
  assert.match(warningText, /rebuilding its geometry/);

  // ...and clear on its own once the chart is rebuilt — the historical bug
  // left this message stuck forever on a perfectly settled chart.
  await page.getByText('bars', { exact: true }).click();
  await waitStableAndAssertContained('recovery from stuck rebuild');
}

runPlaywrightIfAvailable().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
