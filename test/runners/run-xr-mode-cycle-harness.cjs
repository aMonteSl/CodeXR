const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { buildAssembledRuntimes } = require('../manual/buildAssembledRuntimes.cjs');

const projectRoot = path.resolve(__dirname, '..', '..');
const harnessPath = path.join(projectRoot, 'test', 'manual', 'xr-mode-cycle-harness.html');
buildAssembledRuntimes();
const html = fs.readFileSync(harnessPath, 'utf8');

// Static contract: the harness bundles the whole controller stack.
assert.match(html, /codexr-tooling-config-xr-mapping-ui/);
assert.match(html, /assembled\/xrChartMappingUiRuntime\.js/);
assert.match(html, /assembled\/analysisModeRuntime\.js/);
assert.match(html, /assembled\/historicalComparisonRuntime\.js/);
assert.match(html, /assembled\/dependencyGraphRuntime\.js/);

async function runPlaywrightIfAvailable() {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    console.log('[xr-mode-harness] Playwright is not installed; static harness validation passed.');
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
  console.log('[xr-mode-harness] controller mode-cycle validation passed.');
}

// The controller is the single access point to every analysis surface: this
// scenario walks the real user path — open the analysis selector from the
// panel's header button, enter each analysis mode, and come back — asserting
// the controller view/mode state at every step.
async function runScenario(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(pathToFileURL(harnessPath).toString(), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#scene', { timeout: 10000 });
  await page.evaluate(() => new Promise((resolve) => {
    const scene = document.getElementById('scene');
    if (scene.hasLoaded) { resolve(); return; }
    scene.addEventListener('loaded', () => resolve(), { once: true });
  }));

  function controllerState() {
    return {
      panelView: window.CodeXRMappingUiRuntime.getActivePanelView(),
      mode: window.CodeXRAnalysisModeRuntime.getState().mode,
      optionCount: document.querySelectorAll('[data-codexr-mode-option]').length,
    };
  }

  async function waitForState(expected, label) {
    const deadline = Date.now() + 8000;
    let state = null;
    while (Date.now() < deadline) {
      state = await page.evaluate(controllerState);
      if ((!expected.panelView || state.panelView === expected.panelView)
        && (!expected.mode || state.mode === expected.mode)) {
        return state;
      }
      await page.waitForTimeout(150);
    }
    assert.fail(`${label}: controller stayed in ${JSON.stringify(state)}, expected ${JSON.stringify(expected)}`);
  }

  async function clickEntity(selector, label) {
    const clicked = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) { return false; }
      el.dispatchEvent(new Event('click', { bubbles: false }));
      return true;
    }, selector);
    assert.equal(clicked, true, `${label}: entity ${selector} not found`);
  }

  // 1. The analysis-selector header button must exist — a capped registration
  //    retry used to silently drop it, leaving no way to switch analyses.
  await page.waitForFunction(
    () => !!document.querySelector('#codexrMappingUiView-visualization-mode'),
    { timeout: 8000 },
  );
  await waitForState({ panelView: 'mapping' }, 'initial state');

  // 2. Header button opens the analysis selector with its mode options.
  await clickEntity('#codexrMappingUiView-visualization-mode', 'open selector');
  const selection = await waitForState({ panelView: 'visualization-mode', mode: 'selection' }, 'open selector');
  // Normal analysis + historical comparison + dependency graph + project
  // evolution.
  assert.ok(selection.optionCount >= 4, `expected >=4 analysis options, saw ${selection.optionCount}`);

  // 3. Enter each analysis from the selector, returning via the same button.
  //    Project evolution is entered with NO movie generated — the cold path
  //    that used to throw inside activate() and bounce back to the selector.
  const journeys = [
    ['dependency-graph', { panelView: 'dependency-graph', mode: 'dependency-graph' }],
    ['historical-compare', { panelView: 'historical-selection', mode: 'historical-compare' }],
    ['project-evolution', { panelView: 'project-evolution', mode: 'project-evolution' }],
    ['single', { panelView: 'mapping', mode: 'single' }],
  ];
  for (const [optionId, expected] of journeys) {
    if ((await page.evaluate(controllerState)).panelView !== 'visualization-mode') {
      await clickEntity('#codexrMappingUiView-visualization-mode', `reopen selector before ${optionId}`);
      await waitForState({ panelView: 'visualization-mode', mode: 'selection' }, `reopen selector before ${optionId}`);
    }
    await clickEntity(`[data-codexr-mode-option="${optionId}"]`, `select ${optionId}`);
    await waitForState(expected, `enter ${optionId}`);
  }

  // 4. Back in normal analysis, the Field Mapping view is interactive again:
  //    switching the chart type through the controller works.
  const chartSwitch = await page.evaluate(() => {
    const runtime = window.CodeXRMappingUiRuntime;
    const before = runtime.getState().chartId;
    const buttons = [...document.querySelectorAll('.codexr-mapping-ui-chart-option')];
    const other = buttons.find((el) => el.getAttribute('data-codexr-chart-id') !== before);
    if (!other) { return { before, after: before, clicked: false }; }
    other.dispatchEvent(new Event('click', { bubbles: false }));
    return { before, after: runtime.getState().chartId, clicked: true };
  });
  if (chartSwitch.clicked) {
    assert.notEqual(chartSwitch.after, chartSwitch.before, 'chart selector click must switch the active chart');
  }
}

runPlaywrightIfAvailable().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
