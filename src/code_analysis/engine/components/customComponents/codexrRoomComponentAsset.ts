import * as path from 'path';
import * as fs from 'fs';

export const CODEXR_ROOM_RUNTIME_OUTPUT_NAME = 'codexrRoomRuntime.js';
export const CODEXR_ROOM_TEXTURE_OUTPUT_DIRECTORY = 'assets/codexr/xr-room/textures';

const CODEXR_ROOM_SOURCE_SEGMENTS = [
    'src',
    'codexr-components',
    'others',
    'xr-room',
] as const;

const CODEXR_ROOM_TEXTURE_SOURCE_SEGMENTS = [
    ...CODEXR_ROOM_SOURCE_SEGMENTS,
    'textures',
] as const;

export interface TextAssetFile {
    relativeOutputPath: string;
    content: string;
}

export function resolveCodeXrRoomRuntimeSourcePath(extensionPath: string): string {
    return path.join(extensionPath, ...CODEXR_ROOM_SOURCE_SEGMENTS, CODEXR_ROOM_RUNTIME_OUTPUT_NAME);
}

export function resolveCodeXrRoomTextureSourcePath(extensionPath: string): string {
    return path.join(extensionPath, ...CODEXR_ROOM_TEXTURE_SOURCE_SEGMENTS);
}

export function assertCodeXrRoomAssetsExist(extensionPath: string): { runtimePath: string; textureDirectory: string } {
    const runtimePath = resolveCodeXrRoomRuntimeSourcePath(extensionPath);
    const textureDirectory = resolveCodeXrRoomTextureSourcePath(extensionPath);

    if (!fs.existsSync(runtimePath)) {
        throw new Error(`CodeXR room runtime not found at ${runtimePath}`);
    }

    if (!fs.existsSync(textureDirectory)) {
        throw new Error(`CodeXR room texture directory not found at ${textureDirectory}`);
    }

    return { runtimePath, textureDirectory };
}

async function copyDirectoryRecursive(sourceDir: string, destinationDir: string): Promise<void> {
    await fs.promises.mkdir(destinationDir, { recursive: true });
    const entries = await fs.promises.readdir(sourceDir, { withFileTypes: true });

    for (const entry of entries) {
        const sourcePath = path.join(sourceDir, entry.name);
        const destinationPath = path.join(destinationDir, entry.name);

        if (entry.isDirectory()) {
            await copyDirectoryRecursive(sourcePath, destinationPath);
            continue;
        }

        await fs.promises.copyFile(sourcePath, destinationPath);
    }
}

async function readTextFilesRecursive(
    sourceDir: string,
    relativePrefix = '',
): Promise<TextAssetFile[]> {
    const entries = await fs.promises.readdir(sourceDir, { withFileTypes: true });
    const files: TextAssetFile[] = [];

    for (const entry of entries) {
        const sourcePath = path.join(sourceDir, entry.name);
        const relativePath = relativePrefix
            ? path.posix.join(relativePrefix, entry.name)
            : entry.name;

        if (entry.isDirectory()) {
            const nestedFiles = await readTextFilesRecursive(sourcePath, relativePath);
            files.push(...nestedFiles);
            continue;
        }

        const outputPath = path.posix.join(CODEXR_ROOM_TEXTURE_OUTPUT_DIRECTORY, relativePath);
        const content = await fs.promises.readFile(sourcePath, 'utf8');
        files.push({
            relativeOutputPath: outputPath,
            content,
        });
    }

    return files;
}

export async function copyCodeXrRoomAssetsToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<void> {
    const { runtimePath, textureDirectory } = assertCodeXrRoomAssetsExist(extensionPath);
    const runtimeOutputPath = path.join(outputDirectory, CODEXR_ROOM_RUNTIME_OUTPUT_NAME);
    const textureOutputPath = path.join(outputDirectory, ...CODEXR_ROOM_TEXTURE_OUTPUT_DIRECTORY.split('/'));

    await fs.promises.copyFile(runtimePath, runtimeOutputPath);
    await copyDirectoryRecursive(textureDirectory, textureOutputPath);
}

export async function readCodeXrRoomRuntimeContent(extensionPath: string): Promise<string> {
    const { runtimePath } = assertCodeXrRoomAssetsExist(extensionPath);
    return fs.promises.readFile(runtimePath, 'utf8');
}

export async function readCodeXrRoomTextureContents(extensionPath: string): Promise<TextAssetFile[]> {
    const { textureDirectory } = assertCodeXrRoomAssetsExist(extensionPath);
    return readTextFilesRecursive(textureDirectory);
}
