import * as path from 'path';

export function isXRDataFormat(data: unknown): data is any[] {
    return Array.isArray(data);
}

export function removeDeletedFileFromXRFormat(data: any[], deletedPath: string): boolean {
    const index = data.findIndex((file) => file.file_path === deletedPath || file.filePath === deletedPath);
    if (index === -1) {
        return false;
    }

    data.splice(index, 1);
    return true;
}

export function removeDeletedFileFromLivePanelFormat(data: any, deletedPath: string): boolean {
    if (!data.files || !Array.isArray(data.files)) {
        return false;
    }

    const index = data.files.findIndex((file: any) => file.file_path === deletedPath || file.filePath === deletedPath);
    if (index === -1) {
        return false;
    }

    data.files.splice(index, 1);
    return true;
}

export function recalculateLivePanelSummary(data: any): void {
    if (!data.files || !Array.isArray(data.files)) {
        return;
    }

    const summary: Record<string, any> = {
        totalFiles: data.files.length,
        totalFilesAnalyzed: 0,
        totalFilesNotAnalyzed: 0,
        totalLines: 0,
        totalLinesOfCode: 0,
        totalComments: 0,
        totalBlankLines: 0,
        totalFunctions: 0,
        totalClasses: 0,
        averageComplexity: 0,
        languages: {} as Record<string, number>,
    };

    let totalComplexity = 0;
    let filesWithComplexity = 0;

    for (const file of data.files) {
        if (file.status === 'success') {
            summary.totalFilesAnalyzed++;
            summary.totalLines += file.totalLines || 0;
            summary.totalLinesOfCode += file.codeLines || 0;
            summary.totalComments += file.commentLines || 0;
            summary.totalBlankLines += file.blankLines || 0;
            summary.totalFunctions += file.functionCount || 0;
            summary.totalClasses += file.classCount || 0;

            const complexity = file.cyclomaticComplexityNumber || file.maxComplexity || 0;
            if (complexity > 0) {
                totalComplexity += complexity;
                filesWithComplexity++;
            }

            const language = file.language || 'Unknown';
            summary.languages[language] = (summary.languages[language] || 0) + 1;
        } else {
            summary.totalFilesNotAnalyzed++;
        }
    }

    summary.averageComplexity = filesWithComplexity > 0
        ? Math.round((totalComplexity / filesWithComplexity) * 100) / 100
        : 0;

    data.summary = { ...data.summary, ...summary };
}

export function createEmptyFileEntry(filePath: string): any {
    const fileName = path.basename(filePath);
    const extension = path.extname(filePath).toLowerCase();

    return {
        fileName,
        filePath,
        relativePath: fileName,
        language: getLanguageFromExtension(extension),
        timestamp: new Date().toISOString(),
        status: 'empty',
        totalLines: 0,
        codeLines: 0,
        commentLines: 0,
        blankLines: 0,
        commentRatio: 0,
        codeRatio: 0,
        blankRatio: 0,
        classCount: 0,
        functionCount: 0,
        complexity: {
            averageComplexity: 0,
            maxComplexity: 0,
            functionCount: 0,
            highComplexityFunctions: 0,
            criticalComplexityFunctions: 0,
        },
        functions: [],
        classes: [],
        maxComplexity: 0,
        cyclomaticComplexityNumber: 0,
        cyclomaticComplexityDensity: 0,
        highComplexityFunctions: 0,
        criticalComplexityFunctions: 0,
        averageFunctionParameters: 0,
        maxFunctionParameters: 0,
        averageFunctionLines: 0,
        maxFunctionLines: 0,
        averageFunctionNestingDepth: 0,
        maxFunctionNestingDepth: 0,
        fileSizeBytes: 0,
        file_path: filePath,
    };
}

function getLanguageFromExtension(extension: string): string {
    const languageMap: Record<string, string> = {
        '.js': 'JavaScript',
        '.ts': 'TypeScript',
        '.tsx': 'TypeScript',
        '.jsx': 'JavaScript',
        '.py': 'Python',
        '.java': 'Java',
        '.cpp': 'C++',
        '.c': 'C',
        '.cs': 'C#',
        '.go': 'Go',
        '.rs': 'Rust',
        '.rb': 'Ruby',
        '.php': 'PHP',
        '.swift': 'Swift',
        '.kt': 'Kotlin',
        '.scala': 'Scala',
        '.vue': 'Vue',
        '.html': 'HTML',
        '.css': 'CSS',
        '.scss': 'SCSS',
        '.less': 'LESS',
    };

    return languageMap[extension] || 'Unknown';
}



