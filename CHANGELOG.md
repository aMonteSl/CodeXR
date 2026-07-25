# Changelog

## [1.2.0] - Unreleased

### Fixed — Every babia-boats is built the same way: one tree convention, one component base

- **The same project produced visibly different boats per mode** — the normal analysis showed the wide stacked steps the user expects, the movie didn't. The steps ARE the tree: the treebuilder makes one quarter level per path segment, and each producer fed it a different path shape. The normal analysis splits `filePath` (the full analyzed path, drive letter stripped); the movie and the historical comparison rewrote their paths relative to the analyzed root, because they analyze **per-commit temp copies** whose raw absolute paths differ on every frame — so their boats came out flat and cramped next to the normal one. Measured with identical data: full path → 13 meshes / 11 stacked levels; relative → 8 / 6.
- **One tree contract now, declared once** (`XR_BOATS_TREE_FIELDS` in `templateCharts.ts`), and it is the normal analysis' original convention: directory boats split `filePath`, file boats split the synthetic `treePath` — in the generated scene, the movie and both historical sides. The evolution and historical services now **rebuild `filePath` against the ORIGINAL analyzed target** (`buildBabiaStyleFilePath`: the exact shape Python's normalizer publishes), so a materialized copy's temp location never shapes the quarters and the movie's tree is byte-identical to the normal analysis of the same directory. Cross-commit/cross-side identity (`evolutionKey`/`comparisonKey`) stays relative, so the same file still matches across frames and sides.
- **The boats component base is now a single canonical object** (`BOATS_BASE_COMPONENT_ATTRIBUTES`): the HTML template is serialized FROM it, and the scene injects it as JSON (`#codexr-chart-base-config`) that the runtime reads for chart switches and the movie — with a mirrored fallback for scenes generated before the config existed. This kills the one real divergence found (the runtime rebuilt boats with a two-line `legend_text` instead of the full metric legend) and makes future drift structurally impossible. The dead boats duplicate in `createChart.ts` (an unreachable fallback with its own copy of everything) is deleted.
- **Found and fixed while verifying: the movie's play button could freeze the transport.** `play()` set `playing = true` and then died synchronously inside the playback overlay — `splitSourceDescription` called the git-ref-picker runtime's `describeSource` without any guard, so a scene where that (purely presentational) runtime is missing threw before `scheduleNext` ever ran, leaving the movie stuck "playing" forever. Every source description now goes through a guarded helper with a raw-fields fallback, and the playback harness loads the picker like production does. This was a latent regression from the timeline-chrome work that the project-evolution harness — not part of the routine gate — had never re-checked.
- Gates: `npm test` 376, **all three** Playwright harnesses (mode-cycle, containment, project-evolution playback) and `npm run compile` green. Verified that the rebuilt paths are byte-identical to the normal analysis' (`/Users/…/proyecto/src/a.py` from a Windows target and its per-commit temp copy alike), and that the movie plays through to "finished" again.

### Fixed — One active pointer: legends appear on gaze, laser or mouse hover — and nothing else

- **Chart legends now respond to exactly one pointer at a time**: the mouse in a normal browser, a new gaze reticle in VR without controllers, and the right laser once controllers connect (the left one if it is the only controller). Babia's pie/donut/bubbles share one implicit global legend reference, so two live raycasters corrupt the show/hide cycle — orphan legends and `NotFoundError`s — and that is precisely the state the scenes shipped: the mouse cursor stayed live inside VR, and the "visual only" left controller was a third, *unfiltered* pointer. `laser-controls` injects a cursor plus a raycaster with `objects: ''` (= the whole scene) on every `controllerconnected`/`controllermodelready`, and its `controllerdisconnected` handler instantiates a default raycaster even on desktop — verified live: `{objects: "", enabled: true}` on the left hand in a plain browser tab.
- **New scene-level `codexr-pointer-policy` runtime** enforces the single-active-pointer rule: it listens to `enter-vr`/`exit-vr` and both controllers' connect/disconnect events, enables exactly one raycaster, re-neutralizes the inactive controller **after every** laser-controls injection (drops the injected cursor, disables the ray), and pins the active laser's `objects` filter to babia targets (the injected one is unfiltered). Disabling a raycaster fires its pending `mouseleave`s (A-Frame clears intersections on `enabled: false`), so open legends close cleanly on every hand-over.
- **Gazing at a chart in VR without controllers now shows its legend** — there was no gaze cursor anywhere before, so "look at the chart" simply did nothing. Both scene templates grow a hover-only reticle under the camera (`fuse: false`: no gaze clicks), visible only while gaze is the active pointer.
- **Boats legends billboard to the user's face, not to the idle left hand**: `legend_lookat: [laser-controls]` resolved to the first laser-controls element in the document — the left controller — and is now `[camera]` in all three sites (both generators and the mapping UI's boats profile).
- **Chart roots no longer carry `babiaxraycasterclass`**: babia marks its own pieces (bars, sectors, buildings — verified live), and the class on the root made *everything hung under it* a recursive raycast target — legends included, so a legend could occlude its own chart from the ray. Interactive UI (panels, buttons, screens) keeps the class; the historical/dependency suspension guards already skip entities without it.
- **The DOM visualization's duplicated pointers are gone**: its camera declared `babia-camera`, which creates a *second* mouse cursor and its own hand raycasters next to the template's manual ones. It is now a plain camera plus the same pointer set and policy as the main template.
- Verified end-to-end in a real browser against the real runtime (colored debug rays: red mouse, blue laser, green gaze): desktop hover shows/hides legends; `enter-vr` hands over to gaze; a real laser-controls injection on connect is re-neutralized on the left while the right takes over; right disconnect falls back to the left **with the filter enforced**; `exit-vr` returns to the mouse and legends still work. `npm test` 375 (new 9-case pointer-policy suite included), both Playwright harnesses and `npm run compile` green.

