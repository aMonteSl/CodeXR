import * as fs from 'fs';
import * as path from 'path';

export const CODEXR_DEBUG_RUNTIME_OUTPUT_NAME = 'codexrDebugRuntime.js';

const SOURCE_SEGMENTS = [
    'templates',
    'components',
    'codexr',
    'debug',
    CODEXR_DEBUG_RUNTIME_OUTPUT_NAME,
] as const;

export function resolveCodeXrDebugRuntimeSourcePath(extensionPath: string): string {
    return path.join(extensionPath, ...SOURCE_SEGMENTS);
}

export async function readCodeXrDebugRuntimeContent(extensionPath: string): Promise<string> {
    const sourcePath = resolveCodeXrDebugRuntimeSourcePath(extensionPath);
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`CodeXR debug runtime not found at ${sourcePath}`);
    }
    return fs.promises.readFile(sourcePath, 'utf8');
}

export async function copyCodeXrDebugRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    const sourcePath = resolveCodeXrDebugRuntimeSourcePath(extensionPath);
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`CodeXR debug runtime not found at ${sourcePath}`);
    }
    const outputPath = path.join(outputDirectory, CODEXR_DEBUG_RUNTIME_OUTPUT_NAME);
    await fs.promises.copyFile(sourcePath, outputPath);
    return outputPath;
}
