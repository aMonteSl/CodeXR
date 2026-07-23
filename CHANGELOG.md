# Changelog

## [1.2.0] - Unreleased

### Added — in-room CodeXR guide screen + served guide.html page

- **A guide screen now furnishes the room's right corner**: a fixed "monitor" (new `guide-screen` runtime, placement configurable via `codexr-tooling-config-guide-screen`) with one tab per analysis mode — Start, Normal, Deps, History, Evolution, Tips — each explaining what the mode shows, which data/metrics it represents and how to interact. Tabs are per-user (reading pace is personal) and take the matching mode-selector colour.
- **The same guide is served as a real web page** at `/guide.html` on every analysis server: a thin styled shell that loads the very same runtime and mounts its DOM projection — one declarative content model (`GUIDE_SECTIONS`), two renderers, zero duplicated copy, and no new server routes (the session's static server picks the file up automatically). WebXR cannot texture live iframes, which is why the in-room screen renders natively instead of embedding the page.
- Wiring: `guideScreenComponentAsset.ts` (assemble + emit runtime and page), both XR parsers ship the two files with required-file checks, the scene template loads the runtime, and `COMPONENTS.md` documents the new runtime and load order.
- **Guide v2 — metric glossaries per mode.** Every analysis-mode section now carries a `metrics` glossary ({term, definition} pairs grounded in the real analysis contracts — `xr_field_schema.py` and the dependency runtime's detail models): Normal explains Complexity (CCN), complexity bands, parameters, nesting depth…; the dependency graph defines Fan-in, Fan-out, Degree, Relations, Cycle, Instability, edge Confidence and Occurrences; Historical explains reference/working-copy/delta; Evolution explains frames, timelines and playback. On the XR screen each of those sections gains a local `Guide`/`Data` sub-toggle (accent-coloured terms, resets to Guide on tab change); on `guide.html` the glossary renders as a responsive "Data represented" definition grid under the bullets — same single content model, both renderers.
- **Guide v4 — the guide screen is now a true virtual-screen subtype.** The virtual screen component gained a reusable content seam (`contentKind: 'fixed'` + `registerContentProvider(id, build)` + `contentDesignWidth`): fixed screens host immutable locally-rendered content in a scalable slot instead of the WebRTC video plane — no share button, no hidden `<video>`, broadcast fields inert — while inheriting everything else from the parent: frame/chrome, edge-drag + corner-resize with wheel depth, follow/look-at/minimize, and the room-shared `screen` entity (position/size/presentation sync with all participants). The multi-screen manager now supports *well-known screens* (`registerWellKnownScreen`; `default` and `guide`) that sync in place and are never removable remote copies, and it skips fixed screens whose provider isn't registered instead of materializing dead video screens. The guide runtime dropped its hand-rolled drag/billboard/grab-bar entirely and became a thin subtype: it registers the `codexr-guide` provider (tabs, Guide/Data, pagination — reading state stays per-user) and creates well-known screen `guide` through the parent factory. Transient parent hints (move/resize) render above fixed screens so they never cover content.
- **Guide v3 — richer content, pagination, and a movable screen.** Every section grew (movement controls, mapping confirmation, chart list, filter colour chips, Up/Root navigation, external summary portal, live comparison refresh, per-frame mapping, privacy principles…); sections that overflow one screen page now paginate with wrap-around `‹ n/N ›` controls in the bottom-right corner (page state is local and resets on tab/view changes). The screen is also **draggable like the virtual screens**: grab the `= Drag to move =` bar on top and it follows the cursor/controller ray on a camera-facing plane, scrolling pushes/pulls it along the view axis, and it yaw-faces you while moving. Placement is local furniture (each participant arranges their own guide) and can be disabled via `movable: false` in the tooling config.

### Added — collision bumpers: screens stop at walls and other screens

- **Approaching a screen made part of it disappear into the wall behind** — the look-at re-orientation (`computeFaceUserQuaternion`) was an unlimited full look-at, so a close viewer produced a steep pitch that swept the screen's far edge backward into the north wall. Screens now carry a **physical collision system**: they track the user without limits (look-at, drag, resize) until any edge would touch the room shell (walls, floor, ceiling) or **another screen** — there the motion stops like a bumper and resumes the moment the target pose comes back inside. Rotation applies as much of the look-at as fits (full target first, then shrinking slerp fractions, else hold); dragging **slides along** the obstacle (motion into it stops, parallel motion continues); resizing refuses growth that would push an edge into an obstacle (shrinking is always free). Bounds derive automatically from the `codexr-room` entity (inner faces minus a 0.05 margin) with a `collisionBounds` config override for custom scenes, and other screens register as thin oriented-box obstacles; `collisionEnabled: false` opts a screen out. The screens stay anchored on the wall (z −22) — the bumper is what keeps them out of it. Verified in the browser harness: from directly underneath, the look-at stops at ≈21° with the deepest corner at z −22.63 (wall limit −22.70), and tracking resumes to the stop boundary as the viewer backs away.

### Fixed — guide screen appeared with its bottom band cut after a reload

- **On page reload the guide could render with its bottom (footer + padding) cut off, or even duplicated.** The room server persists the `screen:guide` entity; on reload the snapshot replayed to the multi-screen manager *before* the guide registered as well-known, so the manager materialized a duplicate copy under the same DOM ids — and `buildRuntimeInitConfig` didn't pass `aspectRatio`, so that copy fell back to the broadcast 16:9 and framed the 5.6×3.5 guide content 0.35 short. Three-part fix: **well-known ids are now reserved at script load** (parent registry `reserveWellKnownScreenId`; the guide reserves `'guide'` the moment its script loads, always before any snapshot replay; the manager seeds its set from the registry), `registerWellKnownScreen` **destroys any race-materialized copy** before adopting the local runtime, and **`aspectRatio` now travels with the shared screen state** (buildSharedScreenState → ensureRemoteScreen → buildRuntimeInitConfig) so legitimately materialized fixed screens keep their proportions. Server hardening in the same family: `updateEntityTransform` no longer resurrects unknown entities from a bare transform (the rebuilt record lacked `contentKind` and clients materialized broken copies).

### Changed — the guide screen now stacks above the default screen

- The guide moved from its right-corner spot to **directly above the default broadcast screen**: same X/Z, Y derived from the shared screen config (default's half height + a 0.65 clearance band for its header buttons + the guide's half height), same wall tilt. Because the anchor is derived (via the parent's `mergeConfig`), re-anchoring the default screen moves the guide with it; the `codexr-tooling-config-guide-screen` script still overrides both position and rotation when present. The default screen's anchor was lowered from y 5 to **y 4.2** so the stacked guide (center y 7.95, top + header buttons ≈ 10.04) keeps ~0.9 of clearance under the room ceiling — at y 5 the guide's top ran flush against the ceiling slab and its upper band was visually clipped.

### Changed — Virtual screens control panel: redesigned, richer, and correct

- **The wall panel was overlapping its own heading with the first row, offered Del on the guide screen (killing it until reload), showed a meaningless `| idle` for fixed screens, and wasted most of its surface.** Reworked end to end: constant-driven top-anchored layout (`PANEL_LAYOUT`) whose backing plane resizes to the row count; rows gained a **kind accent chip + tag** (Broadcast blue / Fixed cyan / local Screen violet / Remote amber), a white name line and a muted live-status line (`sharing`/`live`/`viewing`/`idle`, current width in metres, `minimized` flag, and `by {owner}` on remote rows via the participant registry). Each row now offers **Bring + Min/Exp** (toggles the room-shared presentation mode) and **Del only for managed screens** — well-known screens (default, guide) are room furniture and never deletable. The 350 ms refresh poll is now **signature-gated**: the panel DOM only rebuilds when a screen's state actually changes, ending per-tick entity churn.

### Fixed — dragging a screen no longer "slices" everything it passes over

- **While dragging a virtual screen across other components, everything behind it looked cut along a straight diagonal line** (including the dragged screen's own frame), healing on release. The near-invisible raycast planes (`opacity: 0.001; transparent: true`) **wrote to the depth buffer**: the 28×18 camera-facing drag plane clipped every transparent object behind it exactly along its intersection line. Both screen utility planes (drag plane + interaction surface) and the dependency panel's three invisible `‹ label ›` click segments now carry `depthWrite: false` — the same pattern code-xr-boats already used for its invisible metric envelopes. Verified at pixel level in the browser harness: a transparent panel behind the visible drag plane renders through it, force-restoring `depthWrite: true` reproduces the cut, and the fix heals it.

### Fixed — invisible screen chrome no longer blocks raycast clicks (collision polish)

- **Clicking scene controls (e.g. the analysis-mode "Normal" selector) died near a virtual screen.** A-Frame's raycaster intersects entities regardless of `visible`, and the screen chrome hid elements while keeping the `babiaxraycasterclass` — worst of all the invisible **28×18 drag plane** that every screen projects into the room, plus the minimized screen surface and every hidden button/handle. The virtual screen now enforces **raycastable ⇔ visible**: a new `setInteractive` helper drops/restores the raycast class together with visibility (and refreshes every raycaster's whitelist, since A-Frame doesn't watch class mutations); the drag plane is created without the class and only joins the raycaster's world during an active drag. Verified with A-Frame's own raycaster in the browser harness: at rest only the screen face intersects, the old drag-plane footprint is completely clear, and a minimized screen blocks nothing.
- **Dependency-graph fallback parking left raycastable ghosts**: when hiding the normal charts without the surface runtime it only toggled `visible`; it now suspends/restores the subtree's raycast classes with the same `data-codexr-raycast-suspended` marker contract as the historical-comparison runtime.

### Fixed — dependency-graph flow particles scaled inversely with distance

- **The particles travelling along edges looked smaller as you approached and bigger as you retreated.** The point shader clamped the camera distance at 40 units (`80/max(40, dist)`), and the whole interaction range of the scene sits below 40 — so particles were pinned to a constant pixel size while everything else scaled with perspective. The shader now applies true perspective attenuation for this scene's range (base size at ~6 units, pixel-clamped `1..28` so close-ups stay tasteful), documented in place.

### Added — dependency-graph flow size & speed, shared with the room

- **New `Flow size` (S/M/L/XL) and `Flow speed` (x0.5/x1/x2/x3) cycle buttons** in the dependency settings panel. Both are room-shared exactly like the `Edges:` encoding: published with `dependency-graph-settings`, validated against id whitelists and persisted by the analysis server (with defaults on `dependency-graph-start`), and broadcast so every participant sees the same particles in real time. The particle phase is now a **delta-accumulated clock** (`FLOW_BASE_SPEED` × the shared multiplier) instead of absolute time, so speed changes re-pace the flow smoothly without teleporting particles; the size drives a `pointScale` shader uniform.
- **Cleanup**: the settings panel's row Y positions (grown organically across the recent re-layouts) are now anchored in a single documented `PANEL_ROWS` map, and the panel height (6.8) lives there too — no scattered magic numbers.

### Fixed — dependency-graph edges rendered black in every encoding

- **Every edge drew black no matter which `Edges:` mode was active** (only the click-focus edges showed colour). The instanced edge batches set `vertexColors: true` on materials whose cylinder/cone geometries carry no per-vertex colour attribute, so the shader multiplied by a missing attribute and every `setColorAt` was visually ignored. The batch materials now rely on seeded **instance colours** (buffer created before first render), and `beginTransition` writes every edge's encoding colour immediately after the batches are rebuilt, so colours no longer depend on the transition loop's first frame. All four encodings now render as designed: relation-kind colours, the 5-step occurrence ramp, kind colour + width, or both.

### Changed — dependency-graph edge encodings: per-mode legends + consolidated code

- **Every `Edges:` mode now has a legend.** A single declarative legend model (`edgeEncodingLegend`) drives one render path: relation-coloured modes (`Relation type`, `Intensity width`) show the 7 kind swatches with names; intensity modes show the 5-bucket occurrence ramp with growing bars. Below it, a constant status line (`Density | Flow | Opacity = confidence`). Each relation **filter button also carries a colour chip** of its kind, so the colour language is discoverable in any mode, and the `Edges:` button's help text is now per-encoding.
- **Cleanup**: the whole edge-encoding domain (palettes, occurrence buckets, `edgeStyle`, encoding catalogue, legend models) was consolidated into a new runtime part `dependencyGraphRuntime/edgeEncoding.js` — previously spread across four files — with regression tests for the black-edge fix and the legend contract.

### Changed — Code-XR legends: multiple non-overlapping cards + a compact, richer style

- **Legends (the floating node/edge detail cards) were redesigned to be compact, information-dense, and elegant.** The shared legend runtime (`codexrCommonRuntime.js`, used by every Code-XR surface) now draws a left type-colour accent bar, an accent-tinted frame, a header with a divider, and a **two-column metric grid** instead of four stacked sentences — smaller overall while showing more. The dependency-graph node legend now surfaces Fan-in, Fan-out, Degree, Relations, Cycle, Lines and **Instability** (`Ce/(Ca+Ce)`, a standard dependency-health metric), colour-accented by the node's type; edge legends show kind, `source → target`, confidence and occurrences.
- **You can now pin several legends at once and they never overlap.** The dependency graph tracks a bounded set of pinned selections (oldest evicted past a cap) instead of a single one; every pinned legend (plus a transient hover legend) is placed into a non-overlapping grid above the graph via a new shared `CodeXRCommonRuntime.legendSlotPosition(index, count)` primitive, each with a leader line to its node/edge. Node highlighting, halos and edge dimming now reflect the **union** of all pinned selections. Verified via a component-level harness (multiple pins → measured zero card–card overlap, one connector each, correct cleanup) plus a style mock; `npm test`, `npm run test:xr-mode-harness`, `npm run compile` green.
- **Legends follow the user.** All cards hang off one *legend board* that yaw-billboards toward the camera as a rigid group (new shared `CodeXRCommonRuntime.faceCameraYaw` — upright, rotation around Y only), so walking behind the graph turns the whole arrangement to face you while the cards' relative layout — and therefore the no-overlap guarantee — never changes. Leader-line anchors are re-projected into the rotated board's space, and the scope breadcrumb yaw-follows too. Verified from a behind-the-graph camera in the component harness (board yaw ≈ 152°, cards readable, connectors correct).

### Changed — dependency-graph: the scope path stays readable when a detail card opens

- **The graph's persistent path label (`Folder: …` / `File: …`) is no longer hidden by the detail card.** The label sat at a fixed height (local y=1.52) directly in the band the floating node/edge card occupies (anchored at `graphTopY + 0.92`, lower edge ≈1.33, taller with a navigate button); because the card billboards toward the camera and renders with `depthTest:false` (always on top), it swept over and covered the path from some angles. The label is now wrapped in a movable group with a dark contrast chip and, whenever a card becomes visible (hover or pin), it smoothly dodges (~220 ms) to a low, forward "table-edge" breadcrumb position clear of the card, returning home when the card hides. The dodge is tweened deterministically in the component's `tick` (not the A-Frame `animation` component, which did not re-fire reliably), and every re-render prunes any breadcrumb that isn't the tracked one so a copy can never be left behind at the old position. Verified via a component-level scratchpad harness (single breadcrumb across dock/undock/re-dock/re-render and an injected-orphan case) plus a geometry mock, `npm test`, and `npm run test:xr-mode-harness`.

### Changed — dependency-graph settings panel: readable, non-overlapping layout

- **The dependency-graph controller panel is taller and its rows no longer overlap.** In dependency mode the panel now registers a `panelHeight` of `6.2` (was `4.9`) and every control row was re-spaced. Previously the long legend lines wrapped to 2–3 lines and collided with the buttons and status text beneath them (the "Shapes: …", "Colors identify … Density … Flow …", and "Hover nodes …" lines all overran their neighbours). Those three legend/hint lines are now kept to a single line (higher `wrap-count`, the panel is wide enough at background width 6.2 to stay legible) and the rows are laid out with even vertical gaps. Verified visually across the `force-3d`, `hierarchical`, and `metric-space` layouts (including the densest case: 5 mapping columns + intensity edge encoding with its colour-sample row) and the waiting state.
- **Removed the redundant yellow "Dependency graph" subtitle** that sat directly under the panel's "Dependencies" title.

### Fixed — visualization mode selector: "Dependency graph" did nothing on first use

- **Choosing "Dependency graph" in the XR visualization-mode panel silently never started the analysis** (the scene sat on the selector until a 20s watchdog reported "The dependency analysis did not respond"). Root cause: the dependency start flow hops to the selection view before messaging the server, and that hop disposes every registered mode. Project evolution's `disposeView` → `stop()` → `render()` chain threw a synchronous `TypeError` when the mode had never been opened (`state.references`/`state.result` are `null` until the server answers), the throw escaped the cleanup `.map()` before `Promise.allSettled` could contain it, the whole transition rejected, and — because the flow runs as `void start()` — the `dependency-graph-start` message was never sent. The server side was never at fault.
- **Fixes**: project evolution's render path now tolerates never-loaded state (`getSuggestedAutoOrderById`, `render`); the selection cleanup sweep uses `invokeSafely` so no single mode's broken cleanup can abort a transition for every other mode; and the dependency start flow sends `dependency-graph-start` even if the cosmetic selection hop fails (the server's authoritative broadcast is what really drives the scene). Regression tests cover all three layers (`projectEvolutionRuntime`, `analysisModeMegatest`, `dependencyGraph` test files), each verified to fail against the pre-fix code.

### Fixed — table controller (Field Mapping panel): reliable access to the analysis selector

- **The analysis-type selector could permanently disappear from the controller panel.** Feature runtimes registered their panel views (analysis selector "V" button, dependency settings, historical selection, project evolution) by polling the controller with capped retries (3s for the selector, 2s for historical) — on a slow-loading scene the cap expired and the view was silently lost forever, leaving no way to switch between analyses. View registration is now event-driven: the controller exposes `whenPanelReady(callback)` (fires immediately once its panel exists, queues otherwise) and every consumer registers through it.
- **The controller now bootstraps deterministically**: `autoInit` waits for the A-Frame scene's `loaded` event before building panel entities (attaching mid-load could wedge the scene's load pipeline), and keeps re-trying while its tooling config has not appeared yet instead of giving up on the first attempt.
- **The controller's extension contract is documented in the source** (view registry, controller-view maps, how to add a new analysis surface), and a new Playwright runner (`npm run test:xr-mode-harness`) walks the real user path end to end: header button opens the analysis selector, each analysis mode is entered from it (dependency graph, historical comparison, back to normal analysis), and the Field Mapping chart selector stays interactive.

### Fixed — analysis table (pedestal) containment status and rescaling robustness

- **The table's status readout no longer freezes on a stale message.** The warning surface ("The chart is still rebuilding its geometry", "No chart detected", …) was only updated when an external caller happened to sample the diagnostics, so a message captured mid-rebuild stayed on the table forever even after the chart settled. The containment component now drives the readout itself: every lifecycle transition (normalize success, waiting-geometry, steady-fit promotion, chart removal) and the periodic maintenance tick request a coalesced refresh, and graced states keep re-sampling on their own — the displayed message always converges to the live chart state.
- **Transient states no longer flash as errors.** A chart that is (re)building its geometry — normal during initial load and every re-analysis — was classified with the same severity as a genuinely invalid chart. Rebuilding (and brief no-chart gaps during mode transitions) are now graced: nothing is shown unless the state persists past the grace window, and then as a warning, not an error. Invalid axis values remain an immediate error.
- **A pre-init `renormalize()` call no longer wedges the containment component.** External calls (e.g. `renormalizeAll`) reaching the component before A-Frame ran `init()` corrupted the normalization generation counter (`NaN`), after which every normalization attempt aborted silently — leaving charts unscaled and diagnostics stuck. All public entry points now bootstrap the component state idempotently first.
- **XR containment harness now exercises the real machinery**: its initial render fired on window `load`, before the A-Frame scene finished loading, which wedged entity initialization (no component `init`/`tick`, so bands, PID and guards never ran in the harness). Both the harness bootstrap and the Playwright runner now wait for the scene's `loaded` event, and the runner gained a warning-stability scenario: initial render, re-analysis-style data updates, brief and persistent geometry gaps, and recovery — asserting the X/Z/height ratios stay inside the containment bands and the warning surface shows nothing stale at every step.

### Internal — templates refactor (no behavior change)

- **Every oversized browser runtime split into ordered part files.** The ten 1,100–3,900-line runtime files under `templates/components/codexr/` (analysis table, virtual screen, dependency graph, mapping UI, analysis mode, historical comparison, project evolution, chart debug, collaboration, boats prototype) now live as cohesive 100–500-line module files under `codexr/<component>/<runtimeBase>/` (natural names — `geometryUtils.js`, `webrtcPeers.js`, `tooltips.js`, …), with the concatenation order declared in each directory's `manifest.json`. A shared assembler (`customComponents/runtimeAssembly.ts`, test mirror `test/helpers/runtimeAssembly.cjs`) validates the manifest (missing or orphan parts fail loudly) and concatenates each set back into the exact flat file generated scenes have always shipped — the split was verified byte-identical per runtime, so generated analysis output is unchanged. Component assets now delegate to the assembler; manual XR harnesses load assembled copies from `test/manual/assembled/` (built automatically by the harness runners, or via `node test/manual/buildAssembledRuntimes.cjs`).
- **LivePanel templates deduplicated via a shared page shell** (`templates/components/livepanel/panelShell.{js,css}`): the theme toggle (both panels now share one stored preference, `codexrLivePanelTheme`), the SSE status indicator (now class-styled in both panels), notification toasts, the DataTable registry and shared formatters moved out of the two template scripts into one implementation. Both template mains are now well under 1,000 lines.
- Convention documented in `templates/components/COMPONENTS.md` ("Multi-part runtimes"); no file under `templates/` exceeds 1,000 lines anymore.

### Fixed — `?`-stripping corruption in the project-evolution runtime and XR harnesses

- **Project evolution runtime (ships in XR scenes): ~60 misplaced or missing optional-chaining guards restored.** The historical `?`-stripping tooling incident had left the runtime guarding methods instead of objects (`refs.status.setAttribute?.(…)`, `state.pendingFrameApply.reject`, `client().sendMessage?.(…)`, `chart.isConnected` before the null check, `root.CodeXRAnalysisModeRuntime.transitionTo?.(…)`, …), which throws whenever the object itself is absent — crashing playback paths (`seek`, `requestBridgeFrame`, `clearMovie`, `applySharedState`) when the panel, collaboration client, or playback entities do not exist yet. All guards moved onto the objects (`refs.status?.setAttribute(…)` etc.), matching the pattern the historical-comparison runtime already used.
- **Both Playwright harnesses repaired and green again.** 14 stripped `?` characters restored across `test/runners/run-project-evolution-harness.cjs` (bridge/query URLs lost their `?query` separators → the bridge validation hit a 404) and the containment/evolution harness HTMLs (ternaries collapsed into syntax errors, so the pages never booted). `npm run test:xr-harness` and `npm run test:project-evolution-harness` now pass end to end (Chromium launch, scene boot, frame stepping, movie playback, screenshots).
- **Harness runners no longer hang on failure**: assertion failures used to leave the Playwright browser (and http server) open, so a red run looked like an endless hang; both runners now close the browser in a `finally` and exit non-zero.

### LivePanel

- Added a Dependency Summary section to the directory/project LivePanel. It now runs automatically on page load alongside the classic analysis, so every dependency metric is present from the start; the button is now just a manual "Refresh".
- Added a same-origin `POST /api/dependency-graph/summary` REST endpoint on the existing local HTTP/HTTPS analysis server, reusing `DependencyGraphService` (gate relaxed to allow LivePanel directory/project analyses alongside XR).
- Summary shows node/edge/external-dependency/cycle/warning counts, top fan-in and fan-out tables, an external-dependencies table, cycle groupings, edge-confidence and language/relation capability breakdowns, and warnings — all derived client-side from the existing dependency-graph dataset.
- Reworked the directory LivePanel presentation: every data table (classic file details and all dependency tables) now has a fixed maximum height with internal scrolling and a pinned header row, so long lists such as External Dependencies no longer stretch the page into an endless scroll. The theme toggle renders a sun/moon SVG icon instead of the words "Dark"/"Light", and the page `<body>` now uses `data-theme` so the dark-theme CSS applies immediately on load (no flash of the wrong theme).
- Unified every list in the directory LivePanel onto one shared `DataTable` component (`templates/components/livepanel/dataTable.{js,css}`): File Details, Most Complex Files, the dependency rankings, External Dependencies, Cycles, Confidence Breakdown and Capability Breakdown now share the same look and behavior — a search box, a "Sort by" menu and clickable sortable headers, a fixed-height internally-scrolling body, and consistent badges. Cycles and Confidence Breakdown are now proper tables. `LivePanelParser` bundles the shared component ahead of each template's own script/stylesheet into `main.js`/`style.css`, so future LivePanel views reuse it for free. Removed the superseded per-table markup, styles and scripts.
- The Dependency Summary no longer has a manual refresh button. It is now recomputed as part of the existing incremental re-analysis chain: when a watcher detects changes, the directory LivePanel dependency graph is re-derived using the same technique as the classic analysis (only the changed files are re-extracted, via the dependency extraction cache), and the result is pushed to the panel over SSE (`dependency-updated`), which reloads the freshly written `dependency-graph.json`. Implemented as a "background refresh mode" in the analysis refresh coordinator so the dependency graph stays in lockstep with the classic view without being the active visualization.
- The directory LivePanel header now shows the analyzed-file count and the analysis timestamp as subtle icon chips instead of solid blocks. The "Live Updates" indicator briefly shows "New data received" when an update arrives, then returns to "Live Updates".
- **Historical Comparison in LivePanel (file and directory)**: both panels gain a Historical Comparison section that reuses the XR comparator's server-side engine. Pick any two versions of the analyzed target — the live working copy and/or any local Git branch/tag/commit — and compare: added/removed/modified/unchanged counts, a left-vs-right metric totals chart, and a searchable per-item table with per-metric deltas. Comparison runs asynchronously (`GET /api/historical/references`, `POST /api/historical/compare` → progress and results over SSE); a comparison with a working-copy side stays live — every incremental re-analysis refreshes it automatically.
- **File LivePanel modernized to the directory panel's standard**: `data-theme` theming with the sun/moon icon toggle and no wrong-theme flash, header info chips, a "Most Complex Functions" severity-colored bar chart, the functions list as the shared searchable/sortable DataTable, and the Dependency Summary section (file sessions now seed and background-refresh their dependency dataset too — the analyzer resolves the surrounding project root).
- **Self-contained charts — Chart.js CDN removed**: LivePanel pages no longer load `https://cdn.jsdelivr.net/npm/chart.js` (a network dependency that broke offline use and violated the no-network-without-consent principle). New dependency-free shared chart components (`templates/components/livepanel/charts.{js,css}`) render SVG/HTML donut, bar, and paired-comparison charts with hover tooltips, value+share legends, a CVD-validated palette, and pure-CSS light/dark theming (theme toggle restyles charts with no re-render).
- The Dependency Summary rendering was extracted into a shared component (`dependencySummaryPanel.js`) used by both templates, so the file and directory panels share one implementation of the tiles, rankings, cycles, confidence and capability tables.
- **File comparisons are strictly file-scoped**: a file analysis compares only the analyzed file between versions — the comparator materializes just that one file from the Git reference and compares it function by function (each row in "Changed Items" is a function of the file, labeled by function name, with per-metric deltas). The version pickers hide any branch/tag/commit where the file does not exist (deleted, renamed, or not yet created there), via a read-only `git cat-file -e` probe, and a raw API request against such a version is refused (`comparison-target-missing-in-version`). Directory comparisons keep every reference and compare file-by-file — per-file presence is what the comparison itself reports.
- **Visual redesign of both LivePanel dashboards**: compact left-aligned header, small-caps section labels with hairline rules, quiet hairline metric tiles with tabular figures (accent colors reserved for semantic values), refined light/dark palettes matching the chart surfaces, and removal of the decorative shadows/hover-lift effects and duplicated legacy style blocks.

#### Fixed

- Fixed a widespread pre-existing regression where literal `?` characters had been dropped from ~20 TypeScript and JavaScript files (optional chaining, ternaries, regex escapes), breaking XR HTML generation (`TypeError: candidateFields.includes is not a function`), Git timeline parsing, and null-safety across the analysis-mode, analysis-table, dependency-graph, historical-comparison, project-evolution, and code-xr-boats XR runtimes. `npm run compile`, `npm run typecheck`, `npm run lint`, and the full unit test suite (305/305) are green again. Not caused by this release's LivePanel work; unrelated regression from an earlier commit.
- Fixed LivePanel analyses (file and directory) failing to launch their server while XR launches always worked, even though both share the same launch pipeline. `LivePanelParser` resolved the extension's install path via a fragile global lookup (`vscode.extensions.getExtension`) instead of the `ExtensionContext` already used by every other parser, throwing `Extension amonteSl.code-xr not found` and aborting the launch. It now uses `context.extensionPath` directly, matching XR/DOM.
- Fixed LivePanel server launches still aborting with `historical-comparison-session-unavailable`. The shared `HttpServer` was eagerly constructing the XR-only feature services (historical comparison, project evolution) for every session, and their constructors throw for non-XR sessions. Server launching is now truly common across analysis modes: a single `resolveAnalysisServerCapabilities(mode)` table (`src/servers/runtime/analysisServerCapabilities.ts`) declares which optional feature services each mode's server exposes, and `HttpServer` attaches only those — XR gets all of them, LivePanel gets the dependency-graph summary, DOM gets none, and any future analysis type gets a working server by default. Adding a mode is a one-line change to that table.

### Collaboration 2.0

- Added authoritative host and guest roles, automatic host promotion, host transfer, connection removal, and presenter administration.
- Added persistent anonymous or custom identities, Unicode name validation, duplicate-name resolution, and six synchronized avatar skins.
- Added the independent `codexr-avatar` component with procedural fallback, pose interpolation, hands, animation selection, LOD, and distance hiding.
- Added an optional 2.16 MiB animated glTF avatar download with explicit consent, source/license disclosure, and browser caching. No avatar model is bundled in the VSIX.
- Added a central `COLLABORATION` section in the CodeXR sidebar for identity, display name, avatar color, and the optional model download.
- Stores the optional avatar model once in VS Code global storage and reuses it across all analyses.
- Keeps roles and presentation authority internal instead of rendering collaboration controls in the scene.
- Removed participant, follow, teleport, presentation, and skin controls from the browser/XR scene while retaining the shared controller or desktop pointer ray.
- Corrected avatar facing direction and keeps the body upright when the tracked head crouches.
- Scoped collaboration identity to each CodeXR installation; direct browser connections now remain anonymous.
- Added optional cross-network collaboration through a per-server Cloudflare Quick Tunnel, disabled by default.
- Added invitation tokens, host-visible six-digit pairing codes, one-use browser tokens, session cookies, rate limits, and complete revocation when sharing stops.
- Added `Unirse a sesión remota` in `COLLABORATION` plus start, status, copy, and stop actions in `Active Servers`.
- Added Cloudflare STUN for direct WebRTC screen sharing across networks, with clear TURN limitations.
- Pinned optional `cloudflared` 2026.5.2 downloads and verifies SHA-256 before running without a shell.
- Removed procedural hand markers while glTF avatars are active and ignores untracked controllers.
- Added server, runtime, consent, packaging, and compatibility tests for the new collaboration contracts.
- Renamed visible product references from Code-XR to CodeXR while retaining the compatible `code-xr` extension identifier.

## [1.1.0] - 2026-03-21

### Plugin Optimization Update - Enhanced Performance, Stability, and Collaborative Immersion

This release promotes the latest CodeXR work to 1.1.0 because it combines reliability fixes with new XR functionality, richer analysis data, and a smarter configuration experience powered directly by the Python backend.

#### New Features & Improvements
- **Live XR Field Schema from Python**: Dimension Mapping for file and directory XR analysis now loads its available fields and value types from the Python analyzer, keeping the UI aligned with the real backend output.
- **Expanded XR Metrics**: XR file and directory analysis now expose additional metrics such as `spanLines`, `complexityBand`, `commentRatio`, `codeRatio`, `blankRatio`, `highComplexityFunctions`, `criticalComplexityFunctions`, `averageFunctionLines`, `maxFunctionLines`, `averageFunctionNestingDepth`, and `maxFunctionNestingDepth`.
- **Typed Dimension Validation for BabiaXR**: Dimension Mapping now validates field compatibility using the chart dimension constraints, preventing text fields from being assigned to numeric-only BabiaXR dimensions.
- **Improved XR Boats Hierarchy for File Analysis**: File-based XR boats visualizations now generate a synthetic `treePath` per function so BabiaXR renders visible neighborhoods while keeping one building per function and preserving the function-level analysis data.
- **Shared Workspace Inventory for Tree Sections**: Project Structure and Files by Language now share a single workspace snapshot and watcher, reducing duplicated work while keeping both views synchronized from the same inventory logic.
- **Active Analyses Quick Actions**: Active analyses now open their available actions on left-click, and each session can export its generated analysis folder for faster debugging and manual inspection.
- **Improved XR Path Normalization**: Public analysis payloads use BabiaXR-friendly paths more consistently across Windows, Linux, and macOS.
- **Generated Local HTTPS Certificates**: Default HTTPS mode now generates and reuses a self-signed certificate pair inside VS Code global storage on first startup, keeping repo PEM files out of the shipped VSIX and out of tracked runtime assets while preserving HTTPS support for WebXR.
- **Unified Multi-language Analysis Engine**: XR and LivePanel file and directory analysis now share the same Python payload contract, backed by a repo-tracked `manual_test` corpus and the new `npm run test:analysis` validation flow.
- **Unified Incremental Reanalysis Watchers**: File, directory, XR, LivePanel, and DOM HTML sessions now share the same debounce-driven watcher architecture, use mtime + size as a fast filter before validating with hashes, only re-run analysis when the content really changed, and react to the user's current debounce setting without requiring a fresh analysis session.
- **Virtual Screen Runtime for XR and DOM**: XR charts and DOM visualization scenes now include shared virtual screens that can project a native shared screen, tab, or window inside the immersive view. The panel supports creating, bringing, and deleting shared screens, move, resize, smooth depth adjustment while dragging, follow mode, an independent `look-at` mode for fixed screens that still face the user, minimize/expand, stop sharing, an auto-sized collapsible side legend, contextual hover chrome, and runtime bindings for mouse plus A-Frame/WebXR-style controller interaction.
- **Shared Screen Broadcasting with Video/Audio**: Shared screens now propagate the selected desktop, window, or browser-tab content to other connected devices in real time, including remote audio playback when the chosen source exposes audio tracks.
- **Universal XR Analysis Table Layout**: XR charts now render through a shared CodeXR containment engine that recenters each chart, keeps it inside a useful size band, and auto-rescales it across `X`, `Y`, and `Z` while stabilizing the visualization after rebuilds or remaps without requiring chart-specific layout rules.
- **In-Scene XR Mapping UI**: XR analysis scenes now include a contextual field-mapping panel near the chart, making it possible to remap chart dimensions directly inside the immersive experience without leaving XR.
- **Safe Mapping Recovery Inside XR**: XR chart remapping now applies selections tentatively, lets Babia rebuild the chart, automatically restores the last valid mapping if the resulting geometry becomes invalid, warns the user about the failed field choice, and temporarily disables the failing field/axis combination for the session so the immersive scene stays stable while the user tries another mapping.
- **Collaborative XR/DOM Room Sessions**: Connected users now share screen layout changes, Mapping UI updates, chart refreshes, and visible presence markers with server-assigned display names inside the same live collaboration room.

#### Bug Fixes
- **Faster Directory Analysis Startup and Deep XR Reliability**: Directory analysis no longer performs a full pre-scan and mass hash generation before Python starts. Large ignored folders such as `.git`, `node_modules`, `dist`, and cache directories are now pruned during the shared Python scan, `spawn ENAMETOOLONG` is avoided by not sending huge `--files` argument lists, and hash-based incremental reanalysis is still preserved after the initial run.
- **Fixed Deleted, Renamed, and Moved Files Handling During Directory Reanalysis**: Incremental directory reanalysis now matches internal system paths against the BabiaXR-normalized paths stored in `data.json`, removes only the affected entries when files disappear, and treats rename or move operations as remove + add so XR and LivePanel outputs stay in sync without leaving stale records behind.
- **Enhanced Empty File Handling in Directory Analysis**: New files created during directory analysis now appear in visualizations immediately, even if they are empty, with metrics initialized to 0 so the visualization reflects the actual file system state.
- **Fixed Windows Path Compatibility with BabiaXR**: Windows file paths are normalized before being passed to BabiaXR, converting backslashes to forward slashes and removing drive-letter prefixes so directory neighborhoods are organized consistently across Windows, macOS, and Linux.
- **Fixed Server-Analysis Closure Inconsistency**: Closing an analysis now closes its associated server more reliably through the bidirectional lookup strategy implemented in the server-analysis integration flow.
- **Hardened Python Environment Installation on Windows**:
  - Package operations inside the plugin venv now run through the virtual-environment interpreter using `python -m pip` instead of invoking `pip.exe` directly.
  - Added `ensurepip --upgrade` fallback when `pip` is missing inside the CodeXR virtual environment.
  - If `pip` upgrade fails but the venv pip still works, CodeXR now continues with a warning instead of aborting the whole setup.
  - Retry logic now removes invalid file blockers at the `venv` path before recreation, preventing `WinError 267` after forced-failure tests.
- **Fixed Startup/Reinitialize Behavior for Existing Environments**: If the CodeXR virtual environment already exists and is valid, startup and `Reinitialize Python Environment` now verify it and refresh metadata instead of reinstalling it.

#### Python Environment UI & Workflow
- Added a dedicated `PYTHON ENV` section in the CodeXR tree view with `Ready`, `Installing`, and `Error` states.
- Added `Show Python Environment Status`, `Verify Installation`, and `Reinitialize Python Environment` actions in the UI.
- Added progress, warning, and error notifications for virtual-environment setup using the VS Code extension API.
- Added guided retry behavior when setup fails, while restricting the rest of the plugin UI until recovery is completed.
- Added `CodeXR: Debug Python Environment Failure` to simulate a controlled setup failure and validate the recovery UI.

#### Validation
- **TypeScript Compilation**: clean compilation.
- **ESLint**: clean lint pass.
- **Node-Based Unit Tests**: coverage for command registration, directory reanalysis helpers, XR field schema integration, and python-environment utilities.
- **Python Backend Tests**: coverage for Windows path normalization, XR schema behavior, and XR empty-file fallback handling.
- **Manual Analysis Corpus Validation**: `npm run test:analysis` now creates a local venv, installs Lizard, analyzes the `manual_test/` fixtures, and verifies that XR and LivePanel share non-placeholder payloads.
- **HTML DOM XR Validation**: `npm run test:htmlanalysis` validates the DOM HTML visualization contract, runtime integration, and manual DOM fixtures.
- **VSIX Packaging Validation**: `npm run package:vsix` validates the release bundle and emits the installable package in `artifacts/`.
- **XR Hardware Validation Status**: this release has not yet been tested on physical VR headsets or real VR controller hardware; current XR confidence is based on desktop/browser validation plus static verification of controller-facing hooks such as `raycaster-intersected`, `thumbstickmoved`, A-Frame tracked-controller selectors, and `babiaxraycasterclass` targets.

---
## [1.0.0] - 2025-07-28

### Major Release - Version 1.0.0 

This milestone release marks the official 1.0.0 version of CodeXR with several improvements and bug fixes that enhance user experience and system reliability.

#### New Features & Improvements
- **Enhanced Dimension Filtering**: Improved chart dimension mapping to exclude string-based fields (filePath, relativePath) from numeric chart dimensions, ensuring cleaner data visualizations
- **Auto-Analysis Toggle Setting**: Added Auto-Analysis enabled/disabled configuration with persistence across sessions and watcher control system
- **Advanced Session Management**: Implemented duplicate session detection and prevention system with user notifications and clean analysis flow management
- **Smart HTML File Filtering**: Enhanced XR directory analysis to automatically filter out HTML files while maintaining full HTML support in LivePanel mode for optimal analysis workflows
- **Official Documentation Website**: Launch of the official CodeXR documentation website at https://amontesl.github.io/code-xr-docs/ with comprehensive guides, tutorials, and examples

#### Technical Architecture
- **Configuration Restructuring**: Moved auto-analysis settings to nested configuration structure for better organization and maintainability
- **Session Registry Enhancements**: Improved duplicate detection with detailed logging and null-safe session handling
- **Watcher System Optimization**: Enhanced file/directory watchers with intelligent debounce configuration and auto-analysis control
- **JSON Persistence**: Robust configuration persistence system with profile support and error recovery

#### User Experience
- **Duplicate Prevention**: Users receive clear notifications when attempting to analyze already active sessions without interrupting workflow
- **Intelligent Analysis Mode Selection**: Automatic routing of HTML files to appropriate analysis modes based on context
- **Enhanced Configuration Management**: User-friendly settings management with real-time persistence and immediate effect application
- **Comprehensive Documentation**: Complete learning resources now available through the integrated "Learn More" section

#### Documentation & Resources
- **Live Documentation Site**: Official website now active with detailed guides and tutorials
- **Enhanced Learn More Section**: Updated with direct access to comprehensive documentation and examples
- **Community Resources**: Full support documentation and troubleshooting guides now available online

This release represents a stable, production-ready version of CodeXR with all major features fully implemented and thoroughly tested.

## [0.0.9] - 2025-07-27

### Major Release - Complete Plugin Re-work

This version represents a complete re-work and modernization of the CodeXR extension with significant architectural improvements and new analysis capabilities.

#### New Features
- **Enhanced Directory Analysis**: Complete implementation of directory analysis in all forms (LivePanel and XR modes)
- **Deep Analysis Support**: Added deep analysis modes for both LivePanel and XR visualizations
- **Project Structure Navigation**: Interactive project structure view with click-to-analyze functionality
- **Expanded Visualization Dimensions**: Added new metrics and dimensions for richer data visualization
- **Advanced Data Processing**: Improved data processing pipelines with better error handling and performance

#### Major Changes
- **Rebranding**: Static Analysis is now called "LivePanel" analysis for better clarity
- **Unified Analysis Engine**: Complete re-architecture of the analysis engine for better performance and reliability
- **Enhanced XR Support**: Improved XR visualization capabilities with better metric accuracy
- **New Analysis Modes**: 
  - LivePanel (formerly Static Analysis)
  - LivePanel Deep
  - XR Analysis
  - XR Deep Analysis

#### Technical Improvements
- **Python Analysis Engine**: Redesigned Python-based analysis coordinators for better accuracy
- **Session Management**: Improved session registry and lifecycle management
- **Configuration System**: Enhanced configuration storage and user preference handling
- **Error Handling**: Better error reporting and recovery mechanisms

#### User Interface
- **Active Analyses View**: New tree view for managing active analysis sessions
- **Project Structure View**: Interactive file and directory browser with analysis integration
- **Context Menu Integration**: Enhanced right-click context menus in Explorer and Editor
- **Command Palette**: Updated command structure with clear naming conventions

#### Bug Fixes
- Fixed cyclomatic complexity calculations returning zero values
- Resolved coordinator path resolution issues in XR analysis
- Fixed directory analysis configuration not respecting user settings
- Corrected command conflicts in project structure navigation

#### Performance
- Optimized file analysis processing for large directories
- Improved memory usage in analysis sessions
- Better handling of analysis timeouts and failures
- Enhanced progress reporting for long-running operations

## [0.0.8] - 2025-07-03

### Major Analysis Engine Overhaul

This release significantly enhances the analysis capabilities with comprehensive language support, improved visualizations, and better user experience.

#### Added
- **Full Lizard-Compatible Language Support**: Enhanced analysis for all languages supported by Lizard
  - JavaScript, TypeScript, Python, C/C++, C#, Java, Ruby, Go, PHP, Swift, Kotlin, Rust
  - HTML, Vue.js, Scala, Lua, Erlang, Zig, Perl, Solidity, TTCN-3, Objective-C, Fortran, GDScript
  - Accurate metrics extraction for complexity, lines of code, and function parameters across all languages
- **New "Visualize DOM" Feature**: Comprehensive HTML file analysis
  - DOM tree structure visualization with interactive navigation
  - Automatic routing of HTML files to DOM analysis instead of Static/XR modes
  - Real-time DOM tree exploration with element details and hierarchy
- **XR Bubble Chart Visualization**: New 3D chart type for immersive data exploration
  - Multi-dimensional bubble representations of code metrics
  - Interactive 3D bubble charts with customizable sizing and color mapping
  - Enhanced spatial understanding of code complexity relationships
- **Active Analyses Management**: Real-time tracking of open visualizations
  - Dedicated "Active Analyses" section in tree view
  - Lists currently open Static, XR, and DOM visualizations
  - Prevents duplicate analysis launches for the same file
  - One-click access to reopen or close existing analyses
- **Enhanced Static Analysis Panel**: Comprehensive metrics visualization improvements
  - Added Cyclomatic Density per function for better complexity assessment
  - Completely reworked Complexity Distribution chart with improved layout and readability
  - Better visual organization of metrics with responsive design
- **Advanced Tree View Features**: Improved file organization and sorting
  - Sortable "Files by Language" section by name, lines of code, complexity, or function count
  - Enhanced file filtering and organization capabilities
  - Better visual indicators for file analysis status
- **Debounce Time Customization**: Configurable analysis timing
  - User-adjustable debounce delays for auto-analysis triggers
  - Visual indicators for pending analysis operations
  - Improved performance for large codebases with smart timing controls

#### Enhanced
- **Revamped Comment Line Counter**: Accurate multi-language comment detection
  - Precise handling of multi-line comments (/* */, =begin/=end, etc.)
  - Accurate inline comment detection for C-style (//), Ruby (#), Fortran (!), GDScript (#)
  - Language-specific string literal handling to avoid false positives
  - Enhanced docstring detection for Python with tokenizer-based analysis
- **Improved Class Detection**: Enhanced object-oriented code analysis
  - Better class counting across multiple programming languages
  - Accurate detection of nested classes and anonymous classes
  - Enhanced inheritance hierarchy analysis
- **HTML File Analysis Routing**: Intelligent file type handling
  - HTML and HTM files automatically route to DOM visualization
  - Added file extension detection to all analysis commands
  - Ensures consistent behavior regardless of user's preferred analysis mode
  - Case-insensitive extension matching for comprehensive file support
- **Active Analyses Tree View**: Real-time session management
  - Added comprehensive logging for session manager and tree provider events
  - Enhanced tree refresh mechanisms for immediate updates
  - Better error handling and debugging capabilities for analysis session tracking
  - Improved state synchronization between analysis engines

#### Changed
- **Internal Analysis Engine Refactor**: Unified architecture for better maintainability
  - Shared component reuse between XR and Static analysis modes
  - Centralized session management with consistent state tracking
  - Improved data flow between analysis engines and visualization layers
  - Enhanced modularity for easier feature additions and maintenance
- **File Watcher Optimization**: Improved performance and reliability
  - Enhanced file change detection with better debouncing
  - Reduced resource usage with smarter watcher lifecycle management
  - Improved error handling for file system events
  - Better cleanup of watchers when analyses are closed

#### Fixed
- **UI Synchronization Issues**: Resolved tree view and session management problems
  - Fixed tree refresh mechanisms for real-time updates
  - Corrected session registration and cleanup processes
  - Improved synchronization between multiple analysis instances
  - Enhanced error recovery for failed analysis sessions
- **Language-Specific Analysis Bugs**: Comprehensive fixes across supported languages
  - Corrected comment counting inconsistencies in various languages
  - Fixed class detection issues in complex object-oriented structures
  - Resolved analysis hanging during frequent auto-saves
  - Improved handling of edge cases in code parsing
- **Performance and Memory Optimization**: Enhanced resource management
  - Better cleanup of temporary files and analysis artifacts
  - Improved memory usage during large file analysis
  - Enhanced garbage collection for visualization resources
  - Optimized data structures for better performance

#### Build Process Migration to ESBuild
This version migrates the build process from Webpack to ESBuild for faster builds and improved development experience.

- **New Build Configuration**: esbuild.config.mjs with optimized settings
- **Updated Scripts**: Build and watch scripts now use ESBuild
- **Faster Builds**: Significantly reduced build times (from ~1000ms to ~20ms)
- **Better Sourcemaps**: Improved debugging experience with accurate sourcemaps
- **ES2020 Target**: Modern JavaScript output for better performance

## [0.0.7] - 2025-06-01

#### Added
- **Enhanced Live Reload System**: Complete rewrite of the live reload functionality for XR visualizations
  - Server-Sent Events (SSE) for real-time communication between VS Code and browser
  - Automatic cache-busting with timestamps to ensure fresh data loading
  - Multiple event types support for different update scenarios
  - Client-side automatic chart rebuilding without page refresh
- **Advanced Chart Configuration**: Flexible chart type and dimension mapping system
  - Support for multiple BabiaXR chart types (bars, cylinders, bubbles, donuts, etc.)
  - Custom dimension mapping for X, Y, Z axes and additional properties
  - Real-time chart type switching without server restart
  - Intelligent dimension recommendations based on data types
- **Comprehensive Environment Settings**: Full customization of XR environment appearance
  - Background color picker with real-time preview
  - Ground color customization for immersive experiences
  - Multiple chart color palettes (Blues, Business, Commerce, Flat, Foxy, etc.)
  - Environment preset selection (forest, city, space, etc.)
  - Settings accessible directly from tree view
- **Enhanced VR/AR Controller Support**: Universal controller compatibility and improved navigation
  - Support for all major VR headsets (Oculus, Valve Index, HTC Vive, etc.)
  - Left joystick movement controls for natural locomotion
  - Right joystick rotation controls for smooth turning
  - Hand tracking support for gesture-based interaction
  - Automatic controller detection and configuration
- **Advanced Analysis Configuration**: Granular control over analysis behavior
  - Visible debounce delay indicator in status bar
  - Reset to defaults button for quick configuration restoration
  - Per-analysis custom chart type selection
  - Dimension mapping persistence across sessions
- **Improved File Opening UX**: When analyzing files from the tree view, files now automatically open in the editor
  - Files open in the main column (not preview mode) for better workflow
  - Respects the configured analysis mode (Static/XR) from settings
  - Seamless integration between file selection and analysis

#### Changed
- **A-Frame Upgrade**: Updated to A-Frame 1.7.1 for enhanced performance and stability
- **Enhanced AR/VR Experience**: Significant improvements to immersive functionality
- **Live Reload Architecture**: Completely reimplemented for reliability
- **Analysis Workflow**: More flexible and user-friendly analysis process
- **Server Creation Logic**: Enhanced server startup process

#### Fixed
- **Critical Live Reload Issues**: Resolved major problems with XR visualization updates
- **Server Watch Errors**: Eliminated ENOENT errors when launching examples
- **Tree View Synchronization**: Improved tree view refresh and display
- **Analysis Command Integration**: Resolved issues with file opening and analysis
- **VR/AR Controller Issues**: Resolved compatibility problems with different headsets

## [0.0.6] - 2025-04-29

Fixed some issues of the previous version.

## [0.0.5] - 2025-04-29

#### Added
- Integrated babia-boats visualization component for enhanced 3D representation
- New parameter mapping system for more intuitive data representation:
  - Function parameters shown by area dimension
  - Lines of code represented by height dimension
  - Complexity visualized through color dimension
- Added improved file path resolution for analysis scripts to ensure compatibility across different environments

#### Changed
- Migrated from previous visualization component to babia-boats for better data insight
- Enhanced template variable system to support multiple dimensions simultaneously
- Refactored XR template to use the new parameter format
- Improved visualization mapping for complexity metrics with better color differentiation

#### Fixed
- Resolved template variable substitution issues in XR analysis
- Fixed path resolution for lizard analyzer to work reliably in all installation scenarios
- Improved error handling when analyzer scripts cannot be located
- Enhanced script discovery to support diverse installation environments

## [0.0.4] - 2025-04-27

#### Added
- Added support for multiple programming languages:
  - C++ support with full metrics analysis
  - C# integration for .NET projects
  - Vue.js analysis with HTML/JS component detection
  - Ruby support with class and method analysis
- Implemented configurable debounce system for auto-analysis:
  - User-selectable delay times (500ms to 5000ms)
  - Option to completely disable auto-analysis
  - Settings accessible directly from Code Analysis tree view
- Enhanced XR visualization experience:
  - Live updates without exiting AR/VR mode when code changes
- Added multiple analysis capability:
  - Analyze several files simultaneously
  - Consistent performance across different file types
- Added new color palettes for BabiaXR visualizations:
  - Blues, Business, Commerce, Flat
  - Foxy, Icecream, Pearl, Sunset, Ubuntu

#### Changed
- Renamed analysis commands for clarity:
  - "CodeXR Analyze File: Static" instead of "2D"
  - "CodeXR Analyze File: XR" instead of "3D"
- Improved code comment detection system:
  - New language-specific comment parsing
  - Accurate comment counting for all supported languages
  - Enhanced multi-line comment detection
- Modified Tree View structure:
  - Added settings section with debounce configuration
  - Better organization of language-specific files
- Enhanced debugging and logging system:
  - Detailed logs for Python script execution
  - Better error reporting for analysis failures

#### Fixed
- Fixed issue where comment lines were counted as 0 for newly supported languages
- Fixed issue with analysis hanging during frequent auto-saves
- Corrected class counting in complex object-oriented structures
- Fixed Tree View refresh issues when toggling settings
- Resolved Vue.js component detection in single-file components
- Fixed HTML comment detection in mixed-language files

## [0.0.3] - 2025-04-11

#### Added
- Improved visualization axis selection with step-by-step interface
- Added support for cylinder charts with optional radius dimension
- Smart dimension detection that recommends appropriate fields for each axis type
- Added support for Code Analysis (Static Mode) with metrics extraction (LOC, comments, functions, CCN)
- Added new Code Analysis (XR Mode) that generates an interactive AR/VR visualization of code metrics using BabiaXR
- Auto-reanalysis system: code analysis automatically updates when the analyzed file is modified
- Visualization Settings for customizing environment colors, palette, and environment preset
- File Watcher system per analyzed file for efficient updates
- SSE (Server-Sent Events) integration for real-time XR visualization updates
- Auto-generation of .venv Python environment for Lizard dependency
- Language detection for analysis (supports: JavaScript, TypeScript, Python, C)
- Icon integration in Tree View based on file language
- Visualization in XR of function names (X axis) and CCN (Y axis) with Babia Bars

#### Changed
- Enhanced JSON data processing to preserve original data structure while reordering attributes
- Implemented a more reliable temporary file handling system using the extension's global storage path
- Improved error handling when copying data files to visualization projects
- Reorganized internal structure of src/code_analysis and src/pythonEnv
- Refactored status bar logic for better maintainability
- Improved event management and disposal
- Changed analysis command naming:
  - CodeXR: Analyze File (Static)
  - CodeXR: Analyze File (XR)
- Improved user interaction flow in TreeView when selecting files to analyze
- Cleaned up visualization temporary folders automatically on extension deactivation
- Improved handling of JSON transformation for XR visualization compatibility

#### Fixed
- Fixed issue with temporary JSON files not being properly cleaned up
- Resolved errors when copying files between directories with different permission levels
- Fixed parsing of Python comments using a dedicated Python script
- Fixed detection of classes in any supported language
- Resolved issue where XR visualization data was not correctly injected into the HTML template

## Earlier Versions
- Initial development and prototype versions








