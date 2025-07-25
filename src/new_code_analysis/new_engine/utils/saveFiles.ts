import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Utility para guardar archivos en el workspace storage
 * 
 * Esta clase:
 * - Recibe archivos procesados y los guarda en workspace storage
 * - Crea la estructura de carpetas necesaria
 * - Retorna la ruta completa donde se guardaron los archivos
 */
export class SaveFiles {

    constructor() {
        console.log('SAVE_FILES: Initializing SaveFiles utility...');
    }

    /**
     * Guarda archivos en el workspace storage
     * 
     * @param files - Map con fileName -> fileContent
     * @param folderName - Nombre de la carpeta base (fileAnalysis/directoryAnalysis)
     * @param analysisType - Tipo de análisis para crear subcarpeta única
     * @param context - Contexto de VS Code para acceder al storage
     * @returns Promise con la ruta completa donde se guardaron los archivos
     */
    public async saveFilesToStorage(
        files: Map<string, string>,
        folderName: string,
        analysisType: string,
        context: vscode.ExtensionContext
    ): Promise<string> {
        
        console.log(`SAVE_FILES: 💾 Saving ${files.size} files to workspace storage...`);
        console.log(`SAVE_FILES: Folder name: ${folderName}`);
        console.log(`SAVE_FILES: Analysis type: ${analysisType}`);
        
        try {
            // Obtener el workspace storage URI
            const storageUri = context.storageUri;
            if (!storageUri) {
                throw new Error('Workspace storage URI is not available');
            }
            
            // Crear la ruta completa: storage/folderName/analysisType/
            const storagePath = path.join(storageUri.fsPath, folderName, analysisType);
            console.log(`SAVE_FILES: 📂 Storage path: ${storagePath}`);
            
            // Crear directorios si no existen
            await this.ensureDirectoryExists(storagePath);
            
            // Guardar cada archivo
            const savedFiles: string[] = [];
            for (const [fileName, content] of files) {
                const filePath = path.join(storagePath, fileName);
                
                console.log(`SAVE_FILES: 📝 Saving ${fileName}...`);
                await fs.promises.writeFile(filePath, content, 'utf8');
                savedFiles.push(fileName);
                console.log(`SAVE_FILES: ✅ Saved ${fileName} (${content.length} chars)`);
            }
            
            console.log(`SAVE_FILES: 🎉 Successfully saved ${savedFiles.length} files to: ${storagePath}`);
            console.log(`SAVE_FILES: 📋 Files saved: ${savedFiles.join(', ')}`);
            
            return storagePath;
            
        } catch (error) {
            console.error(`SAVE_FILES: ❌ Error saving files to storage:`, error);
            throw error;
        }
    }

    /**
     * Asegura que el directorio existe, creándolo si es necesario
     */
    private async ensureDirectoryExists(dirPath: string): Promise<void> {
        try {
            console.log(`SAVE_FILES: 🔍 Checking directory: ${dirPath}`);
            
            // Verificar si el directorio ya existe
            const exists = fs.existsSync(dirPath);
            if (exists) {
                console.log(`SAVE_FILES: ✅ Directory already exists: ${dirPath}`);
                return;
            }
            
            // Crear el directorio recursivamente
            console.log(`SAVE_FILES: 🏗️ Creating directory: ${dirPath}`);
            await fs.promises.mkdir(dirPath, { recursive: true });
            console.log(`SAVE_FILES: ✅ Directory created successfully: ${dirPath}`);
            
        } catch (error) {
            console.error(`SAVE_FILES: ❌ Error creating directory ${dirPath}:`, error);
            throw error;
        }
    }

    /**
     * Verifica que los archivos se guardaron correctamente
     */
    public async verifyFiles(storagePath: string, expectedFiles: string[]): Promise<boolean> {
        try {
            console.log(`SAVE_FILES: 🔍 Verifying files in: ${storagePath}`);
            
            for (const fileName of expectedFiles) {
                const filePath = path.join(storagePath, fileName);
                const exists = fs.existsSync(filePath);
                
                if (!exists) {
                    console.error(`SAVE_FILES: ❌ File not found: ${fileName}`);
                    return false;
                }
                
                const stats = fs.statSync(filePath);
                console.log(`SAVE_FILES: ✅ Verified ${fileName} (${stats.size} bytes)`);
            }
            
            console.log(`SAVE_FILES: 🎉 All files verified successfully`);
            return true;
            
        } catch (error) {
            console.error(`SAVE_FILES: ❌ Error verifying files:`, error);
            return false;
        }
    }
}
