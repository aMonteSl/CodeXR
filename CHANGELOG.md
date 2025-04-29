# CHANGELOG.md

This file contains all notable changes and updates for the "CodeXR" Visual Studio Code extension.
The changelog follows a versioning system to document new features, improvements, fixes, and relevant modifications made to the project.


# CHANGELOG.md

## [0.0.5.1] - 2025-04-29

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