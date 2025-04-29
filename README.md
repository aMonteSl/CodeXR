# CodeXR — Code Visualization in Extended Reality

Visual Studio Code extension that transforms your code analysis into immersive XR visualizations. Experience your code metrics (complexity, lines, parameters) in both traditional VS Code views and breathtaking XR/VR environments powered by BabiaXR. **The primary intended use is in AR mode, bringing your code's structure into your physical workspace.**

Gain unprecedented insights into your codebase by stepping into a XR representation of your code structure that updates in real-time as you work.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Primary Feature: Immersive Code Visualization

CodeXR's main purpose is to provide powerful, interactive 3D visualizations of your code:

- 🥽 **XR Visualization** - Explore your code metrics in immersive VR/AR environments
- 🔄 **Live Updates** - See your code changes reflected instantly in the visualization
- 🎨 **Multi-dimensional Mapping** - View multiple metrics simultaneously:
  - Function parameters represented by area
  - Lines of code shown through height
  - Complexity illustrated with color gradients
- 📊 **BabiaXR Integration** - Leverage advanced 3D data visualization capabilities

![CodeXR Visualization Example](./resources/gifts/example.gif)

## How to Use Visualizations

### Quick Start with XR Visualization

1. Right-click on a file in VS Code Explorer
2. Select "CodeXR Analyze File: XR"
3. A browser will open showing your 3D code visualization
4. Edit your code - watch as the visualization updates in real-time!
5. **For AR mode**: Access the visualization URL on your AR-capable device to overlay code metrics in your physical environment

### Visualization Modes

| Mode | Description | Best For |
|------|-------------|----------|
| **AR Mode** | Overlay on physical world | **Primary intended use** - Integrating code insights into your workspace |
| VR Mode | Full immersive experience | Deep code structure exploration |
| Desktop 3D | Standard browser view | Quick analysis without headset |

### AR Mode Benefits

The AR visualization is designed to:
- Blend your code metrics with your physical development environment
- Enable hands-free code exploration while you continue working
- Facilitate team discussions with shared AR views of code structure
- Provide spatial understanding of complex codebases

### Visualization Settings

Customize your visualization experience:

- **Environment Themes** - Forest, Dream, Arches, and more
- **Color Palettes** - Choose from multiple data visualization schemes
- **Chart Types** - Boats, cylinders, bars and other visualization types
- **Background and Ground** - Set colors that complement your data

## Additional Features

### Code Analysis

CodeXR provides comprehensive code analysis across multiple languages:

- 🔍 Multi-language support (JavaScript, TypeScript, Python, C, C++, C#, Vue.js, Ruby)
- 📏 Metrics include lines of code, comments, complexity, function parameters
- ⚡ Configurable analysis timing with debounce settings

### Visualization Options

- 📊 **Static Mode** - Traditional webview visualization for quick reference
- 🔍 **Function Detail View** - Drill down into specific function metrics
- 📁 **Multi-File Analysis** - Compare metrics across multiple files

## Technical Details

### Technologies Used

- **BabiaXR** - Advanced data visualization in XR environments
- **A-Frame** - WebXR framework for 3D visualization
- **TypeScript** - Main development language
- **Python/Lizard** - Advanced code metrics and analysis
- **SSE** - Server-Sent Events for real-time visualization updates

### Architecture


```
src/
├── babiaxr/            # 3D visualizations with BabiaXR
├── analysis/           # Code analysis engine
├── server/             # Local server with live updates
├── pythonEnv/          # Python environment manager
└── ui/                 # User interface components
```


## Usage Notes

- First-time setup automatically configures Python environment
- XR visualizations require a WebXR-compatible browser
- AR mode works best on mobile devices or supported headsets
- Visualizations update in real-time as you edit code

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Visualization not appearing | Ensure WebXR is supported in your browser |
| Updates not showing | Check VS Code Output panel for server logs |
| AR mode issues | Make sure HTTPS is enabled and device supports WebXR |

## License

This project is licensed under the MIT License - see the LICENSE file for details.