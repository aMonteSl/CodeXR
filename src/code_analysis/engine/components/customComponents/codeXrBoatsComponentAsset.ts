import { assembleRuntimeContent, writeAssembledRuntimeToOutput } from './runtimeAssembly';

export const CODEXR_BOATS_RUNTIME_OUTPUT_NAME = 'codeXrBoatsRuntime.js';

// The CodeXR boats runtime is a multi-part runtime (see runtimeAssembly.ts): its source
// lives as ordered parts under code-xr-boats/codeXrBoatsRuntime/.
export async function copyCodeXrBoatsRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    return writeAssembledRuntimeToOutput(
        extensionPath, 'code-xr-boats', CODEXR_BOATS_RUNTIME_OUTPUT_NAME, outputDirectory,
    );
}

export async function readCodeXrBoatsRuntimeContent(extensionPath: string): Promise<string> {
    return assembleRuntimeContent(extensionPath, 'code-xr-boats', CODEXR_BOATS_RUNTIME_OUTPUT_NAME);
}
