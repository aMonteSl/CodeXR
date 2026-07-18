# Changelog

## [1.2.0] - Unreleased

### Internal — templates refactor (no behavior change)

- **Every oversized browser runtime split into ordered part files.** The ten 1,100–3,900-line runtime files under `templates/components/codexr/` (analysis table, virtual screen, dependency graph, mapping UI, analysis mode, historical comparison, project evolution, chart debug, collaboration, boats prototype) now live as cohesive 100–500-line parts under `codexr/<component>/<runtimeBase>/NN-<section>.js`. A shared assembler (`customComponents/runtimeAssembly.ts`, test mirror `test/helpers/runtimeAssembly.cjs`) concatenates each set back into the exact flat file generated scenes have always shipped — the split was verified byte-identical per runtime, so generated analysis output is unchanged. Component assets now delegate to the assembler; manual XR harnesses load assembled copies from `test/manual/assembled/` (built automatically by the harness runners, or via `node test/manual/buildAssembledRuntimes.cjs`).
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








