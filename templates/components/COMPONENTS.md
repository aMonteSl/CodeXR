# CodeXR Components Inventory

This folder contains the browser-side runtimes copied into generated CodeXR analysis scenes.

## Multi-part runtimes

Large runtimes are split into focused module files under
`codexr/<component>/<runtimeBase>/` (for example
`codexr/analysis-table/analysisTableRuntime/geometryUtils.js`), with the
concatenation order declared in that directory's **`manifest.json`**
(`{ "output": "<runtimeBase>.js", "parts": [...] }`). The first listed part
opens the runtime's IIFE/UMD wrapper, the last one closes it, and the parts in
between are plain declarations at wrapper scope. At injection time
`src/.../customComponents/runtimeAssembly.ts` (tests:
`test/helpers/runtimeAssembly.cjs`) joins them back into the single flat file
listed below, so generated scenes are unchanged. The assembler refuses orphan
`.js` files that are not listed in the manifest — when adding a part, add it to
`manifest.json` at the right position. Never re-create the flat file next to
its parts directory. Manual harnesses load assembled copies from
`test/manual/assembled/` (regenerate with
`node test/manual/buildAssembledRuntimes.cjs`).

## Shared Runtime

- `common/codexrCommonRuntime.js`
  - Global: `window.CodeXRCommonRuntime`.
  - Owns reusable UI helpers for CodeXR components: tooltip panels, camera-facing billboards, hitboxes, text compaction and entity creation.
  - Use this folder for logic that is useful to more than one component or future CodeXR graph.

- `common/codexrGitRefPickerRuntime.js`
  - Global: `window.CodeXRGitRefPickerRuntime`.
  - Shared Git-reference facility for the controller: the detection vocabulary (`describeSource`, `sourceCategory`, `filterByCategory`, type label/color) and an embeddable picker (`createPicker`) with two modes — `compare` (two slots + category tabs, e.g. historical comparison) and `sequence` (ordered multi-select with click-order badges, e.g. project evolution). Also `registerGitGatedMode` for the shared "disabled unless inside a Git repo" mode option. Historical comparison and project evolution both embed it.
  - Loads after `codexrCommonRuntime.js` and before the historical/project-evolution runtimes that consume it.
  - Keep graph-specific semantics, data models and protocol handling in the owning component.

## CodeXR Runtimes

- `codexr/pointer-policy/codexrPointerPolicyRuntime.js`
  - Scene-level `codexr-pointer-policy` component: guarantees exactly ONE pointer raycaster is enabled at a time — mouse cursor on desktop, gaze cursor (`#gazeCursor` under `#head`) **only in a REAL immersive session without controllers** (mobile AR, sleeping controllers — A-Frame sets `sceneEl.xrSession` before `enter-vr`; simulated entries never do and keep the MOUSE as the pointer, since the user is still at a desk), and with controllers **the laser of whichever hand you last used** (trigger, button or stick promotes it; right is only the initial default). The gaze cursor carries **no reticle geometry**: the white ring bothered headset users and was removed everywhere — hover feedback comes from the content itself. Babia's legend show/hide shares one implicit global, so a second live pointer corrupts it; this policy is what keeps legends hover-only and single-sourced. Re-neutralizes the inactive controller after every `laser-controls` cursor/raycaster injection. **A demoted controller keeps its `cursor` component** (inert while its raycaster is disabled): creating a cursor with `rayOrigin: entity` runs A-Frame's `cursor.resetRaycaster()`, which overwrites the raycaster's origin/direction with the bare entity axis — removing and re-adding cursors on handover is what re-aimed the laser ~40° above where a Touch controller points (found live in the WebXR emulator). Demotion also **sweeps the raycaster's rendered line one macrotask later**: A-Frame queues its line redraw with `setTimeout` on every intersecting tick and redraws without re-checking `showLine`, so the redraw queued just before a handover resurrects the beam permanently on the now-disabled raycaster (the "two lasers" ghost). And while the scene carries the **`codexr-screen-drag`** state (set by the virtual-screen runtime during a controller drag), `markUsed` hands nothing over: an active grab owns the pointer — stealing the laser mid-drag freezes the drag, and walking with the other stick during a grab is expressly supported.
