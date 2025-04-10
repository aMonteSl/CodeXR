# CodeXR — Local Server and WebXR Visualizations

Extension for Visual Studio Code that enables source code analysis (JavaScript, TypeScript, Python, etc.) and visualization of key metrics (LOC, variables, cyclomatic complexity, etc.) in immersive XR/VR environments using A-Frame and BabiaXR.

Transform your workspace into an augmented programming environment, surrounded by 3D graphs and insights into your code.

## Key Features

- ⚡ Optimized local server for WebXR experiences
- 📊 3D data visualization generator powered by BabiaXR
- 🧠 JavaScript code analysis (metrics and visualization)
- 🛠️ Modular and scalable architecture

## Technologies and Libraries Used

- **TypeScript** — Main development language
- **VS Code API** — Native integration with the editor
- **A-Frame** — WebXR framework
- **BabiaXR** — Data visualization in VR/AR environments
- **Node.js** (http, https, fs) — Modules for server and file system
- **TypeScript Compiler API** — Static code analysis
- **get-port** — Automatic free port assignment

## Project Structure

src/
├── analysis/        # JavaScript code analysis
├── server/          # Local server for A-Frame with live reload
├── babiaxr/         # 3D visualizations with BabiaXR
├── ui/              # Shared user interface components
├── utils/           # General utilities
├── commands/        # Extension commands
└── extension.ts     # Main entry point

## Module Descriptions

### 1. analysis/ — JavaScript Code Analysis

Allows obtaining code quality metrics:

- Lines of code (LOC)
- Comments
- Number of functions and classes
- Metrics visualization in a webview panel

Main files:
- `codeAnalyzer.ts` — Analysis coordinator
- `metrics/` — Specific analysis modules
- `providers/` — Tree and webview result view
- `utils/fileParser.ts` — Custom JS/TS file parser

### 2. server/ — Local Server for WebXR

HTTP/HTTPS server with live reload:

- SSL support (self-signed or custom certificates)
- Management of multiple simultaneous servers
- Automatic reload on file modification

Main files:
- `serverManager.ts` — Server manager
- `certificateManager.ts` — SSL certificate management
- `liveReloadManager.ts` — Live reload
- `requestHandler.ts` — HTTP/HTTPS request handler

### 3. babiaxr/ — 3D Data Visualizations

Immersive visualization generator for VR/AR environments:

- Bar, cylinder, pie charts, etc.
- JSON data support
- Export of complete A-Frame projects

Main files:
- `chartManager.ts` — Chart management
- `dataCollector.ts` — Data loading and processing
- `templateManager.ts` — Visualization templates
- `babiaTreeProvider.ts` — UI for BabiaXR visualizations

### 4. ui/ — User Interface Components

Reusable components to improve development experience:

- Custom side tree view
- VS Code status bar
- Interactive webviews (color picker)

### 5. commands/ — Modular Command System

Commands organized by category to facilitate maintenance:

- `analysisCommands.ts`
- `serverCommands.ts`
- `babiaCommands.ts`
- `uiCommands.ts`

## Main Features

### Local WebXR Server

| Feature | Description |
|---------|-------------|
| HTTP / HTTPS | Flexible server mode configuration |
| Live reload | Automatic browser update |
| Multi-server management | Visual panel of active servers |
| Custom certificates | Support for your own SSL certificates |

### 3D Visualizations with BabiaXR

| Feature | Description |
|---------|-------------|
| 3D Charts | Bars, cylinders, pies, etc. |
| Data sources | JSON files |
| Customization | Configurable visual and aesthetic parameters |
| Project export | Generation of ready-to-use A-Frame VR/AR projects |

### JavaScript Code Analysis

| Metric | Description |
|--------|-------------|
| LOC | Total lines of code |
| Comments | Percentage of commented lines |
| Functions and Classes | Number of found declarations |
| Visualization | Results displayed in an interactive panel |

## Requirements

- Visual Studio Code v1.98.0 or higher
- WebXR-compatible browser (Chrome, Edge, Firefox)
- For VR/AR environments: HTTPS is mandatory

## Quick Usage

### Start a Local Server

1. Open the "WebXR Explorer" side panel
2. Click "Start Local Server"
3. Select your .html file
4. The browser will automatically open your application

### Create a BabiaXR Visualization

1. "WebXR Explorer" side panel → "BabiaXR Visualizations"
2. Click "Create Visualization"
3. Select the chart type and data source
4. Configure visual parameters
5. Export the project and view it in VR/AR

## Important Notes

- It is normal for browsers to warn about self-signed certificates.
- HTTP mode is not compatible with WebXR.
- Servers automatically stop when VS Code is closed.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Blocked ports | Restart VS Code or use "Stop Server" |
| SSL certificate issues | Use custom certificates if necessary |
| VR/AR issues | Ensure you are using HTTPS |
| JSON files | Verify format and UTF-8 encoding |
