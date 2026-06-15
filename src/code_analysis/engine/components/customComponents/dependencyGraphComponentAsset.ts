import * as fs from 'fs';
import * as path from 'path';

export const DEPENDENCY_GRAPH_RUNTIME_OUTPUT_NAME = 'dependencyGraphRuntime.js';

const SOURCE_SEGMENTS = [
    'templates',
    'components',
    'codexr',
    'dependency-graph',
    DEPENDENCY_GRAPH_RUNTIME_OUTPUT_NAME,
] as const;

export function resolveDependencyGraphRuntimeSourcePath(extensionPath: string): string {
    return path.join(extensionPath, ...SOURCE_SEGMENTS);
}

export async function readDependencyGraphRuntimeContent(extensionPath: string): Promise<string> {
    const sourcePath = resolveDependencyGraphRuntimeSourcePath(extensionPath);
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Dependency graph runtime not found at ${sourcePath}`);
    }
    return fs.promises.readFile(sourcePath, 'utf8');
}

export async function copyDependencyGraphRuntimeToOutput(
    extensionPath: string,
    outputPath: string,
): Promise<string> {
    const sourcePath = resolveDependencyGraphRuntimeSourcePath(extensionPath);
    const targetPath = path.join(outputPath, DEPENDENCY_GRAPH_RUNTIME_OUTPUT_NAME);
    await fs.promises.copyFile(sourcePath, targetPath);
    return targetPath;
}
