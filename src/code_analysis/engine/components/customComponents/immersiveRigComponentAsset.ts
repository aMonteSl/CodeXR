import * as fs from 'fs';
import * as path from 'path';

export const IMMERSIVE_RIG_RUNTIME_OUTPUT_NAME = 'codexrImmersiveRigRuntime.js';

const IMMERSIVE_RIG_RUNTIME_SOURCE_SEGMENTS = [
    'templates',
    'components',
    'codexr',
    'immersive-rig',
    IMMERSIVE_RIG_RUNTIME_OUTPUT_NAME,
] as const;

export function resolveImmersiveRigRuntimeSourcePath(extensionPath: string): string {
    return path.join(extensionPath, ...IMMERSIVE_RIG_RUNTIME_SOURCE_SEGMENTS);
}

export function assertImmersiveRigRuntimeSourceExists(extensionPath: string): string {
    const runtimePath = resolveImmersiveRigRuntimeSourcePath(extensionPath);
    if (!fs.existsSync(runtimePath)) {
        throw new Error(`CodeXR immersive-rig runtime not found at ${runtimePath}`);
    }
    return runtimePath;
}

export async function copyImmersiveRigRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    const runtimePath = assertImmersiveRigRuntimeSourceExists(extensionPath);
    const outputPath = path.join(outputDirectory, IMMERSIVE_RIG_RUNTIME_OUTPUT_NAME);
    await fs.promises.copyFile(runtimePath, outputPath);
    return outputPath;
}

export async function readImmersiveRigRuntimeContent(extensionPath: string): Promise<string> {
    const runtimePath = assertImmersiveRigRuntimeSourceExists(extensionPath);
    return fs.promises.readFile(runtimePath, 'utf8');
}
