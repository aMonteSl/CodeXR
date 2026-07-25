import * as fs from 'fs';
import * as path from 'path';

export const CODEXR_GIT_REF_PICKER_OUTPUT_NAME = 'codexrGitRefPickerRuntime.js';

const CODEXR_GIT_REF_PICKER_SOURCE_SEGMENTS = [
    'templates',
    'components',
    'common',
    CODEXR_GIT_REF_PICKER_OUTPUT_NAME,
] as const;

export function resolveCodeXrGitRefPickerSourcePath(extensionPath: string): string {
    return path.join(extensionPath, ...CODEXR_GIT_REF_PICKER_SOURCE_SEGMENTS);
}

export function assertCodeXrGitRefPickerSourceExists(extensionPath: string): string {
    const runtimePath = resolveCodeXrGitRefPickerSourcePath(extensionPath);
    if (!fs.existsSync(runtimePath)) {
        throw new Error(`CodeXR Git ref picker runtime not found at ${runtimePath}`);
    }
    return runtimePath;
}

export async function copyCodeXrGitRefPickerToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    const runtimePath = assertCodeXrGitRefPickerSourceExists(extensionPath);
    const outputPath = path.join(outputDirectory, CODEXR_GIT_REF_PICKER_OUTPUT_NAME);
    await fs.promises.copyFile(runtimePath, outputPath);
    return outputPath;
}

export async function readCodeXrGitRefPickerContent(extensionPath: string): Promise<string> {
    const runtimePath = assertCodeXrGitRefPickerSourceExists(extensionPath);
    return fs.promises.readFile(runtimePath, 'utf8');
}
