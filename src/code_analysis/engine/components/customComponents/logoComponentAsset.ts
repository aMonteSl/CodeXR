import { assembleRuntimeContent, writeAssembledRuntimeToOutput } from './runtimeAssembly';

export const LOGO_RUNTIME_OUTPUT_NAME = 'codexrLogoRuntime.js';

// The brand logo runtime is a multi-part runtime (see runtimeAssembly.ts): the
// mark's contours, generated offline from resources/icon.svg, plus the A-Frame
// component that extrudes them over the analysis table while it sits empty.
export async function copyLogoRuntimeToOutput(
    extensionPath: string,
    outputDirectory: string,
): Promise<string> {
    return writeAssembledRuntimeToOutput(
        extensionPath, 'logo', LOGO_RUNTIME_OUTPUT_NAME, outputDirectory,
    );
}

export async function readLogoRuntimeContent(extensionPath: string): Promise<string> {
    return assembleRuntimeContent(extensionPath, 'logo', LOGO_RUNTIME_OUTPUT_NAME);
}
