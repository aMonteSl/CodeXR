export type CodeXRLogLevel = 'debug' | 'info' | 'warn' | 'error';
export type CodeXRExtensionMode = 'development' | 'production';

/**
 * Debug/info logs are only emitted in development mode or when verbose logging is enabled.
 */
export function isVerboseLoggingEnabled(
    extensionMode: CodeXRExtensionMode,
    verboseSettingEnabled: boolean,
): boolean {
    return extensionMode === 'development' || verboseSettingEnabled;
}

/**
 * Warn/error logs are always emitted. Debug/info logs depend on verbose mode.
 */
export function shouldEmitLog(level: CodeXRLogLevel, verboseLoggingEnabled: boolean): boolean {
    if (level === 'warn' || level === 'error') {
        return true;
    }

    return verboseLoggingEnabled;
}
