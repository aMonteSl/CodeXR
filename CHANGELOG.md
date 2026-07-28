# Changelog

## [1.2.0] - Unreleased

### CodeXR 1.2.0 — "Threads, Timelines & Global Networks"

**Threads** are the new dependency graph: the lines that tie your codebase together. **Timelines** are the two Git analyses — compare two points in your project's history, or replay the whole thing as a film. **Global Networks** are the sessions you can now open to someone who is not on your network at all.

CodeXR 1.2.0 turns the extension into a shared XR workspace. Three new ways to look at a codebase join the classic analysis, the people you work with now have a name and a face inside the scene, and a session can be opened to someone on a different network without touching your router.

#### Added

##### Dependency graph — see the architecture, not just the files

The classic analysis answers *how complex is each file*. The dependency graph answers a different question: **what depends on what, and what happens if I touch this**. It is the third mode of the analysis table and it renders the project as a navigable 3D graph.

- **How it works.** Language adapters statically extract the relations present in your working directory — imports, includes, requires, inheritance, implementation and calls — across the 23 languages of the metric contract. Each relation declares its own quality: `exact` when the syntax states the dependency outright, `best-effort` when the syntax is there but name resolution may be partial, and `unsupported` when that adapter cannot provide it. Nothing is inferred from complexity metrics, nothing is fetched from GitHub or GitLab, and BabiaXR is left untouched — this is a CodeXR component with its own nodes, edges and layout worker.
- **Three layouts**, computed in a Web Worker so a large graph never freezes the scene: `force-3d` (a bounded spatial distribution), `hierarchical` (directed levels by incoming dependencies) and `metric-space` (X and Z derived from the metrics you choose, with real axes and readable tick steps).
- **It stays usable on big projects.** A rendered view is capped at 600 nodes and 2,000 edges; beyond that the graph opens in **group view**, aggregating by the first path segment — summing metrics, merging equivalent edges and dropping the self-edges aggregation would create — and you drill into a group to reach its files. Cycles are detected with strongly connected components and only between internal files, so an external package never invents a cycle in your project.
- **What you can do in it.** Point at a node to see its path, language and metrics, or at an edge to see its kind, confidence and how many times it occurs; click to pin that card and its highlight. Selecting a node dims everything unrelated so its dependency neighbourhood stands out. Detail cards always face you, in desktop, mobile and immersive XR alike. Hovering and pinning are deliberately local: they never overwrite what another participant is inspecting.

##### Graph metrics — what they are for

The graph publishes a metric set per node, and any of them can drive **size, height, colour or X/Z position**. That is the point: mapped to geometry, *"the thing that breaks the most if you touch it"* becomes something you see across the room instead of something you find by reading a table.

- `fanIn` — how many files depend on this one. High fan-in means expensive to change: everyone will feel it.
- `fanOut` — how many files this one depends on. High fan-out means fragile: it breaks when any of them moves.
- `degree` and `relationCount` — total coupling and how dense its relations are.
- `dependentCount` — the direct blast radius of a change.
- `cycleSize` — the size of the strongly connected component this file belongs to; anything above 1 is a dependency cycle worth untangling.
- `totalLines` — size, so you can cross it with the rest: a small file with huge fan-in is a very different problem from a large one nobody imports.

##### Historical comparison — what changed between two points in time

Two states of the same target, side by side on one dual table. **Objective:** answer *what did this refactor actually do to the code* without leaving XR and without disturbing your repository.

- **How it works.** Pick two sources — the live working copy, a local branch, a remote branch you already have, a tag, or one of the 50 most recent commits. CodeXR materializes temporary snapshots and analyses them: it never runs `checkout` or `fetch`, and never writes inside `.git`, so your active branch, your index and your files are exactly where you left them. It talks to the local `git` binary, not to a hosting provider's API, so GitHub, GitLab, Bitbucket, Gitea or a self-hosted server all work the same — the only requirement is a normal local clone.
- **What you get.** Both sides keep the chart type and the metric mapping of the original analysis, so the comparison is visually honest instead of two charts drawn by different rules. Alongside them, a comparison card reports added / removed / modified / unchanged counts and a per-metric table with signed deltas. Changing a mapping applies to both sides at once.

##### Project Evolution — the trend, not two snapshots

Where the comparison shows two photographs, Project Evolution plays **the film**: a single full-size chart whose data source walks the project's own history from older commits to recent ones.

