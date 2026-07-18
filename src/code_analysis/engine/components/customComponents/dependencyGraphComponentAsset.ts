import { assembleRuntimeContent, writeAssembledRuntimeToOutput } from './runtimeAssembly';

export const DEPENDENCY_GRAPH_RUNTIME_OUTPUT_NAME = 'dependencyGraphRuntime.js';

// The Dependency graph runtime is a multi-part runtime (see runtimeAssembly.ts): its source
// lives as ordered parts under dependency-graph/dependencyGraphRuntime/.
export async function copyDependencyGraphRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    return writeAssembledRuntimeToOutput(
        extensionPath, 'dependency-graph', DEPENDENCY_GRAPH_RUNTIME_OUTPUT_NAME, outputDirectory,
    );
}

export async function readDependencyGraphRuntimeContent(extensionPath: string): Promise<string> {
    return assembleRuntimeContent(extensionPath, 'dependency-graph', DEPENDENCY_GRAPH_RUNTIME_OUTPUT_NAME);
}
