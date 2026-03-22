/**
 * New Code Analysis View Subsections Module
 * Central exports for all view subsections
 */

export { AnalysisSettingsSubsectionProvider, AnalysisFileSetting, AnalysisFileMode } from './analysis_settings';
// SIMPLIFIED: Removed ActiveAnalysesSubsectionProvider (replaced by direct service usage)
export { ProjectByLanguageSubsectionProvider } from './project_by_language';
export { FilesByLanguageSubsectionProvider } from './files_by_language';
