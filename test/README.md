# CodeXR Test Suite

This folder contains the local validation suite for CodeXR.

## Structure

- `test/commands`: command registration contract tests.
- `test/directory_analysis`: directory watcher and reanalysis data tests.
- `test/python`: backend Python tests grouped by capability.
- `test/runners`: small runners that make the suite work consistently on Windows.

## Commands

- `npm run test`: typecheck, lint, compile the TypeScript sources, and run Node-based unit tests.
- `npm run test:python`: run Python backend tests if a Python interpreter is available.
- `npm run test:all`: run both the Node and Python suites.
- `npm run test:integration`: reserved for VS Code extension-host integration tests.
