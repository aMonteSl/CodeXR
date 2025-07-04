# CHANGELOG.md

This file contains all notable changes and updates for the "CodeXR" Visual Studio Code extension.
The changelog follows a versioning system to document new features, improvements, fixes, and relevant modifications made to the project.

# CHANGELOG.md

## [0.0.8] - 2025-01-03

### 🚀 Version 0.0.8 - Major Analysis Engine Overhaul

This release significantly enhances the analysis capabilities with comprehensive language support, improved visualizations, and better user experience.

### Added
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
  - Added **Cyclomatic Density per function** for better complexity assessment
  - Completely reworked **Complexity Distribution** chart with improved layout and readability
  - Better visual organization of metrics with responsive design
- **Advanced Tree View Features**: Improved file organization and sorting
  - Sortable "Files by Language" section by name, lines of code, complexity, or function count
  - Enhanced file filtering and organization capabilities
  - Better visual indicators for file analysis status
- **Debounce Time Customization**: Configurable analysis timing
  - User-adjustable debounce delays for auto-analysis triggers
  - Visual indicators for pending analysis operations
  - Improved performance for large codebases with smart timing controls

### Enhanced
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

### Changed
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

### Fixed
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

### User Experience
- **Streamlined Analysis Workflow**: Intuitive and efficient analysis process
  - Automatic file type detection with appropriate analysis routing
  - Clear visual feedback for analysis progress and completion
  - Consistent behavior across all supported file types and analysis modes
  - Enhanced error messages with actionable guidance
- **Improved Visual Design**: Better organization and presentation
  - Enhanced static analysis panel layout with better metric organization
  - Improved tree view design with clearer visual hierarchy
  - Better color coding and iconography for different analysis types
  - Responsive design improvements for various screen sizes
- **Enhanced Accessibility**: Better support for different user workflows
  - Keyboard navigation improvements in tree views
  - Better screen reader compatibility for analysis results
  - Enhanced contrast and readability in visualization panels
  - Improved tooltip information for all interactive elements

### Technical Improvements
- **Lizard Integration Enhancement**: Deeper integration with code analysis tools
  - Improved Python environment setup for Lizard dependencies
  - Better error handling for Lizard analysis failures
  - Enhanced data extraction and processing from Lizard output
  - Optimized analysis pipeline for better performance
- **Session Management Architecture**: Robust state tracking system
  - Centralized session manager with event-driven updates
  - Better lifecycle management for analysis instances
  - Enhanced persistence of analysis state across VS Code sessions
  - Improved error recovery and cleanup mechanisms
- **Code Quality Improvements**: Enhanced maintainability and reliability
  - Comprehensive TypeScript type checking improvements
  - Enhanced error handling throughout the codebase
  - Better separation of concerns in analysis modules
  - Improved testing coverage for critical components

## Build Process Migration to ESBuild

This version migrates the build process from Webpack to ESBuild for faster builds and improved development experience.

### Changes Made:
- **New Build Configuration**: `esbuild.config.mjs` with optimized settings
- **Updated Scripts**: Build and watch scripts now use ESBuild
- **Faster Builds**: Significantly reduced build times (from ~1000ms to ~20ms)
- **Better Sourcemaps**: Improved debugging experience with accurate sourcemaps
- **ES2020 Target**: Modern JavaScript output for better performance

### Build Commands:
- `npm run build`: One-time build using ESBuild
- `npm run watch`: Watch mode for development (background process)
- `npm run package`: Create VSIX package

### Technical Details:
- **Bundle Size**: ~420KB (optimized)
- **External Dependencies**: VS Code API excluded from bundle
- **Platform**: Node.js with CommonJS output
- **Source Maps**: Enabled for debugging

---

## [0.0.7] - 2025-06-01

### Added
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
- **Enhanced Server Management**: 
  - Better server display names showing analysis file names instead of generic "index.html"
  - Format: `filename.py: 3001` for XR analysis servers
  - Improved server info with analysis-specific metadata
  - Enhanced server lifecycle management
- **Robust File Watching**: Comprehensive file watcher improvements
  - Enhanced error handling for non-existent files
  - Better cleanup of file watchers when servers stop
  - Improved detection of file changes with proper debouncing
  - Multiple notification strategies to ensure reliable updates


### Changed
- **A-Frame Upgrade**: Updated to A-Frame 1.7.1 for enhanced performance and stability
  - Improved WebXR compatibility and performance
  - Better rendering performance in VR/AR modes
  - Enhanced entity management and memory optimization
  - Improved hand tracking and controller support
