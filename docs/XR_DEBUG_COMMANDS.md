# CodeXR XR Debug Commands

## Command catalog

Every generated XR scene exposes a general browser-console catalog:

```js
CodeXR.help();
```

It prints grouped tables with each command, a short explanation and whether
the command is available in the current scene. The returned array can also be
inspected programmatically. Existing `CodeXRDebug` and `CodeXRChartDebug`
APIs remain compatible.

Dependency scenes additionally expose:

```js
CodeXRDependencyGraphRuntime.start();
CodeXRDependencyGraphRuntime.openModeSelector();
CodeXRDependencyGraphRuntime.openDirectory("src/tools");
CodeXRDependencyGraphRuntime.openFile("src/tools/parser.ts");
```

Paths are project-relative and are validated by the server before file
analysis. Console navigation changes the same shared scope as the XR panel.

## Previewing AR and VR from a desktop browser

You do not need a headset to check how a scene is laid out in each immersive
mode:

```js
CodeXRDebug.simulateAR();      // hides the room and the environment, brings you to the pedestal
CodeXRDebug.simulateVR();      // keeps the full room, exactly as a headset would show it
CodeXRDebug.exitSimulated();   // back to the desktop view
```

These set the same scene states and fire the same events A-Frame uses around a
real session, so everything that reacts to them really runs: the room and
environment disappear in AR while the pedestal, charts, panels and screens
stay, the rig recenters in front of the table, and the pointer policy hands
over between mouse, gaze and controller lasers.

**What they cannot show you.** There is no WebXR session behind them, so there
is no headset pose, no stereo rendering and no camera passthrough — in AR the
background is simply empty instead of your room. Use them to answer *what is
hidden and where do I end up*; for the rest use a WebXR emulator (Chrome
DevTools' **WebXR** panel, or the *Immersive Web Emulator* extension, which
also emulates controller thumbsticks) or a real device. There is a full
walkthrough of the emulator, in Spanish, in
[`TUTORIAL_EMULADOR_WEBXR.md`](TUTORIAL_EMULADOR_WEBXR.md).

`CodeXRDebug.status()` reports the active mode (`ar`, `vr` or `desktop`) while
you are in there.

### Controller input

Locomotion is A-Frame's native `movement-controls`/`gamepad-controls` (from
aframe-extras): the **left** stick moves — flying toward wherever the camera
looks while a VR/AR session is active — and the **right** stick turns. It
polls the WebXR gamepads directly, so exercising it needs an emulator (or a
headset); there is no console event to fake a stick.

Pointing is event-driven and CAN be exercised from the console:

```js
// Hand the pointer to a controller (it also happens on any real use of it)
document.querySelector('#leftController').emit('triggerdown');
```

## Visualization status

Every generated XR chart exposes `window.CodeXRDebug` in the browser console.
It complements the chart movement tools documented below.

```js
CodeXRDebug.status();
```

The command prints and returns FPS, P95 frame time, target FPS, render quality,
desktop/VR/AR mode, dependency density, visible graph counts, mappings,
selection, animation state and Three.js renderer statistics.

Continuous console monitoring:

```js
CodeXRDebug.watch(1000);
CodeXRDebug.stopWatch();
```

Optional desktop HUD:

```js
CodeXRDebug.hud(true);
CodeXRDebug.toggleHud();
```

The HUD is disabled by default and is hidden automatically while the scene is
in VR or AR. It does not collect telemetry.

Command summary:

```js
CodeXRDebug.help();
```

## Chart movement

This document describes the browser-console API exposed by `window.CodeXRChartDebug` in XR chart visualizations.

## Quick start

```js
CodeXRChartDebug.enable();
```

Then middle-click a chart to activate debug mode and show the XYZ gizmo.

Direct activation without middle-click:

```js
CodeXRChartDebug.enable("bars");
CodeXRChartDebug.enable("#my-chart");
CodeXRChartDebug.enable("[babia-bars]");
```

## Supported target formats

`enable(target)` and `select(target)` accept:

1. Chart ID

```js
CodeXRChartDebug.enable("my-chart-id");
CodeXRChartDebug.enable("#my-chart-id");
```

1. Chart type alias (first match on page)

- `bars`
- `barsmap`
- `cyls`
- `cylinders`
- `cylsmap`
- `pie`
- `donut`
- `doughnut`
- `bubbles`
- `boats`

```js
CodeXRChartDebug.enable("pie");
```

1. CSS selector

```js
CodeXRChartDebug.enable("[babia-bars]");
CodeXRChartDebug.select(".chart-to-adjust");
```

## Controls in XR

