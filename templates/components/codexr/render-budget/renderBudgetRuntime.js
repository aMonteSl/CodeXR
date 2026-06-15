(function registerCodeXRRenderBudgetRuntime(root) {
  'use strict';

  if (root.CodeXRRenderBudgetRuntime) { return; }

  var QUALITY = ['static', 'interactive', 'full'];
  var SAMPLE_WINDOW = 180;
  var WARMUP_FRAMES = 90;
  var DOWNGRADE_WINDOWS = 2;
  var UPGRADE_WINDOWS = 5;
  var subscribers = new Set();
  var samples = [];
  var frameHandle = null;
  var lastFrameAt = null;
  var badWindows = 0;
  var goodWindows = 0;
  var framesSinceEvaluation = 0;
  var reducedMotion = root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
  var snapshot = {
    quality: reducedMotion ? 'static' : 'full',
    averageFps: 60,
    frameTimeP95: 16.7,
    targetFps: 60,
    xrSession: false
  };

  function percentile(values, ratio) {
    if (!values.length) { return 0; }
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
  }

  function getXrSession() {
    try {
      return root.document?.querySelector('a-scene')?.renderer?.xr?.getSession?.() || null;
    } catch {
      return null;
    }
  }

  function targetFps(session) {
    var rate = Number(session?.frameRate || 0);
    return rate > 0 ? rate : 60;
  }

  function publish(next) {
    var changed = next.quality !== snapshot.quality
      || next.xrSession !== snapshot.xrSession
      || Math.abs(next.averageFps - snapshot.averageFps) >= 1
      || Math.abs(next.frameTimeP95 - snapshot.frameTimeP95) >= 1;
    snapshot = next;
    if (!changed) { return; }
    subscribers.forEach(function (subscriber) {
      try { subscriber(Object.assign({}, snapshot)); } catch {}
    });
  }

  function evaluate() {
    if (samples.length < WARMUP_FRAMES) { return; }
    var averageFrame = samples.reduce(function (sum, value) { return sum + value; }, 0) / samples.length;
    var averageFps = averageFrame > 0 ? 1000 / averageFrame : 60;
    var p95 = percentile(samples, .95);
    var session = getXrSession();
    var target = targetFps(session);
    var quality = snapshot.quality;
    var healthy = averageFps >= target * .82 && p95 <= (1000 / target) * 1.65;
    var stressed = averageFps < target * .68 || p95 > (1000 / target) * 2.2;

    if (reducedMotion) {
      quality = 'static';
      badWindows = goodWindows = 0;
    } else if (stressed) {
      badWindows += 1;
      goodWindows = 0;
      if (badWindows >= DOWNGRADE_WINDOWS) {
        quality = QUALITY[Math.max(0, QUALITY.indexOf(quality) - 1)];
        badWindows = 0;
      }
    } else if (healthy) {
      goodWindows += 1;
      badWindows = 0;
      if (goodWindows >= UPGRADE_WINDOWS) {
        quality = QUALITY[Math.min(QUALITY.length - 1, QUALITY.indexOf(quality) + 1)];
        goodWindows = 0;
      }
    } else {
      badWindows = goodWindows = 0;
    }

    publish({
      quality: quality,
      averageFps: Math.round(averageFps * 10) / 10,
      frameTimeP95: Math.round(p95 * 10) / 10,
      targetFps: Math.round(target * 10) / 10,
      xrSession: !!session
    });
  }

  function onFrame(time) {
    frameHandle = null;
    if (root.document?.hidden) {
      lastFrameAt = null;
      schedule();
      return;
    }
    if (lastFrameAt !== null) {
      var elapsed = Math.max(1, Math.min(250, time - lastFrameAt));
      samples.push(elapsed);
      if (samples.length > SAMPLE_WINDOW) { samples.shift(); }
      framesSinceEvaluation += 1;
      if (samples.length === SAMPLE_WINDOW && framesSinceEvaluation >= 60) {
        framesSinceEvaluation = 0;
        evaluate();
      }
    }
    lastFrameAt = time;
    schedule();
  }

  function schedule() {
    if (frameHandle !== null || !root.requestAnimationFrame) { return; }
    frameHandle = root.requestAnimationFrame(onFrame);
  }

  function subscribe(subscriber) {
    if (typeof subscriber !== 'function') { return function () {}; }
    subscribers.add(subscriber);
    subscriber(Object.assign({}, snapshot));
    schedule();
    return function () { subscribers.delete(subscriber); };
  }

  function resetForTests(nextSnapshot) {
    samples = [];
    badWindows = goodWindows = 0;
    framesSinceEvaluation = 0;
    lastFrameAt = null;
    snapshot = Object.assign({}, snapshot, nextSnapshot || {});
  }

  root.CodeXRRenderBudgetRuntime = {
    getSnapshot: function () { return Object.assign({}, snapshot); },
    subscribe: subscribe,
    start: schedule,
    __testing: {
      percentile: percentile,
      reset: resetForTests,
      evaluateSamples: function (values) {
        samples = values.slice(-SAMPLE_WINDOW);
        evaluate();
        return Object.assign({}, snapshot);
      }
    }
  };
  schedule();
})(typeof window !== 'undefined' ? window : this);
