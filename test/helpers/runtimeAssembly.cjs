/**
 * Test-side mirror of src/.../customComponents/runtimeAssembly.ts.
 *
 * Multi-part runtimes live as ordered part files under
 * templates/components/codexr/<component>/<runtimeBase>/NN-<section>.js and are
 * concatenated (lexicographic order, '\n'-joined) into the flat runtime file
 * generated scenes ship. Tests read the runtime source through this helper so
 * they exercise exactly what the extension assembles.
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');

function readAssembledRuntime(componentFolder, outputName) {
    const runtimeBase = outputName.replace(/\.js$/, '');
    const partsDir = path.join(
        projectRoot, 'templates', 'components', 'codexr', componentFolder, runtimeBase,
    );
    if (fs.existsSync(partsDir)) {
        const parts = fs.readdirSync(partsDir)
            .filter((name) => name.endsWith('.js'))
            .sort();
        if (parts.length === 0) {
            throw new Error(`Runtime parts directory has no .js parts: ${partsDir}`);
        }
        return parts
            .map((name) => fs.readFileSync(path.join(partsDir, name), 'utf8'))
            .join('\n');
    }
    // Single-file runtimes keep their flat layout.
    const flatPath = path.join(
        projectRoot, 'templates', 'components', 'codexr', componentFolder, outputName,
    );
    return fs.readFileSync(flatPath, 'utf8');
}

/**
 * Load an assembled runtime the way `require()` would load the flat file:
 * evaluated under a CommonJS-style wrapper so UMD runtimes export through
 * `module.exports` exactly as before the split.
 */
function requireAssembledRuntime(componentFolder, outputName) {
    const source = readAssembledRuntime(componentFolder, outputName);
    const moduleShim = { exports: {} };
    new Function('module', 'exports', 'require', source)(moduleShim, moduleShim.exports, require);
    return moduleShim.exports;
}

module.exports = { readAssembledRuntime, requireAssembledRuntime };