- Middle-click chart: select/toggle debug mode for that chart.
- Left-click gizmo arrows: move active chart by the configured positive step on that axis.
- Right-click gizmo arrows: move active chart by the configured negative step on that axis.
- Middle-click active chart again: deactivate debug mode and print final coordinates.

## API reference

Invoke methods with parentheses. For example, use `CodeXRChartDebug.listCharts()` to execute the command. Writing `CodeXRChartDebug.listCharts` only prints the function reference in the browser console.

### `enable(target?)`

Enables debug mode. If `target` is provided and resolved, it selects and activates that chart immediately.

Returns: `void`

### `disable()`

Disables runtime-level debug mode and deactivates any active chart.

Returns: `void`

### `toggle()`

Toggles runtime-level debug mode.

Returns: `void`

### `select(target)`

Selects a chart target and activates chart debug mode. If runtime is disabled, it enables it first.

Returns: `boolean` (`true` when chart found and activated)

### `deactivate()`

Deactivates active chart debug mode without disabling the full runtime.

Returns: `void`

### `listCharts()`

Lists detected charts in console, with index, id, and chart type.

Returns: `Array<{ element, component, type, id }>`

### `getActiveChartId()`

Returns active chart id or `null`.

Returns: `string | null`

### `isEnabled()`

Returns runtime enabled state.

Returns: `boolean`

### `setStep(axis, value?)`

Sets the movement step for one axis. The first argument is required and must be `"x"`, `"y"`, or `"z"`. The second argument defaults to `0.25` and can be any numeric value, including negative values.

Returns: `number | null`

### `getState()`

Returns a serializable runtime snapshot.

Returns: `{ enabled, step, activeChartId, debugActive }`

### `restoreState(snapshot)`

Restores a snapshot generated by `getState()`.

Returns: `void`

### `getActiveChart()`

Returns active chart element.

Returns: `HTMLElement | null`

### `getActiveChartPosition()`

Returns active chart world coordinates.

Returns: `{ x, y, z } | null`

### `actualScale()`

Returns the current scale of the active chart and prints it in console.

Returns: `{ x, y, z } | null`

### `actualDimensions()`

Returns the current 3D size of the active chart and prints it in console.

Returns: `{ width, height, depth } | null`

### `actualWidth()`

Returns the current width of the active chart.

Returns: `number | null`

### `actualHeight()`

Returns the current height of the active chart.

Returns: `number | null`

### `actualDepth()`

Returns the current depth of the active chart.

Returns: `number | null`

### `scale(x, y, z)`

Sets the scale of the active chart using three numeric values.

Returns: `{ x, y, z } | null`

### `setPosition(x, y, z)`

Sets the world position of the active chart using three numeric values.

Returns: `{ x, y, z } | null`

### `setFlight(enabled)`

Enables or disables fly mode in the XR rig (`#rig`) by updating `movement-controls`.

Returns: `boolean | null`

### `toggleFlight()`

Toggles fly mode in the XR rig (`#rig`).

Returns: `boolean | null`

### `getRigPosition()`

Returns the world position of `#rig`.

Returns: `{ x, y, z } | null`

### `getCameraPosition()`

Returns the world position of the active camera.

Returns: `{ x, y, z } | null`

### `getUserPosition()`

Returns both rig and camera world positions in one object.

Returns: `{ rig: { x, y, z } | null, camera: { x, y, z } | null } | null`

### `teardown()`

Disables runtime and detaches listeners.

Returns: `void`

### `commands()`

Prints command summary in console.

Returns: `string[]`

### `help()`

Prints detailed usage help and examples in console.

Returns: `void`

## Common workflow

```js
CodeXRChartDebug.enable("bars");
CodeXRChartDebug.setStep("x", 0.25);
CodeXRChartDebug.setStep("y", -0.1);
CodeXRChartDebug.getActiveChartPosition();
CodeXRChartDebug.actualDimensions();
CodeXRChartDebug.actualWidth();
CodeXRChartDebug.actualHeight();
CodeXRChartDebug.actualDepth();
CodeXRChartDebug.actualScale();
CodeXRChartDebug.scale(1.25, 1.25, 1.25);
CodeXRChartDebug.setPosition(2, 1.5, -3);
CodeXRChartDebug.setFlight(true);
CodeXRChartDebug.getUserPosition();
// click gizmo arrows in XR
CodeXRChartDebug.deactivate();
```

## Troubleshooting

- If no chart is selected, run `CodeXRChartDebug.listCharts()` to inspect available targets.
- If `enable(target)` does not find a chart, verify id/selector exists in the generated scene.
- If you only want interactive selection, use `CodeXRChartDebug.enable()` with no arguments.

## Boats: visualize table and height bands

Paste this snippet in browser console while an XR scene with boats is loaded.

