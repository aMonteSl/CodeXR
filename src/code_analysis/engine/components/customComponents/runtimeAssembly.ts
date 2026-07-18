import * as path from 'path';
import * as fs from 'fs';

/**
 * Assembly of multi-part CodeXR browser runtimes.
 *
 * Large runtimes live as focused module files under
 * `templates/components/codexr/<component>/<runtimeBase>/` (for example
 * `analysis-table/analysisTableRuntime/geometryUtils.js`). The concatenation
 * order is declared explicitly in that directory's `manifest.json` — the first
 * listed part opens the runtime's IIFE/UMD wrapper, the last one closes it. At
 * injection time the parts are joined back into the single flat file generated
 * scenes have always shipped (`<runtimeBase>.js`), so analysis output stays
 * simple and self-contained.
 *
 * See templates/components/COMPONENTS.md ("Multi-part runtimes").
 */

interface RuntimePartsManifest {
    output: string;
    parts: string[];
}

export function resolveRuntimePartsDir(
    extensionPath: string,
    componentFolder: string,
    outputName: string,
): string {
    const runtimeBase = outputName.replace(/\.js$/, '');
    return path.join(extensionPath, 'templates', 'components', 'codexr', componentFolder, runtimeBase);
}

function readManifest(partsDir: string): RuntimePartsManifest {
    const manifestPath = path.join(partsDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
        throw new Error(`Runtime parts manifest not found at ${manifestPath}`);
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as RuntimePartsManifest;
    if (!Array.isArray(manifest.parts) || manifest.parts.length === 0) {
        throw new Error(`Runtime parts manifest lists no parts: ${manifestPath}`);
    }
    return manifest;
}

export function listRuntimePartFiles(partsDir: string): string[] {
    const manifest = readManifest(partsDir);
    const partPaths = manifest.parts.map((name) => path.join(partsDir, name));
    for (const partPath of partPaths) {
        if (!fs.existsSync(partPath)) {
            throw new Error(`Runtime part listed in manifest is missing: ${partPath}`);
        }
    }
    // A .js file next to the manifest but absent from it is almost certainly a
    // mistake (it would silently not ship) — fail loudly instead.
    const orphans = fs.readdirSync(partsDir)
        .filter((name) => name.endsWith('.js') && !manifest.parts.includes(name));
    if (orphans.length > 0) {
        throw new Error(`Runtime parts not listed in ${path.join(partsDir, 'manifest.json')}: ${orphans.join(', ')}`);
    }
    return partPaths;
}

export async function assembleRuntimeContent(
    extensionPath: string,
    componentFolder: string,
    outputName: string,
): Promise<string> {
    const partsDir = resolveRuntimePartsDir(extensionPath, componentFolder, outputName);
    const partPaths = listRuntimePartFiles(partsDir);
    const contents = await Promise.all(
        partPaths.map((partPath) => fs.promises.readFile(partPath, 'utf8')),
    );
    return contents.join('\n');
}

export async function writeAssembledRuntimeToOutput(
    extensionPath: string,
    componentFolder: string,
    outputName: string,
    outputDirectory: string,
): Promise<string> {
    const content = await assembleRuntimeContent(extensionPath, componentFolder, outputName);
    const outputPath = path.join(outputDirectory, outputName);
    await fs.promises.writeFile(outputPath, content, 'utf8');
    return outputPath;
}
