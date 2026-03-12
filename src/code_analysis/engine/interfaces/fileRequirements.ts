/**
 * Interfaces para requerimientos de archivos y contenido extraído
 */

/**
 * Interfaz para requerimientos de archivo individual
 */
export interface FileRequirement {
    filePath: string;
    fileName: string;
    fileType: 'source' | 'config' | 'documentation' | 'data' | 'dependency' | 'template';
    priority: 'critical' | 'high' | 'medium' | 'low';
    extractionStrategy: 'full' | 'selective' | 'metadata_only';
    reason: string; // Por qué este archivo es necesario
}

/**
 * Interfaz para requerimientos procesados
 */
export interface ProcessedRequirements {
    sessionId: string;
    analysisMode: string;
    targetPath: string;
    requiredFiles: FileRequirement[];
    estimatedComplexity: 'low' | 'medium' | 'high' | 'very_high';
    processingTime: Date;
}

/**
 * Interfaz para contenido extraído
 */
export interface ExtractedContent {
    files: ExtractedFile[];
    metadata: {
        totalFiles: number;
        extractionTime: Date;
        totalSize: number; // en bytes
    };
}

/**
 * Interfaz para archivo extraído
 */
export interface ExtractedFile {
    filePath: string;
    fileName: string;
    fileType: 'source' | 'config' | 'documentation' | 'data' | 'dependency' | 'template';
    content: string;
    size: number; // en bytes
    extractionStrategy: 'full' | 'selective' | 'metadata_only';
    priority: 'critical' | 'high' | 'medium' | 'low';
}