```js
window.CodeXRBoatsDebugBands = window.CodeXRBoatsDebugBands || {
  _els: [],
  _cleanup() {
    this._els.forEach((el) => el && el.parentNode && el.parentNode.removeChild(el));
    this._els = [];
  },
  _mk(parent, tag, attrs) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    parent.appendChild(el);
    this._els.push(el);
    return el;
  },
  _collectLeafBoatHeights(chartEl) {
    const nodes = [...chartEl.querySelectorAll('[id^="boat-"]')];
    const leaves = nodes.filter((n) => !n.querySelector('[id^="boat-"]'));
    const candidates = leaves.length ? leaves : nodes;
    const box = new THREE.Box3();
    const size = new THREE.Vector3();
    const heights = [];
    candidates.forEach((n) => {
      if (!n.object3D) return;
      box.setFromObject(n.object3D);
      box.getSize(size);
      if (size.y > 0) heights.push(size.y);
    });
    return heights;
  },
  show(target = '[codexr-chart-containment]') {
    this._cleanup();

    const chart = typeof target === 'string' ? document.querySelector(target) : target;
    if (!chart) {
      console.warn('[CodeXR][BoatsBands] Chart not found for target:', target);
      return null;
    }

    const cmp = chart.components && chart.components['codexr-chart-containment'];
    if (!cmp) {
      console.warn('[CodeXR][BoatsBands] codexr-chart-containment component not found on target.');
      return null;
    }

    const d = cmp.data;
    const scene = chart.sceneEl || document.querySelector('a-scene');
    if (!scene) {
      console.warn('[CodeXR][BoatsBands] Scene not found.');
      return null;
    }

    const ax = d.anchorX;
    const ay = d.anchorY;
    const az = d.anchorZ;
    const tableBottomY = ay + d.revealOffsetY;

    // Envelope box (mesa target: width/depth/height)
    this._mk(scene, 'a-box', {
      position: `${ax} ${tableBottomY + d.targetHeight / 2} ${az}`,
      width: d.targetWidth,
      height: d.targetHeight,
      depth: d.targetDepth,
      material: 'color: #2bb3ff; opacity: 0.12; transparent: true; wireframe: true',
      class: 'babiaxraycasterclass'
    });

    // Min / Max building-height planes
    const hMin = Math.max(0.01, d.buildingHeightMinTarget || 0.42);
    const hMax = Math.max(hMin + 0.01, d.buildingHeightMaxTarget || 1.22);
    const tol = Math.max(0, Math.min(0.45, d.buildingHeightToleranceRatio || 0.08));
    const bandMin = hMin * (1 - tol);
    const bandMax = hMax * (1 + tol);

    this._mk(scene, 'a-plane', {
      position: `${ax} ${tableBottomY + bandMin} ${az}`,
      rotation: '-90 0 0',
      width: d.targetWidth,
      height: d.targetDepth,
      material: 'color: #22c55e; opacity: 0.22; transparent: true; side: double',
      class: 'babiaxraycasterclass'
    });

    this._mk(scene, 'a-plane', {
      position: `${ax} ${tableBottomY + bandMax} ${az}`,
      rotation: '-90 0 0',
      width: d.targetWidth,
      height: d.targetDepth,
      material: 'color: #ef4444; opacity: 0.22; transparent: true; side: double',
      class: 'babiaxraycasterclass'
    });

    const heights = this._collectLeafBoatHeights(chart);
    const minB = heights.length ? Math.min(...heights) : null;
    const maxB = heights.length ? Math.max(...heights) : null;
    const inBand = heights.filter((h) => h >= bandMin && h <= bandMax).length;

    console.table({
      chartId: chart.id || '(no-id)',
      targetWidth: d.targetWidth,
      targetDepth: d.targetDepth,
      targetHeight: d.targetHeight,
      buildingHeightMinTarget: hMin,
      buildingHeightMaxTarget: hMax,
      buildingTolerance: tol,
      bandMin,
      bandMax,
      measuredMinBuildingHeight: minB,
      measuredMaxBuildingHeight: maxB,
      measuredInBandCount: inBand,
      measuredTotal: heights.length,
      yScale: chart.object3D?.scale?.y
    });

    return {
      chart,
      measured: { minB, maxB, inBand, total: heights.length },
      band: { bandMin, bandMax },
      envelope: { width: d.targetWidth, depth: d.targetDepth, height: d.targetHeight }
    };
  },
  hide() {
    this._cleanup();
    return true;
  }
};

// Show current boats bands (first boats chart on scene)
CodeXRBoatsDebugBands.show();

// Hide overlays
// CodeXRBoatsDebugBands.hide();
```
