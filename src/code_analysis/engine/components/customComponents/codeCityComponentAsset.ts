import * as fs from 'fs';
import * as path from 'path';

export const CODE_CITY_RUNTIME_OUTPUT_NAME = 'codeCityRuntime.js';

const SOURCE_SEGMENTS = [
    'src',
    'codexr-components',
    'graphs',
    'code-city',
    CODE_CITY_RUNTIME_OUTPUT_NAME,
] as const;

export function resolveCodeCityRuntimeSourcePath(extensionPath: string): string {
    return path.join(extensionPath, ...SOURCE_SEGMENTS);
}

export async function readCodeCityRuntimeContent(extensionPath: string): Promise<string> {
    const sourcePath = resolveCodeCityRuntimeSourcePath(extensionPath);
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`CodeXR Code City runtime not found at ${sourcePath}`);
    }
    return fs.promises.readFile(sourcePath, 'utf8');
}

export async function copyCodeCityRuntimeToOutput(
    extensionPath: string,
    outputPath: string,
): Promise<string> {
    const sourcePath = resolveCodeCityRuntimeSourcePath(extensionPath);
    const targetPath = path.join(outputPath, CODE_CITY_RUNTIME_OUTPUT_NAME);
    await fs.promises.copyFile(sourcePath, targetPath);
    return targetPath;
}
