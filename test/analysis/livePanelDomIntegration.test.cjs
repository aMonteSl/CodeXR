const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..', '..');

function readProjectFile(...segments) {
    return fs.readFileSync(path.join(projectRoot, ...segments), 'utf8');
}

/**
 * Loads the real, compiled LivePanelParser class with a stubbed `vscode` module,
 * so its actual runtime behavior (not just its source text) can be exercised —
 * this is what would have caught the "extension not found" server-launch bug,
 * since `vscode.extensions.getExtension` is spied on and asserted never called.
 */
function loadLivePanelParserWithStubbedVscode() {
    const sourcePath = path.join(
        projectRoot,
        'src',
        'code_analysis',
        'engine',
        'parsers',
        'livePanelParser.ts',
    );

    let getExtensionCallCount = 0;
    const vscodeStub = {
        ExtensionMode: { Development: 1, Production: 2, Test: 3 },
        extensions: {
            getExtension(id) {
                getExtensionCallCount += 1;
                throw new Error(`Unexpected vscode.extensions.getExtension('${id}') call — LivePanelParser must use context.extensionPath instead.`);
            },
        },
        window: {
            createOutputChannel() {
                return { appendLine() {}, };
            },
        },
        workspace: {
            getConfiguration() {
                return { get: () => false };
            },
            onDidChangeConfiguration() {
                return { dispose() {} };
            },
        },
    };

    const originalModuleRequire = Module.prototype.require;
    Module.prototype.require = function (id) {
        if (id === 'vscode') {
            return vscodeStub;
        }
        return originalModuleRequire.apply(this, arguments);
    };

    const previousLoader = require.extensions['.ts'];
    require.extensions['.ts'] = function compileTypeScript(module, filename) {
        const source = fs.readFileSync(filename, 'utf8');
        const transpiled = ts.transpileModule(source, {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2022,
                esModuleInterop: true,
            },
            fileName: filename,
        }).outputText;
        module._compile(transpiled, filename);
    };

    try {
        delete require.cache[sourcePath];
        const { LivePanelParser } = require(sourcePath);
        return {
            LivePanelParser,
            getExtensionCallCount: () => getExtensionCallCount,
        };
    } finally {
        if (previousLoader) {
            require.extensions['.ts'] = previousLoader;
        } else {
            delete require.extensions['.ts'];
        }
        Module.prototype.require = originalModuleRequire;
    }
}

function extractMethodBlock(source, methodName) {
    const marker = `private async ${methodName}`;
    const start = source.indexOf(marker);
    if (start === -1) {
        return '';
    }

    const nextPrivate = source.indexOf('\n    private ', start + marker.length);
    return source.slice(start, nextPrivate === -1 ? source.length : nextPrivate);
}

test('LivePanel directory launcher no longer blocks on empty directoriesToAnalyze before the first analysis', () => {
    const source = readProjectFile('src', 'code_analysis', 'engine', 'launchers', 'launcherLivePanel.ts');

    assert.equal(source.includes('No directories to analyze'), false);
    assert.match(source, /Directory targets will be resolved by the Python coordinator during the initial analysis/);
    assert.match(source, /filesToHash will be populated after the initial directory analysis completes/);
});

test('FileRequirementProcessor delegates all analysis startup paths to AnalysisBootstrap', () => {
    const processor = readProjectFile('src', 'code_analysis', 'engine', 'processors', 'FileRequirementProcessor.ts');
    const bootstrap = readProjectFile('src', 'code_analysis', 'engine', 'processors', 'analysisBootstrap.ts');

    assert.match(processor, /import \{ AnalysisBootstrap, BootstrapProcessedRequirements \} from '\.\/analysisBootstrap';/);
    assert.match(processor, /this\.analysisBootstrap = new AnalysisBootstrap\(context\);/);
    assert.match(processor, /await this\.analysisBootstrap\.bootstrap\(session, theme\)/);

    assert.match(bootstrap, /case 'LivePanel':/);
    assert.match(bootstrap, /case 'XR':/);
    assert.match(bootstrap, /case 'VisualizeDOM':/);
    assert.match(bootstrap, /session\.filesToHash = trackedFiles/);
    assert.match(bootstrap, /session\.metadata\.mainHtmlFileName = htmlFileName/);
});

