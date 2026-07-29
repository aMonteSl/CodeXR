import * as fs from 'fs';
import * as path from 'path';

export const CODEXR_COMMON_RUNTIME_OUTPUT_NAME = 'codexrCommonRuntime.js';

const CODEXR_COMMON_RUNTIME_SOURCE_SEGMENTS = [
    'templates',
    'components',
    'common',
    CODEXR_COMMON_RUNTIME_OUTPUT_NAME,
] as const;

export function resolveCodeXrCommonRuntimeSourcePath(extensionPath: string): string {
    return path.join(extensionPath, ...CODEXR_COMMON_RUNTIME_SOURCE_SEGMENTS);
}

export function assertCodeXrCommonRuntimeSourceExists(extensionPath: string): string {
    const runtimePath = resolveCodeXrCommonRuntimeSourcePath(extensionPath);
    if (!fs.existsSync(runtimePath)) {
        throw new Error(`CodeXR common runtime not found at ${runtimePath}`);
    }
    return runtimePath;
}

export async function copyCodeXrCommonRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    const runtimePath = assertCodeXrCommonRuntimeSourceExists(extensionPath);
    const outputPath = path.join(outputDirectory, CODEXR_COMMON_RUNTIME_OUTPUT_NAME);
    await fs.promises.copyFile(runtimePath, outputPath);
    return outputPath;
}

export async function readCodeXrCommonRuntimeContent(extensionPath: string): Promise<string> {
    const runtimePath = assertCodeXrCommonRuntimeSourceExists(extensionPath);
    return fs.promises.readFile(runtimePath, 'utf8');
}
