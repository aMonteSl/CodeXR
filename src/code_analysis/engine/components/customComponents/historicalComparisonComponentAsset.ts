import * as fs from 'fs';
import * as path from 'path';

export const HISTORICAL_COMPARISON_RUNTIME_OUTPUT_NAME = 'historicalComparisonRuntime.js';

const SOURCE_SEGMENTS = [
    'src',
    'codexr-components',
    'others',
    'historical-comparison',
    HISTORICAL_COMPARISON_RUNTIME_OUTPUT_NAME,
] as const;

export function resolveHistoricalComparisonRuntimeSourcePath(extensionPath: string): string {
    return path.join(extensionPath, ...SOURCE_SEGMENTS);
}

export async function copyHistoricalComparisonRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    const sourcePath = resolveHistoricalComparisonRuntimeSourcePath(extensionPath);
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Historical comparison runtime not found at ${sourcePath}`);
    }
    const outputPath = path.join(outputDirectory, HISTORICAL_COMPARISON_RUNTIME_OUTPUT_NAME);
    await fs.promises.copyFile(sourcePath, outputPath);
    return outputPath;
}

export async function readHistoricalComparisonRuntimeContent(extensionPath: string): Promise<string> {
    const sourcePath = resolveHistoricalComparisonRuntimeSourcePath(extensionPath);
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Historical comparison runtime not found at ${sourcePath}`);
    }
    return fs.promises.readFile(sourcePath, 'utf8');
}
