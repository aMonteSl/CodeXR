import { assembleRuntimeContent, writeAssembledRuntimeToOutput } from './runtimeAssembly';

export const HISTORICAL_COMPARISON_RUNTIME_OUTPUT_NAME = 'historicalComparisonRuntime.js';

// The Historical comparison runtime is a multi-part runtime (see runtimeAssembly.ts): its source
// lives as ordered parts under historical-comparison/historicalComparisonRuntime/.
export async function copyHistoricalComparisonRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    return writeAssembledRuntimeToOutput(
        extensionPath, 'historical-comparison', HISTORICAL_COMPARISON_RUNTIME_OUTPUT_NAME, outputDirectory,
    );
}

export async function readHistoricalComparisonRuntimeContent(extensionPath: string): Promise<string> {
    return assembleRuntimeContent(extensionPath, 'historical-comparison', HISTORICAL_COMPARISON_RUNTIME_OUTPUT_NAME);
}
