import * as path from 'path';
import * as fs from 'fs';

export const CODEXR_VISUAL_STYLE_RUNTIME_OUTPUT_NAME = 'codexrVisualStyleRuntime.js';

const CODEXR_VISUAL_STYLE_RUNTIME_SOURCE_SEGMENTS = [
    'templates',
    'components',
    'common',
    CODEXR_VISUAL_STYLE_RUNTIME_OUTPUT_NAME,
] as const;

export function resolveCodeXrVisualStyleRuntimeSourcePath(extensionPath: string): string {
    return path.join(extensionPath, ...CODEXR_VISUAL_STYLE_RUNTIME_SOURCE_SEGMENTS);
}

export function assertCodeXrVisualStyleRuntimeSourceExists(extensionPath: string): string {
    const runtimePath = resolveCodeXrVisualStyleRuntimeSourcePath(extensionPath);
    if (!fs.existsSync(runtimePath)) {
        throw new Error(`CodeXR visual style runtime not found at ${runtimePath}`);
    }
    return runtimePath;
}

export async function copyCodeXrVisualStyleRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    const runtimePath = assertCodeXrVisualStyleRuntimeSourceExists(extensionPath);
    const outputPath = path.join(outputDirectory, CODEXR_VISUAL_STYLE_RUNTIME_OUTPUT_NAME);
    await fs.promises.copyFile(runtimePath, outputPath);
    return outputPath;
}

export async function readCodeXrVisualStyleRuntimeContent(extensionPath: string): Promise<string> {
    const runtimePath = assertCodeXrVisualStyleRuntimeSourceExists(extensionPath);
    return fs.promises.readFile(runtimePath, 'utf8');
}
