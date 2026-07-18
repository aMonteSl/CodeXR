import { assembleRuntimeContent, writeAssembledRuntimeToOutput } from './runtimeAssembly';

export const XR_CHART_MAPPING_UI_RUNTIME_OUTPUT_NAME = 'xrChartMappingUiRuntime.js';

// The XR chart mapping UI runtime is a multi-part runtime (see runtimeAssembly.ts): its source
// lives as ordered parts under xr-chart-mapping-ui/xrChartMappingUiRuntime/.
export async function copyXrChartMappingUiRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    return writeAssembledRuntimeToOutput(
        extensionPath, 'xr-chart-mapping-ui', XR_CHART_MAPPING_UI_RUNTIME_OUTPUT_NAME, outputDirectory,
    );
}

export async function readXrChartMappingUiRuntimeContent(extensionPath: string): Promise<string> {
    return assembleRuntimeContent(extensionPath, 'xr-chart-mapping-ui', XR_CHART_MAPPING_UI_RUNTIME_OUTPUT_NAME);
}
