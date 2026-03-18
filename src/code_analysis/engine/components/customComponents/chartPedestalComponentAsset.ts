import * as path from 'path';
import * as fs from 'fs';

export const CHART_PEDESTAL_RUNTIME_OUTPUT_NAME = 'chartPedestalRuntime.js';

const CHART_PEDESTAL_RUNTIME_SOURCE_SEGMENTS = [
    'templates',
    'components',
    'codexr',
    'chart-pedestal',
    CHART_PEDESTAL_RUNTIME_OUTPUT_NAME,
] as const;

export function resolveChartPedestalRuntimeSourcePath(extensionPath: string): string {
    return path.join(extensionPath, ...CHART_PEDESTAL_RUNTIME_SOURCE_SEGMENTS);
}

export function assertChartPedestalRuntimeSourceExists(extensionPath: string): string {
    const runtimePath = resolveChartPedestalRuntimeSourcePath(extensionPath);
    if (!fs.existsSync(runtimePath)) {
        throw new Error(`Chart pedestal runtime not found at ${runtimePath}`);
    }
    return runtimePath;
}

export async function copyChartPedestalRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    const runtimePath = assertChartPedestalRuntimeSourceExists(extensionPath);
    const outputPath = path.join(outputDirectory, CHART_PEDESTAL_RUNTIME_OUTPUT_NAME);
    await fs.promises.copyFile(runtimePath, outputPath);
    return outputPath;
}

export async function readChartPedestalRuntimeContent(extensionPath: string): Promise<string> {
    const runtimePath = assertChartPedestalRuntimeSourceExists(extensionPath);
    return fs.promises.readFile(runtimePath, 'utf8');
}

export const BOATS_PEDESTAL_RUNTIME_OUTPUT_NAME = CHART_PEDESTAL_RUNTIME_OUTPUT_NAME;
export const resolveBoatsPedestalRuntimeSourcePath = resolveChartPedestalRuntimeSourcePath;
export const assertBoatsPedestalRuntimeSourceExists = assertChartPedestalRuntimeSourceExists;
export const copyBoatsPedestalRuntimeToOutput = copyChartPedestalRuntimeToOutput;
export const readBoatsPedestalRuntimeContent = readChartPedestalRuntimeContent;