- **How it works.** By default CodeXR builds the timeline automatically from local Git history, sampling it **evenly in time** rather than every Nth commit (so a busy week does not eat the whole movie), preferring a merge or a tag when one falls inside a slot, and always anchoring the ends — the first revision, and the current state of the branch as the final frame. You can also pick a **range** between two points, or select frames **manually** in your own order. Long histories are sampled to a bounded number of frames so playback stays usable in a headset.
- **What you can do.** Play and pause, step to the previous or next frame, change speed, and click anywhere on the timeline to jump. Each frame swaps the chart's data source and waits for the table to settle before advancing, so the result reads as a sequence of stable scenes instead of a flicker of numbers. An overlay above the table names the revision, date and frame you are looking at. The Field Mapping panel stays available while you watch, so you can change chart or metric mid-review, and `Clear movie` resets the mode for everyone in the shared room without touching the normal analysis' data.

##### Cross-network sessions — optional, and never required for VR

**Your headset does not need any of this.** A VR session over your own network is the complete experience: the analysis server already speaks HTTPS for WebXR, and a headset on the same Wi-Fi opens the scene directly. Cross-network exists for the other case — someone who is *not* on your network — and it stays **off by default**.

- **How you connect someone.** Enable cross-network connections in `SERVERS`, then start remote access on the server you want to share. `cloudflared` opens an **outbound** tunnel to Cloudflare — your router never has to accept a new inbound connection, and CodeXR does not publish your IP — and the invitation link lands on your clipboard. Your guest opens it, picks the name they will appear with, and CodeXR shows **you**, in VS Code, a temporary six-digit code with a *Copy code* button. You pass that code to them however you already talk; they type it and they are in.
- **The code is the gate.** It expires, it allows a limited number of attempts, and a wrong one **burns itself immediately** and warns you — with a one-click action to issue a replacement. Behind it: one-use browser tokens, an `HttpOnly` session cookie, per-address rate limits, and complete revocation of invitations, sessions and credentials the moment you stop sharing (the random URL simply ceases to exist). `cloudflared` itself is pinned to 2026.5.2, downloaded only with your consent and verified by SHA-256 before it is ever executed.
- Another VS Code running CodeXR can join from `Join Remote Session` using its own configured profile, instead of pasting a link into a browser.

##### Screen sharing that survives the trip

Peer-to-peer video cannot cross two different NATs without a TURN server, so guests arriving through the tunnel are served **by your own CodeXR server**, over the connection they already have. The browser encodes once for the whole audience (VP8 + Opus through WebCodecs, images where WebCodecs is missing), quality follows the audience size automatically, and temporal layers let a single congested viewer degrade on their own. There is no viewer limit; the screen tells the host how many people are watching and roughly what it is costing their upload.

##### An in-room user guide

A guide screen lives inside the scene, so the answer to *what am I looking at* never requires taking the headset off. It has **six tabs** — Start, Normal, Deps, History, Evolution and Tips — each carrying the accent colour of the mode it explains, and four of them include a **glossary of the metrics involved** (24 terms in total, with definitions taken from the real analysis contracts rather than written separately, so they cannot drift from what the charts actually show). The same guide is also served as a `guide.html` page next to the scene, for reading it outside XR. It behaves like any other screen: drag it by its edges, resize from the corners, minimize it when you are done.

##### The rest

