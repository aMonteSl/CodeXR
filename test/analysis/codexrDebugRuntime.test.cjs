const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(
  path.join(root, 'templates', 'components', 'codexr', 'debug', 'codexrDebugRuntime.js'),
  'utf8',
);

test('CodeXRDebug exposes status, monitoring and desktop HUD commands', () => {
  const messages = [];
  const context = {
    console: {
      log: (...args) => messages.push(args),
      groupCollapsed() {},
      groupEnd() {},
      table() {},
    },
    Date,
    setInterval: () => 17,
    clearInterval() {},
    CodeXRRenderBudgetRuntime: {
      getSnapshot: () => ({
        quality: 'interactive',
        averageFps: 54.2,
        frameTimeP95: 22.4,
        targetFps: 60,
      }),
    },
    CodeXRDependencyVisualBudgetRuntime: {
      getSnapshot: () => ({
        profile: 'dense',
        effectiveProfile: 'dense',
        score: 2.5,
        override: 'auto',
        edgeNodeRatio: 6.8,
        maxDegree: 459,
        widths: [.0025, .004, .006, .008, .01],
      }),
    },
  };
  vm.runInNewContext(source, context);

  const debug = context.CodeXRDebug;
  assert.equal(typeof debug.status, 'function');
  assert.equal(typeof debug.watch, 'function');
  assert.equal(typeof debug.stopWatch, 'function');
  assert.equal(typeof debug.hud, 'function');
  assert.equal(typeof debug.toggleHud, 'function');
  assert.equal(typeof debug.help, 'function');
  const status = debug.getStatus();
  assert.equal(status.performance.averageFps, 54.2);
  assert.equal(status.performance.targetFps, 60);
  assert.equal(status.density.profile, 'dense');
  assert.deepEqual(Array.from(status.density.widthRange), [.0025, .01]);
  assert.equal(debug.watch(500), 500);
  assert.equal(debug.isWatching(), true);
  assert.equal(debug.stopWatch(), false);
  assert.equal(debug.isWatching(), false);
  assert.ok(debug.help().every(command => command.startsWith('CodeXRDebug.')));
  assert.equal(typeof context.CodeXR.help, 'function');
  assert.ok(context.CodeXR.help().some(command => command.command === 'CodeXRDebug.status()'));
  assert.ok(context.CodeXR.help().some(
    command => command.command === 'CodeXRDependencyGraphRuntime.openModeSelector()',
  ));
  assert.ok(messages.length > 0);
});

test('CodeXR debug runtime owns the desktop-only immersive guard', () => {
  assert.match(source, /codexr-desktop-only/);
  assert.match(source, /enter-vr/);
  assert.match(source, /enter-ar/);
  assert.match(source, /exit-vr/);
  assert.match(source, /exit-ar/);
  assert.match(source, /rendererStats/);
  assert.match(source, /getDebugSnapshot/);
});

test('CodeXRDebug tolerates browsers that reject WebXR session inspection', () => {
  const scene = {
    renderer: {
      xr: {
        getSession() {
          throw new TypeError('Permissions check failed');
        },
      },
      info: {},
    },
    is() {
      return false;
    },
  };
  const context = {
    console: { log() {}, groupCollapsed() {}, groupEnd() {}, table() {} },
    Date,
    document: {
      querySelector(selector) {
        return selector === 'a-scene' ? scene : null;
      },
      getElementById() {
        return null;
      },
    },
  };
  vm.runInNewContext(source, context);

  assert.doesNotThrow(() => context.CodeXRDebug.status());
  assert.equal(context.CodeXRDebug.getStatus().performance.xrSession, false);
});
