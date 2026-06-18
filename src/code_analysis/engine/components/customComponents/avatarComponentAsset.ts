import * as path from 'path';
import * as fs from 'fs';

export const CODEXR_AVATAR_RUNTIME_OUTPUT_NAME = 'codexrAvatarRuntime.js';

const CODEXR_AVATAR_RUNTIME_SOURCE_SEGMENTS = [
    'templates',
    'components',
    'codexr',
    'avatar',
    CODEXR_AVATAR_RUNTIME_OUTPUT_NAME,
] as const;

export function resolveCodeXrAvatarRuntimeSourcePath(extensionPath: string): string {
    return path.join(extensionPath, ...CODEXR_AVATAR_RUNTIME_SOURCE_SEGMENTS);
}

export function assertCodeXrAvatarRuntimeSourceExists(extensionPath: string): string {
    const sourcePath = resolveCodeXrAvatarRuntimeSourcePath(extensionPath);
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`CodeXR avatar runtime not found at ${sourcePath}`);
    }
    return sourcePath;
}

export async function copyCodeXrAvatarRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    const sourcePath = assertCodeXrAvatarRuntimeSourceExists(extensionPath);
    const outputPath = path.join(outputDirectory, CODEXR_AVATAR_RUNTIME_OUTPUT_NAME);
    await fs.promises.copyFile(sourcePath, outputPath);
    return outputPath;
}

export async function readCodeXrAvatarRuntimeContent(extensionPath: string): Promise<string> {
    return fs.promises.readFile(assertCodeXrAvatarRuntimeSourceExists(extensionPath), 'utf8');
}
