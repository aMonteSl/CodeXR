import * as path from 'path';
import * as fs from 'fs';
import { assembleRuntimeContent, writeAssembledRuntimeToOutput } from './runtimeAssembly';

export const VIRTUAL_SCREEN_RUNTIME_OUTPUT_NAME = 'virtualScreenRuntime.js';
export const VIRTUAL_SCREEN_MANAGER_RUNTIME_OUTPUT_NAME = 'codexrMultiScreenManagerRuntime.js';

const VIRTUAL_SCREEN_MANAGER_RUNTIME_SOURCE_SEGMENTS = [
    'templates',
    'components',
    'codexr',
    'virtual-screen',
    VIRTUAL_SCREEN_MANAGER_RUNTIME_OUTPUT_NAME,
] as const;

// The virtual screen runtime is a multi-part runtime (see runtimeAssembly.ts):
// its source lives as ordered parts under virtual-screen/virtualScreenRuntime/.
export async function copyVirtualScreenRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    return writeAssembledRuntimeToOutput(
        extensionPath, 'virtual-screen', VIRTUAL_SCREEN_RUNTIME_OUTPUT_NAME, outputDirectory,
    );
}

export async function readVirtualScreenRuntimeContent(extensionPath: string): Promise<string> {
    return assembleRuntimeContent(extensionPath, 'virtual-screen', VIRTUAL_SCREEN_RUNTIME_OUTPUT_NAME);
}

export function resolveVirtualScreenManagerRuntimeSourcePath(extensionPath: string): string {
    return path.join(extensionPath, ...VIRTUAL_SCREEN_MANAGER_RUNTIME_SOURCE_SEGMENTS);
}

export function assertVirtualScreenManagerRuntimeSourceExists(extensionPath: string): string {
    const runtimePath = resolveVirtualScreenManagerRuntimeSourcePath(extensionPath);
    if (!fs.existsSync(runtimePath)) {
        throw new Error(`Virtual screen manager runtime not found at ${runtimePath}`);
    }
    return runtimePath;
}

export async function copyVirtualScreenManagerRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    const runtimePath = assertVirtualScreenManagerRuntimeSourceExists(extensionPath);
    const outputPath = path.join(outputDirectory, VIRTUAL_SCREEN_MANAGER_RUNTIME_OUTPUT_NAME);
    await fs.promises.copyFile(runtimePath, outputPath);
    return outputPath;
}

export async function readVirtualScreenManagerRuntimeContent(extensionPath: string): Promise<string> {
    const runtimePath = assertVirtualScreenManagerRuntimeSourceExists(extensionPath);
    return fs.promises.readFile(runtimePath, 'utf8');
}
