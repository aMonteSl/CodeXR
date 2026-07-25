import * as fs from 'fs';
import * as path from 'path';

export const POINTER_POLICY_RUNTIME_OUTPUT_NAME = 'codexrPointerPolicyRuntime.js';

const POINTER_POLICY_RUNTIME_SOURCE_SEGMENTS = [
    'templates',
    'components',
    'codexr',
    'pointer-policy',
    POINTER_POLICY_RUNTIME_OUTPUT_NAME,
] as const;

export function resolvePointerPolicyRuntimeSourcePath(extensionPath: string): string {
    return path.join(extensionPath, ...POINTER_POLICY_RUNTIME_SOURCE_SEGMENTS);
}

export function assertPointerPolicyRuntimeSourceExists(extensionPath: string): string {
    const runtimePath = resolvePointerPolicyRuntimeSourcePath(extensionPath);
    if (!fs.existsSync(runtimePath)) {
        throw new Error(`CodeXR pointer-policy runtime not found at ${runtimePath}`);
    }
    return runtimePath;
}

export async function copyPointerPolicyRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    const runtimePath = assertPointerPolicyRuntimeSourceExists(extensionPath);
    const outputPath = path.join(outputDirectory, POINTER_POLICY_RUNTIME_OUTPUT_NAME);
    await fs.promises.copyFile(runtimePath, outputPath);
    return outputPath;
}

export async function readPointerPolicyRuntimeContent(extensionPath: string): Promise<string> {
    const runtimePath = assertPointerPolicyRuntimeSourceExists(extensionPath);
    return fs.promises.readFile(runtimePath, 'utf8');
}
