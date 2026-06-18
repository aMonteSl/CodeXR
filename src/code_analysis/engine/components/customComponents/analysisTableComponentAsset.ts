import * as path from 'path';
import * as fs from 'fs';

export const ANALYSIS_TABLE_RUNTIME_OUTPUT_NAME = 'analysisTableRuntime.js';

const ANALYSIS_TABLE_RUNTIME_SOURCE_SEGMENTS = [
    'templates',
    'components',
    'codexr',
    'analysis-table',
    ANALYSIS_TABLE_RUNTIME_OUTPUT_NAME,
] as const;

export function resolveAnalysisTableRuntimeSourcePath(extensionPath: string): string {
    return path.join(extensionPath, ...ANALYSIS_TABLE_RUNTIME_SOURCE_SEGMENTS);
}

export function assertAnalysisTableRuntimeSourceExists(extensionPath: string): string {
    const runtimePath = resolveAnalysisTableRuntimeSourcePath(extensionPath);
    if (!fs.existsSync(runtimePath)) {
        throw new Error(`Analysis table runtime not found at ${runtimePath}`);
    }
    return runtimePath;
}

export async function copyAnalysisTableRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    const runtimePath = assertAnalysisTableRuntimeSourceExists(extensionPath);
    const outputPath = path.join(outputDirectory, ANALYSIS_TABLE_RUNTIME_OUTPUT_NAME);
    await fs.promises.copyFile(runtimePath, outputPath);
    return outputPath;
}

export async function readAnalysisTableRuntimeContent(extensionPath: string): Promise<string> {
    const runtimePath = assertAnalysisTableRuntimeSourceExists(extensionPath);
    return fs.promises.readFile(runtimePath, 'utf8');
}
