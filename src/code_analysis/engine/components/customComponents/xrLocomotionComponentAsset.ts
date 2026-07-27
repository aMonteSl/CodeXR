import * as fs from 'fs';
import * as path from 'path';

export const XR_LOCOMOTION_RUNTIME_OUTPUT_NAME = 'codexrXrLocomotionRuntime.js';

const XR_LOCOMOTION_RUNTIME_SOURCE_SEGMENTS = [
    'templates',
    'components',
    'codexr',
    'xr-locomotion',
    XR_LOCOMOTION_RUNTIME_OUTPUT_NAME,
] as const;

export function resolveXrLocomotionRuntimeSourcePath(extensionPath: string): string {
    return path.join(extensionPath, ...XR_LOCOMOTION_RUNTIME_SOURCE_SEGMENTS);
}

export function assertXrLocomotionRuntimeSourceExists(extensionPath: string): string {
    const runtimePath = resolveXrLocomotionRuntimeSourcePath(extensionPath);
    if (!fs.existsSync(runtimePath)) {
        throw new Error(`CodeXR xr-locomotion runtime not found at ${runtimePath}`);
    }
    return runtimePath;
}

export async function copyXrLocomotionRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    const runtimePath = assertXrLocomotionRuntimeSourceExists(extensionPath);
    const outputPath = path.join(outputDirectory, XR_LOCOMOTION_RUNTIME_OUTPUT_NAME);
    await fs.promises.copyFile(runtimePath, outputPath);
    return outputPath;
}

export async function readXrLocomotionRuntimeContent(extensionPath: string): Promise<string> {
    const runtimePath = assertXrLocomotionRuntimeSourceExists(extensionPath);
    return fs.promises.readFile(runtimePath, 'utf8');
}
