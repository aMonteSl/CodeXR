const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const projectRoot = path.resolve(__dirname, '..', '..');
const harnessPath = path.join(projectRoot, 'test', 'manual', 'project-evolution-playback-harness.html');
const outputRoot = path.join(projectRoot, 'output', 'project-evolution-harness');
const revisionRoot = path.join(outputRoot, 'evolution', 'revision-1');
const screenshotRoot = path.join(outputRoot, 'screenshots');

// Frames must differ in SHAPE and in SIZE, the way real revisions do: a
// handful of hand-written files never exercised Babia's incremental redraw,
// which is why this harness missed a chart that decayed frame after frame.
// Frame 2 triples the tree and deepens it (plus a vendored monster); frame 3
// collapses it into different packages again.
function generateFrame(fileCount, lineScale, maxDepth, packagePrefix) {
  const rows = [];
  for (let index = 0; index < fileCount; index += 1) {
    const depth = 1 + (index % maxDepth);
    const segments = [];
    for (let level = 0; level < depth; level += 1) {
      segments.push(`${packagePrefix}${(index + level) % 6}`);
    }
    segments.push(`module_${index}.py`);
    rows.push(file(
      segments.join('/'),
      1 + (index % 10),
      Math.round((40 + ((index * 37) % 320)) * lineScale),
      1 + (index % 8),
    ));
  }
  return rows;
}

const framePayloads = [
  generateFrame(40, 1, 2, 'pkg'),
  generateFrame(120, 4, 4, 'pkg').concat([file('vendor/bundle/legacy.js', 60, 4200, 38)]),
  generateFrame(25, 2, 2, 'core'),
];

function file(filePath, functionCount, totalLines, complexity) {
  const fileName = filePath.split('/').pop();
  return {
    fileName,
    filePath,
    relativePath: filePath,
    language: fileName.endsWith('.py') ? 'Python' : 'Markdown',
    functionCount,
    totalLines,
    codeLines: Math.max(1, totalLines - 8),
    commentLines: 4,
    blankLines: 4,
    cyclomaticComplexityNumber: complexity,
    maxComplexity: complexity,
    fileSizeBytes: totalLines * 64,
  };
}

function writeFixtureFiles() {
  fs.rmSync(outputRoot, { recursive: true, force: true });
  fs.mkdirSync(revisionRoot, { recursive: true });
  fs.mkdirSync(screenshotRoot, { recursive: true });
  framePayloads.forEach((payload, index) => {
    fs.writeFileSync(
      path.join(revisionRoot, `data${index + 1}.json`),
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf8',
    );
  });
  fs.copyFileSync(path.join(revisionRoot, 'data1.json'), path.join(revisionRoot, 'data.json'));
  fs.writeFileSync(
    path.join(revisionRoot, 'manifest.json'),
    `${JSON.stringify({
      revision: 1,
      bridgeUrl: '/output/project-evolution-harness/evolution/revision-1/data.json',
      frames: framePayloads.map((payload, index) => ({
        index,
        url: `/output/project-evolution-harness/evolution/revision-1/data${index + 1}.json`,
        itemCount: payload.length,
      })),
    }, null, 2)}\n`,
    'utf8',
  );
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}

function createServer() {
  return http.createServer((request, response) => {
    const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
    if (requestUrl.pathname === '/__project_evolution_apply_frame') {
      const frameIndex = Number(requestUrl.searchParams.get('frameIndex') || 0);
      const sourcePath = path.join(revisionRoot, `data${frameIndex + 1}.json`);
      const bridgePath = path.join(revisionRoot, 'data.json');
      if (!Number.isInteger(frameIndex) || frameIndex < 0 || !fs.existsSync(sourcePath)) {
        response.writeHead(400, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: 'invalid-frame' }));
        return;
      }
      const tmpPath = `${bridgePath}.${process.pid}.tmp`;
      fs.copyFileSync(sourcePath, tmpPath);
      fs.renameSync(tmpPath, bridgePath);
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify({
        revision: 1,
        frameIndex,
        bridgeUrl: '/output/project-evolution-harness/evolution/revision-1/data.json',
      }));
      return;
    }

    let filePath = path.normalize(path.join(projectRoot, decodeURIComponent(requestUrl.pathname)));
    if (requestUrl.pathname === '/') {
      filePath = harnessPath;
    }
    if (!filePath.startsWith(projectRoot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('not found');
      return;
    }
    response.writeHead(200, {
      'content-type': contentType(filePath),
      'cache-control': filePath.endsWith('.json') || filePath.endsWith('.js') || filePath.endsWith('.html')
        ? 'no-store'
        : 'public, max-age=60',
    });
    fs.createReadStream(filePath).pipe(response);
  });
}

async function listen(server, requestedPort = 0) {
  return new Promise((resolve) => {
    server.listen(requestedPort, '127.0.0.1', () => resolve(server.address().port));
  });
}

async function validateBridge(port) {
  const applyUrl = `http://127.0.0.1:${port}/__project_evolution_apply_frame?revision=1&frameIndex=2`;
  const response = await fetch(applyUrl);
  assert.equal(response.status, 200);
  const payload = JSON.parse(fs.readFileSync(path.join(revisionRoot, 'data.json'), 'utf8'));
  assert.equal(payload.length, framePayloads[2].length);
  fs.copyFileSync(path.join(revisionRoot, 'data1.json'), path.join(revisionRoot, 'data.json'));
}

