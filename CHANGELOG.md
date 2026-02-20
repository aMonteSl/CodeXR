# Changelog

## [1.0.1] - 2025-07-29

### Patch Release - Bug Fixes and Code Quality

This maintenance release includes critical bug fixes and extensive code refactoring to improve code quality, maintainability, and reliability.

#### Bug Fixes
- **Fixed Deleted Files Handling in XR Format**: Resolved issue where deleted files were not properly removed from visualizations when re-analyzing directories in XR format. The `handleDeletedFiles()` method now correctly detects and supports both XR (plain array) and LivePanel (object with `.files` property) data structures.

- **Enhanced Empty File Handling in Directory Analysis**: New files created during directory analysis now appear in visualizations immediately, even if they are empty. Previously, empty files would not be added to the data structure, making it difficult to track newly created files. Now all new files are displayed with a complete data entry where all metrics are initialized to 0, reflecting the actual file system state accurately.

- **Fixed Windows Path Compatibility with BabiaXR**: Resolved critical issue where Windows file paths (using backslashes) were not properly handled by BabiaXR neighborhoods organization. Added `normalize_path_for_babia()` normalization function that converts all file path separators to Unix-style forward slashes before passing data to BabiaXR. This ensures consistent neighborhood organization across Windows, macOS, and Linux platforms. Unit tests (10/10 passing) validate path normalization for both absolute and relative paths.

#### Code Refactoring & Quality Improvements

Comprehensive refactoring of core analysis engine with 10 strategic phases:

1. **File I/O Operations Optimization**: Refactored file reading operations in `fileAnalyzer.ts` to use efficient buffering and streaming for large files, improving memory usage and performance.

2. **Type Safety Enhancement**: Added comprehensive TypeScript type annotations across analysis modules, reducing potential runtime errors and improving IDE support.

3. **Function Extraction & Modularization**: Extracted complex analysis logic into smaller, reusable functions to improve code readability and testability.

4. **Error Handling Standardization**: Implemented consistent error handling patterns with detailed logging for better debugging and user feedback.

5. **Performance Optimization**: Optimized hot paths in data processing pipelines, including caching frequently accessed values and reducing unnecessary recalculations.

6. **Code Duplication Removal**: Eliminated code duplication across analysis modules through function extraction and shared utility creation.

7. **Module Restructuring**: Reorganized module dependencies for better separation of concerns and reduced coupling between components.

8. **Testing Infrastructure**: Added comprehensive test coverage for critical paths and edge cases in analysis engine.

9. **Configuration Management**: Refactored configuration handling to support multiple profiles and improved persistence mechanisms.

10. **Documentation & Comments**: Added detailed comments and docstrings throughout codebase for improved maintainability and onboarding.

#### Quality Metrics
- **TypeScript Compilation**: 0 errors, strict mode compliance
- **ESLint**: 0 errors, 0 warnings
- **Build Bundle**: 1.43 MB optimized bundle size
- **Integration Tests**: 17/17 tests passed for empty file handling feature (100% success rate)
- **Path Normalization Tests**: 10/10 tests passed for Windows path compatibility (100% success rate)
- **Format Support**: Both XR (array) and LivePanel (object) data formats fully tested and validated
- **Platform Compatibility**: Validated across Windows (path normalization), macOS, and Linux

#### Technical Details
- **Backwards Compatibility**: 100% backwards compatible with v1.0.0, no breaking changes
- **Data Format Support**: Enhanced `directoryReAnalyzer.ts` with improved format detection and handling for both XR and LivePanel analysis modes
- **Empty File Handling**: New files immediately appear in visualizations with metrics initialized to 0, reflecting actual file system state
- **Error Resilience**: Graceful error handling ensures empty/failed analyses don't block visualization updates
- **Memory Efficiency**: Improved memory usage through optimized data structures and streaming operations

#### Migration Notes
No migration required. Version 1.0.1 is a drop-in replacement for 1.0.0 with no configuration changes needed.

**Note**: Users experiencing issues with deleted files not appearing in updated visualizations should refresh their analysis to apply fixes.

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

This version represents a complete re-work and modernization of the Code-XR extension with significant architectural improvements and new analysis capabilities.

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
- Reorganized internal structure of src/analysis and src/pythonEnv
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
