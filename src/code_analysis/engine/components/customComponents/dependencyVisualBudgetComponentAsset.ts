import * as fs from 'fs';
import * as path from 'path';

export const DEPENDENCY_VISUAL_BUDGET_RUNTIME_OUTPUT_NAME = 'dependencyVisualBudgetRuntime.js';

const SOURCE_SEGMENTS = [
    'templates',
    'components',
    'codexr',
    'dependency-visual-budget',
    DEPENDENCY_VISUAL_BUDGET_RUNTIME_OUTPUT_NAME,
] as const;

export function resolveDependencyVisualBudgetRuntimeSourcePath(extensionPath: string): string {
    return path.join(extensionPath, ...SOURCE_SEGMENTS);
}

export async function readDependencyVisualBudgetRuntimeContent(extensionPath: string): Promise<string> {
    const sourcePath = resolveDependencyVisualBudgetRuntimeSourcePath(extensionPath);
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Dependency visual budget runtime not found at ${sourcePath}`);
    }
    return fs.promises.readFile(sourcePath, 'utf8');
}

export async function copyDependencyVisualBudgetRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    const sourcePath = resolveDependencyVisualBudgetRuntimeSourcePath(extensionPath);
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Dependency visual budget runtime not found at ${sourcePath}`);
    }
    const outputPath = path.join(outputDirectory, DEPENDENCY_VISUAL_BUDGET_RUNTIME_OUTPUT_NAME);
    await fs.promises.copyFile(sourcePath, outputPath);
    return outputPath;
}
