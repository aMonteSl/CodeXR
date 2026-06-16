import * as path from 'path';
import * as fs from 'fs';

export const XR_CHART_DEBUG_RUNTIME_OUTPUT_NAME = 'xrChartDebugRuntime.js';

const XR_CHART_DEBUG_RUNTIME_SOURCE_SEGMENTS = [
    'src',
    'codexr-components',
    'others',
    'xr-chart-debug',
    XR_CHART_DEBUG_RUNTIME_OUTPUT_NAME,
] as const;

export function resolveXrChartDebugRuntimeSourcePath(extensionPath: string): string {
    return path.join(extensionPath, ...XR_CHART_DEBUG_RUNTIME_SOURCE_SEGMENTS);
}

export function assertXrChartDebugRuntimeSourceExists(extensionPath: string): string {
    const runtimePath = resolveXrChartDebugRuntimeSourcePath(extensionPath);
    if (!fs.existsSync(runtimePath)) {
        throw new Error(`XR chart debug runtime not found at ${runtimePath}`);
    }
    return runtimePath;
}

export async function copyXrChartDebugRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    const runtimePath = assertXrChartDebugRuntimeSourceExists(extensionPath);
    const outputPath = path.join(outputDirectory, XR_CHART_DEBUG_RUNTIME_OUTPUT_NAME);
    await fs.promises.copyFile(runtimePath, outputPath);
    return outputPath;
}

export async function readXrChartDebugRuntimeContent(extensionPath: string): Promise<string> {
    const runtimePath = assertXrChartDebugRuntimeSourceExists(extensionPath);
    return fs.promises.readFile(runtimePath, 'utf8');
}
