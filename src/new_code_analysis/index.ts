/**
 * New Code Analysis Module
 * Main entry point for the new code analysis functionality
 */

export { NewCodeAnalysisCommands } from './commands';
export { 
    NewCodeAnalysisSectionProvider, 
    NewCodeAnalysisTreeItem, 
    NewCodeAnalysisItemFactory,
    NewCodeAnalysisInteractionHandler 
} from './views';
// TODO: Update to use new engine exports
// export { LaunchAnalyzeFileLivePanel } from './engine';

// Initialize services
export { ServerWatcherIntegration } from './services/serverWatcherIntegration';
