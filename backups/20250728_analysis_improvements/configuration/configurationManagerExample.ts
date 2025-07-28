/**
 * Configuration Manager Usage Example
 * Demonstrates how to use the ConfigurationManager with getters for each JSON attribute
 */

import { ConfigurationManager } from './configurationManager';
import { AnalysisConfiguration } from './models/analysisConfiguration';

/**
 * Example usage of ConfigurationManager
 */
export function demonstrateConfigurationManager() {
    // Create a new configuration manager instance
    const configManager = new ConfigurationManager();

    console.log('=== Configuration Manager Demo ===');

    // Demonstrate getters for each JSON attribute
    console.log('Current configuration attributes:');
    console.log(`- Analysis File Mode: ${configManager.analysisFileMode}`);
    console.log(`- View Theme: ${configManager.viewTheme}`);
    console.log(`- Auto-Analysis Delay Type: ${configManager.autoAnalysisDelayType}`);
    console.log(`- Custom Delay (ms): ${configManager.customDelayMs}`);
    console.log(`- Delay in MS: ${configManager.getDelayInMs()}`);

    // Demonstrate utility methods
    console.log('\nUtility checks:');
    console.log(`- Is XR Mode: ${configManager.isXRMode()}`);
    console.log(`- Is LivePanel Mode: ${configManager.isLivePanelMode()}`);
    console.log(`- Is Dark Theme: ${configManager.isDarkTheme()}`);
    console.log(`- Is Light Theme: ${configManager.isLightTheme()}`);
    console.log(`- Is Real Time Analysis: ${configManager.isRealTimeAnalysis()}`);

    // Demonstrate setters
    console.log('\n=== Testing Configuration Changes ===');
    
    // Change to LivePanel mode
    configManager.analysisFileMode = 'LivePanel';
    console.log(`After changing to LivePanel: ${configManager.analysisFileMode}`);
    console.log(`Is XR Mode: ${configManager.isXRMode()}`);
    console.log(`Is LivePanel Mode: ${configManager.isLivePanelMode()}`);

    // Change theme to Light
    configManager.viewTheme = 'Light';
    console.log(`After changing to Light theme: ${configManager.viewTheme}`);
    console.log(`Is Dark Theme: ${configManager.isDarkTheme()}`);
    console.log(`Is Light Theme: ${configManager.isLightTheme()}`);

    // Change auto-analysis delay to custom
    configManager.autoAnalysisDelay = {
        type: 'Custom',
        customMs: 2500
    };
    console.log(`After setting custom delay: ${configManager.autoAnalysisDelayType}`);
    console.log(`Custom delay value: ${configManager.customDelayMs}ms`);
    console.log(`Delay in MS: ${configManager.getDelayInMs()}ms`);
    console.log(`Is Real Time: ${configManager.isRealTimeAnalysis()}`);

    // Demonstrate JSON conversion
    console.log('\n=== JSON Conversion ===');
    const jsonString = configManager.toJSON();
    console.log('Configuration as JSON:', jsonString);

    // Reset to defaults
    configManager.resetToDefaults();
    console.log('\n=== After Reset to Defaults ===');
    console.log(`Analysis File Mode: ${configManager.analysisFileMode}`);
    console.log(`View Theme: ${configManager.viewTheme}`);
    console.log(`Auto-Analysis Delay: ${configManager.autoAnalysisDelayType}`);

    // Demonstrate loading from JSON
    console.log('\n=== Loading from JSON ===');
    const customConfigJson = `{
        "analysisFileMode": "LivePanel",
        "viewTheme": "Light",
        "autoAnalysisDelay": {
            "type": "5s"
        }
    }`;
    
    configManager.fromJSON(customConfigJson);
    console.log('After loading custom JSON:');
    console.log(`Analysis File Mode: ${configManager.analysisFileMode}`);
    console.log(`View Theme: ${configManager.viewTheme}`);
    console.log(`Auto-Analysis Delay: ${configManager.autoAnalysisDelayType}`);
    console.log(`Delay in MS: ${configManager.getDelayInMs()}ms`);

    // Get complete configuration
    console.log('\n=== Complete Configuration Object ===');
    const completeConfig = configManager.getConfiguration();
    console.log('Complete config:', JSON.stringify(completeConfig, null, 2));

    return configManager;
}

/**
 * Example of integrating ConfigurationManager with VS Code context
 */
export async function integrateWithVSCode(context: any) {
    // Create configuration manager
    const configManager = new ConfigurationManager();

    // Example: Load configuration from workspace storage
    // const savedConfig = context.workspaceState.get('analysisConfiguration');
    // if (savedConfig) {
    //     configManager.fromJSON(JSON.stringify(savedConfig));
    // }

    // Example: Save configuration to workspace storage
    // const configToSave = configManager.getConfiguration();
    // await context.workspaceState.update('analysisConfiguration', configToSave);

    // Example: Use configuration in different parts of the application
    if (configManager.isXRMode()) {
        console.log('Using XR Analysis Mode');
        // Launch XR analysis
    } else {
        console.log('Using LivePanel Analysis Mode');
        // Launch LivePanel analysis
    }

    if (configManager.isDarkTheme()) {
        console.log('Applying Dark Theme');
        // Apply dark theme CSS/styling
    } else {
        console.log('Applying Light Theme');
        // Apply light theme CSS/styling
    }

    const delay = configManager.getDelayInMs();
    if (delay > 0) {
        console.log(`Setting up auto-analysis with ${delay}ms delay`);
        // Set up delayed analysis
    } else {
        console.log('Setting up real-time analysis');
        // Set up immediate analysis
    }

    return configManager;
}
