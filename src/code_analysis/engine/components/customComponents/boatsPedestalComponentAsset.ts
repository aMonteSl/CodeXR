import * as path from 'path';
import * as fs from 'fs';

export const BOATS_PEDESTAL_RUNTIME_OUTPUT_NAME = 'boatsPedestalRuntime.js';

const BOATS_PEDESTAL_RUNTIME_SOURCE_SEGMENTS = [
    'templates',
    'components',
    'codexr',
    'boats-pedestal',
    BOATS_PEDESTAL_RUNTIME_OUTPUT_NAME,
] as const;

export function resolveBoatsPedestalRuntimeSourcePath(extensionPath: string): string {
    return path.join(extensionPath, ...BOATS_PEDESTAL_RUNTIME_SOURCE_SEGMENTS);
}

export function assertBoatsPedestalRuntimeSourceExists(extensionPath: string): string {
    const runtimePath = resolveBoatsPedestalRuntimeSourcePath(extensionPath);
    if (!fs.existsSync(runtimePath)) {
        throw new Error(`Boats pedestal runtime not found at ${runtimePath}`);
    }
    return runtimePath;
}

export async function copyBoatsPedestalRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    const runtimePath = assertBoatsPedestalRuntimeSourceExists(extensionPath);
    const outputPath = path.join(outputDirectory, BOATS_PEDESTAL_RUNTIME_OUTPUT_NAME);
    await fs.promises.copyFile(runtimePath, outputPath);
    return outputPath;
}

export async function readBoatsPedestalRuntimeContent(extensionPath: string): Promise<string> {
    const runtimePath = assertBoatsPedestalRuntimeSourceExists(extensionPath);
    return fs.promises.readFile(runtimePath, 'utf8');
}