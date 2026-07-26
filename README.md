# CodeXR - Code Visualization in Extended Reality (v1.2.0)

> La colaboración entre redes usa Cloudflare Quick Tunnel como servicio temporal
> sin SLA. Consulta [cómo funciona, sus límites y consideraciones de
> privacidad](docs/CLOUDFLARE_REMOTE_ACCESS.md).
>
> La arquitectura y el funcionamiento del comparador entre revisiones se
> documentan en [Comparador histórico XR](docs/HISTORICAL_COMPARISON_XR.md).

A revolutionary Visual Studio Code extension that transforms your code analysis into immersive XR visualizations. Experience your code metrics (complexity, lines, parameters) in both traditional VS Code panels and breathtaking XR/VR environments powered by BabiaXR and A-Frame. Dive deep into your codebase with comprehensive file analysis, directory scanning, and interactive DOM visualization.

**Gain unprecedented insights into your codebase by stepping into an XR representation of your code structure that updates in real-time as you work.**

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

## What's New in v1.1.0

> The current `v1.2.0` work is tracked in [`docs/ROADMAP_V1.2.0.md`](docs/ROADMAP_V1.2.0.md), including per-installation identity, shared avatars, an optional one-time glTF download, and protected cross-network sessions through Cloudflare Quick Tunnel.

- **Unified analysis engine**: XR, LivePanel, and DOM now share the same modernized analysis bootstrap and payload contract.
- **Richer real metrics**: File and directory analysis expose corrected ratios, nesting, parameter, complexity-band, and aggregate metrics.
- **Stable DOM XR visualization**: HTML DOM analysis now feeds BabiaXR with the full stringified HTML contract expected by `babia-html`.
- **Shared virtual screens for XR/DOM**: Immersive scenes now include collaborative virtual screens plus a control panel to create, bring, and remove shared screens across connected clients.
- **Live shared screen broadcasting**: Shared screens can project a screen, window, or browser tab with synchronized layout updates and real-time video/audio playback across connected devices.
- **XR analysis table auto-scaling**: XR charts use a shared containment engine that recenters and rescales them in `X`, `Y`, and `Z` within stable viewing bands.
- **In-scene Mapping UI with recovery**: XR scenes now expose a Mapping UI next to the chart so users can remap dimensions live, detect invalid BabiaXR rebuilds, restore the last valid mapping, and disable the failing option for the session.
- **Real-time collaborative XR/DOM sessions**: Connected users can now see shared mapping changes, shared chart updates, shared screen interactions, and remote presence markers with server-assigned display names in the same live session.

## Version Comparison/Improvements v1.0.0 -> v1.1.0

Explore the major visual and functional improvements introduced in CodeXR v1.1.0.

### Visual Scene Enhancements
From a simple A-Frame scenario to a complete immersive room with custom components and textures.

