# CodeXR — Code Visualization in Extended Reality (v0.0.8)

Visual Studio Code extension that transforms your code analysis into immersive XR visualizations. Experience your code metrics (complexity, lines, parameters) in both traditional VS Code views and breathtaking XR/VR environments powered by BabiaXR and A-Frame 1.7.1. **The primary intended use is in AR mode, bringing your code's structure into your physical workspace.**

Gain unprecedented insights into your codebase by stepping into a XR representation of your code structure that updates in real-time as you work.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/aMonteSl.code-xr?color=blue&label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=aMonteSl.code-xr)
[![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/aMonteSl.code-xr?color=brightgreen)](https://marketplace.visualstudio.com/items?itemName=aMonteSl.code-xr)
[![Visual Studio Marketplace Rating](https://img.shields.io/visual-studio-marketplace/r/aMonteSl.code-xr?color=orange)](https://marketplace.visualstudio.com/items?itemName=aMonteSl.code-xr)
[![A-Frame Version](https://img.shields.io/badge/A--Frame-1.7.1-red)](https://aframe.io/)
[![WebXR](https://img.shields.io/badge/WebXR-Compatible-purple)](https://immersiveweb.dev/)
[![BabiaXR](https://img.shields.io/badge/BabiaXR-Powered-teal)](https://babiaxr.gitlab.io/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)](https://code.visualstudio.com/)
[![HTTPS](https://img.shields.io/badge/HTTPS-Supported-green?logo=letsencrypt)](https://letsencrypt.org/)

## 🚀 What's New in v0.0.8

- **🌐 Complete Language Support**: Full analysis for all Lizard-compatible languages (25+ languages including JavaScript, TypeScript, Python, C/C++, C#, Java, Ruby, Go, PHP, Swift, Kotlin, Rust, and more)
- **🎯 DOM Visualization**: New HTML file analysis with interactive DOM tree exploration
- **📊 Enhanced Static Analysis**: Improved complexity distribution charts, cyclomatic density metrics, and function-level details
- **💫 XR Bubble Charts**: New 3D bubble visualization for multi-dimensional code exploration
- **📋 Active Analyses Manager**: Real-time tracking of all open visualizations with duplicate prevention
- **🔧 Smart File Routing**: Automatic analysis type selection based on file extensions
- **⏱️ Customizable Timing**: Configurable debounce delays for optimal performance

## Analysis Modes Overview

CodeXR offers three powerful analysis modes, each optimized for different file types and use cases:

### 🎮 XR Analysis Mode
**Best for: Immersive code exploration in VR/AR**

- **Supported Files**: All programming languages (JavaScript, TypeScript, Python, C/C++, C#, Java, Ruby, Go, PHP, Swift, Kotlin, Rust, Scala, Lua, Erlang, Zig, Perl, Solidity, TTCN-3, Objective-C, Fortran, GDScript, Vue.js)
- **Features**: 
  - 3D visualizations with bars, cylinders, bubbles, and boats
  - Real-time updates as you edit code
  - Universal VR controller support
  - Multi-dimensional metric mapping (complexity, LOC, parameters)
  - Customizable environments and color palettes

### 📊 Static Analysis Mode  
**Best for: Detailed metrics review and reporting**

- **Supported Files**: All programming languages
- **Features**:
  - Comprehensive function-level analysis
  - Complexity distribution charts with improved layout
  - Cyclomatic density calculations
  - Interactive drill-down panels
  - Export capabilities for reporting

### 🌐 DOM Visualization Mode
**Best for: HTML structure analysis** (Automatically triggered for HTML files)

- **Supported Files**: HTML, HTM files
- **Features**:
  - Interactive DOM tree exploration
  - Element hierarchy visualization
  - Real-time DOM structure analysis
  - Automatic routing from any analysis command

## How to Use CodeXR

### 🚀 Quick Start

**Method 1: From Tree View**
1. Open the CodeXR tree view in VS Code sidebar
2. Expand "Code Analysis" → "Files per Language"
3. Click on any file to analyze it (automatically chooses the best analysis mode)
4. HTML files automatically open DOM visualization
5. Other files use your preferred mode (Static or XR)

**Method 2: From Explorer**
1. Right-click any file in VS Code Explorer
2. Choose your analysis mode:
   - "CodeXR: Analyze File (Static)" - Detailed metrics panel
   - "CodeXR: Analyze File (XR)" - Immersive 3D visualization
   - "CodeXR: Visualize DOM" - HTML structure analysis (HTML files only)

**Method 3: From Command Palette**
1. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS)
2. Type "CodeXR" to see all available commands
3. Select your preferred analysis mode

### 📊 Understanding Your Results

**Static Analysis Panel Features:**
- **Function List**: Sortable table with complexity, lines of code, and parameter counts
- **Complexity Distribution**: Visual chart showing complexity patterns across your codebase
- **Cyclomatic Density**: Advanced complexity metric per function
- **Drill-down Details**: Click any function for detailed analysis

**XR Visualization Features:**
- **3D Charts**: Bars, cylinders, bubbles showing function metrics in 3D space
- **Interactive Navigation**: VR controller support or mouse/keyboard controls
- **Real-time Updates**: Changes in your code immediately reflect in the visualization
- **Customizable Mapping**: Choose what metrics map to X, Y, Z dimensions and colors

**DOM Visualization Features:**
- **Interactive Tree**: Click to expand/collapse DOM elements
- **Element Details**: View attributes, content, and hierarchy information
- **Visual Hierarchy**: Clear parent-child relationships in tree structure

### 🎮 VR/AR Navigation Controls

**VR Controllers:**
- **Left Joystick**: Move forward/backward/left/right
- **Right Joystick**: Rotate view smoothly
- **Hand Tracking**: Natural gesture-based interaction (supported devices)

**Desktop Controls:**
- **Mouse**: Click and drag to rotate view
- **WASD Keys**: Navigate through the 3D space
- **Scroll Wheel**: Zoom in and out

### ⚙️ Managing Active Analyses

The **"Active Analyses"** section in the tree view shows all currently running visualizations:

- **View Status**: See which files are currently being analyzed
- **Prevent Duplicates**: Automatically prevents multiple analyses of the same file
- **Quick Access**: Click to reopen existing visualizations
- **Easy Cleanup**: Close analyses you no longer need

### 🔧 Customization Options

**Analysis Settings** (accessible from tree view):
- **Default Mode**: Choose between Static and XR as your default
- **Debounce Timing**: Adjust how quickly analysis responds to code changes
- **Auto-analysis**: Enable/disable automatic re-analysis on file save

**XR Environment Settings**:
- **Chart Types**: Bars, cylinders, bubbles, boats, and more
- **Color Palettes**: Business, Blues, Commerce, Flat, Foxy, and others
- **Environment Themes**: Forest, Dream, City, Space, and more
- **Dimension Mapping**: Customize what metrics map to 3D dimensions

## 🌍 Supported Languages

CodeXR provides comprehensive analysis for **25+ programming languages** through advanced Lizard integration:

### 📋 Complete Language Support Matrix

| Language | Extension | Analysis Type | Comment Detection | Class Detection |
|----------|-----------|---------------|-------------------|-----------------|
| **JavaScript** | `.js`, `.jsx` | Static, XR | ✅ C-style (`//`, `/* */`) | ✅ ES6 Classes |
| **TypeScript** | `.ts`, `.tsx` | Static, XR | ✅ C-style (`//`, `/* */`) | ✅ Classes & Interfaces |
| **Python** | `.py` | Static, XR | ✅ Hash (`#`) + Docstrings | ✅ Classes & Methods |
| **C/C++** | `.c`, `.cpp`, `.cc`, `.cxx`, `.h`, `.hpp` | Static, XR | ✅ C-style (`//`, `/* */`) | ✅ Classes & Structs |
| **C#** | `.cs` | Static, XR | ✅ C-style (`//`, `/* */`) | ✅ Classes & Namespaces |
| **Java** | `.java` | Static, XR | ✅ C-style (`//`, `/* */`) | ✅ Classes & Interfaces |
| **Ruby** | `.rb` | Static, XR | ✅ Hash (`#`) + Block (`=begin/=end`) | ✅ Classes & Modules |
| **Go** | `.go` | Static, XR | ✅ C-style (`//`, `/* */`) | ✅ Structs & Interfaces |
| **PHP** | `.php`, `.phtml` | Static, XR | ✅ C-style + Hash (`//`, `#`, `/* */`) | ✅ Classes & Traits |
| **Swift** | `.swift` | Static, XR | ✅ C-style (`//`, `/* */`) | ✅ Classes & Structs |
| **Kotlin** | `.kt` | Static, XR | ✅ C-style (`//`, `/* */`) | ✅ Classes & Objects |
| **Rust** | `.rs` | Static, XR | ✅ C-style (`//`, `/* */`) | ✅ Structs & Impl |
| **Scala** | `.scala` | Static, XR | ✅ C-style (`//`, `/* */`) | ✅ Classes & Objects |
| **Lua** | `.lua` | Static, XR | ✅ Double dash (`--`) | ✅ Table-based OOP |
| **Erlang** | `.erl` | Static, XR | ✅ Percent (`%`) | ✅ Modules |
| **Zig** | `.zig` | Static, XR | ✅ C-style (`//`) | ✅ Structs |
| **Perl** | `.pl`, `.pm` | Static, XR | ✅ Hash (`#`) | ✅ Packages |
| **Solidity** | `.sol` | Static, XR | ✅ C-style (`//`, `/* */`) | ✅ Contracts |
| **TTCN-3** | `.ttcn`, `.ttcn3` | Static, XR | ✅ C-style (`//`, `/* */`) | ✅ Modules |
| **Objective-C** | `.m` | Static, XR | ✅ C-style (`//`, `/* */`) | ✅ Classes & Categories |
| **Fortran** | `.f90`, `.f95`, `.f03`, `.f08` | Static, XR | ✅ Exclamation (`!`) | ✅ Modules & Types |
| **GDScript** | `.gd` | Static, XR | ✅ Hash (`#`) | ✅ Classes |
| **Vue.js** | `.vue` | Static, XR | ✅ HTML (`<!-- -->`) | ✅ Component Analysis |
| **HTML** | `.html`, `.htm` | **DOM Visualization** | ✅ HTML Comments | ✅ Element Structure |

### 🔍 Analysis Capabilities by Language

**All Languages Support:**
- ✅ **Lines of Code (LOC)** counting
- ✅ **Cyclomatic Complexity** analysis
- ✅ **Function parameter** counting  
- ✅ **Accurate comment detection** with language-specific rules
- ✅ **Real-time analysis** with file watching
- ✅ **Multi-file analysis** support

**Advanced Features:**
- **Comment Analysis**: Language-aware parsing for single-line, multi-line, and documentation comments
- **Class Detection**: Object-oriented structure analysis including inheritance and nested classes  
- **Function Metrics**: Parameter counting, complexity scoring, and density calculations
- **File Organization**: Smart sorting and filtering by language in the tree view

### 🎯 Special File Handling

**HTML Files**: Automatically routed to **DOM Visualization** mode regardless of selected analysis type
- Interactive DOM tree exploration
- Element hierarchy visualization  
- Attribute and content analysis

**Mixed-Language Files**: Intelligent detection and analysis
- Vue.js single-file components with template, script, and style sections
- HTML files with embedded JavaScript and CSS
- Multi-language codebases with consistent analysis

## 🛠️ Installation & Setup

### Prerequisites
- **VS Code**: Version 1.60.0 or higher
- **Python**: Automatically configured (virtual environment created if needed)
- **WebXR Browser**: Chrome, Edge, or Firefox Reality for VR/AR features

### Quick Installation
1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for "CodeXR"
4. Click "Install"
5. Restart VS Code

### First-Time Setup
- CodeXR automatically sets up the Python environment on first use
- No additional configuration required for basic functionality
- HTTPS certificates are included for WebXR compatibility

## 🎯 Real-World Use Cases

### 📊 Code Quality Assessment
- **Before Code Reviews**: Quickly identify complex functions that need attention
- **Refactoring Planning**: Visualize complexity hotspots across your codebase
- **Technical Debt**: Track complexity trends over time with repeated analysis

### 👥 Team Collaboration  
- **Architecture Discussions**: Share 3D visualizations in meetings
- **Onboarding**: Help new team members understand codebase structure
- **AR Presentations**: Use AR mode for immersive code walkthroughs

### 🎓 Educational Purposes
- **Learning Patterns**: Visualize how different programming patterns affect complexity
- **Algorithm Comparison**: Compare multiple implementations in 3D space
- **Code Metrics Education**: Understand complexity metrics through interactive visualization

## � Tips & Best Practices

### Performance Optimization
- **Large Files**: Increase debounce delay for files over 1000 lines
- **Resource Management**: Close unused analyses to free system resources  
- **Multiple Projects**: Use Static mode for quick analysis, XR for deep exploration

### VR/AR Best Practices
- **AR Mode**: Use on mobile devices or AR headsets for best experience
- **VR Navigation**: Take breaks during long analysis sessions
- **Controller Setup**: Ensure controllers are charged before starting VR sessions

### Analysis Workflow
- **Start with Static**: Get overview with Static analysis, then explore in XR
- **Use Active Analyses**: Monitor all open visualizations from tree view
- **Custom Settings**: Configure debounce timing based on your coding style

## � Support & Feedback

- **Feature Requests**: Submit through VS Code Marketplace reviews
- **Community**: Share your visualizations and use cases

## 🚀 Performance Tips

- Use HTTP mode for faster local development (VR/AR requires HTTPS)
- Adjust debounce delay based on file size and system performance
- Disable auto-analysis for very large files to improve responsiveness
- Close unused analysis servers to free system resources

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Experience your code like never before with CodeXR v0.0.8 - Where code analysis meets extended reality! 🥽✨**

## Development

### Build Process

CodeXR uses ESBuild for fast and efficient bundling:

```bash
# One-time build
npm run build

# Watch mode for development
npm run watch

# Create VSIX package
npm run package
```

### Requirements

- Node.js 16+
- Python 3.7+ (for code analysis)
- VS Code 1.98.0+