async function runPlaywrightIfAvailable(port) {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    console.log('[project-evolution-harness] Playwright is not installed; bridge/static validation passed.');
    console.log(`[project-evolution-harness] Open ${pathToFileURL(harnessPath).toString()} or http://127.0.0.1:${port}/test/manual/project-evolution-playback-harness.html while this runner is active.`);
    return;
  }

  // Close the browser even when an assertion fails: leaked pages keep the
  // process alive forever, turning a red run into a silent hang.
  const browser = await chromium.launch();
  try {
    await runScenario(browser, port);
  } finally {
    await browser.close();
  }
}

async function runScenario(browser, port) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
  const url = `http://127.0.0.1:${port}/test/manual/project-evolution-playback-harness.html?bust=${Date.now()}`;
  const logs = [];
  page.on('console', (message) => {
    logs.push(`${message.type()}: ${message.text()}`);
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="evolution-harness-status"]', { timeout: 15000 });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: path.join(screenshotRoot, 'frame-1.png') });
  let metrics = await page.evaluate(() => window.CodeXRProjectEvolutionHarness.updateStatus());
  assert.equal(metrics.hasQueryComponent, true);
  assert.equal(metrics.hasTreeComponent, true);
  assert.equal(metrics.hasChartComponent, true);
  assert.ok(metrics.chartChildren > 0, 'expected chart geometry after frame 1');
  assert.match(JSON.stringify(metrics.dataUrl), /data\.json/);

  const frameOneMeshes = metrics.chartMeshes;
  assert.ok(frameOneMeshes > 0, 'expected chart meshes after frame 1');

  await page.click('[data-testid="frame-2"]');
  await page.waitForTimeout(4500);
  await page.screenshot({ path: path.join(screenshotRoot, 'frame-2.png') });
  metrics = await page.evaluate(() => window.CodeXRProjectEvolutionHarness.updateStatus());
  assert.equal(metrics.runtime.frameIndex, 1);
  assert.ok(metrics.chartChildren > 0, 'expected chart geometry after frame 2');
  // Frame 2 carries three times the files: the chart must actually grow.
  assert.ok(
    metrics.chartMeshes > frameOneMeshes,
    `expected frame 2 to add geometry (frame 1: ${frameOneMeshes}, frame 2: ${metrics.chartMeshes})`,
  );

  // The regression this harness missed for a long time: Babia's boats only
  // redraws from scratch while it has no previous figures, and otherwise
  // morphs — which loses geometry between revisions that are shaped
  // differently. Frame by frame the chart decayed and never recovered, so
  // returning to a frame must reproduce that frame exactly.
  await page.click('[data-testid="frame-3"]');
  await page.waitForTimeout(4500);
  await page.click('[data-testid="frame-1"]');
  await page.waitForTimeout(4500);
  metrics = await page.evaluate(() => window.CodeXRProjectEvolutionHarness.updateStatus());
  assert.equal(metrics.runtime.frameIndex, 0);
  assert.equal(
    metrics.chartMeshes,
    frameOneMeshes,
    `returning to frame 1 must rebuild its geometry (was ${frameOneMeshes}, got ${metrics.chartMeshes})`,
  );

  await page.click('[data-testid="frame-2"]');
  await page.waitForTimeout(4500);

  await page.click('[data-testid="play-movie"]');
  await page.waitForTimeout(15000);
  await page.screenshot({ path: path.join(screenshotRoot, 'finished.png') });
  metrics = await page.evaluate(() => window.CodeXRProjectEvolutionHarness.updateStatus());
  assert.equal(metrics.runtime.playing, false);
  assert.equal(metrics.runtime.frameIndex, 2);
  assert.ok(metrics.chartChildren > 0, 'expected final chart geometry');

  fs.writeFileSync(path.join(outputRoot, 'browser-console.log'), `${logs.join('\n')}\n`, 'utf8');
  fs.writeFileSync(path.join(outputRoot, 'final-metrics.json'), `${JSON.stringify(metrics, null, 2)}\n`, 'utf8');
  console.log(`[project-evolution-harness] screenshots: ${screenshotRoot}`);
}

async function main() {
  const serveOnly = process.argv.includes('--serve');
  const portArg = process.argv.find((arg) => arg.startsWith('--port='));
  const requestedPort = portArg ? Number(portArg.slice('--port='.length)) || 0 : 0;
  require('../manual/buildAssembledRuntimes.cjs').buildAssembledRuntimes();
  assert.match(fs.readFileSync(harnessPath, 'utf8'), /CodeXRProjectEvolutionHarness/);
  assert.match(fs.readFileSync(harnessPath, 'utf8'), /project-evolution-apply-frame/);
  writeFixtureFiles();
  const server = createServer();
  const port = await listen(server, requestedPort);
  const harnessUrl = `http://127.0.0.1:${port}/test/manual/project-evolution-playback-harness.html?bust=${Date.now()}`;
  fs.writeFileSync(path.join(outputRoot, 'server-url.txt'), `${harnessUrl}\n`, 'utf8');
  try {
    await validateBridge(port);
    if (serveOnly) {
      console.log(`[project-evolution-harness] serving ${harnessUrl}`);
      await new Promise((resolve) => {
        process.on('SIGINT', resolve);
        process.on('SIGTERM', resolve);
      });
      return;
    }
    await runPlaywrightIfAvailable(port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
