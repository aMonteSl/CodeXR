/**
 * Test-side mirror of src/.../customComponents/runtimeAssembly.ts.
 *
 * Multi-part runtimes live as focused module files under
 * templates/components/codexr/<component>/<runtimeBase>/ with their
 * concatenation order declared in that directory's manifest.json. Tests read
 * the runtime source through this helper so they exercise exactly what the
 * extension assembles.
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
        const manifest = JSON.parse(fs.readFileSync(path.join(partsDir, 'manifest.json'), 'utf8'));
        const orphans = fs.readdirSync(partsDir)
            .filter((name) => name.endsWith('.js') && !manifest.parts.includes(name));
        if (orphans.length > 0) {
            throw new Error(`Runtime parts not listed in ${partsDir}\\manifest.json: ${orphans.join(', ')}`);
        }
        return manifest.parts
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
