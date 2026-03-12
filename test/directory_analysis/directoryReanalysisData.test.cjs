const test = require('node:test');
const assert = require('node:assert/strict');
const {
    createEmptyFileEntry,
    isXRDataFormat,
    recalculateLivePanelSummary,
    removeDeletedFileFromLivePanelFormat,
    removeDeletedFileFromXRFormat,
} = require('../../out/code_analysis/engine/watchers/directoryReanalysisData.js');

test('isXRDataFormat distinguishes XR arrays from LivePanel objects', () => {
    assert.equal(isXRDataFormat([]), true);
    assert.equal(isXRDataFormat({ files: [] }), false);
});

test('createEmptyFileEntry creates a zeroed entry with inferred language', () => {
    const entry = createEmptyFileEntry('C:/workspace/example.ts');

    assert.equal(entry.fileName, 'example.ts');
    assert.equal(entry.filePath, 'C:/workspace/example.ts');
    assert.equal(entry.file_path, 'C:/workspace/example.ts');
    assert.equal(entry.language, 'TypeScript');
    assert.equal(entry.status, 'empty');
    assert.equal(entry.totalLines, 0);
    assert.equal(entry.functionCount, 0);
    assert.deepEqual(entry.functions, []);
    assert.deepEqual(entry.classes, []);
});

test('removeDeletedFileFromXRFormat removes matching files by filePath or file_path', () => {
    const data = [
        { filePath: 'src/keep.ts' },
        { file_path: 'src/remove.ts' },
    ];

    assert.equal(removeDeletedFileFromXRFormat(data, 'src/remove.ts'), true);
    assert.deepEqual(data, [{ filePath: 'src/keep.ts' }]);
    assert.equal(removeDeletedFileFromXRFormat(data, 'src/missing.ts'), false);
});

test('removeDeletedFileFromLivePanelFormat removes matching files from the files array', () => {
    const data = {
        files: [
            { filePath: 'src/keep.ts' },
            { file_path: 'src/remove.ts' },
        ],
    };

    assert.equal(removeDeletedFileFromLivePanelFormat(data, 'src/remove.ts'), true);
    assert.deepEqual(data.files, [{ filePath: 'src/keep.ts' }]);
    assert.equal(removeDeletedFileFromLivePanelFormat(data, 'src/missing.ts'), false);
});

test('recalculateLivePanelSummary updates totals, languages, and average complexity', () => {
    const data = {
        summary: { previous: true },
        files: [
            {
                status: 'success',
                totalLines: 30,
                codeLines: 20,
                commentLines: 5,
                blankLines: 5,
                functionCount: 3,
                classCount: 1,
                cyclomaticComplexityNumber: 6,
                language: 'TypeScript',
            },
            {
                status: 'success',
                totalLines: 10,
                codeLines: 8,
                commentLines: 1,
                blankLines: 1,
                functionCount: 1,
                classCount: 0,
                maxComplexity: 2,
                language: 'Python',
            },
            {
                status: 'empty',
                totalLines: 0,
                codeLines: 0,
                commentLines: 0,
                blankLines: 0,
                functionCount: 0,
                classCount: 0,
                language: 'TypeScript',
            },
        ],
    };

    recalculateLivePanelSummary(data);

    assert.equal(data.summary.totalFiles, 3);
    assert.equal(data.summary.totalFilesAnalyzed, 2);
    assert.equal(data.summary.totalFilesNotAnalyzed, 1);
    assert.equal(data.summary.totalLines, 40);
    assert.equal(data.summary.totalLinesOfCode, 28);
    assert.equal(data.summary.totalComments, 6);
    assert.equal(data.summary.totalBlankLines, 6);
    assert.equal(data.summary.totalFunctions, 4);
    assert.equal(data.summary.totalClasses, 1);
    assert.equal(data.summary.averageComplexity, 4);
    assert.deepEqual(data.summary.languages, {
        TypeScript: 1,
        Python: 1,
    });
    assert.equal(data.summary.previous, true);
});
