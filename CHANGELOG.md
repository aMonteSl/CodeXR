# CHANGELOG.md

All notable changes to the "CodeXR" extension will be documented in this file.

## [0.0.3] - 2025-04-11
### Added
- Improved visualization axis selection with step-by-step interface
- Added support for cylinder charts with optional radius dimension
- Smart dimension detection that recommends appropriate fields for each axis type

### Changed
- Enhanced JSON data processing to preserve original data structure while reordering attributes
- Implemented a more reliable temporary file handling system using the extension's global storage path
- Improved error handling when copying data files to visualization projects

### Fixed
- Fixed issue with temporary JSON files not being properly cleaned up
- Resolved errors when copying files between directories with different permission levels

### User Experience
- Added intelligent warning system that detects potentially confusing visualizations
- Warning alerts users when data dimensions might cause overlapping in charts
- Simplified UI with clear "Continue" or "Cancel" options for data selection decisions
