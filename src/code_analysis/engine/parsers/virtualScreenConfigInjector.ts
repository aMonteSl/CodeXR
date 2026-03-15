export interface VirtualScreenViewerConfig {
    virtualScreenSessionId: string;
    virtualScreenSignalPath: string;
    virtualScreenSupportsHostBroadcast: boolean;
    virtualScreenSupportsLocalCapture: boolean;
}

export function injectVirtualScreenViewerConfig(
    htmlContent: string,
    config: VirtualScreenViewerConfig,
): string {
    return htmlContent.replace(
        /(window\.__CODEXR_VIRTUAL_SCREEN_CONFIG__ = \{)([\s\S]*?)(\n\s*\};)/,
        (_match, prefix: string, body: string, suffix: string) => {
            const injectedFields = `
        virtualScreenSessionId: ${JSON.stringify(config.virtualScreenSessionId)},
        virtualScreenSignalPath: ${JSON.stringify(config.virtualScreenSignalPath)},
        virtualScreenSupportsHostBroadcast: ${config.virtualScreenSupportsHostBroadcast ? 'true' : 'false'},
        virtualScreenSupportsLocalCapture: ${config.virtualScreenSupportsLocalCapture ? 'true' : 'false'},`;

            return `${prefix}${body}${injectedFields}${suffix}`;
        },
    );
}