### Changed — The table goes quiet once fitted, axes follow BabiaXR's real rules, and the legacy boats runtime is gone

- **A fitted chart now stops resizing, completely.** The containment system had no terminal state: the maintenance pass re-entered the controller every 700 ms forever, the tick measured bounds and ran the height guard **on every frame** with a 0.0001 threshold, the equilibrium sat exactly on the containment edge (tolerance only fed a flag, never the target), and the measurement included camera-facing chrome — Babia nests its legend so the visible plane is an anonymous child, and a `legend_lookat` billboard changes its world AABB as the player turns. Every one of those produced the micro-resizes users saw while simply walking around. Now: the auxiliary filter judges the mesh's **whole ancestor chain** (plus a `lookat` token), correction targets aim inside the limit with real hysteresis on every band, the PID dead zone is relative to the chart's scale (one absolute number served flat charts at 1.5 and boats at 0.01), the mutating axis probe is cached per fit, and — the core — a converged chart enters a **settled** state: zero per-frame work, one cheap check every 700 ms, and only a drift that persists across two checks (or a hard violation) re-engages the controller. Proven in the containment harness: with a spinning legend inside the chart, the settled scale stays **bit-identical across 6 watch periods**, and a real content change re-fits and re-settles at a new scale.
- **Every axis now offers every field BabiaXR actually accepts.** Verified against the library's code: `x_axis`/`z_axis`/`key` are pure categorical keys (any value works — position comes from the index, the label is stringified), while `height`/`radius`/`size`/`area` are arithmetic. The categorical dimensions move from `text` to `any` — bars' X axis grows from 4 candidate fields to all 27 — and `size`/`area` are declared `numeric-positive` (negatives break pie/donut angles and boats' `Math.sqrt`). Also fixed: the file-analysis preferred defaults named fields that don't exist in that schema (`name`, `longName`, `codeLines`), and the `'any'` validator bypass no longer skips checking that the field exists at all.
- **The dormant `code-xr-boats` runtime is deleted** (~2,300 lines + textures + 33 tests): no scene has injected it, generated scenes use `babia-boats`, and old configs already migrate. Its remnants in the table went with it (a listener for an event with no emitter, an animation gate keyed to its component), and the pending re-fit request it consumed now has a real consumer: the first periodic pass with the chart visible again. More dead weight removed: an unreachable steady-planar-fit chain (`applySteadyPlanarFit`, `computePlanarBandScale`, `softenFactor`, the `containmentDamping` knob), two never-called geometry helpers, and three schema parameters that fed no computation (`minHeightOccupancyRatio`, `buildingHeightBandEnabled`, `revealOffsetY`). `update()` now compares exactly the keys that feed a fit (including `tableTopPadding`, which it previously ignored) and disabling the component really stops the controller's own timer.
- Gates: `npm test` 366 (33 removed with the boats runtime), both Playwright harnesses — including the new settled-quiet scenario — and `npm run compile` green; the 8-chart sweep still lands `steady-fit` with zero orphans on every type.

### Fixed — The table is really cleared before the new chart is drawn

- **Switching chart type left the previous chart on the table** (bars → barsmap showed both). The cause is in BabiaXR itself: a chart component subscribes to its data source through the producer's `NotiBuffer`, and **no chart component in BabiaXR 1.3.4 declares `remove()`** — so removing the component leaves its callback registered. `NotiBuffer.set()` calls *every* registered callback, so on the next data push (any refresh; in project evolution, every frame) the **deleted** chart repainted itself into the live entity, on top of the new one.
- **CodeXR now unsubscribes on the library's behalf**, using Babia's own API, before removing a component — and the movie and the historical comparison do the same for any chart entity they discard. A second line of defence sweeps children that no live component claims, shortly after the new chart is built.
- Measured in the browser, switching bars → barsmap and then forcing a data push: **before**, 2 chart roots, 1 orphan, 2 subscribers, 8 meshes; **after**, 1 root, 0 orphans, 1 subscriber, 4 meshes. Re-verified across all eight chart types: 0 orphans and exactly one subscriber every time.
- The harness now models Babia's producer/consumer contract faithfully (a `NotiBuffer` on the data source, charts that register and never unregister), so this class of leak fails the check instead of hiding. `npm test` 399, both Playwright harnesses and `npm run compile` green.

### Fixed — Changing the chart type now just works: complete mappings, the right entity, and a fit that settles

Switching the chart shown in the project-evolution movie failed three different ways — some charts never appeared and the table reported *"No chart detected"*, others resized forever, and Barsmap reported *"invalid axis"*. These were seven independent defects across three layers, all of which broke the same promise: **change the chart, get that chart's axes filled with their defaults (or the best available field), and a chart that settles inside the table.**

- **A chart's mapping can no longer be partial.** The generator dropped a dimension whose strict field pool was empty (a `text` axis with no text fields) and omitted its default, yet still offered the chart — so `barsmap` shipped with `x_axis` and `height` but **no `z_axis`**. Babia then built an axis with a non-finite length, which is exactly what surfaced as "invalid axis". Candidate fields now fall back to *every* field, so every declared dimension always gets one; and the runtime completes any gap from the chart's own dimensions, so scenes generated before this fix are repaired on load too. Stale axes belonging to the previous chart are dropped in the same pass.
- **A chart switch made inside the movie no longer converts the normal analysis' chart.** A-Frame does not mirror a programmatically set component to the DOM, and every lookup here was an attribute selector — so the movie's chart entity was invisible to chart resolution, which fell through to the parked normal chart. Live components now count as much as DOM attributes.
- **The movie's chart is built, not cloned from a DOM template.** It used to clone a `[babia-*]` element, but the mapping UI's own `removeAttribute` wipes the last such attribute on the first chart switch — after that *every* chart failed to build, and the failing path detached the chart **before** discovering it had no template, leaving the scene empty. The entity is now constructed from what is actually known (id, markers, component), a scene chart contributes only decoration, and the replacement is built before the current one is dropped.
- **"No chart detected" over a perfectly rendered chart is gone.** Charts created at runtime (the movie's, and the historical comparison's two) were invisible to the table's `[codexr-chart-containment]` sweep for the same DOM-attribute reason. Applying a containment profile now stamps a plain data marker the sweep also accepts.
- **Charts stop resizing.** Two causes: the measurement signature included the *unfiltered* bounds — legends that follow the camera and late-loading labels kept changing it, so the stabilization loop never saw three identical passes, never reached `steady-fit`, and the maintenance tick kept re-fitting every 700 ms; and the movie re-applied its containment profile on every frame, writing the raw anchor position over the fit that had just been computed. The signature now mirrors what the fit actually uses, and the profile is applied once per chart. Also fixed: a re-fit request arriving during the fit's own 650 ms animation restarted the cycle and recorded a half-animated transform as "stable", and the base scale was captured once for the entity instead of per chart type (so resets restored the previous type's scale).
- **A chart switch that ends in invalid geometry now reverts itself** with a message, reusing the validation that already existed for single-field changes; and the post-change re-fit ladder stops as soon as every chart reports a settled fit instead of re-measuring a stable scene for 18 seconds.
- **Verified by sweeping all eight chart types in a real browser** (bars, barsmap, cyls, cylsmap, pie, donut, bubbles, boats): each one lands the right component **on the movie chart** with the normal chart untouched, every declared dimension mapped (including the `z_axis` the harness deliberately omits for barsmap), `steady-fit` reached with the scale converged, and no invalid-axis or missing-chart diagnostic. Playing three frames leaves the scale bit-identical, and the normal analysis and historical comparison stay clean and contained. `npm test` 398, both Playwright harnesses and `npm run compile` green.

