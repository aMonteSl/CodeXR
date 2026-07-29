/**
 * Analysis-server capability resolution.
 *
 * Single source of truth for which optional, session-bound analysis services the
 * shared HTTP/HTTPS server should attach for a given analysis mode.
 *
 * Every analysis type — XR, LivePanel, VisualizeDOM, and any mode added later —
 * shares ONE launch path (`MultiServerLauncher` → `HttpServer`). The server core
 * (static file serving, SSE live-reload, collaboration) is identical for all of
 * them. The only per-mode difference is which feature services get wired in, and
 * that decision lives here and nowhere else.
 *
 * Some feature services are XR-only: their constructors resolve the session and
 * throw (`historical-comparison-session-unavailable`, etc.) if it is not an XR
 * session. Attaching them for a non-XR mode aborts the whole launch. Gating their
 * construction through this table is what lets the shared launch path succeed for
 * every mode.
 *
 * To add a new analysis mode, add one entry to `CAPABILITIES_BY_MODE` declaring
 * exactly which features its server exposes — the shared launch path then works
 * for it automatically, with no changes to the launcher or the server core.
 */
export interface AnalysisServerCapabilities {
    /** Dependency-graph summary/refresh endpoints (XR + LivePanel). */
    dependencyGraph: boolean;
    /** Historical-comparison endpoints + live refresh (XR + LivePanel). */
    historicalComparison: boolean;
    /** Project-evolution endpoints (XR only). */
    projectEvolution: boolean;
}

const NO_CAPABILITIES: AnalysisServerCapabilities = {
    dependencyGraph: false,
    historicalComparison: false,
    projectEvolution: false,
};

const CAPABILITIES_BY_MODE: Readonly<Record<string, AnalysisServerCapabilities>> = {
    XR: {
        dependencyGraph: true,
        historicalComparison: true,
        projectEvolution: true,
    },
    LivePanel: {
        dependencyGraph: true,
        historicalComparison: true,
        projectEvolution: false,
    },
    VisualizeDOM: {
        dependencyGraph: false,
        historicalComparison: false,
        projectEvolution: false,
    },
};

/**
 * Resolve the feature services the shared server should attach for a mode.
 *
 * Unknown or undefined modes get no optional services: the server still launches
 * (static files + SSE + collaboration) but exposes no analysis feature endpoints,
 * which is the safe default for a brand-new mode until its capabilities are
 * declared above.
 */
export function resolveAnalysisServerCapabilities(
    analysisMode: string | undefined,
): AnalysisServerCapabilities {
    // Return a fresh copy so a caller can never mutate the shared table entries.
    return { ...(CAPABILITIES_BY_MODE[analysisMode ?? ''] ?? NO_CAPABILITIES) };
}