- **Collaboration 2.0 — the people in the room.** Persistent identities (anonymous with a stable alias, or a custom Unicode name), authoritative host/guest roles with automatic promotion and host transfer, and a **bundled animated glTF avatar** (CC0, 0.44 MiB — nothing is downloaded, it works offline from the moment you install). Every participant gets their own colour over the model and a name tag above their head that always turns to face you. The host can inspect any connected participant from VS Code and remove them from the session; guests are told when the host closes it instead of being left staring at a dead scene.
- **Screen controls with roles.** Each screen offers *Share* when it is free, a green *Join · name* when someone is broadcasting on it and you are not watching, and *Stop/Leave* according to your role. One screen has one broadcaster (enforced by the server, with a clear message naming who holds it) while one person may broadcast different content on several screens.
- **Collision bumpers**, so screens stop at the room walls and at each other instead of passing through.
- **LivePanel gains two sections.** *Dependency Summary* (node, edge, external and cycle counts, top fan-in/fan-out rankings, external dependencies, cycle groupings, and confidence/capability breakdowns) and *Historical Comparison* (the same comparator engine, in 2D: pick two versions and get counts, a metric totals chart and a searchable table of per-item deltas). A comparison with a working-copy side stays live — every incremental re-analysis refreshes it. File comparisons are strictly file-scoped and compare function by function. Every list in both panels now shares one searchable, sortable table component, and the file panel was modernized to the directory panel's standard.
- **A reorganized VS Code sidebar.** `COLLABORATION` now lives inside `ACTIVE SERVERS` — the servers you host and the session you join in one place. Server rows are organized around the cross-network setting (local address, remote connection, connected users, actions), a click on any connected user opens their details, and every server dialog is a readable native dialog. New entries elsewhere: `Reset to Default` in VISUALIZATION SETTINGS, `About BabiaXR` in BABIA EXAMPLES, a 3D-model attribution card, and `Meet the Creator` in LEARN MORE & SUPPORT.
- **A new setting in SERVERS** to enable or disable cross-network connections, which governs whether the tunnel actions appear on your servers at all.
- **The CodeXR mark, in 3D, while the table is empty.** Between analyses — and while a heavy one is being prepared — the table used to sit blank. The logo now assembles itself over it, letters sliding into the visor, turns slowly, and takes itself apart when your analysis arrives. It is decoration and behaves like it: it never intercepts a click, and it holds perfectly still if your frame rate is under pressure or your system asks for reduced motion.
- **AR brings the pedestal to you.** Entering AR hides the virtual room and environment (that part already worked) and now also recenters you: the pedestal, its controller and the screens appear a step in front of you, on your own floor, instead of seven virtual metres away — possibly behind a real wall. Exiting restores your exact previous position. VR is untouched: the full room stays visible.
- **Preview AR and VR without a headset.** `CodeXRDebug.simulateAR()`, `simulateVR()` and `exitSimulated()` in any generated scene's browser console show what each immersive mode hides, keeps and where it places you. They are not a WebXR session — no headset pose, stereo or passthrough — and say so; see `docs/XR_DEBUG_COMMANDS.md`. For the full experience — emulated controllers with working thumbsticks and triggers included — there is a step-by-step Spanish tutorial for Meta's Immersive Web Emulator in `docs/TUTORIAL_EMULADOR_WEBXR.md`.
- **Walk, turn and fly with the thumbsticks.** The left stick moves you — fluidly, toward where you are looking — and the right stick turns you smoothly, the standard VR scheme, driven entirely by A-Frame's own controls rather than custom code. Flying is automatic in VR and AR: look up and push forward to rise over the city, look down to come back; on desktop you stay on the ground with WASD as always.

#### Changed

- **The analysis controller switches between analyses.** The in-scene selector routes to each mode's own view and mapping context, so moving between the classic table, the dependency graph, a comparison and the movie keeps each one's state instead of resetting it. Leaving and returning to an analysis restores what you had.
- **The table (pedestal) serves every analysis type**: the single chart, the comparator's dual table, the graph and the movie's full-size chart, each with its own containment so charts stay inside the useful area.
- **The chart type can be changed live** from CodeXR Field Mapping, applying that chart's own default axes; a change that produces invalid geometry reverts itself with a message.
- **Every axis now offers every field BabiaXR really accepts.** Categorical dimensions were typed too strictly — the bars X axis grows from 4 candidate fields to all 27 — while `size` and `area` are declared numeric-positive, since negatives break pie/donut angles. File analysis' preferred defaults no longer name fields that do not exist in its schema.
- **The way into the analysis selector says what it is.** The control panel used to open it from a small blue square holding the single letter `V` — at the panel's real size that glyph is about five millimetres tall and tells you nothing. It is now a proper button labelled **Analyses**, and it wears the colour of the analysis you are currently in (the same colour that tints the table), so the panel tells you where you are before you even open it.
- **Legends** render as multiple non-overlapping cards in a compact, richer style, and billboard to your face rather than to an idle controller.
- **Product identity**: visible references are `CodeXR` (the extension identifier stays the compatible `code-xr`), documentation points at the project's own domain, the README and LEARN MORE credit the author, and the guest pairing page wears the CodeXR identity. The whole sidebar, its dialogs and the remote-access messages are now in English.

#### Fixed

