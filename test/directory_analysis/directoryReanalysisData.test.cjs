const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
    createEmptyFileEntry,
    hasMatchingLivePanelFile,
    hasMatchingXRFile,
    isXRDataFormat,
    recalculateLivePanelSummary,
    removeDeletedFileFromLivePanelFormat,
    removeDeletedFileFromXRFormat,
    resolveTrackedSystemPath,
    upsertLivePanelFiles,
    upsertXRFiles,
} = require('../../out/code_analysis/engine/watchers/directoryReanalysisData.js');

function createTempDir(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('isXRDataFormat distinguishes XR arrays from LivePanel objects', () => {
    assert.equal(isXRDataFormat([]), true);
    assert.equal(isXRDataFormat({ files: [] }), false);
});

test('createEmptyFileEntry creates a zeroed entry with normalized public paths', () => {
    const entry = createEmptyFileEntry('C:/workspace/example.ts');

    assert.equal(entry.fileName, 'example.ts');
    assert.equal(entry.filePath, '/workspace/example.ts');
    assert.equal(entry.file_path, '/workspace/example.ts');
    assert.equal(entry.language, 'TypeScript');
    assert.equal(entry.status, 'empty');
    assert.equal(entry.totalLines, 0);
    assert.equal(entry.functionCount, 0);
    assert.deepEqual(entry.functions, []);
    assert.deepEqual(entry.classes, []);
});

test('removeDeletedFileFromXRFormat removes all matching files using system paths against normalized output paths', () => {
    const data = [
        { filePath: '/Users/adria/project/src/keep.ts' },
        { filePath: '/Users/adria/project/src/remove.ts' },
        { file_path: '/Users/adria/project/src/remove.ts' },
    ];

    assert.equal(removeDeletedFileFromXRFormat(data, 'C:\\Users\\adria\\project\\src\\remove.ts'), true);
    assert.deepEqual(data, [{ filePath: '/Users/adria/project/src/keep.ts' }]);
    assert.equal(removeDeletedFileFromXRFormat(data, 'C:\\Users\\adria\\project\\src\\missing.ts'), false);
});

test('removeDeletedFileFromLivePanelFormat removes matching files from the files array', () => {
    const data = {
        files: [
            { filePath: '/Users/adria/project/src/keep.ts' },
            { file_path: '/Users/adria/project/src/remove.ts' },
            { filePath: '/Users/adria/project/src/remove.ts' },
        ],
    };

    assert.equal(removeDeletedFileFromLivePanelFormat(data, 'C:\\Users\\adria\\project\\src\\remove.ts'), true);
    assert.deepEqual(data.files, [{ filePath: '/Users/adria/project/src/keep.ts' }]);
    assert.equal(removeDeletedFileFromLivePanelFormat(data, 'C:\\Users\\adria\\project\\src\\missing.ts'), false);
});

test('upsert helpers replace existing matching entries instead of duplicating them', () => {
    const xrData = [
        { filePath: '/Users/adria/project/src/remove.ts', value: 'old' },
        { file_path: '/Users/adria/project/src/remove.ts', value: 'duplicate' },
    ];
    const livePanelData = {
        files: [
            { filePath: '/Users/adria/project/src/remove.ts', value: 'old' },
            { file_path: '/Users/adria/project/src/remove.ts', value: 'duplicate' },
        ],
    };

    assert.equal(hasMatchingXRFile(xrData, 'C:\\Users\\adria\\project\\src\\remove.ts'), true);
    assert.equal(hasMatchingLivePanelFile(livePanelData, 'C:\\Users\\adria\\project\\src\\remove.ts'), true);

    upsertXRFiles(xrData, [{ filePath: '/Users/adria/project/src/remove.ts', value: 'new' }]);
    upsertLivePanelFiles(livePanelData, [{ filePath: '/Users/adria/project/src/remove.ts', value: 'new' }]);

    assert.deepEqual(xrData, [{ filePath: '/Users/adria/project/src/remove.ts', value: 'new' }]);
    assert.deepEqual(livePanelData.files, [{ filePath: '/Users/adria/project/src/remove.ts', value: 'new' }]);
});

test('resolveTrackedSystemPath rebuilds real paths from relativePath for watcher snapshots', () => {
    const root = createTempDir('codexr-resolve-');
    const nestedDir = path.join(root, 'src');
    const filePath = path.join(nestedDir, 'example.ts');
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.writeFileSync(filePath, 'export const value = 1;\n');

    const resolved = resolveTrackedSystemPath(root, {
        filePath: '/tmp/normalized/example.ts',
        relativePath: 'src/example.ts',
        fileName: 'example.ts',
    });

    assert.equal(resolved, filePath);
    fs.rmSync(root, { recursive: true, force: true });
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
