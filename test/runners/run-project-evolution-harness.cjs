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

function readBridgePayload() {
  return JSON.parse(fs.readFileSync(path.join(revisionRoot, 'data.json'), 'utf8'));
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
  assert.deepEqual(
    metrics.rootChildren,
    ['codexrProjectEvolutionTree', 'codexrProjectEvolutionChart'],
    'the Evolution root must contain only the declarative tree then chart',
  );
  assert.equal(metrics.dataParentTag, 'A-SCENE', 'the isolated datasource must live outside the root');
  assert.equal(metrics.treeParentId, 'codexrProjectEvolutionRoot');
  assert.equal(metrics.chartParentId, 'codexrProjectEvolutionRoot');
  assert.equal(metrics.hasLegacySurface, false);
  assert.match(metrics.dataHtml, /babia-queryjson="url: .*data\.json/);
  assert.match(metrics.treeHtml, /babia-treebuilder="field: filePath/);
  assert.match(metrics.treeHtml, /from: codexrProjectEvolutionData/);
  assert.match(metrics.chartHtml, /babia-boats="[^"]*from: codexrProjectEvolutionTree/);
  assert.match(metrics.chartHtml, /area: functionCount/);
  assert.match(metrics.chartHtml, /codexr-boats-layout-stability="enabled: true"/);
  assert.match(metrics.chartHtml, /codexr-chart-containment="enabled: true/);
  assert.ok(metrics.chartChildren > 0, 'expected chart geometry after frame 1');
  assert.match(JSON.stringify(metrics.dataUrl), /data\.json/);
  assert.deepEqual(readBridgePayload(), framePayloads[0], 'data.json must contain frame 1');

  const frameOneMeshes = metrics.chartMeshes;
  const frameOneNodeToken = metrics.chartNodeToken;
  const frameOneComponentToken = metrics.chartComponentToken;
  const frameOneDataToken = metrics.dataNodeToken;
  const frameOneTreeToken = metrics.treeNodeToken;
  const frameOneBoxIds = new Set(metrics.boxIds);
  const frameOneYScale = metrics.chartScale.y;
  const frameOneLayerGap = metrics.greenLayerGaps[0];
  const frameOneNormalizedLayerGap = metrics.normalizedGreenLayerGaps[0];
  const normalChartTransform = metrics.normalChartTransform;
  assert.ok(frameOneMeshes > 0, 'expected chart meshes after frame 1');
  assert.ok(frameOneNodeToken, 'expected a concrete chart instance for frame 1');
  assert.ok(frameOneComponentToken, 'expected a concrete Babia component instance for frame 1');
  assert.ok(frameOneLayerGap > 0, 'expected visible separation between Boats hierarchy layers');
  assert.ok(frameOneNormalizedLayerGap > 0, 'expected a finite hierarchy gap relative to scale.y');
  assert.ok(
    metrics.greenLayerLocalHeights.length > 0
      && metrics.greenLayerLocalHeights.every((height) => Math.abs(height - 0.2) <= 0.002),
    `frame 1 Boats bases must use the canonical local height 0.2: ${metrics.greenLayerLocalHeights.join(', ')}`,
  );
  assert.deepEqual(metrics.duplicateIds, [], 'frame 1 must not contain duplicate DOM ids');
  assert.deepEqual(metrics.boatsStyle, {
    separation: 0.5,
    zoneElevation: 0.01,
    quarterLegendBoxHeight: 0.01,
    quarterLegendTitleHeight: 2.5,
    legendScale: 0.25,
    buildingLegendHeight: -0.5,
  });

  await page.click('[data-testid="frame-2"]');
  await page.waitForTimeout(4500);
  await page.screenshot({ path: path.join(screenshotRoot, 'frame-2.png') });
  metrics = await page.evaluate(() => window.CodeXRProjectEvolutionHarness.updateStatus());
  assert.equal(metrics.runtime.frameIndex, 1);
  assert.ok(metrics.chartChildren > 0, 'expected chart geometry after frame 2');
  assert.equal(
    metrics.chartNodeToken,
    frameOneNodeToken,
    'frame 2 must reuse the exact chart object3D',
  );
  assert.equal(metrics.chartComponentToken, frameOneComponentToken, 'frame 2 must reuse the Babia component');
  assert.equal(metrics.dataNodeToken, frameOneDataToken, 'frame 2 must reuse the datasource');
  assert.equal(metrics.treeNodeToken, frameOneTreeToken, 'frame 2 must reuse the hierarchy producer');
  assert.deepEqual(metrics.rootChildren, ['codexrProjectEvolutionTree', 'codexrProjectEvolutionChart']);
  assert.deepEqual(metrics.duplicateIds, [], 'frame 2 must not contain duplicate DOM ids');
  assert.ok(
    metrics.boxIds.some((id) => frameOneBoxIds.has(id)),
    'stable Boats ids must retain at least one box entity between frames',
  );
  assert.ok(metrics.figuresOldCount > 0, 'Babia must retain figures_old for the frame transition');
  assert.equal(metrics.chartAnimating, false, 'the frame transition must finish before containment settles');
  assert.deepEqual(readBridgePayload(), framePayloads[1], 'data.json must contain frame 2');
  assert.ok(
    metrics.chartScale.y >= frameOneYScale * 0.25
      && metrics.chartScale.y <= frameOneYScale * 4,
    `frame 2 containment must not collapse the Boats Y presentation (${frameOneYScale} vs ${metrics.chartScale.y})`,
  );
  assert.ok(
    metrics.greenLayerGaps.length > 0 && metrics.greenLayerGaps.every((gap) => gap > 0),
    `frame 2 hierarchy layers must remain visibly separated: ${metrics.greenLayerGaps.join(', ')}`,
  );
  assert.ok(
    metrics.greenLayerLocalHeights.length > 0
      && metrics.greenLayerLocalHeights.every((height) => Math.abs(height - 0.2) <= 0.002),
    `frame 2 Boats bases must retain local height 0.2: ${metrics.greenLayerLocalHeights.join(', ')}`,
  );
  assert.ok(
    metrics.normalizedGreenLayerGaps.length > 0
      && Math.abs(metrics.normalizedGreenLayerGaps[0] - frameOneNormalizedLayerGap)
        <= Math.max(0.002, frameOneNormalizedLayerGap * 0.01),
    `frame 2 layer gaps divided by scale.y must remain proportional: ${metrics.normalizedGreenLayerGaps.join(', ')}`,
  );
  assert.deepEqual(metrics.normalChartTransform, normalChartTransform);
  assert.deepEqual(metrics.boatsStyle, {
    separation: 0.5,
    zoneElevation: 0.01,
    quarterLegendBoxHeight: 0.01,
    quarterLegendTitleHeight: 2.5,
    legendScale: 0.25,
    buildingLegendHeight: -0.5,
  });
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
  metrics = await page.evaluate(() => window.CodeXRProjectEvolutionHarness.updateStatus());
  assert.equal(metrics.chartNodeToken, frameOneNodeToken, 'frame 3 must reuse the chart');
  assert.equal(metrics.chartComponentToken, frameOneComponentToken, 'frame 3 must reuse Babia');
  assert.equal(metrics.dataNodeToken, frameOneDataToken, 'frame 3 must reuse the datasource');
  assert.equal(metrics.treeNodeToken, frameOneTreeToken, 'frame 3 must reuse the tree');
  assert.deepEqual(metrics.rootChildren, ['codexrProjectEvolutionTree', 'codexrProjectEvolutionChart']);
  assert.deepEqual(metrics.duplicateIds, [], 'frame 3 must not contain duplicate DOM ids');
  assert.ok(
    metrics.greenLayerLocalHeights.length > 0
      && metrics.greenLayerLocalHeights.every((height) => Math.abs(height - 0.2) <= 0.002),
    `frame 3 Boats bases must retain local height 0.2: ${metrics.greenLayerLocalHeights.join(', ')}`,
  );
  assert.equal(metrics.boatsStyle.zoneElevation, 0.01);
  assert.deepEqual(readBridgePayload(), framePayloads[2], 'data.json must contain frame 3');
  await page.click('[data-testid="frame-1"]');
  await page.waitForTimeout(4500);
  metrics = await page.evaluate(() => window.CodeXRProjectEvolutionHarness.updateStatus());
  assert.equal(metrics.runtime.frameIndex, 0);
  assert.equal(
    metrics.chartMeshes,
    frameOneMeshes,
    `returning to frame 1 must rebuild its geometry (was ${frameOneMeshes}, got ${metrics.chartMeshes})`,
  );
  assert.equal(metrics.chartNodeToken, frameOneNodeToken, 'seeking back must keep the chart identity');
  assert.equal(metrics.chartComponentToken, frameOneComponentToken, 'seeking back must keep Babia');
  assert.deepEqual(readBridgePayload(), framePayloads[0], 'data.json must return to frame 1');

  await page.click('[data-testid="frame-2"]');
  await page.waitForTimeout(4500);

  await page.click('[data-testid="play-movie"]');
  await page.waitForTimeout(15000);
  await page.screenshot({ path: path.join(screenshotRoot, 'finished.png') });
  metrics = await page.evaluate(() => window.CodeXRProjectEvolutionHarness.updateStatus());
  assert.equal(metrics.runtime.playing, false);
  assert.equal(metrics.runtime.frameIndex, 2);
  assert.ok(metrics.chartChildren > 0, 'expected final chart geometry');

  // Playback locks both UI and programmatic chart changes.
  await page.click('[data-testid="frame-1"]');
  await page.waitForTimeout(4500);
  const beforeLockedChange = await page.evaluate(() => window.CodeXRProjectEvolutionHarness.updateStatus());
  await page.click('[data-testid="play-movie"]');
  await page.waitForTimeout(150);
  const lockedResult = await page.evaluate(() => ({
    changed: window.CodeXRProjectEvolutionHarness.changeChart('bars'),
    mapping: window.CodeXRProjectEvolutionHarness.mappingState(),
  }));
  assert.equal(lockedResult.changed, false, 'a programmatic chart change must be rejected during Play');
  assert.equal(lockedResult.mapping.chartId, 'boats');
  assert.equal(lockedResult.mapping.locked, true);
  await page.evaluate(() => window.CodeXRProjectEvolutionRuntime.pause());
  await page.waitForTimeout(100);
  metrics = await page.evaluate(() => window.CodeXRProjectEvolutionHarness.updateStatus());
  assert.equal(metrics.chartNodeToken, beforeLockedChange.chartNodeToken);
  assert.equal(metrics.runtime.frameIndex, 0);

  // Paused chart selection replaces only the chart. It must not seek,
  // refresh the datasource, or overwrite the bridge payload.
  const pausedDataUrl = JSON.stringify(metrics.dataUrl);
  const pausedBridgePayload = readBridgePayload();
  const pausedDataToken = metrics.dataNodeToken;
  const pausedTreeToken = metrics.treeNodeToken;
  const pausedChartToken = metrics.chartNodeToken;
  const changed = await page.evaluate(() => window.CodeXRProjectEvolutionHarness.changeChart('bars'));
  assert.equal(changed, true);
  await page.waitForTimeout(4500);
  metrics = await page.evaluate(() => window.CodeXRProjectEvolutionHarness.updateStatus());
  assert.equal(metrics.runtime.frameIndex, 0, 'changing chart while paused must not seek');
  assert.equal(metrics.chartType, 'bars');
  assert.notEqual(metrics.chartNodeToken, pausedChartToken, 'a chart-type change creates one new chart');
  assert.equal(metrics.dataNodeToken, pausedDataToken, 'the datasource survives a chart-type change');
  assert.equal(metrics.treeNodeToken, pausedTreeToken, 'the tree survives a chart-type change');
  assert.deepEqual(metrics.rootChildren, ['codexrProjectEvolutionTree', 'codexrProjectEvolutionChart']);
  assert.match(metrics.chartHtml, /babia-bars="[^"]*from: codexrProjectEvolutionData/);
  assert.match(metrics.chartHtml, /x_axis: fileName/);
  assert.equal(JSON.stringify(metrics.dataUrl), pausedDataUrl, 'the datasource URL must not refresh');
  assert.deepEqual(readBridgePayload(), pausedBridgePayload, 'data.json must not change');
  assert.deepEqual(metrics.normalChartTransform, normalChartTransform);
  assert.deepEqual(metrics.duplicateIds, []);
  await page.waitForFunction(
    () => window.CodeXRProjectEvolutionRuntime.getState().applyingMapping === false,
    null,
    { timeout: 15000 },
  );

  const barsChartToken = metrics.chartNodeToken;
  const barsComponentToken = metrics.chartComponentToken;
  await page.click('[data-testid="frame-2"]');
  await page.waitForFunction(
    () => {
      const state = window.CodeXRProjectEvolutionRuntime.getState();
      return state.frameIndex === 1 && state.appliedFrameIndex === 1;
    },
    null,
    { timeout: 15000 },
  );
  await page.waitForTimeout(500);
  metrics = await page.evaluate(() => window.CodeXRProjectEvolutionHarness.updateStatus());
  assert.equal(metrics.chartType, 'bars');
  assert.equal(metrics.chartNodeToken, barsChartToken, 'the selected chart persists into later frames');
  assert.equal(metrics.chartComponentToken, barsComponentToken, 'the selected Babia instance persists');
  assert.deepEqual(metrics.rootChildren, ['codexrProjectEvolutionTree', 'codexrProjectEvolutionChart']);
  assert.deepEqual(readBridgePayload(), framePayloads[1]);

  // Leaving parks the complete pipeline. Re-entry restores the exact entities
  // and frame without asking the server to apply it again.
  const beforeReentry = metrics;
  const requestsBeforeReentry = await page.evaluate(
    () => window.CodeXRProjectEvolutionHarness.frameRequestCount(),
  );
  await page.evaluate(async () => {
    await window.CodeXRProjectEvolutionHarness.switchMode('single');
    await window.CodeXRProjectEvolutionHarness.switchMode('project-evolution');
  });
  await page.waitForTimeout(500);
  metrics = await page.evaluate(() => window.CodeXRProjectEvolutionHarness.updateStatus());
  assert.equal(metrics.runtime.frameIndex, beforeReentry.runtime.frameIndex);
  assert.equal(metrics.chartNodeToken, beforeReentry.chartNodeToken);
  assert.equal(metrics.chartComponentToken, beforeReentry.chartComponentToken);
  assert.equal(metrics.dataNodeToken, beforeReentry.dataNodeToken);
  assert.equal(metrics.treeNodeToken, beforeReentry.treeNodeToken);
  assert.deepEqual(metrics.rootChildren, ['codexrProjectEvolutionTree', 'codexrProjectEvolutionChart']);
  assert.equal(
    await page.evaluate(() => window.CodeXRProjectEvolutionHarness.frameRequestCount()),
    requestsBeforeReentry,
    're-entry must not request the preserved frame again',
  );

  // If it was playing, the preserved movie resumes only after activation.
  await page.evaluate(() => window.CodeXRProjectEvolutionRuntime.play());
  await page.waitForTimeout(120);
  await page.evaluate(async () => {
    await window.CodeXRProjectEvolutionHarness.switchMode('single');
    await window.CodeXRProjectEvolutionHarness.switchMode('project-evolution');
  });
  await page.waitForTimeout(250);
  metrics = await page.evaluate(() => window.CodeXRProjectEvolutionHarness.updateStatus());
  assert.equal(metrics.runtime.playing, true, 're-entry must restore the playback state');
  assert.equal(metrics.chartNodeToken, beforeReentry.chartNodeToken);
  await page.evaluate(() => window.CodeXRProjectEvolutionRuntime.pause());

  // The same contract applies to Single without touching Evolution: refreshing
  // its producer after containment has changed scale.y must keep the local
  // hierarchy bases at 0.2 and leave zone_elevation public and declarative.
  await page.evaluate(async () => {
    await window.CodeXRProjectEvolutionHarness.switchMode('single');
  });
  await page.waitForTimeout(1500);
  const singleBeforeRefresh = await page.evaluate(
    () => window.CodeXRProjectEvolutionHarness.updateStatus(),
  );
  assert.ok(singleBeforeRefresh.normalGreenLayerLocalHeights.length > 0);
  assert.ok(singleBeforeRefresh.normalGreenLayerLocalHeights.every(
    (height) => Math.abs(height - 0.2) <= 0.002,
  ));
  await page.evaluate(() => window.CodeXRProjectEvolutionHarness.refreshSingle(1));
  await page.waitForTimeout(4500);
  const singleAfterRefresh = await page.evaluate(
    () => window.CodeXRProjectEvolutionHarness.updateStatus(),
  );
  assert.equal(
    singleAfterRefresh.normalChartComponentToken,
    singleBeforeRefresh.normalChartComponentToken,
    'Single refresh must reuse its Babia component',
  );
  assert.equal(singleAfterRefresh.normalBoatsStyle.zoneElevation, 0.01);
  assert.ok(
    singleAfterRefresh.normalGreenLayerLocalHeights.length > 0
      && singleAfterRefresh.normalGreenLayerLocalHeights.every(
        (height) => Math.abs(height - 0.2) <= 0.002,
      ),
    `Single Boats bases must remain at 0.2 after refresh: ${singleAfterRefresh.normalGreenLayerLocalHeights.join(', ')}`,
  );
  assert.ok(
    singleBeforeRefresh.normalNormalizedGreenLayerGaps.length > 0
      && singleAfterRefresh.normalNormalizedGreenLayerGaps.length > 0
      && Math.abs(
        singleAfterRefresh.normalNormalizedGreenLayerGaps[0]
          - singleBeforeRefresh.normalNormalizedGreenLayerGaps[0],
      ) <= Math.max(0.002, singleBeforeRefresh.normalNormalizedGreenLayerGaps[0] * 0.01),
    'Single layerGap / scale.y must remain constant within 1% after refresh',
  );

  // Reproduce the real regression reported from DevTools: switching away
  // from Boats and back used to install Babia while object3D.scale.y still
  // carried the previous contained chart scale. Its first synchronous layout
  // produced thin bases and serialized the component as babia-boats="".
  assert.equal(
    await page.evaluate(() => window.CodeXRProjectEvolutionHarness.switchSingleChart('bars')),
    true,
  );
  await page.waitForTimeout(1800);
  assert.equal(
    await page.evaluate(() => window.CodeXRProjectEvolutionHarness.switchSingleChart('boats')),
    true,
  );
  await page.waitForTimeout(4500);
  const singleAfterChartRoundTrip = await page.evaluate(
    () => window.CodeXRProjectEvolutionHarness.updateStatus(),
  );
  assert.match(singleAfterChartRoundTrip.normalChartHtml, /babia-boats="[^"]*from: tree/);
  assert.match(singleAfterChartRoundTrip.normalChartHtml, /zone_elevation: 0\.01/);
  assert.doesNotMatch(singleAfterChartRoundTrip.normalChartHtml, /babia-boats=""/);
  assert.ok(
    singleAfterChartRoundTrip.normalGreenLayerLocalHeights.length > 0
      && singleAfterChartRoundTrip.normalGreenLayerLocalHeights.every(
        (height) => Math.abs(height - 0.2) <= 0.002,
      ),
    `Single Boats bases must start at 0.2 after a chart round-trip: ${singleAfterChartRoundTrip.normalGreenLayerLocalHeights.join(', ')}`,
  );
  assert.equal(singleAfterChartRoundTrip.normalBoatsStyle.zoneElevation, 0.01);
  await page.evaluate(async () => {
    await window.CodeXRProjectEvolutionHarness.switchMode('project-evolution');
  });
  await page.waitForTimeout(500);

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
