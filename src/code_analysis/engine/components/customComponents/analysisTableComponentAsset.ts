import { assembleRuntimeContent, writeAssembledRuntimeToOutput } from './runtimeAssembly';

export const ANALYSIS_TABLE_RUNTIME_OUTPUT_NAME = 'analysisTableRuntime.js';

// The Analysis table runtime is a multi-part runtime (see runtimeAssembly.ts): its source
// lives as ordered parts under analysis-table/analysisTableRuntime/.
export async function copyAnalysisTableRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    return writeAssembledRuntimeToOutput(
        extensionPath, 'analysis-table', ANALYSIS_TABLE_RUNTIME_OUTPUT_NAME, outputDirectory,
    );
}

export async function readAnalysisTableRuntimeContent(extensionPath: string): Promise<string> {
    return assembleRuntimeContent(extensionPath, 'analysis-table', ANALYSIS_TABLE_RUNTIME_OUTPUT_NAME);
}