### Added — Speed shortcuts and the next-frame countdown inside the movie companion

- **0.5x / 1x / 2x now sit next to the movie transport in the Field Mapping view.** They existed only on the Project evolution panel, so changing speed meant leaving the mapping view ("Change movie"), switching, and coming back. The row reuses the panel's own button atom (narrowed to the column, extremes measured at ±1.33 inside the card's ±1.4 strip) so both places speak one vocabulary.
- **Both rows now highlight the speed the movie is actually running at** — neither did before. Fixing that surfaced a real gap: `setSpeed` never re-rendered, so any indicator would have gone stale on the first click; it renders now.
- **The wait for the next frame is visible from the mapping view too.** The countdown only ever existed on the panel's status line, so while watching the movie from the Field Mapping view there was no way to tell whether it had stalled. The companion has its own line now: it ticks down second by second, says *"Preparing next frame…"* while the chart is still settling, *"Last frame"* at the end, and goes quiet when the movie is paused (pausing clears it, so no frozen "in 3s" is left behind).
- Verified in-browser: each button sets the speed and takes the highlight (panel and companion agreeing), changing speed mid-playback keeps the movie running at the new pace, the countdown was sampled ticking 5→1 across two frame transitions and clears on pause, and the normal analysis' mapping view stays clean. `npm test` 395, both Playwright harnesses and `npm run compile` green.

### Fixed — Project evolution: precise range marking, right-sized timeline bar, framed companion, and boats by default

- **Range rows are marked by precise commit time and by sha, not by day.** Every Git date in the pipeline was day-granular (`--date=short`), so any ref sharing the end commit's date was painted as "inside the range" — including branches pointing at commits NEWER than the end, and branch aliases of the end itself. Sources now also carry the committer's **Unix timestamp** (branches/tags via `committerdate:unix`, commits via `%ct`; the displayed short date is unchanged), range membership compares those times (a Live endpoint counts as "now"), and a ref whose `commitSha` equals an endpoint's commit paints **the endpoint's colour** — `origin/master` sitting on the picked end shows red, not amber, so "why is this row marked" answers itself. The shared picker's Newest/Oldest sort and the timeline sampler use the same precise time, so same-day commits finally order correctly everywhere. Verified in-browser with a same-day alias + a same-day-later branch: alias red, later branch unmarked, span amber, endpoints green/red, and the Live-ended range still paints.
- **The movie companion's timeline bar fits its column.** One shared width constant (5.4) sized every bar, so the companion's bar overflowed its 3.1-wide column and the cursor at the last frame sat outside the panel. Bars are now sized per instance; the companion's is 2.6 and the cursor at frame N/N measures inside the card.
- **The companion is a framed card now** (the historical COMPARISON card pattern): border + fill stretching to the column height, centred title with accent underline, frame counter with a commit date/subject line, timeline bar and transport centred in the free space, and **Change movie pinned to the bottom edge** — instead of everything piling at the top of an empty column.
- **Project evolution opens with Babia Boats and its default axes.** Its default chart was `config().chartId || 'boats'` — and that config value is the chart the NORMAL analysis scene was created with, so a pie scene opened the movie as a pie (the reported bug). Boats is the mode's identity chart: it is now preferred whenever the scene has the boats template.
- **Chart selection follows the mode — without touching other modes' entities.** Fixing the default exposed a family of cross-mode leaks, all closed: `selectChart` (and the mapping apply under it) gained a **UI-only mode** used by evolution's activation, because the full switch ran while the resolved chart ids still pointed at the parked normal chart and converted it in place; every non-evolution mode now restores the **scene's pristine chart** on entry (captured before any switch can overwrite it); and leaving the evolution mode hands chart-entity targeting back to the scene — the stale override made the normal analysis' chart switches land on the parked movie chart ("could not switch chart").
- **The harness got faithful enough to catch all of this**: its mapping config now declares the scene chart and available charts (bars + boats with real defaults), its normal chart carries the containment component real scenes always have, and its Git sources carry timestamps, shas, and the two trap branches (same-day alias, same-day-later). The Playwright mode-cycle runner's chart-switch step, silently skipped for months because no second chart existed, now actually runs. `npm test` 395, both Playwright harnesses and `npm run compile` green.

