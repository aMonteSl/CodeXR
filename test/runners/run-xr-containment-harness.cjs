const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const projectRoot = path.resolve(__dirname, '..', '..');
const harnessPath = path.join(projectRoot, 'test', 'manual', 'xr-containment-harness.html');
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

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const url = pathToFileURL(harnessPath).toString();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="containment-status"]', { timeout: 10000 });
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

  await browser.close();
  console.log('[xr-harness] Playwright harness validation passed.');
}

runPlaywrightIfAvailable().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
