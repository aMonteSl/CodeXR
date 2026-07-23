import * as path from 'path';
import * as fs from 'fs';
import { assembleRuntimeContent, writeAssembledRuntimeToOutput } from './runtimeAssembly';

export const GUIDE_SCREEN_RUNTIME_OUTPUT_NAME = 'guideScreenRuntime.js';
export const GUIDE_PAGE_OUTPUT_NAME = 'guide.html';

// The guide runtime is a multi-part runtime (see runtimeAssembly.ts): one content
// model rendered both natively on the in-room guide screen and as guide.html.
export async function copyGuideScreenRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    return writeAssembledRuntimeToOutput(
        extensionPath, 'guide-screen', GUIDE_SCREEN_RUNTIME_OUTPUT_NAME, outputDirectory,
    );
}

export async function readGuideScreenRuntimeContent(extensionPath: string): Promise<string> {
    return assembleRuntimeContent(extensionPath, 'guide-screen', GUIDE_SCREEN_RUNTIME_OUTPUT_NAME);
}

// guide.html is a static shell served next to the scene by the session's static
// server (no extra routes needed): it loads guideScreenRuntime.js and mounts the
// DOM projection of the same guide model shown on the in-room screen.
export async function readGuidePageContent(extensionPath: string): Promise<string> {
    const pagePath = path.join(extensionPath, 'templates', 'guide', GUIDE_PAGE_OUTPUT_NAME);
    return fs.promises.readFile(pagePath, 'utf8');
}

export async function copyGuidePageToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    const content = await readGuidePageContent(extensionPath);
    const outputPath = path.join(outputDirectory, GUIDE_PAGE_OUTPUT_NAME);
    await fs.promises.writeFile(outputPath, content, 'utf8');
    return outputPath;
}