- **The laser points where the controller points.** Touch controllers are held at an angle to the direction they aim, and A-Frame compensates for that when it sets up the ray — but the scene overrode it with a hand-written raycaster, so the beam left the controller some 40° high and you aimed at the ceiling instead of the table. The controllers are now declared the way A-Frame expects, both hands identically.
- **Either controller points and clicks.** The left one used to be inert. The pointer now follows whichever controller you last used — pull its trigger, press a button or push its stick and it takes over — so you can work with either hand without thinking about it. Only one pointer is ever live at a time, which is what keeps chart legends from tearing.
- **One active pointer at a time.** Chart legends respond to the mouse in a browser, to your gaze in VR without controllers, or to the laser once controllers connect. Scenes shipped with the mouse cursor still live inside VR and the second controller acting as an unfiltered third pointer, which corrupted the legends' show/hide cycle and left orphan legends behind. Gazing at a chart in VR now works at all — there was no gaze cursor before.
- **A fitted chart stops resizing.** The containment system had no terminal state, so charts kept micro-resizing while you simply walked around them; a converged chart now settles and stays put until its content really changes.
- **Dragging a screen no longer "slices"** everything it passes in front of, and invisible screen chrome no longer swallows clicks meant for what is behind it.
- **Screen sharing is reliable.** Starting a share no longer leaves the other participants on "connecting…" and then *Live sharing stopped*, remote guests no longer get a black rectangle, and clicking the content someone else is sharing no longer detaches you from it — it just tells you who is sharing.
- **Servers really stop and leave the list**, even when a shutdown fails (you are told, and the close is forced), and server information dialogs are legible instead of printing raw escape characters.
- **Every chart type now presents properly on the table** — not just Boats. Pie and Donut stand upright (they rendered lying flat like a plate) and keep their circular shape while fitting the table. Cylsmap loads instead of being rejected with "invalid axes" whenever a file had zero functions mapped to the radius. Bubbles is contained instead of towering out of the room at raw metric scale after a chart switch. Bars and Cyls no longer flood the room floor with giant axis labels.
- **Charts stay readable on large projects.** Bar, cylinder, bubble, pie and donut charts show the top files by the mapped metric (BabiaXR draws one element per row and cannot aggregate, so hundreds of rows became an unreadable wall shrunk to nothing), and files sharing a name no longer overwrite each other's bar or pie slice.
- **Switching back to Babia Boats renders immediately.** The chart-switch ghost cleaner mistook a freshly built boats for leftover geometry and deleted it, leaving the table empty until the next mapping change rebuilt it.
- **Bubbles are spheres again, with sizes you can actually compare, and they rest on the table instead of being sliced by it.** A chart switch used to inherit the previous chart's stretched scale (bubbles rendered as vertical lozenges), the default radius metric was so skewed that every typical file was an invisible speck — the default mappings now prefer average complexity for radius and language for the depth axis, which also declutters the map charts — and round-bottomed geometry now clears the tabletop surface.
- **Scenes generated by older builds heal themselves.** Opening an analysis whose pie or donut was generated lying flat now stands it up and applies the current chart presentation at load, without re-running the analysis.
- **The evolution movie no longer falls apart as it plays.** Each frame is a different revision, with different files and folders, and the chart was being morphed from the previous one instead of redrawn — losing buildings it never got back, so a few frames in the city was unrecognizable. Every frame now redraws cleanly: playing forward and stepping back to an earlier revision shows exactly the same thing it showed the first time.
- **A chart that should stand straight no longer inherits a previous chart's tilt.** After using Pie or Donut — which stand at 90° by design — the next chart could come out lying on its side and spilling off the table, most visibly when opening the evolution movie. Orientation now always comes from the chart actually on screen: the movie no longer borrows the scene chart's rotation (nor, through a name mismatch, its Donut component), the comparison clones do the same, and re-applying a mapping converts the chart properly instead of stacking the new one on top of the old.
- **You enter VR and AR at the same height you had in the browser.** Entering an immersive mode used to leave you either floating metres above the room or with your eyes at floor level, under the pedestal, depending on the device. Now the rig carries the eye height for flat screens, and the moment a real WebXR session starts — headset or emulator — it steps aside and lets the device's own floor-tracked pose supply your height instead of stacking on top of it. The result is the same standing view everywhere: browser tab, desktop simulate commands, WebXR emulator, and headset. And since flying is enabled in immersive modes, you can adjust freely from there.

#### Internal

- `HttpServer` was split by responsibility (HTTP helpers and static assets, remote pairing and authorization, the collaboration session API, and the analysis feature host with its bridges), with the façade keeping its public surface; the XR/DOM template layer was refactored with no behaviour change.
- The automated gate grew to more than 400 tests — Node unit tests, the Python analysis suites, and Playwright harnesses for chart containment, analysis-mode cycling and project-evolution playback — plus a per-language end-to-end metrics matrix.
- A dedicated immersive-semantics harness (`test:xr-immersive-harness`) runs the AR/VR contract against real A-Frame in Chromium: what AR hides (environment + room) and keeps (pedestal, charts, panel, screens), the rig floor-alignment and AR recenter, and the mouse → gaze → laser pointer handover, plus a static contract pinning both scene templates.

#### Validation & feedback

- **XR hardware validation status**: like 1.1.0, this release was validated on desktop browsers and through the automated gate above, **not on physical VR headsets or real VR controllers**. The controller-facing paths are built on standard A-Frame/WebXR bindings and verified statically, but if anything misbehaves on real hardware — or anywhere else — **please report it** at [GitHub Issues](https://github.com/aMonteSl/CodeXR/issues) so it can be fixed; a device name and a short description are enough.
- If CodeXR is useful to you, a ⭐ on [GitHub](https://github.com/aMonteSl/CodeXR) or a review on the [Marketplace](https://marketplace.visualstudio.com/items?itemName=aMonteSl.code-xr) helps the project reach more people, and ideas or improvement proposals are genuinely welcome in Issues.

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