- **Enhanced AR/VR Experience**: Significant improvements to immersive functionality
  - Added `hide-on-enter-ar` component for cleaner AR experiences
  - Optimized scene rendering for better frame rates
  - Improved lighting and shadow systems
  - Better asset loading and management
- **Live Reload Architecture**: Completely reimplemented for reliability
  - Moved from polling-based to event-driven updates
  - Simplified notification flow with single event dispatch
  - Better error handling and recovery mechanisms
  - Reduced server load and improved performance
- **Analysis Workflow**: More flexible and user-friendly analysis process
  - Chart type selection during analysis setup
  - Interactive dimension mapping with real-time preview
  - Better integration between settings and analysis results
  - Persistent user preferences across sessions
- **Server Creation Logic**: Enhanced server startup process
  - Better validation of file existence before creating watchers
  - Improved error messages when files or directories don't exist
  - More robust cleanup when servers fail to start
  - Enhanced logging for debugging server issues
- **XR Analysis Display**: Improved visualization of analysis results
  - Custom server names in Active Servers list
  - Better distinction between analysis servers and example servers
  - Enhanced tooltips and descriptions for XR analysis servers
  - Improved context menus for analysis-specific actions
- **File Analysis Workflow**: Streamlined analysis process
  - Automatic file opening when analyzing from tree
  - Consistent behavior across Static and XR analysis modes
  - Better progress indicators and user feedback
  - Enhanced error handling during analysis

### Fixed
- **Critical Live Reload Issues**: Resolved major problems with XR visualization updates
  - Fixed dynamic import resolution errors in file watch manager
  - Corrected module path issues causing silent failures
  - Resolved timestamp propagation ensuring proper cache invalidation
  - Fixed event listener attachment in browser clients
- **Server Watch Errors**: Eliminated ENOENT errors when launching examples
  - Added existence checks before setting up file watchers
  - Proper error handling for missing HTML files
  - Better validation of example directory structure
  - Fixed watcher cleanup on server shutdown
- **Tree View Synchronization**: Improved tree view refresh and display
  - Fixed server list updates after analysis completion
  - Resolved display name updates for XR analysis servers
  - Better synchronization between server state and UI
  - Enhanced refresh mechanisms for real-time updates
- **Analysis Command Integration**: Resolved issues with file opening and analysis
  - Fixed command registration and execution flow
  - Corrected parameter passing between commands
  - Better error handling when files cannot be opened
  - Improved timing between file opening and analysis start
- **VR/AR Controller Issues**: Resolved compatibility problems with different headsets
  - Fixed controller mapping inconsistencies across devices
  - Resolved joystick sensitivity and dead zone issues
  - Fixed hand tracking detection problems
  - Improved controller button mapping consistency

### User Experience
- **Seamless XR Updates**: XR visualizations now update automatically when code changes
  - No need to manually refresh browser or restart servers
  - Real-time data updates without losing VR/AR context
  - Smooth transitions between different analysis states
  - Immediate feedback when code metrics change
- **Immersive Navigation**: Natural movement and interaction in VR/AR
  - Intuitive joystick-based locomotion
  - Smooth rotation controls for comfortable navigation
  - Support for room-scale and teleportation movement
  - Gesture-based interaction for hand tracking devices
- **Visual Customization**: Complete control over XR environment appearance
  - Real-time color changes without reloading
  - Multiple environment themes for different preferences
  - Chart palettes optimized for VR/AR viewing
  - Consistent theming with VS Code appearance
- **Flexible Analysis**: Adaptable analysis workflow for different needs
  - Quick chart type switching for different data perspectives
  - Intuitive dimension mapping with drag-and-drop interface
  - One-click reset to sensible defaults
  - Visual feedback for configuration changes
- **Improved Workflow**: Enhanced development experience
  - Files automatically open when selected for analysis
  - Clear visual indicators of active analysis servers
  - Better server management with descriptive names
  - Streamlined example browsing and launching
- **Better Error Handling**: More informative error messages and recovery
  - Clear feedback when files or servers cannot be accessed
  - Helpful suggestions for resolving common issues
  - Graceful degradation when optional features fail
  - Comprehensive logging for troubleshooting
- **Enhanced Performance**: Optimized operations for better responsiveness
  - Faster server startup and shutdown cycles
  - Reduced memory usage through better cleanup
  - More efficient file watching and event handling
  - Improved browser-side chart rebuilding performance
  - Better VR/AR frame rates and reduced motion sickness

