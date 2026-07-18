import { assembleRuntimeContent, writeAssembledRuntimeToOutput } from './runtimeAssembly';

export const XR_CHART_DEBUG_RUNTIME_OUTPUT_NAME = 'xrChartDebugRuntime.js';

// The XR chart debug runtime is a multi-part runtime (see runtimeAssembly.ts): its source
// lives as ordered parts under xr-chart-debug/xrChartDebugRuntime/.
export async function copyXrChartDebugRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    return writeAssembledRuntimeToOutput(
        extensionPath, 'xr-chart-debug', XR_CHART_DEBUG_RUNTIME_OUTPUT_NAME, outputDirectory,
    );
}

export async function readXrChartDebugRuntimeContent(extensionPath: string): Promise<string> {
    return assembleRuntimeContent(extensionPath, 'xr-chart-debug', XR_CHART_DEBUG_RUNTIME_OUTPUT_NAME);
}
