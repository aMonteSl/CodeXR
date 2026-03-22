# manual_test

Manual fixtures for validating CodeXR analysis.

This folder is intended for two uses:
- manual validation inside the extension
- automated backend validation through `npm run test:analysis`

Included coverage:
- one or more code fixtures for every language currently supported by `Files by Language`
- one HTML fixture for DOM-only smoke tests
- a `deep/` folder for recursive directory-analysis checks

Expected checks:
- file analysis returns a non-empty function array for code fixtures
- directory analysis returns a non-empty file array
- XR and LivePanel generate the same `data.json` for the same target
- directory deep includes files inside `manual_test/deep/`
- DOM HTML still produces a prepared `htmlContent` string