### Technical Improvements
- **A-Frame 1.7.1 Integration**: Latest WebXR framework with enhanced capabilities
- **Universal Controller Support**: Comprehensive gamepad and hand tracking API integration
- **Module Resolution**: Fixed ES module import issues across the codebase
- **TypeScript Compliance**: Enhanced type safety and error detection
- **Event System**: Robust event-driven architecture for real-time updates
- **Resource Management**: Better cleanup of servers, watchers, and temporary files
- **Code Organization**: Improved separation of concerns and modularity
- **Performance Optimization**: Reduced overhead and improved rendering performance

### Developer Experience
- **Status Bar Integration**: Visual debounce delay indicator for immediate feedback
- **Settings Persistence**: User preferences saved across VS Code sessions
- **Real-time Preview**: See changes immediately without manual refresh
- **Comprehensive Logging**: Detailed debug information for troubleshooting
- **Better Error Messages**: More informative feedback when things go wrong

This update significantly enhances the live development experience for XR code visualization, making it possible to see code metrics changes in real-time within VR/AR environments while maintaining a smooth and intuitive workflow. The addition of universal controller support and A-Frame 1.7.1 provides a much more immersive and accessible experience across all major VR/AR platforms.

## [0.0.6] - 2025-04-29

Fix some issues of the previous version

## [0.0.5] - 2025-04-29
### Added
- Integrated babia-boats visualization component for enhanced 3D representation
- New parameter mapping system for more intuitive data representation:
  - Function parameters shown by area dimension
  - Lines of code represented by height dimension
  - Complexity visualized through color dimension
- Added improved file path resolution for analysis scripts to ensure compatibility across different environments

### Changed
- Migrated from previous visualization component to babia-boats for better data insight
- Enhanced template variable system to support multiple dimensions simultaneously
- Refactored XR template to use the new parameter format
- Improved visualization mapping for complexity metrics with better color differentiation

### Fixed
- Resolved template variable substitution issues in XR analysis
- Fixed path resolution for lizard analyzer to work reliably in all installation scenarios
- Improved error handling when analyzer scripts cannot be located
- Enhanced script discovery to support diverse installation environments

### User Experience
- More intuitive data representation with function parameters, line count, and complexity unified in a single visualization
- Better visual differentiation between function properties
- More reliable analysis across different installation environments
- Smoother visualization experience with improved data mapping

This update enhances the visualization capabilities while improving the robustness of the analysis system across different installation environments.

## [0.0.4] - 2025-04-27
### Added
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

### Changed
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

### Fixed
- Fixed issue where comment lines were counted as 0 for newly supported languages
- Fixed issue with analysis hanging during frequent auto-saves
- Corrected class counting in complex object-oriented structures
- Fixed Tree View refresh issues when toggling settings
- Resolved Vue.js component detection in single-file components
- Fixed HTML comment detection in mixed-language files

### User Experience
- Smoother workflow with configurable debounce system
- Less intrusive analysis process during active coding
- Improved performance during analysis of large files
- Visual indicators when analysis is pending or in progress
- Consistent experience across all supported languages
- More intuitive naming in context menus and command palette
- Better Tree View organization with comprehensive settings

This update significantly expands language support while improving the overall user experience through configurable analysis timing and enhanced visualization capabilities.


## [0.0.3] - 2025-04-11
### Added
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

### Changed
- Enhanced JSON data processing to preserve original data structure while reordering attributes
- Implemented a more reliable temporary file handling system using the extension's global storage path
- Improved error handling when copying data files to visualization projects
- Reorganized internal structure of src/analysis and src/pythonEnv
- Refactored status bar logic for better maintainability
- Improved event management and disposal
- Changed analysis command naming:
  - CodeXR: Analyze File (Static)
  - CodeXR: Analyze File (XR)
- Improved user interaction flow in TreeView when selecting files to analyze
- Cleaned up visualization temporary folders automatically on extension deactivation
- Improved handling of JSON transformation for XR visualization compatibility

### Fixed
- Fixed issue with temporary JSON files not being properly cleaned up
- Resolved errors when copying files between directories with different permission levels
- Fixed parsing of Python comments using a dedicated Python script
- Fixed detection of classes in any supported language
- Resolved issue where XR visualization data was not correctly injected into the HTML template


### User Experience
- Added intelligent warning system that detects potentially confusing visualizations
- Warning alerts users when data dimensions might cause overlapping in charts
- Simplified UI with clear "Continue" or "Cancel" options for data selection decisions
- Visualization adapts colors based on Visual Studio Code theme
- Complexity values (CCN) are color-coded by severity (low, moderate, high, very high)
- Added Setting section in TreeView to select default analysis mode (Static or XR)
- Improved error messages and output logs for better debugging
- Published version available in the Visual Studio Code Marketplace