### Fixed — Project evolution: the chart/axis selector is finally reachable, Live-ended ranges paint, no more text pile-ups

- **The Field Mapping view (chart + axis controls on the left, movie companion on the right) is now actually reachable** — it existed and worked, but nothing ever routed the controller to it: activation always showed the mode's own panel and the movie-ready transition forced it too. Project evolution now routes exactly like the historical comparison: a `resolveControllerView` on its lifecycle (`project-evolution.mapping` when a movie exists, the selection panel otherwise), a `project-evolution.mapping → mapping` entry in both routing maps, and no forced views on the entry paths — so **Generate lands you on the mapping view with the movie companion beside it**, and re-entering the mode with a movie returns there (and resumes playback, as before). Both directions exist without regenerating: a **"Change movie"** button on the companion goes back to the timeline panel, and a **"Field mapping"** row on the panel (folded until a movie exists) goes forward again. The existing interlock is unchanged: chart/axis controls disabled while the movie plays.
- **A range ending on the Live row now paints its span.** The in-between highlight compares committer dates and the working copy has none, so any range with Live as an endpoint refused to tint the middle rows. Range **endpoints** without a date now count as "now" (a key sorting after every ISO date); the rows being tested still require their own date. Verified in-browser: start commit green, Live end red, all three in-between commits amber.
- **The playback texts no longer pile up.** While a movie played, the mapping-ui's lock message ("Playback running - pause to change chart or axes.") painted itself over the evolution panel's own status ("Next frame in 1s..."): `updateStatusText` re-showed the text whenever a message existed, ignoring which panel view was active — and the playback lock refreshes its message on every render. The status text now belongs to the mapping view alone: one owner computes visibility (`mapping` view + message present) and writes both the attribute and `object3D.visible`. Measured in-browser: playing on the evolution panel keeps the lock text invisible across renders; in the mapping view it shows next to the controls it explains.
- Verified end to end in the served harness: cold entry → selection panel; range with Live end → correct 5-row tinting; Generate → mapping view with companion, title and hint; Change movie ⇄ Field mapping round trip; play locks / pause unlocks; leave while playing → normal mapping view clean (no companion, no ghost text) and re-entry → mapping view, same frame, playing again. `npm test` 394, both Playwright harnesses and `npm run compile` green.

### Fixed — Project evolution polish: real ranges, working sort, and leave/return semantics

- **A picked range is now actually analyzed — and highlighted.** Source ids are `refType-hash(refName)`, and the server's timeline only contains commits, so choosing a branch, tag or the Live row as a range endpoint made `findIndex` miss and the server **silently fell back to the full automatic movie** — exactly "my range was not analyzed". Endpoints now resolve by **commit sha** (branches/tags point at one; the working copy means "the end of the timeline"), and an unresolvable endpoint raises `project-evolution-range-not-found` instead of degrading silently. In the picker, the commits **between** the endpoints are now tinted amber, with the endpoints keeping their green/red — verified in-browser (span rows `#b45309`, start `#15803d`, end `#b91c1c`, and the generate request carrying `mode:'range'` + both ids).
- **The Oldest/Newest toggle works again** — a regression from the sampler round: the auto-suggested frames jumped the queue in fixed order and, at 24 suggestions × 6 rows per page, the first pages never changed when sorting. Suggestions no longer reorder the list (their membership shows as numbered badges); verified in-browser flipping the toggle reorders the dated rows both ways with Live pinned first.
- **Manual mode checked end to end** (click order 1-2-3, renumbering on un-click, request `sourceIds` in click order) — and the check surfaced a real pooled-row bug: a row handed to another source **kept the previous source's order badge** painted (the A-Frame 1.7.1 `visible`-attribute cache again). Badges now clear through attribute + `object3D.visible`.
- **Leaving and returning now follows the three requested scenarios**, all verified in-browser: *nothing done* → the selection panel comes back exactly as left (timeline mode and selections preserved); *movie playing* → re-entry resumes at the same frame **and resumes playing** (two real bugs fixed on the way: the selector's disposeView sweep overwrote the just-saved resume flag, and a one-shot `play()` was silently rejected by the chart-remapping safety lock — resume is now deferred and retried when the lock releases; a deliberate pause cancels any pending auto-resume); *generation in flight* → leaving sends `project-evolution-clear` (the server cancels its workers), hides the progress bar and cleans everything, so re-entry lands on a fresh selection panel.
- **Harness made truthful for playback**: the stub's `frame-applied` reply lacked the `revision` the client validates (every seek silently timed out — playback had never actually run in the harness), the default `boats` chart had no mock, and clear/cleared and a `simulateSlow` generation path were missing. All added; the mode's `getState()` now also exposes `generating`/`applyingMapping`/`resumePlayback` for observability. `npm test` 394, both Playwright harnesses and `npm run compile` green.

### Fixed — Project evolution controls leaked over the normal analysis' mapping panel

- **The normal analysis' Field Mapping view showed "PROJECT EVOLUTION" and Prev/Play/Next painted over its rows.** The evolution companion registers hidden, but its layout pass forced `visible: 'true'` on its own root unconditionally — overriding the per-context hiding the controller owns — and, never having been active, its content sat at the panel centre. Visibility is no longer touched by the companion's layout: the mapping-ui's `syncMappingCompanion` is the single owner.
- **Hardened for good**: every companion visibility change now goes through one helper that sets both the attribute and `object3D.visible` (A-Frame 1.7.1 caches the `visible` attribute, and a cached no-op is exactly how a stale companion could stay painted). Regression assertions pin both rules.
- Verified in-browser across the full cycle: normal mapping view → both companions hidden; Project evolution's own view → hidden; its mapping view → the movie companion visible with its title; back to normal → hidden again. `npm test` 394, both Playwright harnesses and `npm run compile` green.

### Changed — Project evolution: real timeline sampling, Live back in the list, and chart control while paused

- **The automatic timeline now samples properly.** Frames were picked every Nth commit, which over-represents busy weeks and compresses quiet months, and the movie only ended on the current state when the working tree happened to be dirty. A new shared sampler (`gitTimelineSampler.ts`, alongside the Git service both analyses already share) spreads frames **evenly in time**, prefers a **merge or tag** when one falls in a slot's window, drops duplicates, gives leftover slots to the **widest remaining time gaps**, and always anchors the ends: first revision, and **the current state of the branch as the last frame** (the `--all` timeline's last entry can belong to another branch). Undated repositories fall back to the previous positional sampling.
- **Fixed: the Live (working copy) row had disappeared from Project evolution** — a regression from sharing the category filter in the previous release. `filterByCategory` deliberately leaves the working copy out (compare mode pins it separately), so filtering the sequence list dropped the current branch. It is pinned first now, exactly as in the historical comparison.
- **The controller extends while a movie is loaded**: the Field Mapping view keeps the chart and axis controls on the left and gains a Project evolution column on the right (current frame, timeline with cursor, Prev/Play/Next) — the same side-companion pattern the historical comparison uses.
- **Safety interlock, both ways**: the chart/axis controls are disabled while the movie plays and re-enabled when it is paused (measured: 1 of 15 controls reachable while playing, 15 of 15 once paused), and Play / Prev / Next / timeline seeking are locked while a confirmed chart or axis change is still being applied to the current frame. The panel says which lock is active ("Pause to change chart or axes." / "Applying chart change…").
- Verified: `npm test` (394, including four new sampler tests over synthetic timelines), both Playwright harnesses and `npm run compile` green; movie generation and playback exercised in the served harness with no console errors.

