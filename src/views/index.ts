/**
 * Modular Views Index
 * Central exports for all modular view components.
 */

// Main modular tree provider
export { ModularTreeDataProvider } from './ModularTreeDataProvider';

// Common interfaces and utilities
export * from './common/baseInterfaces';
export * from './common/supportedLanguages';

// Section providers
export * from './servers';
export * from './active_servers';
export * from './babia_examples';
export * from './visualize_data';
export * from './python_env';
export * from './visualization_settings';
export * from './collaboration';
export * from './learn_more';

// New code analysis views (experimental)
export * from '../code_analysis/views';

