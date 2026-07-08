import * as path from 'path';
import * as fs from 'fs';

export const CODEXR_BOATS_RUNTIME_OUTPUT_NAME = 'codeXrBoatsRuntime.js';
export const CODEXR_BOATS_TEXTURE_OUTPUT_DIRECTORY = 'assets/codexr/code-xr-boats/temporal-skins';

const CODEXR_BOATS_RUNTIME_SOURCE_SEGMENTS = [
    'templates',
    'components',
    'codexr',
    'code-xr-boats',
    CODEXR_BOATS_RUNTIME_OUTPUT_NAME,
] as const;

const CODEXR_BOATS_TEXTURE_SOURCE_SEGMENTS = [
    'templates',
    'components',
    'codexr',
    'code-xr-boats',
    'textures',
    'temporal-skins',
] as const;

export interface CodeXrBoatsTextAssetFile {
    relativeOutputPath: string;
    content: string;
}

export function resolveCodeXrBoatsRuntimeSourcePath(extensionPath: string): string {
    return path.join(extensionPath, ...CODEXR_BOATS_RUNTIME_SOURCE_SEGMENTS);
}

export function resolveCodeXrBoatsTextureSourcePath(extensionPath: string): string {
    return path.join(extensionPath, ...CODEXR_BOATS_TEXTURE_SOURCE_SEGMENTS);
}

export function assertCodeXrBoatsAssetsExist(extensionPath: string): { runtimePath: string; textureDirectory: string } {
    const runtimePath = resolveCodeXrBoatsRuntimeSourcePath(extensionPath);
    const textureDirectory = resolveCodeXrBoatsTextureSourcePath(extensionPath);
    if (!fs.existsSync(runtimePath)) {
        throw new Error(`CodeXR boats runtime not found at ${runtimePath}`);
    }
    if (!fs.existsSync(textureDirectory)) {
        throw new Error(`CodeXR boats temporal skin texture directory not found at ${textureDirectory}`);
    }
    return { runtimePath, textureDirectory };
}

export function assertCodeXrBoatsRuntimeSourceExists(extensionPath: string): string {
    return assertCodeXrBoatsAssetsExist(extensionPath).runtimePath;
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
        if (path.extname(entry.name).toLowerCase() !== '.svg') {
            continue;
        }
        await fs.promises.copyFile(sourcePath, destinationPath);
    }
}

async function readTextFilesRecursive(
    sourceDir: string,
    relativePrefix = '',
): Promise<CodeXrBoatsTextAssetFile[]> {
    const entries = await fs.promises.readdir(sourceDir, { withFileTypes: true });
    const files: CodeXrBoatsTextAssetFile[] = [];

    for (const entry of entries) {
        const sourcePath = path.join(sourceDir, entry.name);
        const relativePath = relativePrefix
            ? path.posix.join(relativePrefix, entry.name)
            : entry.name;
        if (entry.isDirectory()) {
            files.push(...await readTextFilesRecursive(sourcePath, relativePath));
            continue;
        }
        if (path.extname(entry.name).toLowerCase() !== '.svg') {
            continue;
        }
        files.push({
            relativeOutputPath: path.posix.join(CODEXR_BOATS_TEXTURE_OUTPUT_DIRECTORY, relativePath),
            content: await fs.promises.readFile(sourcePath, 'utf8'),
        });
    }

    return files;
}

export async function copyCodeXrBoatsRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    const { runtimePath, textureDirectory } = assertCodeXrBoatsAssetsExist(extensionPath);
    const outputPath = path.join(outputDirectory, CODEXR_BOATS_RUNTIME_OUTPUT_NAME);
    const textureOutputPath = path.join(outputDirectory, ...CODEXR_BOATS_TEXTURE_OUTPUT_DIRECTORY.split('/'));
    await fs.promises.copyFile(runtimePath, outputPath);
    await copyDirectoryRecursive(textureDirectory, textureOutputPath);
    return outputPath;
}

export async function readCodeXrBoatsRuntimeContent(extensionPath: string): Promise<string> {
    const runtimePath = assertCodeXrBoatsRuntimeSourceExists(extensionPath);
    return fs.promises.readFile(runtimePath, 'utf8');
}

export async function readCodeXrBoatsTextureContents(extensionPath: string): Promise<CodeXrBoatsTextAssetFile[]> {
    const { textureDirectory } = assertCodeXrBoatsAssetsExist(extensionPath);
    return readTextFilesRecursive(textureDirectory);
}