- `codexr/immersive-rig/codexrImmersiveRigRuntime.js`
  - Rig-level `codexr-immersive-rig` component, four small jobs: (1) turns `fly` on for `movement-controls` for the duration of any immersive session (VR or AR) and restores it on exit — desktop stays ground-based; (2) saves the rig pose on **every** immersive entry and restores it on exit — VR and AR alike, because flying can strand the user mid-air or outside the room, from where desktop mode cannot recover; (3) on entering **AR** only, additionally recenters the rig at `(arX, arZ)` facing −Z, so the pedestal, controller and screens land in the user's own room instead of metres away; (4) on a **real WebXR session only** (detected via `sceneEl.xrSession`, which A-Frame assigns before emitting `enter-vr`; the simulate commands never set it), drops the rig's y to 0 so the device's `local-floor` pose supplies the eye height instead of stacking on the rig's desktop offset (1.75 + ~1.6 ≈ 3.35 m of floating, the first thing the WebXR emulator showed). Eye height otherwise lives on the scene template's rig position, which nothing in A-Frame rewrites — that is what keeps desktop, simulated and real entries at the same standing height. **Locomotion is not this component's business**: it is native `movement-controls`/`gamepad-controls` from aframe-extras (left stick walks, right stick turns, both by quaternion — no custom vector math). The runtime does ship two page-level compatibility patches for that native path: (a) aframe-extras gates all stick input on `gamepad.connected`, and Meta's Immersive Web Emulator leaves that flag `false` on session start (its runtime only syncs it inside a setter nothing invokes), so `gamepad-controls.isConnected` is taught to also trust the tracked-controls system's input-source list — which the WebXR Gamepads Module declares connected by definition; without it, lasers and triggers work in the emulator while both sticks are silently dead. (b) **`CodeXRStickGateRuntime`** (`claim(hand)` / `release(hand)` / `claimed(hand)`): a per-hand locomotion gate honoured inside a `getJoystick` patch — aframe-extras polls the gamepads directly, so events cannot intercept it. While a hand is claimed (today: the grabbing hand during a virtual-screen drag, whose stick pushes/pulls the screen), that hand's fixed locomotion role goes quiet (MOVEMENT reads the LEFT gamepad, ROTATION the RIGHT) and the other hand keeps working. The file also registers **`codexr-ar-fill-light`**: `aframe-environment-component` parents its hemisphere + directional lights under `#env`, which hides in AR (three.js does not descend into invisible nodes), leaving only the root ambient — every standard-material object (charts, pedestal, logo) went flat. Both scene templates declare a root-level directional light with this component: it idles at intensity 0 and only comes on (default 0.55) for `ar-mode` sessions, off again on exit, so desktop and VR looks are untouched.
  - Both scene templates declare `movement-controls` on the rig with its default `controls` list (must include `gamepad` — excluding it is what silently killed VR locomotion once) and provide the pointer entities by id (`#mouseCursor`, `#gazeCursor`, `#leftController`, `#rightController`) for `codexr-pointer-policy`.
- `codexr/analysis-table/analysisTableRuntime.js`
  - Owns the XR table, visual surface, table modes and chart containment.
  - Containment applies a per-chart fit strategy (`chartFitProfiles.js` part): `uniform` for circular charts (pie/doughnut stand rotated 90° — one factor on all axes so the disk stays circular), `planar-uniform` for row charts with flat axis labels or round geometry (x/z converge to the same scale value), per-axis for everything else.
- `codexr/xr-chart-mapping-ui/xrChartMappingUiRuntime.js`
  - Owns Field Mapping, live chart switching, contextual panel views and transactional metric mapping.
  - Feeds row-budgeted charts (everything except boats) from a top-N sliced `babia-queryjson` datasource (`chartDataSlice.js` part): ranked by the mapped magnitude, rows violating `numeric-positive` value rules filtered out, one row per Babia element key. Chart construction (rotation, base attributes, budgets) follows the generator-injected presentation profile (`#codexr-chart-base-config`), with a fallback mirror in `mappingProfiles.js`.
- `codexr/analysis-mode/analysisModeRuntime.js`
  - Owns mode switching between normal analysis, historical comparison and dependency graph.
- `codexr/dependency-graph/dependencyGraphRuntime.js`
  - Owns the dependency graph visualization, layouts, filters, navigation and dependency-specific interaction.
  - Uses `CodeXRCommonRuntime` for tooltip presentation and billboard behavior.
