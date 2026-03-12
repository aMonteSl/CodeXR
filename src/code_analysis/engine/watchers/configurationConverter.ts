/**
 * Configuration Converter
 * Convierte la configuración de AutoAnalysisDelay a milisegundos
 */

import { AutoAnalysisDelayConfig, AutoAnalysisDelay } from '../../configuration/models/analysisConfiguration';

export class ConfigurationConverter {
    
    /**
     * Convierte AutoAnalysisDelayConfig a milisegundos
     */
    public static convertToMilliseconds(config: AutoAnalysisDelayConfig): number {
        console.log(`CONFIG_CONVERTER: Converting delay config`, config);
        
        switch (config.type) {
            case 'RealTime':
                return 0;
            case '1s':
                return 1000;
            case '3s':
                return 3000;
            case '5s':
                return 5000;
            case '10s':
                return 10000;
            case 'Custom':
                return config.customMs || 3000; // Default a 3s si no hay valor custom
            default:
                console.warn(`CONFIG_CONVERTER: Unknown delay type ${config.type}, defaulting to 3s`);
                return 3000;
        }
    }

    /**
     * Obtiene una descripción legible del delay
     */
    public static getDisplayName(config: AutoAnalysisDelayConfig): string {
        switch (config.type) {
            case 'RealTime':
                return 'Real-time';
            case '1s':
                return '1 second';
            case '3s':
                return '3 seconds';
            case '5s':
                return '5 seconds';
            case '10s':
                return '10 seconds';
            case 'Custom':
                return `${config.customMs || 3000}ms custom`;
            default:
                return 'Unknown';
        }
    }
}

export default ConfigurationConverter;
