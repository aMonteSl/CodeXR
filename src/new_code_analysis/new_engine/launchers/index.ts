/**
 * New Code Analysis Engine - Launchers Module
 * 
 * Este módulo contiene los launchers para diferentes tipos de análisis.
 * Todos delegan al pipeline compartido en launchPipeline.ts.
 */

export { LauncherLivePanel } from './launcherLivePanel';
export { LauncherVisualizeDOM } from './launcherVisualizeDOM';
export { LauncherXRAnalysis } from './launcherXRAnalysis';
export { executeLaunchPipeline } from './launchPipeline';
export type { LaunchPipelineConfig, ProgressSteps } from './launchPipeline';
