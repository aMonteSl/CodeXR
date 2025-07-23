/**
 * Replace In JSON Utility
 * Efficiently replaces specific file analysis results in existing directory analysis JSON
 */

import * as fs from 'fs';
import * as path from 'path';
import { FileChangeResult } from './checkFilesChanged';

export interface ReplaceResult {
    success: boolean;
    updatedFiles: string[];
    errors: string[];
    summaryUpdated: boolean;
}

export class ReplaceInJson {
    /**
     * Replace analysis results for specific files in the directory analysis JSON
     * IMPORTANT: For incremental updates (re-analysis):
     * - totalFiles = total files in directory (all files in JSON)
     * - totalFilesAnalyzed = files that were RE-ANALYZED in this session (changedFiles.length)
     * - totalFilesNotAnalyzed = totalFiles - totalFilesAnalyzed (files not touched in this session)
     * 
     * @param analysisJsonPath Path to the directory analysis JSON file
     * @param changedFiles List of files that were re-analyzed
     * @param newAnalysisResults New analysis results for the changed files (resume format)
     * @returns Result of the replacement operation
     */
    static async replaceFileAnalysisInJson(
        analysisJsonPath: string,
        changedFiles: FileChangeResult[],
        newAnalysisResults: Map<string, any>
    ): Promise<ReplaceResult> {
        console.log(`REPLACE_JSON_D_LIVE_PANEL: ===== STARTING JSON REPLACEMENT =====`);
        console.log(`REPLACE_JSON_D_LIVE_PANEL: Analysis JSON path: ${analysisJsonPath}`);
        console.log(`REPLACE_JSON_D_LIVE_PANEL: Files to update: ${changedFiles.length}`);
        
        // Log each file that will be updated
        changedFiles.forEach((cf, index) => {
            console.log(`REPLACE_JSON_D_LIVE_PANEL: [${index + 1}/${changedFiles.length}] Will update: ${cf.relativePath}`);
        });

        const result: ReplaceResult = {
            success: false,
            updatedFiles: [],
            errors: [],
            summaryUpdated: false
        };

        try {
            // Read existing JSON
            if (!fs.existsSync(analysisJsonPath)) {
                throw new Error(`Analysis JSON file not found: ${analysisJsonPath}`);
            }

            const jsonContent = fs.readFileSync(analysisJsonPath, 'utf-8');
            const analysisData = JSON.parse(jsonContent);

            console.log(`REPLACE_JSON_D_LIVE_PANEL: Loaded existing analysis data`);
            console.log(`REPLACE_JSON_D_LIVE_PANEL: Existing files array length: ${analysisData.files ? analysisData.files.length : 0}`);

            // Ensure files array exists
            if (!analysisData.files || !Array.isArray(analysisData.files)) {
                analysisData.files = [];
            }

            // Process each changed file
            for (const changedFile of changedFiles) {
                console.log(`REPLACE_JSON_D_LIVE_PANEL: Processing ${changedFile.changeType} for: ${changedFile.relativePath}`);

                if (changedFile.changeType === 'deleted') {
                    // Handle file deletion - remove from JSON
                    let found = false;
                    for (let i = analysisData.files.length - 1; i >= 0; i--) {
                        const existingFile = analysisData.files[i];
                        const existingRelativePath = existingFile.relativePath || existingFile.fileName;
                        
                        if (existingRelativePath === changedFile.relativePath) {
                            console.log(`REPLACE_JSON_D_LIVE_PANEL: REMOVING deleted file entry at index ${i}: ${existingFile.fileName}`);
                            analysisData.files.splice(i, 1);
                            found = true;
                            break;
                        }
                    }
                    
                    if (found) {
                        result.updatedFiles.push(changedFile.relativePath);
                        console.log(`REPLACE_JSON_D_LIVE_PANEL: Successfully removed deleted file: ${changedFile.relativePath}`);
                    } else {
                        console.warn(`REPLACE_JSON_D_LIVE_PANEL: Deleted file not found in JSON: ${changedFile.relativePath}`);
                    }
                    continue;
                }

                if (changedFile.changeType === 'added') {
                    // Handle new file - need to analyze it first
                    const newAnalysis = newAnalysisResults.get(changedFile.relativePath);
                    if (!newAnalysis) {
                        console.warn(`REPLACE_JSON_D_LIVE_PANEL: No analysis data for new file: ${changedFile.relativePath}`);
                        result.errors.push(`No analysis data for new file: ${changedFile.relativePath}`);
                        continue;
                    }

                    console.log(`REPLACE_JSON_D_LIVE_PANEL: ADDING new file entry: ${newAnalysis.fileName}`);
                    console.log(`REPLACE_JSON_D_LIVE_PANEL: New file data:`, {
                        fileName: newAnalysis.fileName,
                        totalLines: newAnalysis.totalLines,
                        functionCount: newAnalysis.functionCount,
                        cyclomaticComplexityNumber: newAnalysis.cyclomaticComplexityNumber
                    });

                    // Add new file entry
                    const newFileEntry = {
                        ...newAnalysis,
                        relativePath: changedFile.relativePath
                    };
                    analysisData.files.push(newFileEntry);
                    result.updatedFiles.push(changedFile.relativePath);
                    continue;
                }

                if (changedFile.changeType === 'modified') {
                    // Handle modified file - replace existing entry
                    const newAnalysis = newAnalysisResults.get(changedFile.relativePath);
                    if (!newAnalysis) {
                        console.warn(`REPLACE_JSON_D_LIVE_PANEL: No new analysis found for: ${changedFile.relativePath}`);
                        result.errors.push(`No new analysis data for: ${changedFile.relativePath}`);
                        continue;
                    }

                    console.log(`REPLACE_JSON_D_LIVE_PANEL: Processing MODIFICATION for: ${changedFile.relativePath}`);
                    console.log(`REPLACE_JSON_D_LIVE_PANEL: New analysis data:`, {
                        fileName: newAnalysis.fileName,
                        totalLines: newAnalysis.totalLines,
                        functionCount: newAnalysis.functionCount,
                        cyclomaticComplexityNumber: newAnalysis.cyclomaticComplexityNumber
                    });

                    try {
                        // Find and replace the existing file entry
                        let foundAndReplaced = false;
                        
                        for (let i = 0; i < analysisData.files.length; i++) {
                            const existingFile = analysisData.files[i];
                            
                            // Match by relativePath or fileName
                            const existingRelativePath = existingFile.relativePath || existingFile.fileName;
                            
                            if (existingRelativePath === changedFile.relativePath || 
                                existingFile.fileName === newAnalysis.fileName) {
                                
                                console.log(`REPLACE_JSON_D_LIVE_PANEL: Found existing file entry at index ${i}: ${existingFile.fileName}`);
                                console.log(`REPLACE_JSON_D_LIVE_PANEL: OLD data:`, {
                                    totalLines: existingFile.totalLines,
                                    functionCount: existingFile.functionCount,
                                    cyclomaticComplexityNumber: existingFile.cyclomaticComplexityNumber
                                });
                                
                                // Replace the entire file entry with new data
                                analysisData.files[i] = {
                                    ...newAnalysis,
                                    // Ensure relativePath is correct
                                    relativePath: changedFile.relativePath
                                };
                                
                                console.log(`REPLACE_JSON_D_LIVE_PANEL: REPLACED file entry at index ${i} with NEW data:`, {
                                    totalLines: analysisData.files[i].totalLines,
                                    functionCount: analysisData.files[i].functionCount,
                                    cyclomaticComplexityNumber: analysisData.files[i].cyclomaticComplexityNumber
                                });
                                
                                foundAndReplaced = true;
                                break;
                            }
                        }

                        if (!foundAndReplaced) {
                            // File not found, add as new entry (should not happen for 'modified', but just in case)
                            const newFileEntry = {
                                ...newAnalysis,
                                relativePath: changedFile.relativePath
                            };
                            analysisData.files.push(newFileEntry);
                            console.log(`REPLACE_JSON_D_LIVE_PANEL: Added NEW file entry for modified file: ${newAnalysis.fileName}`);
                        }

                        result.updatedFiles.push(changedFile.relativePath);

                    } catch (error) {
                        console.error(`REPLACE_JSON_D_LIVE_PANEL: Error processing modified file ${changedFile.relativePath}:`, error);
                        result.errors.push(`Error processing modified file ${changedFile.relativePath}: ${error}`);
                    }
                }
            }

            // Update total counts in summary when there are changes (including deletions)
            if (result.updatedFiles.length > 0) {
                console.log(`REPLACE_JSON_D_LIVE_PANEL: Files updated successfully, recalculating summary`);
                
                // Recalculate totals from all files
                let totalLines = 0;
                let totalComments = 0;
                let totalBlankLines = 0;
                let totalFunctions = 0;
                let totalClasses = 0;
                let totalComplexity = 0;
                const languageCounts: { [key: string]: number } = {};
                const complexities: number[] = [];

                analysisData.files.forEach((file: any) => {
                    totalLines += file.totalLines || 0;
                    totalComments += file.commentLines || 0;
                    totalBlankLines += file.blankLines || 0;
                    totalFunctions += file.functionCount || 0;
                    totalClasses += file.classCount || 0;
                    totalComplexity += file.cyclomaticComplexityNumber || 0;
                    
                    // Collect complexities for average calculation
                    if (file.cyclomaticComplexityNumber && file.cyclomaticComplexityNumber > 0) {
                        complexities.push(file.cyclomaticComplexityNumber);
                    }
                    
                    // Count languages
                    if (file.language) {
                        languageCounts[file.language] = (languageCounts[file.language] || 0) + 1;
                    }
                });

                // Calculate average complexity
                const averageComplexity = complexities.length > 0 
                    ? complexities.reduce((a, b) => a + b, 0) / complexities.length 
                    : 0;

                // Update both top-level and summary object
                analysisData.totalLines = totalLines;
                analysisData.totalFunctions = totalFunctions;
                analysisData.totalCyclomaticComplexity = totalComplexity;
                analysisData.totalFiles = analysisData.files.length;

                // Ensure summary object exists and update it
                if (!analysisData.summary) {
                    analysisData.summary = {};
                }

                // For incremental updates (re-analysis), we need to distinguish between:
                // - Total files in directory (always equals files.length after update)
                // - Files that were re-analyzed in this session (result.updatedFiles.length)
                // - Files not re-analyzed = total - re-analyzed
                
                const totalFilesInDirectory = analysisData.files.length;
                const filesReAnalyzedThisSession = result.updatedFiles.length;
                const filesNotReAnalyzed = totalFilesInDirectory - filesReAnalyzedThisSession;

                analysisData.summary.totalFiles = totalFilesInDirectory;
                analysisData.summary.totalFilesAnalyzed = filesReAnalyzedThisSession;  // Only files re-analyzed in this session
                analysisData.summary.totalFilesNotAnalyzed = filesNotReAnalyzed;  // Files that weren't touched in this session
                analysisData.summary.totalLines = totalLines;
                analysisData.summary.totalComments = totalComments;
                analysisData.summary.totalBlankLines = totalBlankLines;
                analysisData.summary.totalFunctions = totalFunctions;
                analysisData.summary.totalClasses = totalClasses;
                analysisData.summary.averageComplexity = averageComplexity;
                analysisData.summary.analyzedAt = new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
                analysisData.summary.languages = languageCounts;

                console.log(`REPLACE_JSON_D_LIVE_PANEL: Updated summary (INCREMENTAL):`, {
                    totalFiles: analysisData.summary.totalFiles,
                    totalFilesAnalyzed: analysisData.summary.totalFilesAnalyzed,  // Files re-analyzed in this session
                    totalFilesNotAnalyzed: analysisData.summary.totalFilesNotAnalyzed,  // Files not touched in this session
                    totalLines: analysisData.summary.totalLines,
                    totalComments: analysisData.summary.totalComments,
                    totalBlankLines: analysisData.summary.totalBlankLines,
                    totalFunctions: analysisData.summary.totalFunctions,
                    totalClasses: analysisData.summary.totalClasses,
                    averageComplexity: analysisData.summary.averageComplexity,
                    languages: analysisData.summary.languages
                });

                result.summaryUpdated = true;
            }

            // Write updated JSON back to file
            const updatedJsonContent = JSON.stringify(analysisData, null, 2);
            fs.writeFileSync(analysisJsonPath, updatedJsonContent, 'utf-8');

            console.log(`REPLACE_JSON_D_LIVE_PANEL: ===== JSON REPLACEMENT COMPLETED =====`);
            console.log(`REPLACE_JSON_D_LIVE_PANEL: Successfully updated analysis JSON`);
            console.log(`REPLACE_JSON_D_LIVE_PANEL: Updated files count: ${result.updatedFiles.length}`);
            console.log(`REPLACE_JSON_D_LIVE_PANEL: Errors count: ${result.errors.length}`);
            console.log(`REPLACE_JSON_D_LIVE_PANEL: Summary updated: ${result.summaryUpdated}`);

            // Log each updated file
            result.updatedFiles.forEach((filePath, index) => {
                console.log(`REPLACE_JSON_D_LIVE_PANEL: [${index + 1}] Updated: ${filePath}`);
            });

            // Log any errors
            result.errors.forEach((error, index) => {
                console.log(`REPLACE_JSON_D_LIVE_PANEL: [ERROR ${index + 1}] ${error}`);
            });

            result.success = result.updatedFiles.length > 0 || result.summaryUpdated;

        } catch (error) {
            console.error(`REPLACE_JSON_D_LIVE_PANEL: CRITICAL ERROR - Failed to replace analysis in JSON:`, error);
            result.errors.push(`Failed to replace analysis: ${error}`);
        }

        return result;
    }
}
