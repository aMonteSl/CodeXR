import * as fs from 'fs';
import * as path from 'path';

export const GRAPH_COMMON_RUNTIME_OUTPUT_NAME = 'graphCommonRuntime.js';

const SOURCE_SEGMENTS = [
    'src',
    'codexr-components',
    'graphs',
    'common',
    GRAPH_COMMON_RUNTIME_OUTPUT_NAME,
] as const;

export function resolveGraphCommonRuntimeSourcePath(extensionPath: string): string {
    return path.join(extensionPath, ...SOURCE_SEGMENTS);
}

export async function readGraphCommonRuntimeContent(extensionPath: string): Promise<string> {
    const sourcePath = resolveGraphCommonRuntimeSourcePath(extensionPath);
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`CodeXR graph common runtime not found at ${sourcePath}`);
    }
    return fs.promises.readFile(sourcePath, 'utf8');
}

export async function copyGraphCommonRuntimeToOutput(
    extensionPath: string,
    outputPath: string,
): Promise<string> {
    const sourcePath = resolveGraphCommonRuntimeSourcePath(extensionPath);
    const targetPath = path.join(outputPath, GRAPH_COMMON_RUNTIME_OUTPUT_NAME);
    await fs.promises.copyFile(sourcePath, targetPath);
    return targetPath;
}
