import * as fs from 'fs';
import * as path from 'path';

export const RENDER_BUDGET_RUNTIME_OUTPUT_NAME = 'renderBudgetRuntime.js';

const SOURCE_SEGMENTS = [
    'src',
    'codexr-components',
    'others',
    'render-budget',
    RENDER_BUDGET_RUNTIME_OUTPUT_NAME,
] as const;

export function resolveRenderBudgetRuntimeSourcePath(extensionPath: string): string {
    return path.join(extensionPath, ...SOURCE_SEGMENTS);
}

export async function readRenderBudgetRuntimeContent(extensionPath: string): Promise<string> {
    const sourcePath = resolveRenderBudgetRuntimeSourcePath(extensionPath);
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Render budget runtime not found at ${sourcePath}`);
    }
    return fs.promises.readFile(sourcePath, 'utf8');
}

export async function copyRenderBudgetRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    const sourcePath = resolveRenderBudgetRuntimeSourcePath(extensionPath);
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Render budget runtime not found at ${sourcePath}`);
    }
    const outputPath = path.join(outputDirectory, RENDER_BUDGET_RUNTIME_OUTPUT_NAME);
    await fs.promises.copyFile(sourcePath, outputPath);
    return outputPath;
}
