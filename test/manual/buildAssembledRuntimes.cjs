/**
 * Assemble the multi-part runtimes the manual harnesses load.
 *
 * The harness pages open over file:// (no fetch/XHR), so split runtimes cannot
 * be loaded part-by-part there; this script concatenates each one into
 * test/manual/assembled/<flat>.js (gitignored). The Playwright harness runners
 * invoke it automatically; run `node test/manual/buildAssembledRuntimes.cjs`
 * before opening a harness by hand.
 */
const fs = require('fs');
const path = require('path');
const { readAssembledRuntime } = require('../helpers/runtimeAssembly.cjs');

const HARNESS_RUNTIMES = [
    ['analysis-table', 'analysisTableRuntime.js'],
    ['xr-chart-mapping-ui', 'xrChartMappingUiRuntime.js'],
    ['analysis-mode', 'analysisModeRuntime.js'],
    ['historical-comparison', 'historicalComparisonRuntime.js'],
    ['dependency-graph', 'dependencyGraphRuntime.js'],
    ['project-evolution', 'projectEvolutionRuntime.js'],
];

// Single-file shared runtimes the Git analyses depend on (not manifest-assembled).
const HARNESS_SINGLE_FILE_RUNTIMES = [
    ['common', 'codexrGitRefPickerRuntime.js'],
];

function buildAssembledRuntimes() {
    const outputDir = path.join(__dirname, 'assembled');
    fs.mkdirSync(outputDir, { recursive: true });
    for (const [componentFolder, outputName] of HARNESS_RUNTIMES) {
        const content = readAssembledRuntime(componentFolder, outputName);
        fs.writeFileSync(path.join(outputDir, outputName), content, 'utf8');
    }
    const componentsRoot = path.resolve(__dirname, '..', '..', 'templates', 'components');
    for (const [folder, name] of HARNESS_SINGLE_FILE_RUNTIMES) {
        const content = fs.readFileSync(path.join(componentsRoot, folder, name), 'utf8');
        fs.writeFileSync(path.join(outputDir, name), content, 'utf8');
    }
    return outputDir;
}

if (require.main === module) {
    const outputDir = buildAssembledRuntimes();
    console.log(`[harness-assembly] Assembled ${HARNESS_RUNTIMES.length} runtimes into ${outputDir}`);
}

module.exports = { buildAssembledRuntimes };
