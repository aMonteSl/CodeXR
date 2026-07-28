# CodeXR — Code analysis you can walk through

![The CodeXR room: the dependency graph on the pedestal table, two participants with name tags, the in-room guide and a shared virtual screen](https://raw.githubusercontent.com/aMonteSl/CodeXR/v1.2.0/media/v1.2.0/hero.png)

CodeXR is a Visual Studio Code extension that analyzes your code — complexity, size, structure, dependencies, history — and turns the numbers into something you can actually look at: a 3D scene served locally and opened **in the browser you already have**. Walk around your codebase like a city, watch it update live as you edit, compare two points of its Git history side by side, or replay its whole evolution as a film.

**No VR headset required.** Everything works on a normal desktop with mouse and keyboard, and the 2D LivePanel mode doesn't even leave VS Code. If you do have a headset, the same scene becomes immersive — that's the XR in CodeXR: an extra dimension when you want it, never a requirement.

Everything runs on your machine: local analysis, local servers, no telemetry, no account, and nothing is downloaded without asking you first.

[![License: GPLv3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/aMonteSl.code-xr)](https://marketplace.visualstudio.com/items?itemName=aMonteSl.code-xr)
[![Active Installations](https://img.shields.io/visual-studio-marketplace/i/aMonteSl.code-xr?label=Total%20Downloads)](https://marketplace.visualstudio.com/items?itemName=aMonteSl.code-xr)
[![Visual Studio Marketplace Rating](https://img.shields.io/visual-studio-marketplace/r/aMonteSl.code-xr)](https://marketplace.visualstudio.com/items?itemName=aMonteSl.code-xr)
[![A-Frame Version](https://img.shields.io/badge/A--Frame-1.7.1-brightgreen)](https://aframe.io/)
[![WebXR](https://img.shields.io/badge/WebXR-Compatible-blue)](https://webxr.org/)
[![BabiaXR](https://img.shields.io/badge/BabiaXR-Powered-purple)](https://babiaxr.gitlab.io/)
[![Platform](https://img.shields.io/badge/Platform-VS%20Code-blue)](https://code.visualstudio.com/)
[![HTTPS](https://img.shields.io/badge/HTTPS-Supported-green)](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts)
[![Node.js](https://img.shields.io/badge/Node.js-16%2B-green)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.7%2B-blue)](https://www.python.org/)
[![Documentation](https://img.shields.io/badge/Docs-Official%20Website-blue)](https://code-xr.adrianmonteslinares.com/)
[![Author](https://img.shields.io/badge/Author-adrianmonteslinares.com-lightgrey)](https://adrianmonteslinares.com/)
[![Support](https://img.shields.io/badge/Support-Buy%20Me%20a%20Coffee-FFDD00?logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/adrianadyrx)

## Official Documentation

**Visit our comprehensive documentation website: [https://code-xr.adrianmonteslinares.com/](https://code-xr.adrianmonteslinares.com/)**

Our official documentation includes:
- **Complete Installation Guide** - Step-by-step setup instructions
- **Interactive Tutorials** - Hands-on learning experiences
- **API Reference** - Detailed technical documentation
- **Video Guides** - Visual walkthroughs of key features
- **Troubleshooting** - Solutions to common issues
- **Advanced Configuration** - Customization options and settings

*You can also access the documentation directly from VS Code through the CodeXR tree view → "Learn More" section.*

## What's New in v1.2.0 — "Threads, Timelines & Global Networks"

**Threads** are the new dependency graph: the lines that tie your codebase together. **Timelines** are the two Git analyses — compare two points in your project's history, or replay the whole thing as a film. **Global Networks** are the sessions you can now open to someone who is not on your network at all.

One analysis table now serves **four analyses**, and you switch between them from inside the scene without losing the state of any of them.

### Classic analysis, sharper and live

The city you know — one building per file, sized and coloured by the metrics you choose — on a rebuilt table. Every chart type (bars, cylinders, pie, donut, bubbles, boats and more) now presents correctly and can be changed live from the Field Mapping panel, big projects stay readable by showing the top files per metric, and any change you save in the editor updates the scene by itself.

![Classic analysis demo: the boats city, live chart switching from the Field Mapping panel](https://raw.githubusercontent.com/aMonteSl/CodeXR/v1.2.0/media/v1.2.0/videos/normal/normal_analysis_demo.gif)

▶ **[Watch the full demo on YouTube](https://youtu.be/76p1ibPaf3I)**

### Dependency graph — see the architecture, not just the files

A new analysis that answers *what depends on what, and what happens if I touch this*. Relations are extracted statically from your working directory across the supported languages, and rendered as a navigable 3D graph with three layouts — `force-3d`, `hierarchical` and `metric-space` with real axes. Any node metric (fan-in, fan-out, cycle size, blast radius…) can drive size, height, colour or position, so *"the thing that breaks the most if you touch it"* becomes something you see across the room. Click a node to pin its metric card; large projects open in group view and you drill in.

![Dependency graph demo: three layouts, node cards and relation filters](https://raw.githubusercontent.com/aMonteSl/CodeXR/v1.2.0/media/v1.2.0/videos/dependency/dependency_analysis_demo.gif)

![The pinned node card: fan-in, fan-out, degree, relations, cycle, lines and instability for a directory](https://raw.githubusercontent.com/aMonteSl/CodeXR/v1.2.0/media/v1.2.0/analysis/xr/dependency/dependency_node_card.png)

▶ **[Watch the full demo on YouTube](https://youtu.be/42hIQTUD0-g)**

### Historical comparison — what changed between two points in time

Pick two sources — working copy, branch, tag or commit — and CodeXR puts both states on one dual table, same chart, same mapping, same scale, so a height difference is a real difference. A comparison card reports added / removed / modified counts and per-metric deltas. It never runs `checkout` or `fetch` and never writes inside `.git`: your branch, index and files stay exactly where you left them.

![Historical comparison demo: two revisions of the same project, side by side](https://raw.githubusercontent.com/aMonteSl/CodeXR/v1.2.0/media/v1.2.0/videos/historical/historical_comparison_demo.gif)

▶ **[Watch the full demo on YouTube](https://youtu.be/b37qDCQeZg0)**

### Project Evolution — your Git history as a film

Where the comparison shows two photographs, Project Evolution plays the movie: the chart walks the project's own history, commit by commit, from the first revision to the current state of the branch. The timeline is sampled evenly in time (favouring merges and tags), or you pick a range, or exactly the commits you want. Play, pause, step, change speed, jump anywhere — every frame is a full analysis, labelled with its commit and date.

![Project Evolution demo: the city rising and reorganising through the project's commits](https://raw.githubusercontent.com/aMonteSl/CodeXR/v1.2.0/media/v1.2.0/videos/project_evolution/project_evolution_demo.gif)

▶ **[Watch the full demo on YouTube](https://youtu.be/Qs1OHWCqXSs)**

### And the rest of 1.2.0

- **Collaboration 2.0** — persistent identities, host/guest roles with automatic promotion, and a bundled animated avatar (CC0, works offline) with a per-participant colour and a name tag that always faces you.
- **Cross-network sessions, optional and off by default** — share a session with someone outside your network through an outbound Cloudflare tunnel: no router changes, no published IP, a six-digit pairing code that expires and burns itself on a wrong attempt, and full revocation the moment you stop sharing.
- **Screen sharing that survives the trip** — guests arriving through the tunnel are served by your own CodeXR server; one encode for the whole audience, quality that follows the audience size.
- **An in-room user guide** — six colour-coded tabs plus a 24-term metric glossary generated from the real analysis contracts, also served as `guide.html` for reading outside XR.
- **LivePanel grows two sections** — *Dependency Summary* (counters, top fan-in/fan-out, cycles) and *Historical Comparison* in 2D with a searchable delta table.
- **A reorganized sidebar** — servers, collaboration and remote access in one place, readable native dialogs, and the whole UI in English.
- **The in-scene analysis selector** — a proper `Analyses` button that wears the colour of the analysis you are in:

![The analysis selector panel with the four colour-coded analyses](https://raw.githubusercontent.com/aMonteSl/CodeXR/v1.2.0/media/v1.2.0/controllers/xr/analysis_selector/analysis_selector.png)

The complete list — including a long round of chart, containment and collaboration fixes — is in the [CHANGELOG](CHANGELOG.md).

## Video walkthroughs — v1.2.0

Four narrated videos, one per analysis:

| | |
|:---:|:---:|
| [![Classic analysis walkthrough](https://img.youtube.com/vi/76p1ibPaf3I/hqdefault.jpg)](https://youtu.be/76p1ibPaf3I) | [![Dependency graph walkthrough](https://img.youtube.com/vi/42hIQTUD0-g/hqdefault.jpg)](https://youtu.be/42hIQTUD0-g) |
| **[Classic analysis](https://youtu.be/76p1ibPaf3I)** — the 3D city, Field Mapping and live updates | **[Dependency graph](https://youtu.be/42hIQTUD0-g)** — layouts, node cards, filters and flow |
| [![Historical comparison walkthrough](https://img.youtube.com/vi/b37qDCQeZg0/hqdefault.jpg)](https://youtu.be/b37qDCQeZg0) | [![Project Evolution walkthrough](https://img.youtube.com/vi/Qs1OHWCqXSs/hqdefault.jpg)](https://youtu.be/Qs1OHWCqXSs) |
| **[Historical comparison](https://youtu.be/b37qDCQeZg0)** — two revisions, one table | **[Project Evolution](https://youtu.be/Qs1OHWCqXSs)** — your repository as a film |

## Base tutorials

Everything above builds on the workflows introduced up to v1.1.0 — the UI, the analysis commands, LivePanel and the XR scene basics. These tutorials still describe that foundation accurately:

### Core interface

| | |
|:---:|:---:|
| [![Complete UI tutorial](https://img.youtube.com/vi/KRgLdLZJXHA/hqdefault.jpg)](https://youtu.be/KRgLdLZJXHA) | [![File XR analysis workflow](https://img.youtube.com/vi/j8dgZtmjNks/hqdefault.jpg)](https://youtu.be/j8dgZtmjNks) |
| **[Complete UI tutorial](https://youtu.be/KRgLdLZJXHA)** — the entire CodeXR interface and workflow | **[File XR analysis workflow](https://youtu.be/j8dgZtmjNks)** — single-file analysis in XR |

### File analysis

| | |
|:---:|:---:|
| [![File analysis in LivePanel](https://img.youtube.com/vi/n5ZcjlR4pPc/hqdefault.jpg)](https://youtu.be/n5ZcjlR4pPc) | [![File analysis in XR](https://img.youtube.com/vi/38jGwFGORvc/hqdefault.jpg)](https://youtu.be/38jGwFGORvc) |
| **[LivePanel mode](https://youtu.be/n5ZcjlR4pPc)** — right-click & UI methods | **[XR mode](https://youtu.be/38jGwFGORvc)** — immersive 3D file analysis |

### Directory & project analysis

| | |
|:---:|:---:|
| [![Directory analysis in LivePanel](https://img.youtube.com/vi/sPWjcgV-gZQ/hqdefault.jpg)](https://youtu.be/sPWjcgV-gZQ) | [![Directory analysis in XR](https://img.youtube.com/vi/TnfS2SevtWU/hqdefault.jpg)](https://youtu.be/TnfS2SevtWU) |
| **[Directory — LivePanel](https://youtu.be/sPWjcgV-gZQ)** — detailed directory metrics | **[Directory — XR](https://youtu.be/TnfS2SevtWU)** — 3D directory visualization |
| [![Directory and project XR workflow](https://img.youtube.com/vi/m6FHpENUvtU/hqdefault.jpg)](https://youtu.be/m6FHpENUvtU) | [![Project analysis](https://img.youtube.com/vi/NluAHe3BQu8/hqdefault.jpg)](https://youtu.be/NluAHe3BQu8) |
| **[Directory/project XR workflow](https://youtu.be/m6FHpENUvtU)** — the updated XR flow | **[Project analysis](https://youtu.be/NluAHe3BQu8)** — LivePanel and XR modes |

### DOM & AR

| | |
|:---:|:---:|
| [![DOM visualization](https://img.youtube.com/vi/110b-AergdU/hqdefault.jpg)](https://youtu.be/110b-AergdU) | [![AR programming experience](https://img.youtube.com/vi/d7fojpP90Dk/hqdefault.jpg)](https://youtu.be/d7fojpP90Dk) |
| **[DOM visualization](https://youtu.be/110b-AergdU)** — interactive HTML structure analysis | **[AR programming experience](https://youtu.be/d7fojpP90Dk)** — real-world augmented reality coding |

## Quick Start Guide

### Get Started in 30 Seconds

#### Method 1: From Explorer (Right-Click)
1. **Right-click any file** in VS Code Explorer
2. Choose your analysis mode:
   - **"CodeXR: Analyze File (LivePanel)"** - Detailed metrics panel
   - **"CodeXR: Analyze File (XR)"** - Immersive 3D visualization
   - **"CodeXR: Visualize DOM"** - HTML structure analysis (HTML files only)

#### Method 2: From Tree View
1. Open the **CodeXR tree view** in VS Code sidebar
2. Expand **"Project Structure"** section
3. **Click on any file** to analyze it (respects your configuration preferences)
4. HTML files automatically open DOM visualization
5. Other files use your preferred mode (LivePanel or XR)

#### Method 3: From Command Palette
1. Press **Ctrl+Shift+P** (Windows/Linux) or **Cmd+Shift+P** (macOS)
2. Type **"CodeXR"** to see all available commands
3. Select your preferred analysis mode

#### Directory Analysis
1. **Right-click any folder** in the Explorer
2. Choose your analysis mode:
   - **"CodeXR: Analyze Directory (LivePanel)"** - Standard directory analysis
   - **"CodeXR: Analyze Directory (XR)"** - 3D directory visualization
   - **"CodeXR: Analyze Directory (LivePanel Deep)"** - Recursive subdirectory analysis
   - **"CodeXR: Analyze Directory (XR Deep)"** - Recursive 3D analysis with subdirectories

## Understanding Your Results

### LivePanel Analysis Features
- **Function List**: Sortable table with complexity, lines of code, and parameter counts
- **Complexity Distribution**: Visual charts showing complexity patterns across your codebase
- **Cyclomatic Density**: Advanced complexity metrics per function
- **Drill-down Details**: Click any function for detailed analysis and code navigation
- **Aggregated Metrics**: Directory and project-level summaries
- **Dependency Summary**: Node, edge, external and cycle counters with top fan-in / fan-out rankings
- **Historical Comparison**: Pick two versions and get counts, a metric totals chart and a searchable delta table
- **Export Capabilities**: Save analysis results for documentation and reporting

### XR Visualization Features
- **Four analyses on one table**: The classic chart, the dependency graph, the historical dual table and the evolution movie — switch between them in-scene, each keeps its state
- **3D Charts**: Bars, cylinders, bubbles, pie, donut, boats and more, showing your metrics in 3D space
- **Runs in your browser**: Mouse/keyboard navigation on any desktop; the same scene works with WebXR controllers when a headset is present
- **Real-time Updates**: Changes in your code immediately reflect in the visualization
- **Customizable Mapping**: Choose what metrics map to each dimension and colour, live, from inside the scene
- **Spatial Understanding**: Visualize code complexity relationships in 3D space
- **Multi-file Visualization**: See entire directories and projects at once

### DOM Visualization Features
- **Interactive Tree**: Click to expand/collapse DOM elements
- **Element Details**: View attributes, content, and hierarchy information
- **Visual Hierarchy**: Clear parent-child relationships in tree structure
- **Real-time Updates**: See DOM changes as you edit HTML files

## Analysis Modes Overview

CodeXR offers powerful analysis modes, each optimized for different file types and use cases. **All analysis modes support 24 code languages plus HTML DOM visualization** with comprehensive file, directory, and project analysis capabilities.

### LivePanel Analysis Mode
**Best for:** Detailed metrics review, reporting, and comprehensive code analysis without leaving VS Code

**Features:**
- Comprehensive function-level analysis with accurate metrics
- Enhanced complexity distribution charts with improved layout
- Cyclomatic density calculations and complexity metrics
- Interactive drill-down panels for detailed function analysis
- Dependency Summary and 2D Historical Comparison sections
- Real-time updates as you edit code, directories, and projects
- Export capabilities for reporting and documentation
- Support for both standard and deep analysis modes

### XR Analysis Mode
**Best for:** Spatial exploration of a codebase — in your desktop browser, and optionally in VR/AR

**Features:**
- Four analyses served by one table: classic metrics city, dependency graph, historical comparison and Project Evolution
- Immersive 3D visualizations with bars, cylinders, bubbles, boats, and more
- Real-time updates as you edit code, directories, and projects without leaving the scene
- Full mouse + keyboard support in any desktop browser; A-Frame/WebXR controller bindings when a headset is connected
- Multi-dimensional metric mapping (complexity, LOC, parameters, file size), changeable live from the in-scene Field Mapping panel
- Customizable environments and color palettes for optimal viewing
- Support for both standard and deep analysis modes

### DOM Visualization Mode
**Best for:** HTML structure analysis and web development

**Features:**
- Interactive DOM tree exploration with click-to-expand functionality
- Element hierarchy visualization with clear parent-child relationships
- Real-time DOM structure analysis and attribute inspection
- Automatic routing from any analysis command when dealing with HTML files
- Element details including attributes, content, and positioning

## Comprehensive Analysis Capabilities

### Common Analysis Features (All Types)
**Universal capabilities available for files, directories, and projects:**

- **24 Code Languages + HTML DOM**: Full support for JavaScript, TypeScript, Python, C/C++, C#, Java, Ruby, Go, PHP, Swift, Kotlin, Scala, Lua, Erlang, Zig, Perl, Solidity, TTCN-3, Objective-C, Fortran, GDScript, Vue, plus HTML DOM visualization
- **Cyclomatic Complexity**: Industry-standard complexity calculation using Lizard integration
- **Lines of Code Metrics**: Total lines, code lines, comment lines, and blank lines with language-aware parsing
- **Function Analysis**: Function count, parameter analysis, complexity per function, and cyclomatic density
- **Class Detection**: Object-oriented structure analysis including inheritance, interfaces, and nested classes
- **Comment Analysis**: Language-specific comment detection (single-line, multi-line, documentation)
- **Real-time Updates**: Automatic re-analysis when content changes (applies to all analysis modes: LivePanel, XR, DOM)
- **Multiple Visualization Modes**: Choose between LivePanel (detailed panels), XR (immersive 3D), or DOM (HTML structure)

### File Analysis Specifics
**Individual file deep-dive analysis:**

- **Single File Focus**: Concentrated analysis of one file with detailed function-by-function breakdown
- **Function-level Metrics**: Individual function complexity, parameters, and lines of code
- **Code Navigation**: Direct navigation to specific functions and classes from analysis results
- **Instant Analysis**: Immediate results for quick code quality assessment
- **Export Individual Reports**: Save detailed reports for specific files

### Directory Analysis Specifics
Complete directory analysis implementation

- **Batch Processing**: Analyze entire directories with progress tracking and status updates
- **Recursive Scanning**: Deep analysis modes for comprehensive subdirectory traversal (configurable depth)
- **Hierarchical Metrics**: Aggregated complexity and LOC metrics across directory structures
- **Smart File Detection**: Automatic identification and filtering of analyzable files by extension
- **Directory-level Reporting**: Combined metrics showing directory complexity distribution
- **Subdirectory Comparison**: Compare complexity across different subdirectories
- **Large Directory Optimization**: Efficient processing of directories with hundreds of files
- **Selective Analysis**: Option to exclude certain subdirectories or file patterns

### Project Analysis Specifics
**Workspace-wide comprehensive analysis:**

- **Workspace-wide Scanning**: Analyze entire VS Code workspaces including all folders and subprojects
- **Cross-language Metrics**: Combined complexity metrics across different programming languages
- **Project Architecture Insights**: Understand overall project complexity distribution and hotspots
- **Language Distribution Analysis**: See what percentage of your project is in each programming language
- **Project-level Aggregation**: Total lines of code, functions, classes, and complexity across entire project
- **Comprehensive Reporting**: Detailed analysis reports covering entire project structure and complexity
- **Large Project Optimization**: Optimized for analyzing projects with thousands of files

## Supported Languages

CodeXR provides comprehensive analysis for 24 code languages, plus HTML DOM visualization, through its unified analysis engine:

### Complete Language Support Matrix

| Language | Extensions | Analysis Types | Comment Detection | Class Detection |
|----------|------------|----------------|-------------------|-----------------|
| **JavaScript** | .js, .mjs, .cjs | LivePanel, XR | C-style (//, /* */) | ES6 Classes |
| **TypeScript** | .ts, .tsx | LivePanel, XR | C-style (//, /* */) | Classes & Interfaces |
| **Python** | .py, .pyw, .pyi | LivePanel, XR | Hash (#) + Docstrings | Classes & Methods |
| **C/C++** | .c, .cpp, .cc, .cxx, .h, .hpp, .hxx | LivePanel, XR | C-style (//, /* */) | Classes & Structs |
| **C#** | .cs | LivePanel, XR | C-style (//, /* */) | Classes & Namespaces |
| **Java** | .java | LivePanel, XR | C-style (//, /* */) | Classes & Interfaces |
| **Ruby** | .rb, .rbw | LivePanel, XR | Hash (#) + Block (=begin/=end) | Classes & Modules |
| **Go** | .go | LivePanel, XR | C-style (//, /* */) | Structs & Interfaces |
| **PHP** | .php, .phtml, .php3, .php4, .php5 | LivePanel, XR | C-style + Hash (//, #, /* */) | Classes & Traits |
| **Swift** | .swift | LivePanel, XR | C-style (//, /* */) | Classes & Structs |
| **Kotlin** | .kt, .kts | LivePanel, XR | C-style (//, /* */) | Classes & Objects |
| **Scala** | .scala, .sc | LivePanel, XR | C-style (//, /* */) | Classes & Objects |
| **Lua** | .lua | LivePanel, XR | Double dash (--) | Table-based OOP |
| **Erlang** | .erl, .hrl | LivePanel, XR | Percent (%) | Modules |
| **Zig** | .zig | LivePanel, XR | C-style (//) | Structs |
| **Perl** | .pl, .pm | LivePanel, XR | Hash (#) | Packages |
| **Solidity** | .sol | LivePanel, XR | C-style (//, /* */) | Contracts |
| **TTCN-3** | .ttcn, .ttcn3 | LivePanel, XR | C-style (//, /* */) | Modules |
| **Objective-C** | .m, .mm | LivePanel, XR | C-style (//, /* */) | Classes & Categories |
| **Fortran** | .f90, .f95, .f03, .f08, .f | LivePanel, XR | Exclamation (!) | Modules & Types |
| **GDScript** | .gd | LivePanel, XR | Hash (#) | Classes |
| **Vue.js** | .vue | LivePanel, XR | HTML (<!-- -->) | Component Analysis |
| **HTML** | .html, .htm, .xhtml | DOM Visualization | HTML Comments | Element Structure |

### Analysis Capabilities by Language

**All Languages Support:**
- Lines of Code (LOC) counting with accurate parsing
- Cyclomatic Complexity analysis using industry-standard algorithms
- Function parameter counting and analysis
- Accurate comment detection with language-specific rules
- Real-time analysis with intelligent file watching
- Multi-file analysis support for batch processing

**Advanced Features:**
- **Comment Analysis**: Language-aware parsing for single-line, multi-line, and documentation comments
- **Class Detection**: Object-oriented structure analysis including inheritance and nested classes
- **Function Metrics**: Parameter counting, complexity scoring, and density calculations
- **File Organization**: Smart sorting and filtering by language in the tree view


## Navigation Controls

### Desktop (no headset needed)
- **Mouse**: Click and drag to rotate view around code visualizations
- **WASD Keys**: Navigate through the 3D space like a first-person game
- **Scroll Wheel**: Zoom in and out for detailed or overview perspectives
- **Arrow Keys**: Alternative navigation for fine-tuned movement

### VR Controllers (optional)
The standard VR scheme, driven by A-Frame's native controls:
- **Left thumbstick**: Move — fluidly, toward where you are looking. In VR and AR you fly: look up and push forward to rise over the city, look down to descend
- **Right thumbstick**: Turn smoothly
- **Trigger**: Point and click, with either hand — the pointer follows whichever controller you last used
- **Gaze**: Before any controller connects, a reticle lets you point with your head

> Controller support is implemented through standard A-Frame/WebXR bindings, but this release has not been validated on physical headset hardware — see [Feedback](#support-feedback--community) below.

## Managing Active Analyses

The **"Active Analyses"** section in the tree view provides comprehensive session management:

- **View Status**: See which files, directories, or projects are currently being analyzed
- **Prevent Duplicates**: Automatically prevents multiple analyses of the same target
- **Left-Click Action Menu**: Click any active analysis to open its action menu with details, browser access, export, and close options
- **Easy Cleanup**: Close analyses you no longer need to free system resources
- **Session Details**: View detailed information about each active analysis
- **Browser Integration**: Open analyses directly in your browser
- **Export for Debugging**: Copy the full generated analysis folder to any location for manual inspection or debugging

## Configuration and Customization

### Analysis Settings
Access settings directly from the tree view or VS Code preferences:

- **Default Analysis Mode**: Choose between LivePanel and XR as your default
- **Deep Analysis Settings**: Configure default behavior for directory and project analysis
- **Debounce Timing**: Adjust how quickly analysis responds to code changes
- **Auto-analysis**: Enable/disable automatic re-analysis on file save
- **File Filtering**: Configure which file types to include/exclude from analysis
- **Cross-network Connections**: Enable or disable remote-access actions on your servers (off by default)

### XR Environment Settings
Customize your scene:

- **Chart Types**: Bars, cylinders, bubbles, boats, and more visualization options
- **Color Palettes**: Business, Blues, Commerce, Flat, Foxy, and other professional themes
- **Environment Themes**: Forest, Dream, City, Space, and more immersive backgrounds
- **Dimension Mapping**: Customize what metrics map to 3D dimensions and colors
- **Performance Settings**: Adjust rendering quality for your hardware

## Installation & Setup

### Prerequisites
- **VS Code**: Version 1.98.0 or higher
- **Python**: Automatically configured on Windows, Linux, and macOS (isolated virtual environment created if needed)
- **A modern browser**: Chrome, Edge or Firefox for the 3D scenes; a WebXR-capable browser only if you want the immersive mode
- **VR/AR hardware**: Entirely optional

### Quick Installation
1. Open **Visual Studio Code**
2. Go to **Extensions** (Ctrl+Shift+X)
3. Search for **"CodeXR"**
4. Click **"Install"**
5. **Restart VS Code** for full functionality

### First-Time Setup
- CodeXR automatically sets up the Python environment on first use
- No additional configuration required for basic functionality
- HTTPS certificates are generated locally on first startup and stored in the extension's VS Code global storage for WebXR compatibility
- Virtual environment (.venv) is created automatically for isolated dependencies

## Real-World Use Cases

### Code Quality Assessment
- **Before Code Reviews**: Quickly identify complex functions that need attention
- **Refactoring Planning**: Visualize complexity hotspots across your entire codebase
- **Impact Analysis**: Use the dependency graph to see what a change will touch before you make it
- **Technical Debt**: Track complexity trends over time with Historical Comparison and Project Evolution
- **Code Standards**: Ensure code meets complexity and quality standards

### Team Collaboration
- **Architecture Discussions**: Share 3D visualizations in team meetings — locally or across networks
- **Onboarding**: Help new team members understand codebase structure, with the in-room guide answering "what am I looking at"
- **Code Reviews**: Enhanced visual context for reviewing complex code
- **Shared Working Sessions**: Create or move shared virtual screens, remap charts, and watch other participants interact with the same live room in real time

### Educational Purposes
- **Learning Patterns**: Visualize how different programming patterns affect complexity
- **Algorithm Comparison**: Compare multiple implementations in 3D space
- **Code Metrics Education**: Understand complexity metrics through interactive visualization
- **Programming Courses**: Teach software engineering concepts with visual aids

## Performance Tips & Best Practices

### Performance Optimization
- **Large Files**: Increase debounce delay for files over 1000 lines
- **Resource Management**: Close unused analyses to free system resources
- **Directory Analysis**: Use standard mode first, then deep mode for comprehensive analysis
- **Multiple Projects**: Use LivePanel mode for quick analysis, XR for deep exploration

### VR/AR Best Practices (if you use a headset)
- **AR Mode**: Use on mobile devices or AR headsets for best experience
- **VR Navigation**: Take breaks during long analysis sessions to prevent fatigue
- **Controller Setup**: Ensure controllers are charged before starting VR sessions — and please report any controller issue you hit, since this release could not be validated on physical hardware
- **Lighting**: Ensure adequate room lighting for AR tracking

### Analysis Workflow
1. **Start with LivePanel**: Get overview with LivePanel analysis
2. **Explore in 3D**: Open the XR mode in your browser for spatial exploration of complex code
3. **Use Active Analyses**: Monitor all open visualizations from tree view
4. **Configure Settings**: Adjust debounce timing based on your coding style
5. **Directory Analysis**: Start with standard mode, use deep mode for comprehensive coverage

## Technical Architecture

### Analysis Engine
- **Python-based Coordinators**: Redesigned Python-based analysis coordinators for better accuracy
- **Multi-language Parsing**: Advanced parsing capabilities for 24 code languages plus HTML DOM visualization
- **Lizard Integration**: Industry-standard complexity analysis using Lizard tool
- **Dependency Extraction**: Static relation analysis (imports, includes, inheritance, calls) with per-relation confidence
- **Git Snapshots**: Historical analyses materialize temporary snapshots without ever touching your working tree or `.git`
- **Performance Optimization**: Optimized for handling large codebases efficiently

### Visualization Engine
- **BabiaXR Integration**: Powerful 3D rendering using BabiaXR framework
- **A-Frame 1.7.1**: Latest WebXR framework for immersive experiences
- **CodeXR Components**: The dependency graph, containment engine, guide screen and evolution player are CodeXR's own A-Frame components
- **Interactive Panels**: Responsive web panels for LivePanel analysis
- **Real-time Data Binding**: Live updates between code changes and visualizations

### Session Management
- **Unified Registry**: Centralized session tracking and management
- **Lifecycle Management**: Proper initialization, monitoring, and cleanup
- **Progress Tracking**: Real-time progress reporting for long-running operations
- **Error Handling**: Comprehensive error recovery and user feedback

## Dependencies and Requirements

### End-User Requirements
- **Visual Studio Code**: 1.98.0 or higher
- **Node.js**: 16+ for extension runtime
- **Python**: 3.7+ (automatically managed through virtual environment)
- **Memory**: 4GB RAM minimum, 8GB recommended for large projects
- **Storage**: 100MB for extension, additional space for analysis results

### Automatic Dependencies
CodeXR automatically manages the following dependencies:
- **Python Virtual Environment**: Created in `globalStorage` directory from VS Code
- **Lizard**: Code complexity analysis tool
- **tree-sitter-language-pack**: Structured parsers for the XR dependency graph
- **Required Python Packages**: Automatically installed as needed

### Technical Documentation

- [Cloudflare remote access](docs/CLOUDFLARE_REMOTE_ACCESS.md)
- [Historical comparison XR](docs/HISTORICAL_COMPARISON_XR.md)
- [Dependency graph XR](docs/DEPENDENCY_GRAPH_XR.md)
- [XR browser diagnostics](docs/XR_DEBUG_COMMANDS.md)
- [Testing VR/AR without a headset — WebXR emulator tutorial (Spanish)](docs/TUTORIAL_EMULADOR_WEBXR.md)

### Optional Dependencies
- **WebXR Browser**: For the immersive VR/AR experience
- **VR Headset**: Oculus, Valve Index, HTC Vive, etc. (optional)
- **AR Device**: ARCore/ARKit compatible device (optional)
- **cloudflared**: Only for cross-network sessions; version-pinned, downloaded with your consent and SHA-256 verified

## Development

### Building from Source
```bash
# Clone the repository
git clone https://github.com/aMonteSl/CodeXR.git
cd CodeXR

# Install dependencies
npm install

# Compile the extension
npm run compile

# Build for production
npm run package
```

### Build Commands
```bash
# One-time build
npm run compile

# Watch mode for development
npm run watch

# Create VSIX package
npm run package:vsix

# Run tests
npm run test
```

### Development Requirements (Contributors)
- **Node.js**: 16+
- **Python**: 3.7+ (for analysis components)
- **TypeScript**: For extension development
- **Webpack**: For bundling (configured automatically)

## Contributing

We welcome contributions! Here's how you can help:

1. **Fork the repository** on GitHub
2. **Create a feature branch** for your changes
3. **Make your changes** with appropriate tests
4. **Submit a pull request** with detailed description
5. **Follow our coding standards** and include documentation

### Areas for Contribution
- **Language Support**: Add support for additional programming languages
- **Visualization**: New chart types and visualization modes
- **Performance**: Optimization for large codebases
- **Documentation**: Improve guides and examples
- **Testing**: Expand test coverage

## Support, Feedback & Community

### A note on VR hardware

This release was validated on desktop browsers and through CodeXR's automated test suites (unit tests, Python analysis suites and browser harnesses), **but it could not be tested on a physical VR headset**. Everything is built on standard WebXR/A-Frame bindings and should work — if you run CodeXR on real hardware and anything misbehaves, **please [open an issue](https://github.com/aMonteSl/CodeXR/issues)**: a device name and a couple of lines about what went wrong are enough, and every report directly improves the next release.

### Getting Help
- **GitHub Issues**: Report bugs and request features at [GitHub Issues](https://github.com/aMonteSl/CodeXR/issues)
- **Documentation**: Comprehensive guides and examples at the [official website](https://code-xr.adrianmonteslinares.com/)
- **Community**: Share your visualizations and use cases

### Enjoying CodeXR? It helps more than you think
- ⭐ **Star the project** on [GitHub](https://github.com/aMonteSl/CodeXR)
- **Leave a review** on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=aMonteSl.code-xr&ssr=false#review-details)
- **Share your ideas**: feature proposals and improvement suggestions are genuinely welcome in [Issues](https://github.com/aMonteSl/CodeXR/issues) — several v1.2.0 features started as user feedback

## License

This project is licensed under the **GNU General Public License v3.0 (GPLv3)** - see the [LICENSE](LICENSE) file for details.

### GPLv3 Summary
- You can use, study, and modify the software.
- If you distribute modified versions, you must also provide the source code under GPLv3.
- Derivative works distributed to others must remain under GPLv3-compatible terms.
- The software is provided without warranty.

## Acknowledgments

- **BabiaXR Team**: For the powerful visualization framework
- **A-Frame Community**: For WebXR support and immersive web technologies
- **Lizard Tool**: For reliable code complexity analysis
- **VS Code Extension API**: For the extensible platform
- **Open Source Community**: For continuous feedback and contributions

---

**CodeXR v1.2.0 — understand your code by standing in it.** Metrics, architecture and history as places you can visit: from your editor, in your browser and — when you want it — in a headset.

## About the Author

CodeXR is created and maintained by **Adrián Montes Linares**.

- Website: [https://adrianmonteslinares.com/](https://adrianmonteslinares.com/)
- CodeXR site: [https://code-xr.adrianmonteslinares.com/](https://code-xr.adrianmonteslinares.com/)

## Support CodeXR Development

If you find CodeXR valuable and would like to support its continued development, consider buying the developer a coffee:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy_Me_A_Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/adrianadyrx)

Your support helps me:
- Add new features and improvements
- Fix bugs and maintain compatibility
- Provide better support and documentation
