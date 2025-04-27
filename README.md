# CodeXR — Code Analysis & XR Visualizations

Extension for Visual Studio Code that enables source code analysis (JavaScript, TypeScript, Python, C) and visualization of key metrics (LOC, comments, cyclomatic complexity, etc.) in both static webviews and immersive XR/VR environments using A-Frame and BabiaXR.

Transform your workspace into an augmented programming environment, surrounded by 3D graphs and insights into your code that update in real-time as you code.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Key Features

- 🔍 Multi-language code analysis (JavaScript, TypeScript, Python, C)
- 📊 Static code metrics visualization in VS Code webviews
- 🥽 XR visualization of code complexity in VR/AR environments
- 🔄 Real-time update of metrics and visualizations as you code
- ⚡ Optimized local server for WebXR experiences with SSE updates
- 🧩 Modular and extensible architecture

## Technologies and Libraries Used

- **TypeScript** — Main development language
- **VS Code API** — Native integration with the editor
- **Python** — For advanced code metrics using Lizard
- **A-Frame** — WebXR framework
- **BabiaXR** — Data visualization in VR/AR environments
- **Node.js** (http, https, fs) — Modules for server and file system
- **SSE** (Server-Sent Events) — For real-time visualization updates
- **Lizard** — Cyclomatic complexity analysis

## Project Structure

```
src/
├── analysis/           # Code analysis and metrics
│   ├── tree/           # TreeView for file analysis
│   ├── xr/             # XR visualization of code metrics
│   └── python/         # Python analysis scripts
├── server/             # Local server with SSE for live update
├── pythonEnv/          # Python virtual environment manager
├── babiaxr/            # 3D visualizations with BabiaXR
├── ui/                 # Shared user interface components
├── commands/           # Extension commands
└── extension.ts        # Main entry point
```

## Module Descriptions

### 1. analysis/ — Code Analysis

Multi-language code analysis system:

- Lines of code (LOC), comments, blank lines
- Function and class detection
- Cyclomatic complexity (CCN) metrics
- Static visualization in webview panel
- XR visualization through BabiaXR

Main files:
- `analysisManager.ts` — Analysis coordination
- `fileWatchManager.ts` — Real-time re-analysis on file changes
- `xr/xrAnalysisManager.ts` — XR visualization generation
- `python/lizard_analyzer.py` — Python-based complexity analysis

### 2. server/ — Local Server with SSE

HTTP/HTTPS server with live reload and real-time data updates:

- SSL support (self-signed or custom certificates)
- Server-Sent Events (SSE) for live visualization updates
- Support for updating visualizations without page reloads
- Management of multiple simultaneous servers

Main files:
- `serverManager.ts` — Server management
- `liveReloadManager.ts` — SSE-based live updates
- `requestHandler.ts` — HTTP/HTTPS request handler

### 3. pythonEnv/ — Python Environment Manager

Auto-configuration of Python for analysis:

- Automatic virtual environment setup
- Dependency management (Lizard)
- Cross-platform compatibility

### 4. babiaxr/ — 3D Data Visualizations

Immersive visualization generator for VR/AR environments:

- Bar, cylinder charts for code complexity
- Custom data transformation for BabiaXR compatibility
- Real-time visualization updates via SSE

## Main Features

### Code Analysis

| Feature | Description |
|---------|-------------|
| Multi-language | JavaScript, TypeScript, Python, C |
| Static Mode | Detailed metrics in VS Code webview |
| XR Mode | Immersive 3D visualization of code metrics |
| Auto Re-analysis | Real-time updates as you code |
| TreeView Integration | Easy file selection with language icons |

### XR Visualization

| Feature | Description |
|---------|-------------|
| Function Complexity | 3D bars showing cyclomatic complexity |
| AR Mode | View code metrics in your physical environment |
| VR Mode | Immersive exploration of code structures |
| Custom Styling | Theme and color customization |

### Python Integration

| Feature | Description |
|---------|-------------|
| Auto Environment | Self-configuring Python virtual environment |
| Lizard Integration | Advanced code metrics computation |


## Quick Usage

### Analyze Code (Static Mode)

1. Right-click on a file in VS Code Explorer
2. Select "CodeXR: Analyze File (Static)"
3. View detailed metrics in the VS Code webview
4. Edit your file - metrics update automatically!

### Analyze Code (XR Mode)

1. Right-click on a file in VS Code Explorer
2. Select "CodeXR: Analyze File (XR)"
3. A browser will open with your 3D visualization
5. Use AR/VR mode for immersive exploration

### Change Default Analysis Mode

1. Open the "Code Analysis" side panel
2. In the Settings section, choose "Static" or "XR"
3. All analyses from the TreeView will use this mode

## Important Notes

- First-time setup automatically configures Python environment
- XR visualizations require HTTPS with WebXR-compatible browser
- AR mode works best on mobile devices or supported headsets
- Servers automatically stop when VS Code is closed

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Python setup issues | Check Output panel for detailed logs |
| AR/VR not working | Ensure HTTPS is enabled and using compatible browser |
| Visualization not updating | Check VS Code Output panel for server logs |


## License

This project is licensed under the MIT License - see the LICENSE file for details.