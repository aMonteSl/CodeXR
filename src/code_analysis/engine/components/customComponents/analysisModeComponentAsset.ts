import * as fs from 'fs';
import * as path from 'path';

export const ANALYSIS_MODE_RUNTIME_OUTPUT_NAME = 'analysisModeRuntime.js';

const SOURCE_SEGMENTS = [
    'src',
    'codexr-components',
    'others',
    'analysis-mode',
    ANALYSIS_MODE_RUNTIME_OUTPUT_NAME,
] as const;

export function resolveAnalysisModeRuntimeSourcePath(extensionPath: string): string {
    return path.join(extensionPath, ...SOURCE_SEGMENTS);
}

export async function readAnalysisModeRuntimeContent(extensionPath: string): Promise<string> {
    const sourcePath = resolveAnalysisModeRuntimeSourcePath(extensionPath);
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Analysis mode runtime not found at ${sourcePath}`);
    }
    return fs.promises.readFile(sourcePath, 'utf8');
}

export async function copyAnalysisModeRuntimeToOutput(
    extensionPath: string,
    outputPath: string,
): Promise<string> {
    const sourcePath = resolveAnalysisModeRuntimeSourcePath(extensionPath);
    const targetPath = path.join(outputPath, ANALYSIS_MODE_RUNTIME_OUTPUT_NAME);
    await fs.promises.copyFile(sourcePath, targetPath);
    return targetPath;
}
