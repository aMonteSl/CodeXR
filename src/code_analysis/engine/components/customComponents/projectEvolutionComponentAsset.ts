import * as fs from 'fs';
import * as path from 'path';

export const PROJECT_EVOLUTION_RUNTIME_OUTPUT_NAME = 'projectEvolutionRuntime.js';

const SOURCE_SEGMENTS = [
    'templates',
    'components',
    'codexr',
    'project-evolution',
    PROJECT_EVOLUTION_RUNTIME_OUTPUT_NAME,
] as const;

export function resolveProjectEvolutionRuntimeSourcePath(extensionPath: string): string {
    return path.join(extensionPath, ...SOURCE_SEGMENTS);
}

export async function copyProjectEvolutionRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    const sourcePath = resolveProjectEvolutionRuntimeSourcePath(extensionPath);
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Project evolution runtime not found at ${sourcePath}`);
    }
    const outputPath = path.join(outputDirectory, PROJECT_EVOLUTION_RUNTIME_OUTPUT_NAME);
    await fs.promises.copyFile(sourcePath, outputPath);
    return outputPath;
}

export async function readProjectEvolutionRuntimeContent(extensionPath: string): Promise<string> {
    const sourcePath = resolveProjectEvolutionRuntimeSourcePath(extensionPath);
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Project evolution runtime not found at ${sourcePath}`);
    }
    return fs.promises.readFile(sourcePath, 'utf8');
}