- `codexr/historical-comparison/historicalComparisonRuntime.js`
  - Owns historical Git source selection and two-zone comparison rendering.
- `codexr/virtual-screen/virtualScreenRuntime.js`
  - Owns a shared virtual screen and screen broadcast interaction. Also the base for screen subtypes: `contentKind: 'fixed'` + `registerContentProvider(id, build)` hosts immutable locally-rendered content (no video surface, no share button) while inheriting chrome, drag/resize, follow and the shared `screen` entity.
  - Collision bumpers: look-at, drag and resize stop at the room shell (bounds derived from the `codexr-room` entity, `collisionBounds` override) and at other screens; dragging slides along obstacles. `collisionEnabled: false` opts out. **In `ar-mode` the room-derived bounds are skipped entirely** (checked live, before the cache, so desktop/VR keep the cached shell exactly as before and an explicit `collisionBounds` override still applies): screens move freely in the user's own space instead of bumping into invisible walls. Screen-vs-screen obstacles stay on in every mode.
  - Drag depth ("grab and reach"): while a `move` drag is live, the mouse wheel steps the screen along the camera→screen axis (`dragDepthStep`), and the **grabbing controller's thumbstick** does the same continuously — the handler only records the deflection (thumbstickmoved fires on change, not while held) and the drag loop applies `controllerDepthSpeed` m/s per frame; stick forward pushes away, and stick x slides the screen sideways along `depthAxis × up` at the same speed. Depth works by shifting the interaction PLANE (that is what slides the ray-plane intersection along the ray); the lateral offset must shift ONLY the screen's reference position — a plane shifted parallel to itself leaves the intersection untouched, so routing lateral through the plane moves the screen by a tiny depth-coupled residual instead (observed live). The depth target is clamped (`dragDepthMaxLead` against bumper accumulation, `dragDepthMinDistance` so pulling stops before the user's head); the lateral target gets the same lead clamp. A controller drag also claims its hand in `CodeXRStickGateRuntime` (that stick stops walking/turning; the other hand keeps its role) and holds the scene state `codexr-screen-drag` so `codexr-pointer-policy` never hands the laser away mid-grab — both released on every endDrag path.
  - Media transport is chosen per viewer: same network → direct WebRTC; through the
    tunnel → frames relayed by the server (`relayTransport.js` part, VP8/Opus via
    WebCodecs, JPEG images where WebCodecs is missing). A viewer only reports `live`
    once a real frame is painted, and a direct connection that delivers nothing for
    6 s falls back to the relay.
  - The relay encodes **once** for the whole audience: extra viewers only ask for a
    keyframe. Quality follows the audience size (the same encoder is reconfigured,
    never duplicated) and three temporal layers let the server thin the stream for a
    congested viewer alone. There is no viewer cap — see `docs/features/CLOUDFLARE_REMOTE_ACCESS.md`
    for what it costs the host's uplink.
  - Ownership invariant: **only the sender publishes broadcast fields on the room's
    screen entity**; a viewer's connection failures stay its own. Viewers that join
    before broadcast-start are parked by the server (`viewer-waiting`) and served the
    moment it starts; a stuck viewer re-joins itself on a bounded watchdog.
  - **One screen, one broadcaster** (server-enforced: `broadcast-denied`). Role-aware
    chrome: Share only on a free screen, a green `Join · name` button on screens with
    a broadcast you are not watching, × leaves/stops per role. A leave sets a local
    `viewerOptOut` that sticks until Join (or the broadcast ends/changes hands);
    clicking shared content only shows a transient "who is sharing" note.
- `codexr/virtual-screen/codexrMultiScreenManagerRuntime.js`
  - Owns screen creation, placement and multi-screen controls.
- `codexr/collaboration/codexrCollaborationRuntime.js`
  - Owns shared presence, identity, avatars, pointers and collaboration entities.
  - Terminal disconnects show a full-page screen (`disconnectScreen.js` part) and stop
    the reconnect loop: `session-ended` (host stopped the server) and `participant-kick`.
- `codexr/avatar/codexrAvatarRuntime.js`
  - Owns avatar rendering, the bundled glTF avatar asset (auto-fitted to a human
    height), per-player colour tinting and the billboarded name tags.
- `codexr/xr-room/codexrRoomRuntime.js`
  - Owns the CodeXR room shell and local room texture assets.
  - **In AR the room must be functionally GONE, not just hidden**: `hide-on-enter-ar` only clears `object3D.visible`, and A-Frame raycasters ignore `visible` — the invisible walls kept truncating lasers and stealing hover. On entering `ar-mode` every `[data-codexr-room-part]` drops `babiaxraycasterclass` (with a `[raycaster] → refreshObjects()` sweep, since A-Frame does not watch class mutations); exiting restores the class. `rebuildRoom` re-applies the current mode, so a schema update mid-AR cannot resurrect the invisible colliders. The screen bumpers ignore the room shell in AR separately (see the virtual-screen entry).
- `codexr/guide-screen/guideScreenRuntime.js`
  - Owns the in-room user guide: a fixed-content SUBTYPE of the virtual screen (well-known id `guide`, content provider `codexr-guide`). The parent contributes chrome, drag/resize, follow/look-at, minimize and the room-shared `screen` entity; this runtime contributes the immutable guide content (the same declarative model rendered as the served `guide.html`) plus its own interactions (tabs, Guide/Data glossary toggle, pagination — local per participant).
  - Must load after `virtual-screen/virtualScreenRuntime.js` and the multi-screen manager.
- `codexr/logo/codexrLogoRuntime.js`
  - Owns the 3D CodeXR mark floating over the analysis table while it is EMPTY (table mode `selection`, which is also the transit hop while an analysis is being prepared). Extrudes contours generated offline from `resources/icon.svg` (`logoContours.js`; regenerate rather than hand-edit — `AFRAME.THREE` ships no `SVGLoader`), assembles the frame and the X/R letters on entry and takes them apart on exit.
  - Decoration only: no raycaster class (it must never swallow a click) and it lives outside `#codexrAnalysisSurface`, so the selection sweep does not own it. It reads the table's mode from `componentchanged` on `#codexrAnalysisTable` and goes completely still when `CodeXRRenderBudgetRuntime` reports `static` (also how reduced-motion arrives).
- `codexr/render-budget/renderBudgetRuntime.js`
  - Owns local FPS/render quality monitoring.
- `codexr/dependency-visual-budget/dependencyVisualBudgetRuntime.js`
  - Owns dependency graph visual density budgeting.
- `codexr/debug/codexrDebugRuntime.js`
  - Owns `CodeXRDebug` diagnostics, status, watch and HUD.
- `codexr/xr-chart-debug/xrChartDebugRuntime.js`
  - Owns legacy chart debug helpers for positioned XR charts.
- `codexr/dom-scene/codexrDomSceneCollaborationRuntime.js`
  - Owns DOM-scene collaboration glue.

## Recommended Load Order

1. Room, collaboration, avatars and virtual screens; the `guide-screen` runtime right after the virtual screen + manager (it is a virtual-screen subtype); `codexr/logo` with the room (scene decoration, no dependencies of its own).
2. `common/codexrCommonRuntime.js`, then `common/codexrGitRefPickerRuntime.js` (before the Git analyses that embed it).
3. `codexr/pointer-policy/codexrPointerPolicyRuntime.js` (scene-level pointer arbitration, before anything that assumes pointers), then `codexr/immersive-rig/codexrImmersiveRigRuntime.js` (fly toggle + pose save/restore + AR recenter + the gamepad-connected compatibility patch; must be registered before the user can enter an immersive session).
4. CodeXR charts, mapping UI, chart debug and analysis table.
5. Analysis mode and mode-specific runtimes.
6. Render budgets before visualizations that consume them.
7. Dependency graph and other CodeXR graphs.
8. Debug runtimes last.

Generated scene filenames are intentionally flat (`codexrCommonRuntime.js`, `dependencyGraphRuntime.js`, etc.) so existing analysis output remains simple and self-contained — multi-part runtimes are assembled back into these flat names at injection time.

## Shared LivePanel components (`livepanel/`)

Files under `livepanel/` are bundled by `LivePanelParser` (alphabetical order)
ahead of each LivePanel template's own script/stylesheet: `charts.js|css`,
`dataTable.js|css`, `dependencySummaryPanel.js`, `historicalPanel.js|css`, and
`panelShell.js|css` (theme toggle, SSE status indicator, notifications, the
DataTable registry and shared formatters).
