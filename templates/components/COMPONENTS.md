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
  - Scene-level `codexr-pointer-policy` component: guarantees exactly ONE pointer raycaster is enabled at a time — mouse cursor on desktop, gaze cursor (`#gazeCursor` under `#head`) in VR without controllers, and with controllers **the laser of whichever hand you last used** (trigger, button or stick promotes it; right is only the initial default). Babia's legend show/hide shares one implicit global, so a second live pointer corrupts it; this policy is what keeps legends hover-only and single-sourced. Re-neutralizes the inactive controller after every `laser-controls` cursor/raycaster injection.
- `codexr/immersive-rig/codexrImmersiveRigRuntime.js`
  - Rig-level `codexr-immersive-rig` component, two small jobs: (1) turns `fly` on for `movement-controls` for the duration of any immersive session (VR or AR) and restores it on exit — desktop stays ground-based; (2) on entering **AR** only, recenters the rig at `(arX, arZ)` facing −Z, so the pedestal, controller and screens land in the user's own room instead of metres away, restoring the desktop pose on exit. It never touches the rig's y — **locomotion and height are not this component's business**. VR/AR locomotion is entirely native `movement-controls`/`gamepad-controls` from aframe-extras (left stick walks, right stick turns, both by quaternion — no custom vector math). Eye height lives once, permanently, on the scene template's rig position: A-Frame's `look-controls` only ever zeroes/restores the *camera* entity for a real headset session, never the rig, so a height set on the rig survives every enter-vr/exit-vr untouched.
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
  - Collision bumpers: look-at, drag and resize stop at the room shell (bounds derived from the `codexr-room` entity, `collisionBounds` override) and at other screens; dragging slides along obstacles. `collisionEnabled: false` opts out.
  - Media transport is chosen per viewer: same network → direct WebRTC; through the
    tunnel → frames relayed by the server (`relayTransport.js` part, VP8/Opus via
    WebCodecs, JPEG images where WebCodecs is missing). A viewer only reports `live`
    once a real frame is painted, and a direct connection that delivers nothing for
    6 s falls back to the relay.
  - The relay encodes **once** for the whole audience: extra viewers only ask for a
    keyframe. Quality follows the audience size (the same encoder is reconfigured,
    never duplicated) and three temporal layers let the server thin the stream for a
    congested viewer alone. There is no viewer cap — see `docs/CLOUDFLARE_REMOTE_ACCESS.md`
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
3. `codexr/pointer-policy/codexrPointerPolicyRuntime.js` (scene-level pointer arbitration, before anything that assumes pointers), then `codexr/immersive-rig/codexrImmersiveRigRuntime.js` (fly toggle + AR recenter; must be registered before the user can enter an immersive session).
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