| v1.0.0 | v1.1.0 |
|:---:|:---:|
| ![v1.0.0 Scene](https://raw.githubusercontent.com/aMonteSl/CodeXR/v1.2.0/resources/comparison/scene-v1.0.0.png) | ![v1.1.0 Scene](https://raw.githubusercontent.com/aMonteSl/CodeXR/v1.2.0/resources/comparison/scene-v1.1.0.png) |
| *Simple A-Frame scene* | *Immersive room with custom assets and textures* |

### Analysis Speed & Performance
For the same analysis workflow, execution time drops from **54 seconds** to **3 seconds**.
This means **18x faster execution** and a **94.44% reduction in analysis time**.

| v1.0.0 | v1.1.0 |
|:---:|:---:|
| ![v1.0.0 Speed](https://raw.githubusercontent.com/aMonteSl/CodeXR/v1.2.0/resources/comparison/performance-v1.0.0.gif) | ![v1.1.0 Speed](https://raw.githubusercontent.com/aMonteSl/CodeXR/v1.2.0/resources/comparison/performance-v1.1.0.gif) |
| *54s runtime for the same analysis* | *3s runtime with optimized pipeline* |

### New Virtual Screen Component & Controler
Project any screen, tab, or window from any connected device and broadcast it in real time inside the XR environment, including both video and audio.

<div align="center">

![Virtual Screen and Controler](https://raw.githubusercontent.com/aMonteSl/CodeXR/v1.2.0/resources/screen/virtualScreenAndControler-v.1.1.0.png)

</div>

### New Pedestal/Table Layout componentes & Mapping UI
Includes an analysis table that rescales charts to maintain a stable approximate size and a Mapping UI to change represented data in real time without re-running analysis.

<div align="center">

![Analysis table and Mapping UI](https://raw.githubusercontent.com/aMonteSl/CodeXR/v1.2.0/resources/analysis-table/analysisTableAndMappingUI.png)

</div>

### Interactive Collaborative Workspace
The collaborative server is interactive: users are identified and assigned random names, and every interaction is synchronized so all participants see it live (moving screens, projecting content, changing chart values, and more).

<div align="center">

![Collaborative Workspace](https://raw.githubusercontent.com/aMonteSl/CodeXR/v1.2.0/resources/collaborative/collaborativeWorkspace.png)

</div>

## Visual Demonstrations

### Live Examples - See CodeXR in Action

Experience CodeXR's powerful analysis capabilities through these real-world demonstrations:

#### Project Analysis Examples
<div align="center">

| **BabiaXR Project Analysis** | **Express.js Project Analysis** |
|:---:|:---:|
| ![BabiaXR Analysis](https://raw.githubusercontent.com/aMonteSl/CodeXR/v1.2.0/resources/gifts/analysis_babiaXR.gif) | ![Express Analysis](https://raw.githubusercontent.com/aMonteSl/CodeXR/v1.2.0/resources/gifts/analysis_express.gif) |
| *Directory analysis of BabiaXR project (77 files)* | *Directory analysis of Express.js project (142 files)* |

| **JetUML Project Analysis** | **Single File Analysis** |
|:---:|:---:|
| ![JetUML Analysis](https://raw.githubusercontent.com/aMonteSl/CodeXR/v1.2.0/resources/gifts/analysis_jetuml.gif) | ![File Analysis](https://raw.githubusercontent.com/aMonteSl/CodeXR/v1.2.0/resources/gifts/analysis_file.gif) |
| *Directory analysis of JetUML project (338 files)* | *Simple file analysis demonstration* |

</div>

### Video Tutorials - Complete Learning Experience

Comprehensive video guides to master every aspect of CodeXR.

#### Latest Updates
<div align="center">

**Newest XR Analysis Workflows**

<table>
<tr>
<td align="center" width="50%">
<b>New File XR Analysis Workflow</b><br/>
<iframe width="280" height="157" src="https://www.youtube.com/embed/j8dgZtmjNks" title="New File XR Analysis Workflow" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe><br/>
<i>Explore the updated XR workflow for single-file analysis.</i>
</td>
<td align="center" width="50%">
<b>New Directory/Project XR Analysis Workflow</b><br/>
<iframe width="280" height="157" src="https://www.youtube.com/embed/m6FHpENUvtU" title="New Directory and Project XR Analysis Workflow" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe><br/>
<i>Discover the new XR workflow for directory and project analysis.</i>
</td>
</tr>
</table>

</div>

#### Core Interface & Features
<div align="center">

**Complete UI Tutorial - Master the entire CodeXR interface and workflow**

<iframe width="560" height="315" src="https://www.youtube.com/embed/KRgLdLZJXHA" title="Complete UI Tutorial" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>

</div>

#### File Analysis Workflows
<div align="center">

**File Analysis - LivePanel Mode & XR Mode**

<table>
<tr>
<td align="center" width="50%">
<b>LivePanel Mode</b><br/>
<iframe width="280" height="157" src="https://www.youtube.com/embed/n5ZcjlR4pPc" title="File Analysis - LivePanel" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe><br/>
<i>Analyze files using LivePanel (right-click & UI methods)</i>
</td>
<td align="center" width="50%">
<b>XR Mode</b><br/>
<iframe width="280" height="157" src="https://www.youtube.com/embed/38jGwFGORvc" title="File Analysis - XR" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe><br/>
<i>Immersive 3D file analysis in extended reality</i>
</td>
</tr>
</table>

**DOM Visualization - Interactive HTML structure analysis**

<iframe width="560" height="315" src="https://www.youtube.com/embed/110b-AergdU" title="DOM Visualization" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>

</div>

#### Directory & Project Analysis
<div align="center">

**Directory Analysis - LivePanel & XR Mode**

<table>
<tr>
<td align="center" width="50%">
<b>LivePanel Mode</b><br/>
<iframe width="280" height="157" src="https://www.youtube.com/embed/sPWjcgV-gZQ" title="Directory Analysis - LivePanel" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe><br/>
<i>Comprehensive directory analysis with detailed metrics</i>
</td>
<td align="center" width="50%">
<b>XR Mode</b><br/>
<iframe width="280" height="157" src="https://www.youtube.com/embed/TnfS2SevtWU" title="Directory Analysis - XR" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe><br/>
<i>3D directory visualization in immersive environments</i>
</td>
</tr>
</table>

**Project Analysis - Both LivePanel and XR Modes**

<iframe width="560" height="315" src="https://www.youtube.com/embed/NluAHe3BQu8" title="Project Analysis" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>

</div>

#### Advanced AR/VR Experiences
<div align="center">

**AR Programming Experience - Real-world augmented reality coding**

<iframe width="560" height="315" src="https://www.youtube.com/embed/d7fojpP90Dk" title="AR Programming Experience" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>

</div>

*These video tutorials provide hands-on demonstrations of every CodeXR feature, including AR experiences.*

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
- **Export Capabilities**: Save analysis results for documentation and reporting

### XR Visualization Features
- **3D Charts**: Bars, cylinders, bubbles showing function metrics in immersive 3D space
- **Interactive Navigation**: Mouse/keyboard controls plus runtime bindings for A-Frame/WebXR controllers; physical-headset validation is still pending for v1.1.0
- **Real-time Updates**: Changes in your code immediately reflect in the visualization
- **Customizable Mapping**: Choose what metrics map to X, Y, Z dimensions and colors
- **Spatial Understanding**: Visualize code complexity relationships in 3D space
- **Multi-file Visualization**: See entire directories and projects in XR

### DOM Visualization Features
- **Interactive Tree**: Click to expand/collapse DOM elements
- **Element Details**: View attributes, content, and hierarchy information
- **Visual Hierarchy**: Clear parent-child relationships in tree structure
- **Real-time Updates**: See DOM changes as you edit HTML files

## Analysis Modes Overview

CodeXR offers powerful analysis modes, each optimized for different file types and use cases. **All analysis modes support 24 code languages plus HTML DOM visualization** with comprehensive file, directory, and project analysis capabilities.

### LivePanel Analysis Mode (Formerly Static Analysis)
**Best for:** Detailed metrics review, reporting, and comprehensive code analysis

**Features:**
- Comprehensive function-level analysis with accurate metrics
- Enhanced complexity distribution charts with improved layout
- Cyclomatic density calculations and complexity metrics
- Interactive drill-down panels for detailed function analysis
- Real-time updates as you edit code, directories, and projects
- Export capabilities for reporting and documentation
- Support for both standard and deep analysis modes

### XR Analysis Mode
**Best for:** Immersive code exploration in VR/AR environments

**Features:**
- Immersive 3D visualizations with bars, cylinders, bubbles, and boats
- Real-time updates as you edit code, directories, and projects without exiting VR/AR mode
- Runtime bindings for mouse plus A-Frame/WebXR controllers, pending validation on physical VR headset hardware in v1.1.0
- Multi-dimensional metric mapping (complexity, LOC, parameters, file size)
- Customizable environments and color palettes for optimal viewing
- Spatial representation of code complexity and structure
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


## VR/AR Navigation Controls

### VR Controllers
- **Left Joystick**: Move forward/backward/left/right in 3D space
- **Right Joystick**: Rotate view smoothly for comfortable navigation
- **Hand Tracking**: Natural gesture-based interaction (supported devices)
- **Controller Runtime Hooks**: The extension includes bindings for controller rays and thumbsticks through A-Frame/WebXR components, but v1.1.0 has not been validated yet on physical headset/controller hardware

### Desktop Controls
- **Mouse**: Click and drag to rotate view around code visualizations
- **WASD Keys**: Navigate through the 3D space like a first-person game
- **Scroll Wheel**: Zoom in and out for detailed or overview perspectives
- **Arrow Keys**: Alternative navigation for fine-tuned movement

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

### XR Environment Settings
Customize your immersive experience:

- **Chart Types**: Bars, cylinders, bubbles, boats, and more visualization options
- **Color Palettes**: Business, Blues, Commerce, Flat, Foxy, and other professional themes
- **Environment Themes**: Forest, Dream, City, Space, and more immersive backgrounds
- **Dimension Mapping**: Customize what metrics map to 3D dimensions and colors
- **Performance Settings**: Adjust rendering quality for optimal VR/AR experience

## Installation & Setup

### Prerequisites
- **VS Code**: Version 1.98.0 or higher
- **Python**: Automatically configured on Windows, Linux, and macOS (isolated virtual environment created if needed)
- **WebXR Browser**: Chrome, Edge, or Firefox Reality for VR/AR features (optional)
- **Modern Hardware**: Recommended for optimal XR experience

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
- **Technical Debt**: Track complexity trends over time with repeated analysis
- **Code Standards**: Ensure code meets complexity and quality standards

### Team Collaboration
- **Architecture Discussions**: Share 3D visualizations in team meetings
- **Onboarding**: Help new team members understand codebase structure
- **AR Presentations**: Use AR mode for immersive code walkthroughs
- **Code Reviews**: Enhanced visual context for reviewing complex code
- **Shared Working Sessions**: Create or move shared virtual screens, remap charts, and watch other participants interact with the same live XR/DOM room in real time

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

### VR/AR Best Practices
- **AR Mode**: Use on mobile devices or AR headsets for best experience
- **VR Navigation**: Take breaks during long analysis sessions to prevent fatigue
- **Controller Setup**: Ensure controllers are charged before starting VR sessions; note that v1.1.0 controller interactions have not yet been validated on physical headset hardware
- **Lighting**: Ensure adequate room lighting for AR tracking

### Analysis Workflow
1. **Start with LivePanel**: Get overview with LivePanel analysis
2. **Explore in XR**: Use XR mode for immersive exploration of complex code
3. **Use Active Analyses**: Monitor all open visualizations from tree view
4. **Configure Settings**: Adjust debounce timing based on your coding style
5. **Directory Analysis**: Start with standard mode, use deep mode for comprehensive coverage

## Technical Architecture

### Analysis Engine
- **Python-based Coordinators**: Redesigned Python-based analysis coordinators for better accuracy
- **Multi-language Parsing**: Advanced parsing capabilities for 24 code languages plus HTML DOM visualization
- **Lizard Integration**: Industry-standard complexity analysis using Lizard tool
- **Performance Optimization**: Optimized for handling large codebases efficiently

### Visualization Engine
- **BabiaXR Integration**: Powerful 3D rendering using BabiaXR framework
- **A-Frame 1.7.1**: Latest WebXR framework for immersive experiences
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

### Optional Dependencies
- **WebXR Browser**: For full VR/AR experience
- **VR Headset**: Oculus, Valve Index, HTC Vive, etc. (optional)
- **AR Device**: ARCore/ARKit compatible device (optional)

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

## Support & Community

### Getting Help
- **GitHub Issues**: Report bugs and request features at [GitHub Issues](https://github.com/aMonteSl/CodeXR/issues)
- **Documentation**: Comprehensive guides and examples
- **Community**: Share your visualizations and use cases

### Feature Requests
- Submit through VS Code Marketplace reviews
- Create detailed GitHub issues with use cases
- Join community discussions about new features

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

**Experience your code like never before with CodeXR v1.2.0 - Where comprehensive code analysis meets extended reality!**

Transform your development workflow with immersive visualizations, comprehensive analysis, and real-time insights into your codebase structure and complexity.

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





