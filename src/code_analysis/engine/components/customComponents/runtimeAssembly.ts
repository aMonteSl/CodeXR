import * as path from 'path';
import * as fs from 'fs';

/**
 * Assembly of multi-part CodeXR browser runtimes.
 *
 * Large runtimes are split into ordered part files under
 * `templates/components/codexr/<component>/<runtimeBase>/NN-<section>.js`
 * (lexicographic order: the first part opens the runtime's IIFE/UMD wrapper,
 * the last one closes it). At injection time the parts are concatenated back
 * into the single flat file generated scenes have always shipped
 * (`<runtimeBase>.js`), so analysis output stays simple and self-contained.
 *
 * See templates/components/COMPONENTS.md ("Multi-part runtimes").
 */

export function resolveRuntimePartsDir(
    extensionPath: string,
    componentFolder: string,
    outputName: string,
): string {
    const runtimeBase = outputName.replace(/\.js$/, '');
    return path.join(extensionPath, 'templates', 'components', 'codexr', componentFolder, runtimeBase);
}

export function listRuntimePartFiles(partsDir: string): string[] {
    if (!fs.existsSync(partsDir)) {
        throw new Error(`Runtime parts directory not found at ${partsDir}`);
    }
    const parts = fs.readdirSync(partsDir)
        .filter((name) => name.endsWith('.js'))
        .sort();
    if (parts.length === 0) {
        throw new Error(`Runtime parts directory has no .js parts: ${partsDir}`);
    }
    return parts.map((name) => path.join(partsDir, name));
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
