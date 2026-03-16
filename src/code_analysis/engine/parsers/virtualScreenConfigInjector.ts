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
    const scriptTagPattern = /(<script\s+id="codexr-tooling-config-virtual-screen"\s+type="application\/json">)([\s\S]*?)(<\/script>)/;
    return htmlContent.replace(scriptTagPattern, (_match, prefix: string, jsonBody: string, suffix: string) => {
        let parsedConfig: Record<string, unknown> = {};
        try {
            parsedConfig = JSON.parse(jsonBody.trim());
        } catch {
            parsedConfig = {};
        }

        const mergedConfig = {
            ...parsedConfig,
            virtualScreenSessionId: config.virtualScreenSessionId,
            virtualScreenSignalPath: config.virtualScreenSignalPath,
            virtualScreenSupportsHostBroadcast: config.virtualScreenSupportsHostBroadcast,
            virtualScreenSupportsLocalCapture: config.virtualScreenSupportsLocalCapture,
        };

        return `${prefix}${JSON.stringify(mergedConfig)}${suffix}`;
    });
}
