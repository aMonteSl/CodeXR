import * as path from 'path';
import * as fs from 'fs';

export const CODEXR_COLLABORATION_RUNTIME_OUTPUT_NAME = 'codexrCollaborationRuntime.js';
export const CODEXR_DOM_SCENE_COLLAB_RUNTIME_OUTPUT_NAME = 'codexrDomSceneCollaborationRuntime.js';

const CODEXR_COLLAB_RUNTIME_SOURCE_SEGMENTS = [
    'templates',
    'components',
    'codexr',
    'collaboration',
    CODEXR_COLLABORATION_RUNTIME_OUTPUT_NAME,
] as const;

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

export function resolveCodeXrCollaborationRuntimeSourcePath(extensionPath: string): string {
    return path.join(extensionPath, ...CODEXR_COLLAB_RUNTIME_SOURCE_SEGMENTS);
}

export function resolveCodeXrDomSceneCollaborationRuntimeSourcePath(extensionPath: string): string {
    return path.join(extensionPath, ...CODEXR_DOM_SCENE_COLLAB_RUNTIME_SOURCE_SEGMENTS);
}

export function assertCodeXrCollaborationRuntimeSourceExists(extensionPath: string): string {
    return assertSourceExists(
        resolveCodeXrCollaborationRuntimeSourcePath(extensionPath),
        'CodeXR collaboration runtime',
    );
}

export function assertCodeXrDomSceneCollaborationRuntimeSourceExists(extensionPath: string): string {
    return assertSourceExists(
        resolveCodeXrDomSceneCollaborationRuntimeSourcePath(extensionPath),
        'CodeXR DOM scene collaboration runtime',
    );
}

export async function copyCodeXrCollaborationRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    const runtimePath = assertCodeXrCollaborationRuntimeSourceExists(extensionPath);
    const outputPath = path.join(outputDirectory, CODEXR_COLLABORATION_RUNTIME_OUTPUT_NAME);
    await fs.promises.copyFile(runtimePath, outputPath);
    return outputPath;
}

export async function readCodeXrCollaborationRuntimeContent(extensionPath: string): Promise<string> {
    const runtimePath = assertCodeXrCollaborationRuntimeSourceExists(extensionPath);
    return fs.promises.readFile(runtimePath, 'utf8');
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
