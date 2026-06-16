import * as path from 'path';
import * as fs from 'fs';

export const XR_CHART_MAPPING_UI_RUNTIME_OUTPUT_NAME = 'xrChartMappingUiRuntime.js';

const XR_CHART_MAPPING_UI_RUNTIME_SOURCE_SEGMENTS = [
    'src',
    'codexr-components',
    'others',
    'xr-chart-mapping-ui',
    XR_CHART_MAPPING_UI_RUNTIME_OUTPUT_NAME,
] as const;

export function resolveXrChartMappingUiRuntimeSourcePath(extensionPath: string): string {
    return path.join(extensionPath, ...XR_CHART_MAPPING_UI_RUNTIME_SOURCE_SEGMENTS);
}

export function assertXrChartMappingUiRuntimeSourceExists(extensionPath: string): string {
    const runtimePath = resolveXrChartMappingUiRuntimeSourcePath(extensionPath);
    if (!fs.existsSync(runtimePath)) {
        throw new Error(`XR chart mapping UI runtime not found at ${runtimePath}`);
    }
    return runtimePath;
}

export async function copyXrChartMappingUiRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    const runtimePath = assertXrChartMappingUiRuntimeSourceExists(extensionPath);
    const outputPath = path.join(outputDirectory, XR_CHART_MAPPING_UI_RUNTIME_OUTPUT_NAME);
    await fs.promises.copyFile(runtimePath, outputPath);
    return outputPath;
}

export async function readXrChartMappingUiRuntimeContent(extensionPath: string): Promise<string> {
    const runtimePath = assertXrChartMappingUiRuntimeSourceExists(extensionPath);
    return fs.promises.readFile(runtimePath, 'utf8');
}
