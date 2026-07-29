import { assembleRuntimeContent, writeAssembledRuntimeToOutput } from './runtimeAssembly';

export const ANALYSIS_MODE_RUNTIME_OUTPUT_NAME = 'analysisModeRuntime.js';

// The Analysis mode runtime is a multi-part runtime (see runtimeAssembly.ts): its source
// lives as ordered parts under analysis-mode/analysisModeRuntime/.
export async function copyAnalysisModeRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    return writeAssembledRuntimeToOutput(
        extensionPath, 'analysis-mode', ANALYSIS_MODE_RUNTIME_OUTPUT_NAME, outputDirectory,
    );
}

export async function readAnalysisModeRuntimeContent(extensionPath: string): Promise<string> {
    return assembleRuntimeContent(extensionPath, 'analysis-mode', ANALYSIS_MODE_RUNTIME_OUTPUT_NAME);
}
