import * as path from 'path';
import * as fs from 'fs';
import { assembleRuntimeContent, writeAssembledRuntimeToOutput } from './runtimeAssembly';

export const CODEXR_COLLABORATION_RUNTIME_OUTPUT_NAME = 'codexrCollaborationRuntime.js';
export const CODEXR_DOM_SCENE_COLLAB_RUNTIME_OUTPUT_NAME = 'codexrDomSceneCollaborationRuntime.js';

const CODEXR_DOM_SCENE_COLLAB_RUNTIME_SOURCE_SEGMENTS = [
    'templates',
    'components',
    'codexr',
    'dom-scene',
    CODEXR_DOM_SCENE_COLLAB_RUNTIME_OUTPUT_NAME,
] as const;

function assertSourceExists(sourcePath: string, label: string): string {
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`${label} not found at ${sourcePath}`);
    }
    return sourcePath;
}

export function resolveCodeXrDomSceneCollaborationRuntimeSourcePath(extensionPath: string): string {
    return path.join(extensionPath, ...CODEXR_DOM_SCENE_COLLAB_RUNTIME_SOURCE_SEGMENTS);
}

export function assertCodeXrDomSceneCollaborationRuntimeSourceExists(extensionPath: string): string {
    return assertSourceExists(
        resolveCodeXrDomSceneCollaborationRuntimeSourcePath(extensionPath),
        'CodeXR DOM scene collaboration runtime',
    );
}

// The collaboration runtime is a multi-part runtime (see runtimeAssembly.ts):
// its source lives as ordered parts under collaboration/codexrCollaborationRuntime/.
export async function copyCodeXrCollaborationRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    return writeAssembledRuntimeToOutput(
        extensionPath, 'collaboration', CODEXR_COLLABORATION_RUNTIME_OUTPUT_NAME, outputDirectory,
    );
}

export async function readCodeXrCollaborationRuntimeContent(extensionPath: string): Promise<string> {
    return assembleRuntimeContent(
        extensionPath, 'collaboration', CODEXR_COLLABORATION_RUNTIME_OUTPUT_NAME,
    );
}

export async function copyCodeXrDomSceneCollaborationRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    const runtimePath = assertCodeXrDomSceneCollaborationRuntimeSourceExists(extensionPath);
    const outputPath = path.join(outputDirectory, CODEXR_DOM_SCENE_COLLAB_RUNTIME_OUTPUT_NAME);
    await fs.promises.copyFile(runtimePath, outputPath);
    return outputPath;
}

export async function readCodeXrDomSceneCollaborationRuntimeContent(extensionPath: string): Promise<string> {
    const runtimePath = assertCodeXrDomSceneCollaborationRuntimeSourceExists(extensionPath);
    return fs.promises.readFile(runtimePath, 'utf8');
}