test('LivePanel and XR bootstrap share the first Python analysis and tracked file hydration', () => {
    const bootstrap = readProjectFile('src', 'code_analysis', 'engine', 'processors', 'analysisBootstrap.ts');
    const fileXRParser = readProjectFile('src', 'code_analysis', 'engine', 'parsers', 'fileXRParser.ts');
    const directoryXRParser = readProjectFile('src', 'code_analysis', 'engine', 'parsers', 'directoryXRParser.ts');

    assert.match(bootstrap, /const analysisResult = await this\.executePython\.executeAnalysis\(session\);/);
    assert.match(bootstrap, /session\.hash256 = await SHA256Generator\.generateFileHash\(session\.targetPath\);/);
    assert.match(bootstrap, /const trackedFiles = await this\.buildTrackedFiles\(session, payload\);/);
    assert.match(fileXRParser, /bootstrap\?\.payload \?\? await new ExecutePython\(this\.context\)\.executeAnalysis\(session\)/);
    assert.match(directoryXRParser, /bootstrap\?\.payload \?\? await new ExecutePython\(context\)\.executeAnalysis\(/);
    assert.match(directoryXRParser, /if \(bootstrap\?\.trackedFiles\) \{[\s\S]*session\.filesToHash = bootstrap\.trackedFiles;[\s\S]*\} else \{[\s\S]*session\.filesToHash = await this\.buildTrackedFiles\(session, payload\);/);
});

test('VisualizeDOM launch and regeneration now go through the shared bootstrap path', () => {
    const launcher = readProjectFile('src', 'code_analysis', 'engine', 'launchers', 'launcherVisualizeDOM.ts');
    const reanalysisManager = readProjectFile('src', 'code_analysis', 'engine', 'watchers', 'reAnalysisManager.ts');
    const bootstrap = readProjectFile('src', 'code_analysis', 'engine', 'processors', 'analysisBootstrap.ts');
    const domBootstrap = extractMethodBlock(bootstrap, 'bootstrapVisualizeDOM');

    assert.match(launcher, /const processor = new FileRequirementProcessor\(context\);/);
    assert.match(launcher, /return processor\.processRequirements\(session\);/);
    assert.match(reanalysisManager, /const processor = new FileRequirementProcessor\(this\.context\);/);
    assert.match(reanalysisManager, /await processor\.processRequirements\(session\);/);
    assert.match(domBootstrap, /session\.metadata\.domHtmlContent = htmlContent;/);
    assert.match(domBootstrap, /this\.ensureBootstrapFiles\(session, loadedFiles, \['index\.html', 'main\.js', 'virtualScreenRuntime\.js'\]\);/);
    assert.equal(domBootstrap.includes("loadedFiles.set('data.json'"), false);
});

test('Server launch fails explicitly when an analysis session has no generated main HTML file', () => {
    const orchestrator = readProjectFile('src', 'code_analysis', 'engine', 'servers', 'serverLaunchOrchestrator.ts');

    assert.match(orchestrator, /const preferredMainFile = typeof session\?\.metadata\?\.mainHtmlFileName === 'string'/);
    assert.match(orchestrator, /const htmlFilePath = this\.findMainHtmlFile\(tempDir, preferredMainFile\);/);
    assert.match(orchestrator, /No generated HTML entry file was found for session/);
    assert.equal(orchestrator.includes("path.join(__dirname, '../../../templates')"), false);
});

test('VisualizeDOM runtime mounts babia-html from a JSON payload so full documents survive semicolons in style and script tags', () => {
    const template = readProjectFile('templates', 'xr', 'html', 'dom-visualization-template.html');
    const sseClient = readProjectFile('templates', 'xr', 'sse', 'live_sse_fileDOM.js');
    const reanalysisManager = readProjectFile('src', 'code_analysis', 'engine', 'watchers', 'reAnalysisManager.ts');
    const templateProcessor = readProjectFile('src', 'babia_templates', 'processing', 'templateHTMLProcessor.ts');

    assert.match(template, /html2canvas\.min\.js/);
    assert.match(template, /babia-html="renderHTML: true; renderHTMLOnlyLeafs: true; distanceLevels: 0\.7"/);
    assert.match(template, /<script id="codexr-dom-html-payload" type="application\/json">\$\{HTML_CONTENT_JSON\}<\/script>/);
    assert.match(template, /window\.__CODEXR_DOM_HTML_PAYLOAD__ = readInitialDomHtmlPayload\(\);/);
    assert.match(template, /applyBabiaHtml\(0\.7, window\.__CODEXR_DOM_HTML_PAYLOAD__\);/);
    assert.match(template, /entity\.setAttribute\('babia-html', \{[\s\S]*renderHTML: true,[\s\S]*renderHTMLOnlyLeafs: true,[\s\S]*html: nextHtml,[\s\S]*distanceLevels: distanceLevels,[\s\S]*\}\);/);
    assert.doesNotMatch(template, /babia-html="renderHTML: true; renderHTMLOnlyLeafs: true; distanceLevels: 0\.7; html: \$\{HTML_CONTENT\}"/);
    assert.doesNotMatch(template, /data\.json/);

    assert.match(sseClient, /window\.__CODEXR_DOM_HTML_PAYLOAD__ = htmlContent;/);
    assert.match(sseClient, /entity\.setAttribute\('babia-html', \{[\s\S]*renderHTML: true,[\s\S]*renderHTMLOnlyLeafs: true,[\s\S]*html: htmlContent,[\s\S]*distanceLevels,[\s\S]*\}\);/);
    assert.doesNotMatch(sseClient, /data\.json/);

    assert.match(reanalysisManager, /window\\\.__CODEXR_DOM_HTML_PAYLOAD__\\s\*=\\s\*\(\"\(\?:\\\\\.\|\[\^\"\\\\\]\)\*\"\);/);
    assert.match(reanalysisManager, /return JSON\.parse\(payloadMatch\[1\]\);/);
    assert.match(reanalysisManager, /removeLegacyDomDataJson/);

    assert.match(templateProcessor, /HTML_CONTENT_JSON/);
});

test('HTML DOM Python integration now emits JSON markers and ExecutePython keeps a direct JSON fallback', () => {
    const executePython = readProjectFile('src', 'code_analysis', 'engine', 'utils', 'executePython.ts');
    const htmlParser = readProjectFile('src', 'code_analysis', 'python', 'html', 'html_dom_parser.py');

    assert.match(htmlParser, /def emit_json_result\(result: Dict\[str, Any\]\) -> None:/);
    assert.match(htmlParser, /print\('=== JSON_START ==='\)/);
    assert.match(htmlParser, /print\('=== JSON_END ==='\)/);
    assert.match(htmlParser, /def prepare_html_for_visualization\(html_content: str\) -> str:/);
    assert.doesNotMatch(htmlParser, /re\.sub\(|title_start|body_start|Sample Content/);

    assert.match(executePython, /private parsePythonOutput\(stdoutData: string\): any \{/);
    assert.match(executePython, /return JSON\.parse\(trimmedOutput\);/);
});

test('LivePanel file template and script expose unified file metrics such as ratios, nesting and complexity bands', () => {
    const html = readProjectFile('templates', 'analysis_livePanel', 'file', 'fileAnalysis.html');
    const js = readProjectFile('templates', 'analysis_livePanel', 'file', 'fileAnalysismain.js');

    assert.match(html, /id="comment-ratio"/);
    assert.match(html, /id="complexity-density"/);
    assert.match(html, /id="avg-function-parameters"/);
    assert.match(html, /id="max-nesting-depth"/);
    // The functions table is now a shared DataTable whose columns are declared in JS.
    assert.match(html, /<div id="functions-table"><\/div>/);
    assert.match(js, /label: 'Span'/);
    assert.match(js, /label: 'Nesting'/);
    assert.match(js, /label: 'Band'/);

    assert.match(js, /spanLines/);
    assert.match(js, /complexityBand/);
    assert.match(js, /maxNestingDepth/);
    assert.match(js, /formatRatio\(analysisData\.commentRatio \|\| 0\)/);
    assert.match(js, /formatComplexityBand\(func\.complexityBand\)/);
});

test('LivePanel directory template and script expose unified directory aggregates from the flat file payload', () => {
    const html = readProjectFile('templates', 'analysis_livePanel', 'directory', 'directoryAnalysis.html');
    const js = readProjectFile('templates', 'analysis_livePanel', 'directory', 'directoryAnalysismain.js');

    assert.match(html, /id="comment-ratio-summary"/);
    assert.match(html, /id="high-complexity-functions"/);
    assert.match(html, /id="avg-function-params"/);
    assert.match(html, /id="max-function-nesting"/);
    // The file table is now a shared DataTable whose columns are declared in JS.
    assert.match(html, /<div id="file-details-table"><\/div>/);
    assert.match(js, /label: 'Comment %'/);
    assert.match(js, /label: 'Avg Params'/);
    assert.match(js, /label: 'Critical CCN Fns'/);

    assert.match(js, /summary\.highComplexityFunctions/);
    assert.match(js, /summary\.averageFunctionParameters/);
    assert.match(js, /summary\.averageFunctionNestingDepth/);
    assert.match(js, /formatRatio\(file\.commentRatio \|\| 0\)/);
    assert.match(js, /file\.criticalComplexityFunctions \|\| 0/);
});

// ── LivePanel server launch regression: extension-path resolution ──────────
//
// Bug: LivePanelParser resolved the extension's install path via a global
// registry lookup (vscode.extensions.getExtension('amonteSl.code-xr')) instead
// of the ExtensionContext already threaded through the whole launch pipeline.
// Every other parser (FileXRParser, directoryXRParser, VisualizeDOMParser) uses
// context.extensionPath directly, so XR/DOM launches never touched that lookup
// and always worked, while LivePanel launches depended on the extension being
// registered under that exact id in the current extension host — and threw
// "Extension amonteSl.code-xr not found" whenever it wasn't, aborting the
// server launch (FILE_REQUIREMENT_PROCESSOR / NEW_LAUNCHER_LIVEPANEL_ANALYSIS
// error chain) with no equivalent failure on the XR side.

test('LivePanelParser resolves templates from context.extensionPath like every other parser, never the extension registry', () => {
    const source = readProjectFile('src', 'code_analysis', 'engine', 'parsers', 'livePanelParser.ts');
    const bootstrap = readProjectFile('src', 'code_analysis', 'engine', 'processors', 'analysisBootstrap.ts');
    const fileXRParser = readProjectFile('src', 'code_analysis', 'engine', 'parsers', 'fileXRParser.ts');
    const visualizeDOMParser = readProjectFile('src', 'code_analysis', 'engine', 'parsers', 'visualizeDOMParser.ts');

    assert.match(source, /constructor\(context: vscode\.ExtensionContext\)/);
    assert.match(source, /this\.context = context;/);
    assert.match(source, /path\.join\(this\.context\.extensionPath, 'templates', 'analysis_livePanel', targetType\)/);
    assert.doesNotMatch(source, /vscode\.extensions\.getExtension/);
    assert.doesNotMatch(source, /amonteSl/i);

    // Same construction pattern as the parsers whose launches already work.
    assert.match(bootstrap, /this\.livePanelParser = new LivePanelParser\(context\);/);
    assert.match(fileXRParser, /constructor\(context: vscode\.ExtensionContext\)/);
    assert.match(visualizeDOMParser, /constructor\(context: vscode\.ExtensionContext\)/);
});

test('LivePanelParser actually loads the real directory and file templates from context.extensionPath, with no vscode.extensions lookup at runtime', async () => {
    const { LivePanelParser, getExtensionCallCount } = loadLivePanelParserWithStubbedVscode();

    const fakeContext = { extensionPath: projectRoot };
    const parser = new LivePanelParser(fakeContext);

    const directoryFiles = await parser.loadTemplateFiles('directory', 'LivePanel', 'light');
    assert.ok(directoryFiles.has('directoryAnalysis.html'), 'expected directoryAnalysis.html to load');
    assert.ok(directoryFiles.has('main.js'), 'expected the directory main.js to load');
    assert.ok(directoryFiles.has('style.css'), 'expected the directory style.css to load');
    assert.match(directoryFiles.get('directoryAnalysis.html'), /id="dependency-graph-summary"/);

    // The shared DataTable component is bundled ahead of the template's own code.
    const directoryMainJs = directoryFiles.get('main.js');
    assert.match(directoryMainJs, /class DataTable/);
    assert.match(directoryMainJs, /function renderFileDetailsTable/);
    assert.ok(
        directoryMainJs.indexOf('class DataTable') < directoryMainJs.indexOf('function renderFileDetailsTable'),
        'shared component must be bundled before the template script that uses it',
    );
    assert.match(directoryFiles.get('style.css'), /\.data-table-scroll/);

    const fileFiles = await parser.loadTemplateFiles('file', 'LivePanel', 'light');
    assert.ok(fileFiles.has('fileAnalysis.html'), 'expected fileAnalysis.html to load');
    assert.ok(fileFiles.has('main.js'), 'expected the file main.js to load');
    assert.ok(fileFiles.has('style.css'), 'expected the file style.css to load');
    // Shared component is bundled into every LivePanel template's main.js.
    assert.match(fileFiles.get('main.js'), /class DataTable/);

    assert.equal(getExtensionCallCount(), 0, 'LivePanelParser must never call vscode.extensions.getExtension');
});

test('LivePanelParser throws a clear error instead of silently launching from the wrong directory when the extension path is wrong', async () => {
    const { LivePanelParser } = loadLivePanelParserWithStubbedVscode();

    const badContext = { extensionPath: path.join(projectRoot, 'this-path-does-not-exist') };
    const parser = new LivePanelParser(badContext);

    await assert.rejects(
        () => parser.loadTemplateFiles('directory', 'LivePanel', 'light'),
        /Template directory does not exist/,
    );
});

