import { assembleRuntimeContent, writeAssembledRuntimeToOutput } from './runtimeAssembly';

export const PROJECT_EVOLUTION_RUNTIME_OUTPUT_NAME = 'projectEvolutionRuntime.js';

// The Project evolution runtime is a multi-part runtime (see runtimeAssembly.ts): its source
// lives as ordered parts under project-evolution/projectEvolutionRuntime/.
export async function copyProjectEvolutionRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    return writeAssembledRuntimeToOutput(
        extensionPath, 'project-evolution', PROJECT_EVOLUTION_RUNTIME_OUTPUT_NAME, outputDirectory,
    );
}

export async function readProjectEvolutionRuntimeContent(extensionPath: string): Promise<string> {
    return assembleRuntimeContent(extensionPath, 'project-evolution', PROJECT_EVOLUTION_RUNTIME_OUTPUT_NAME);
}