### Changed — Project evolution: panel reorganised, shared Git chrome, and playback feedback

- **The panel no longer overlaps itself.** Positions were hand-tuned constants that collided: the pager ran into the "Now showing" card, "Clear movie" stuck out past the right edge, the card almost touched Generate, and the "Pick start / Pick end" row reserved space even outside Range mode. Sections are now placed by a single `layoutPanel()` pass from a table of heights: it folds away what is not in use (the range row, and the playback chrome before a movie exists), centres the content on the usable strip, and reports the panel height it needs instead of a fixed constant. **Measured in the harness: 0 overlaps and 0 elements outside the margins in all three timeline modes** (Auto / Range / Manual), with the range row folding in and out.
- **The duplicated title is gone** — the controller header already names the view, and the panel printed "Project evolution" again inside itself.
- **Both Git analyses now drink from the same base.** Category tabs and the newest/oldest toggle were built only for the comparison's `compare` mode even though the filtering and sorting helpers were already shared; evolution (`sequence` mode) now gets them too — browsing hundreds of commits without a filter meant 52 pages of five rows. Buttons come from the shared `buildButton` factory (the mode had its own), and the table-edge nameplate is shared chrome, so the comparison and the evolution label the table with the same plate.
- **New playback feedback** (all pooled, attribute-only updates): a **timeline bar** with one tick per frame and a cursor you can click to jump to a frame; the **current commit on a table-edge plate** while the movie plays; a **real progress bar** during generation ("Generating frame 7 / 24" — the server already sent `frameIndex`/`frameCount` and only the message was shown); and a **sparkline of files per frame** with the current frame highlighted, drawn from the `itemCount` each frame already carries, so it costs no extra request.
- Verified: `npm test` (390), both Playwright harnesses and `npm run compile` green, no console errors on entry.

### Fixed — Project evolution could not be entered from the analysis selector

- **Selecting "Project evolution" bounced straight back to the selector.** Its lifecycle `activate()` calls `clearChartVisualization()` on every cold entry (no movie generated yet), and that function dereferenced refs that only exist once a movie is mounted — `refs` starts empty, so `refs.evolutionFrameRoot.parentNode` threw a `TypeError`. The mode machinery caught the error, disposed the view and reverted to the selector, so the analysis simply "would not open". The optional chaining was on the method (`removeChild?.`), not on the object it had to protect.
- **Fix**: nodes are detached defensively (`node?.parentNode?.removeChild?.(node)`), making the clear safe to call cold and repeatedly. Audited the same anti-pattern across the rest of the runtime and fixed it in the playback overlay teardown, the play-button label (`querySelector('a-text').setAttribute` on a possibly missing node) and the timeline mode/range buttons.
- **A failed activation is no longer silent**: the controller now shows *"CodeXR could not open this analysis: …"* on its status line instead of returning to the selector with no explanation (the error was console-only).
- **Coverage that would have caught it**: the mode-cycle harness never loaded the project-evolution runtime. It now bundles it, the collaboration stub answers the mode's timeline request (and publishes the `projectEvolution` capability the real server already sends), and the Playwright journey enters the mode **with no movie generated** — the exact cold path. Verified by reintroducing the original line: the harness fails with the reported symptom ("controller stayed in visualization-mode") and passes with the fix. `npm test` 390, both Playwright harnesses and `npm run compile` green.

### Fixed — the entry flash: charts were re-fitted to the table for no reason

- **The flash on entering an analysis was the chart containment system, not the mode machinery.** Every mapping change asked to re-fit **all** charts twice — once on the next frame and **again 300 ms later** (`…-settled`) — and `renormalize()` is destructive by design: it drops the `normalized` flag, resets the transform and runs the bootstrap fit again. So a scene that was already correct got re-fitted, late, in full view. That late pass is exactly the "correct → flicker → correct" the user described.
- **Re-fitting is now idempotent.** The containment component remembers the fit currently on screen (reusing its existing `buildMeasurementSignature`) and a request that matches it returns immediately, without touching the transform. Real changes — new data, a rebuilt chart, a different containment zone — move the measurements or the transform, so the signature differs and the fit runs as before.
- **A hidden chart keeps its fit.** Re-fitting a parked chart (another analysis' charts while it is off screen) measured it while invisible and produced a different fit, which then had to be corrected — visibly — the moment it came back. Those requests are now deferred, and the runtime asks for the re-fit when the charts are shown again (a no-op unless their data actually changed).
- **One retry mechanism instead of two.** The mapping UI's 300 ms "settled" pass is gone: waiting for Babia to finish building geometry is the containment component's own job (`markWaitingGeometry` + `scheduleRetry` + its stabilization loop). Also removed a duplicate re-fit request (`applyMappingSnapshot` already asks when it applies a mapping) and made the comparison use the targeted `renormalizeCharts` instead of `renormalizeAll`, which was re-fitting other modes' charts too.
- **Measured in the served harness on leave/re-enter**: 10 re-fit requests now produce **2 actual re-fits** (was: re-fits on every request, plus a late `-settled` pass on every chart), **0 late passes**, and the chart scale is **identical before and after** (`0.9988, 0.3338, 4.2747`) — the charts do not move. Both Playwright harnesses (containment and mode-cycle) stay green, so charts still fit the table correctly; `npm test` 390.

### Fixed — entering an analysis no longer flashes the table and the controller

- **Entering the historical analysis showed the right content, flickered, and showed it again.** The same state was being applied several times, and the two expensive operations rebuilt themselves every time they were asked — even when nothing had changed. Measured in the served harness on re-entry: the table geometry was rebuilt **4×** and the controller's rows were destroyed and recreated **twice** (34 nodes) for a scene that was already correct.
- **Root causes, all removed:**
  - `performTransition` applied the analysis mode **twice** per transition (before and after `activate`); the second pass also overwrote the view the lifecycle had just chosen. Now the mode is applied once, before activate.
  - The authoritative `analysis-view` echo re-ran the **whole lifecycle** for modes that don't consume that snapshot. The blanket "snapshot bypasses the dedupe" rule is now declarative: only a lifecycle marked `consumesSnapshot: true` (the normal analysis, whose data refresh rides that snapshot) is re-activated by an echo; historical, dependency graph and project evolution are fed by their own shared entity and are left alone.
  - **Table**: `setMode` both wrote the attribute (which already drives A-Frame's `update()` → `refreshGeometry()`) *and* called `refreshGeometry()` by hand, so every change rebuilt the table twice; and re-applying the active mode rebuilt it for nothing. It now rebuilds only on a real mode change, once.
  - **Controller**: `switchMappingContext` re-ran `applyMappingRuntimeState` → `renderRows`, which clears and rebuilds every panel row, even when the context on screen was already the requested one. It is now idempotent (tracked by the applied mapping-profile key).
  - The mapping panel header wrote the generic `CodeXR Field Mapping` title and let the companion overwrite it; the title now comes from a single resolver, written once.
- **Result (same harness measurement):** entering with no comparison rebuilds the table **once**; restoring a comparison rebuilds the table **once** and the rows **once**, and only because the mode and the mapping context genuinely changed — the repeated "apply the same state again" passes are gone. `npm test` (388), the Playwright mode-cycle harness and `npm run compile` stay green.

### Fixed — historical comparison: leave/return restores IN PLACE (no rebuild flash) and a stale server view can't hijack the panel

- **Returning to a saved comparison no longer tears the scene down and rebuilds it** (the "loads, flashes, restarts, then shows the same thing" symptom). The comparison root was treated as *transient*: entering the analysis selector destroyed it (`removeTransientRoots`/`removeResidualVisualRoots`) and re-entry ran a full `renderComparison` (park + rebuild + stabilization wait). It is now **preserved-and-hidden** — the same save/restore pattern the normal (single) analysis already used: the root carries `data-codexr-preserve="true"`, both cleanup passes hide it instead of removing it (through the surface's own visibility/interaction bookkeeping), leaving hands the scene back to the normal charts (`releaseSceneToNormal`), and re-entry restores in place (`restoreComparisonScene`: re-park, re-show, re-point the mapping controller) with **zero geometry rebuild** — verified in-browser by node identity (`isSameNode`) across repeated leave/return cycles. A `renderedRevision` check re-syncs only if the live side moved while parked.
- **A stale server view can no longer strand the controller on the generic "CodeXR Field Mapping"**. The server's `historical-comparison` entity persists after the client clears its comparison (e.g. Change comparison — there is no reset message by design), so `analysis-mode-activate` echoes `controllerView:'historical.mapping'` with nothing to show locally. The authoritative echo now routes through the mode's live resolver first (`lifecycles[mode]?.resolveControllerView?.()` before `snapshot.controllerView`), and the historical entry was collapsed to a single path with no explicit view — the client's own state (comparison live → restore; none → source selector) is the routing authority. Verified in-browser with a faithful stub (persistent server entity + availability-derived controllerView): the stale scenario lands on the source-selection table every time.
- **Zombie code removed** (deep review, no callers existed): `buildSourceLabel` and `createLabel` (leftovers of the old floating labels), the unused `mountPanelView` attempt argument, and the mapping-ui `getModeMemory`/`saveModeMemory`/`modeMemory` API.

### Superseded — historical comparison: leaving and returning now saves/restores the comparison deterministically

- **Leaving historical (Back, or the controller's V button → analysis selector) and re-entering opened the mode on the generic "CodeXR Field Mapping" panel with nothing rendered** ("No chart detected"). Root cause (reproduced in the served harness with a faithful server model — async authoritative echo + availability-derived `controllerView`): every mode entry fires two transitions to `historical-compare` — the local route and the server's `analysis-view` echo. When re-entering with a live comparison, the local route targeted `historical.mapping` but the echo fell back to the mode's *static* default `historical.selection`, and depending on timing the two clobbered each other's panel/mapping-context — stranding the generic mapping without the comparison.
- **Fix — the mode's default controller view is now state-aware, so both routes always agree**: the historical lifecycle exposes `resolveControllerView` (`state.result ? 'historical.mapping' : 'historical.selection'`), and `getDefaultControllerViewForMode` consults it. Leaving historical keeps the comparison result + payloads (`disposeComparisonGeometry(false)`; only the geometry is disposed), so a live comparison is **restored** on re-entry and, when none exists, the **source selector** is shown — exactly the requested behaviour ("save the comparison if one is launched; otherwise the table to pick what to compare"). Verified live across repeated leave/return cycles (launched → restores mapping + charts + `historical-comparison` context; empty → source selector), plus `npm test` (388), the Playwright mode-cycle harness, and `npm run compile`. (This supersedes the earlier, wrong-direction "clear the comparison on leave" fix.)

### Changed — historical comparison: professional COMPARISON panel + always-populated table

- **The comparison table was empty on entry** — it read a stale `state.selectedMapping` cached at `autoInit` (empty at that early moment) and only refreshed on a `codexr-mapping-confirmed` click, so the axis metrics shown on the left never appeared on the right. `updateMappingCompanion` now reads the **live mapping from the mapping-ui** (`root.CodeXRMappingUiRuntime.getState().lastKnownGoodMapping`, falling back to `selectedByDimension`) on every update via a new `getLiveMapping()`, so the table always mirrors the metrics currently on the chart axes.
- **The COMPARISON column was redesigned to look finished**, not just filled: a framing card (subtle fill + border) that spans the whole column, a centred section title with an accent underline, two full-width colour-coded side chips (LEFT cyan / RIGHT green, accent bar + branch label), a real metric table with a header bar and zebra-striped rows (`metric | L | R | Δ`, signed/coloured diffs), a placeholder when no metric is mapped instead of a lone header, a 2×2 file-delta dashboard (Added / Removed / Modified / Unchanged as coloured stat cells), and the Change comparison button pinned to the bottom of the card. All pooled/attribute-only (no node churn). `positionMappingCompanion` distributes these groups across the card height (title+chips top, table centred, dashboard+button bottom). Verified: `npm test` (388), the Playwright mode-cycle harness (builds the companion without error), and `npm run compile`; F5 visual pass pending user. (Supersedes the earlier top-anchored/3-zone fill.)
- **The file-delta dashboard now has a "Files (right vs left)" heading** so it is clear the four counts are files (added/removed/modified/unchanged between the two versions), not something else.
- **The historical source selector's action row is now just Back + Compare, centred** — the third `Axes` shortcut was removed (the mapping/axes view is reached automatically after Compare).

### Changed — historical comparison: centred wide controller + full-height COMPARISON column

- **The widened two-column controller is now re-centred on its mount axis** instead of growing to the right only. A `side` companion previously offset the background/border by `centreShift` while the title and left column stayed at `x=0`, so the panel's geometric centre drifted right and the controller looked "salido" (off-centre from the table axis). `applyPanelHeight` now centres the background at `x=0` and shifts the left column, status, toggle and view buttons left by `centreShift`, so the left mapping column and the right companion straddle the mount evenly and the widened panel stays aligned with the table axis. (Supersedes the earlier right-only growth.)
- **The COMPARISON column now fills its full lateral height.** The comparison content was top-anchored and left the lower half of the tall mapping panel empty. The companion API gained an optional `layout(availableHeight)` callback (invoked from `applyPanelHeight` for `side` companions); the historical companion uses it to distribute its content across the whole column — header + side chips near the top, the per-metric table centred in the free middle space, and the file-delta summary + Change comparison pinned near the bottom. The table re-centres whenever the visible-row count changes (a confirmed axis-metric mapping). Attribute-only repositioning (no node churn, per the panel's childList-observer rule). Verified: `npm test` (388), the Playwright mode-cycle harness (enters historical-compare and builds the companion without error), and `npm run compile`.

### Changed — historical comparison: two-column controller with a live per-metric comparison table

- **Removed the floating delta text over the table** — that information now lives entirely in the controller.
- **The Field Mapping controller is now two-column for historical**: the mapping-ui panel widens to the right when a `side` companion is active (left column keeps all the chart/axis controls unchanged; right column holds the comparison info + Change comparison). The companion API gained `placement: 'side'` + `width`; `applyPanelHeight` grows the background/border and repositions the toggle and view buttons to the new right edge, keeping the left edge (and the whole left column) fixed.
- **The right column is a clear comparison table** built from the metrics currently mapped to the chart axes: two colour-coded side chips (which branch is on each side), then rows of `metric | left | right | Δ` (compact numbers, the diff coloured green when the right side is larger / red when smaller), the file-delta summary, and Change comparison. It **always reflects the live axis mapping** — changing an Area/Height/Color metric (via `codexr-mapping-confirmed`) recomputes the table's rows and diffs. Verified in the harness: panel widens to 9.42 growing rightward, the table reacts to metric changes and recomputes each diff, and the left mapping column stays put.

### Changed — historical comparison: table-edge nameplates, live-refresh fix, and a Field Mapping child view

- **The blue/green branch-name labels moved from floating over the charts (where they collided with the guide screen) to lectern-style nameplates on the table edge closest to the user** — one per zone, dark plate + side accent in the side's colour, one compact line (`name — date` via the shared Git vocabulary). The live refresh updates the live plate in place.
- **Fixed: after a live re-analysis the immutable side vanished behind "The chart is still rebuilding its geometry".** `refreshLiveSide` only refreshed the live chart's data but then called `renormalizeAll`, resetting the untouched immutable chart's containment to its `rebuilding` state — waiting for a Babia build event that never comes. New targeted `renormalizeCharts(chartIds, reason)` in the analysis-table runtime; the live refresh now renormalizes only the refreshed chart.
- **The Field Mapping panel gained per-context child versions**, and historical uses one: new `registerMappingCompanion(contextId, { content, height, title })` in the mapping-ui shows a context-owned section under the mapping rows (child title, extended panel height, interactions synced; hidden the moment another context or view takes over). The historical companion — "Field Mapping - History comparison" — shows **what's on each side of the table** (LEFT cyan / RIGHT green, name + date), the compact delta summary, and a **Change comparison** button that clears the table (comparison geometry + result) and reopens the source selector, ready to pick a new pair.

### Fixed — historical analysis: controller vanished after one interaction; entry flicker

- **Interacting once with the historical analysis could leave the scene empty — pedestal cleared, controller gone — and entering the mode blinked everything.** Root cause (reproduced step-by-step in the browser harness): every mode entry fired **two full transitions** — the runtime's direct `transitionTo` plus the server's authoritative `analysis-view` echo — and each ran the complete deactivate/activate cycle: parking, disposing and rebuilding the scene twice (the flicker). With a comparison result present, each duplicate activation re-ran the entire `renderComparison` (rebuild + chart-stabilization wait of up to 12s **per duplicate** — a measured 24s of empty scene), and a failed stabilization wiped everything to the selection state: the vanished controller. Three-layer fix in the analysis-mode core (benefits every analysis, not just historical): **same-mode dedupe** (`transitionTo` into the already-active mode only re-applies controller/panel routing — except snapshot-carrying calls, which are the data-refresh path and stay full but cheap), **in-flight merge** (a second `transitionTo` towards the mode already transitioning rides the in-flight transition and re-applies only its routing — covers direct-then-echo in either order, tracked via `pendingTransitionMode`), and a **historical activation guard** (an activation while the comparison geometry is still mounted re-routes the panel instead of rebuilding). Verified in the harness: enter → Compare → back to normal → re-enter all land correctly, duplicates merge instead of re-running lifecycles, and the previously stuck `transitioning` state is gone.

### Changed — Git selector: Merges + All categories, time sort, Live-first, tighter layout

- **The historical Git selector gained the categories and ordering the user asked for.** New **Merges** tab (split out from Commits) and an **All** tab (every ref) that is now the **default**; the list is **time-ordered** (committer date) with a Newest/Oldest toggle button, and **Live (working copy) is pinned first in every category**. To make this possible for non-commit refs, `GitRepositoryService.listReferences()` now fetches each branch's and tag's target **committer date** (`%(committerdate:short)` / `%(*committerdate:short)`), so branches and tags show a real date and sort chronologically instead of "No commit date". Layout polish: the LEFT/RIGHT slot summaries are hard-compacted so they no longer overflow past the panel edges or into each other, and the row list grew from 5 to **7 rows** with a tightened vertical rhythm so the dead gap between the list and the pager is gone. All of this lives in the shared `CodeXRGitRefPickerRuntime` (compare mode), so project evolution inherits the branch/tag dates for free without changing its sequence UI.
- Fixed a pooled-row hide bug surfaced by the shorter category lists: `setAttribute('visible', …)` is unreliable on reused A-Frame primitives (1.7.1 caches the value and no-ops), leaving stale rows on screen; pooled rows now toggle `object3D.visible` directly (reliable, and three.js skips invisible objects for raycasting too). Verified in the browser: Merges/Tags/Branches show exactly their refs + Live, no leftovers, and paging still yields 0 childList mutations.

### Fixed — Git ref picker froze the scene on paging; rows now pooled + restyled

- **Clicking the pager arrow in the historical/evolution Git selector could freeze ("collapse") the whole scene.** Each render destroyed and rebuilt every row and tab (~16 entity insert/removes per click); the controller panel runs a `childList` MutationObserver that re-scans the panel and re-toggles raycast classes on every DOM insertion, so a rebuild stormed the observer and raycaster. The shared `CodeXRGitRefPickerRuntime` now uses a **fixed row pool**: rows and tabs are created once and every render only updates their attributes (value/colour/visibility) — measured **0 childList mutations per pager click** (was ~16), so the observer and raycaster stay quiet. Rows were also restyled to the compact-modern controller language: a left accent chip coloured by ref type, the name over a muted date, the subject, and a coloured type chip. Verified in the browser harness: paging advances correctly with the pooled rows and produces no node mutations.

### Changed — unified Git-reference facility shared by the two Git analyses

- **Historical comparison and project evolution both let the user pick things out of `.git` (working copy, branches, tags, commits) and are only selectable inside a repo — that logic is now shared instead of duplicated.** New `CodeXRGitRefPickerRuntime` (`templates/components/common/codexrGitRefPickerRuntime.js`, global `window.CodeXRGitRefPickerRuntime`) owns the controller-side Git facility both analyses drink from: the detection **vocabulary** (`describeSource`, `sourceCategory`, `filterByCategory`, one type label/colour table — LIVE/BRANCH/TAG/COMMIT/MERGE), an **embeddable visual picker** (`createPicker`) with two modes — `compare` (two slots + category tabs, historical) and `sequence` (ordered multi-select with click-order badges, project evolution) — that render the exact same row markup, and `registerGitGatedMode` for the shared "disabled unless inside a Git repo" mode option. Each analysis embeds the picker into its own controller panel and keeps only its mode-specific actions/plumbing; the hand-rolled row/parse/paging/tab code, the per-analysis type-label/colour copies, and the duplicated availability gating were deleted. Backend detection was already shared via `GitRepositoryService`; its two identical `getAvailability()` copies collapsed into `GitRepositoryService.getAvailability(reason)`. Load order: after `codexrCommonRuntime.js`, before the two Git runtimes (wired through both XR parsers). Verified in the browser harness: compare and sequence pickers render the identical visual language, click-order badges number in the order clicked (1→2→3), and both analyses still gate/enter their existing compare/generate flows.

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








