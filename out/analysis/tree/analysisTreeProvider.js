"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalysisTreeProvider = void 0;
exports.getAnalysisChildren = getAnalysisChildren;
exports.getFilesPerLanguageChildren = getFilesPerLanguageChildren;
exports.getLanguageGroupChildren = getLanguageGroupChildren;
exports.getAnalysisSectionItem = getAnalysisSectionItem;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path")); // ✅ ADDED: Missing path import
const baseItems_1 = require("../../ui/treeItems/baseItems");
const treeProvider_1 = require("../../ui/treeProvider"); // ✅ ADDED: Missing TreeItemType import
const fileSystemWatcher_1 = require("./fileSystemWatcher");
const fileWatchManager_1 = require("../fileWatchManager");
// ✅ REMOVED: Circular imports - we'll import these inside functions where needed
const analysisTreeItems_js_1 = require("./analysisTreeItems.js"); // ✅ ADDED: Direct imports with .js extension
const treeDisplayConfig_js_1 = require("./treeDisplayConfig.js"); // ✅ ADDED: Missing utility imports
/**
 * Tree data provider for analysis section
 */
class AnalysisTreeProvider {
    context;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    fileSystemWatcher;
    // ✅ NEW: Countdown refresh timer
    countdownRefreshTimer;
    constructor(context) {
        this.context = context;
        this.fileSystemWatcher = fileSystemWatcher_1.FileSystemWatcher.getInstance();
        this.setupFileSystemWatcher();
        // ✅ NEW: Start countdown refresh timer for live updates
        this.startCountdownRefreshTimer();
    }
    /**
     * ✅ NEW: Starts a timer to refresh tree view during active countdowns
     */
    startCountdownRefreshTimer() {
        // Refresh tree view every 2 seconds when there are active countdowns
        this.countdownRefreshTimer = setInterval(() => {
            // ✅ FIXED: Now FileWatchManager is properly imported
            const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
            if (fileWatchManager) {
                const watcherStatus = fileWatchManager.getWatcherStatus();
                // ✅ FIXED: Add type annotation for detail parameter
                const hasActiveCountdowns = watcherStatus.activeTimerDetails.some((detail) => detail.hasCountdown);
                if (hasActiveCountdowns) {
                    console.log('🔄 Refreshing tree view for countdown updates');
                    this.refresh();
                }
            }
        }, 2000); // Refresh every 2 seconds when countdowns are active
    }
    setupFileSystemWatcher() {
        this.fileSystemWatcher.initialize(() => {
            console.log('🔄 AnalysisTreeProvider: File system change detected, refreshing...');
            this.refresh();
        });
    }
    refresh() {
        console.log('🔄 AnalysisTreeProvider: Refreshing tree view...');
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (!element) {
            // Root level: return analysis section
            return [getAnalysisSectionItem(this.context.extensionPath)];
        }
        // ✅ FIXED: Handle different element types properly
        console.log('🔍 Getting children for element type:', element.type, 'label:', element.label);
        switch (element.type) {
            case treeProvider_1.TreeItemType.ANALYSIS_SECTION:
                console.log('📊 Getting analysis section children');
                return await getAnalysisChildren(this.context);
            case treeProvider_1.TreeItemType.FILES_PER_LANGUAGE_CONTAINER:
                console.log('📁 Getting files per language children');
                return await getFilesPerLanguageChildren(this.context);
            case treeProvider_1.TreeItemType.ANALYSIS_LANGUAGE_GROUP:
                console.log('📂 Getting language group children for:', element.label);
                return await getLanguageGroupChildren(element, this.context);
            case treeProvider_1.TreeItemType.ANALYSIS_SETTINGS:
                console.log('⚙️ Getting analysis settings children');
                // ✅ FIXED: Handle settings children properly
                if (element instanceof analysisTreeItems_js_1.AnalysisSettingsItem) {
                    return await element.getChildren();
                }
                return [];
            case treeProvider_1.TreeItemType.DIMENSION_MAPPING:
                console.log('🔗 Getting dimension mapping children');
                // ✅ FIXED: Import and handle dimension mapping
                try {
                    const { DimensionMappingItem } = await import('./dimensionMappingTreeItem.js');
                    if (element instanceof DimensionMappingItem) {
                        return await element.getChildren();
                    }
                }
                catch (error) {
                    console.error('❌ Error loading dimension mapping children:', error);
                }
                return [];
            default:
                console.log('❓ Unknown element type:', element.type);
                return [];
        }
    }
    triggerRefresh() {
        console.log('🔄 AnalysisTreeProvider: Manual refresh triggered');
        this.refresh();
    }
    getFileSystemWatcherStatus() {
        return this.fileSystemWatcher.getStatus();
    }
    dispose() {
        console.log('🧹 AnalysisTreeProvider: Disposing...');
        // ✅ CLEAR: Stop countdown refresh timer
        if (this.countdownRefreshTimer) {
            clearInterval(this.countdownRefreshTimer);
            this.countdownRefreshTimer = undefined;
        }
        this.fileSystemWatcher.dispose();
    }
}
exports.AnalysisTreeProvider = AnalysisTreeProvider;
/**
 * Gets child elements of the analysis section with the new container structure
 */
async function getAnalysisChildren(context) {
    try {
        console.log('📊 Getting analysis children...');
        const children = [];
        // ✅ FIXED: Use imported class
        children.push(new analysisTreeItems_js_1.AnalysisSettingsItem(context.extensionPath, context));
        // Get all analyzable files
        const filesByLanguage = await getAnalyzableFilesByLanguage();
        const languages = Object.keys(filesByLanguage);
        const totalFiles = Object.values(filesByLanguage).reduce((sum, files) => sum + files.length, 0);
        if (languages.length === 0) {
            console.log('📂 No analyzable files found in workspace');
            children.push(createErrorItem('No analyzable files found', 'No supported programming language files were found in the current workspace'));
            return children;
        }
        // ✅ FIXED: Use imported class
        children.push(new analysisTreeItems_js_1.FilesPerLanguageContainer(languages.length, totalFiles, context.extensionPath));
        console.log(`✅ Analysis children created: ${children.length} items (${languages.length} languages, ${totalFiles} files)`);
        return children;
    }
    catch (error) {
        console.error('❌ Error getting analysis children:', error);
        return [
            createErrorItem('Error loading files', `Failed to load analyzable files: ${error instanceof Error ? error.message : String(error)}`)
        ];
    }
}
/**
 * Gets child elements of the Files per Language container
 */
async function getFilesPerLanguageChildren(context) {
    try {
        console.log('📁 Getting files per language children...');
        // Get all analyzable files grouped by language
        const filesByLanguage = await getAnalyzableFilesByLanguage();
        // ✅ FIXED: Use imported function
        const config = (0, treeDisplayConfig_js_1.getTreeDisplayConfig)(context);
        // ✅ FIXED: Use imported function
        const sortedLanguageEntries = (0, treeDisplayConfig_js_1.sortLanguageEntries)(filesByLanguage, config);
        // Create language group items
        const languageItems = [];
        for (const [language, files] of sortedLanguageEntries) {
            // ✅ FIXED: Use imported function
            const limitedFiles = (0, treeDisplayConfig_js_1.limitAndSortFiles)(files, config);
            console.log(`📂 Creating language group for ${language}: ${files.length} total files, ${limitedFiles.length} showing`);
            // ✅ FIXED: Use imported class and set correct properties
            const languageGroupItem = new analysisTreeItems_js_1.LanguageGroupItem(language, files.length, // Total file count
            limitedFiles.length, // Showing file count (after limiting)
            context.extensionPath);
            // ✅ CRITICAL: Store the files data in the item for retrieval later
            languageGroupItem.filesData = limitedFiles;
            languageItems.push(languageGroupItem);
        }
        console.log(`✅ Files per language children created: ${languageItems.length} language groups`);
        return languageItems;
    }
    catch (error) {
        console.error('❌ Error getting files per language children:', error);
        return [
            createErrorItem('Error loading language groups', `Failed to load files by language: ${error instanceof Error ? error.message : String(error)}`)
        ];
    }
}
/**
 * ✅ FIXED: Gets child elements of a language group (individual files)
 */
async function getLanguageGroupChildren(groupItem, context) {
    try {
        console.log('📂 Getting language group children for:', groupItem.label);
        // ✅ FIXED: Extract language name from label (remove file count info)
        const labelStr = typeof groupItem.label === 'string' ? groupItem.label : String(groupItem.label || '');
        const languageName = labelStr.split(' (')[0]; // Extract language name before the count
        if (!languageName) {
            console.log('📂 No language name found for group item');
            return [];
        }
        console.log('📂 Processing language:', languageName);
        // ✅ NEW: Try to get files from stored data first (more efficient)
        const storedFiles = groupItem.filesData;
        let filesToProcess = [];
        if (storedFiles && Array.isArray(storedFiles)) {
            console.log(`📂 Using stored files for ${languageName}: ${storedFiles.length} files`);
            filesToProcess = storedFiles;
        }
        else {
            console.log(`📂 No stored files, fetching fresh data for ${languageName}`);
            // Fallback: fetch fresh data
            const filesByLanguage = await getAnalyzableFilesByLanguage();
            const config = (0, treeDisplayConfig_js_1.getTreeDisplayConfig)(context);
            const filesForLanguage = filesByLanguage[languageName];
            if (!filesForLanguage || filesForLanguage.length === 0) {
                console.log(`📂 No files found for language: ${languageName}`);
                return [];
            }
            filesToProcess = (0, treeDisplayConfig_js_1.limitAndSortFiles)(filesForLanguage, config);
        }
        // Create file items
        const fileItems = [];
        for (const fileUri of filesToProcess) {
            const filePath = fileUri.fsPath;
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
            // ✅ FIXED: path is now imported
            const relativePath = workspaceFolder
                ? path.relative(workspaceFolder.uri.fsPath, filePath)
                : path.basename(filePath);
            // ✅ FIXED: Use imported class
            const fileItem = new analysisTreeItems_js_1.AnalysisFileItem(filePath, relativePath, languageName, context.extensionPath);
            fileItems.push(fileItem);
        }
        console.log(`✅ Created ${fileItems.length} file items for ${languageName}`);
        return fileItems;
    }
    catch (error) {
        console.error('❌ Error getting language group children:', error);
        return [
            createErrorItem('Error loading files', `Failed to load files for this language: ${error instanceof Error ? error.message : String(error)}`)
        ];
    }
}
/**
 * Creates a tree item for displaying error messages
 */
function createErrorItem(message, tooltip) {
    return new baseItems_1.TreeItem(message, tooltip || message, 
    // ✅ FIXED: TreeItemType is now imported
    treeProvider_1.TreeItemType.ANALYSIS_MESSAGE, vscode.TreeItemCollapsibleState.None, undefined, new vscode.ThemeIcon('error'));
}
/**
 * Creates the section item for code analysis
 */
function getAnalysisSectionItem(extensionPath) {
    // ✅ FIXED: Use imported class
    return new analysisTreeItems_js_1.AnalysisSectionItem(extensionPath);
}
/**
 * Gets analyzable files from workspace grouped by language
 */
async function getAnalyzableFilesByLanguage() {
    const filesByLanguage = {};
    if (!vscode.workspace.workspaceFolders) {
        console.log('📂 No workspace folders found');
        return filesByLanguage;
    }
    try {
        // ✅ COMPREHENSIVE EXCLUDE PATTERN (keep as before)
        const excludePattern = `{${[
            // Hidden directories (starting with dot)
            '**/.venv/**',
            '**/.git/**',
            '**/.svn/**',
            '**/.hg/**',
            '**/.bzr/**',
            '**/.idea/**',
            '**/.vscode/**',
            '**/.vs/**',
            '**/.eclipse/**',
            '**/.settings/**',
            '**/.metadata/**',
            '**/.pytest_cache/**',
            '**/.coverage/**',
            '**/.nyc_output/**',
            '**/.sass-cache/**',
            // Build and output directories
            '**/node_modules/**',
            '**/bower_components/**',
            '**/vendor/**',
            '**/dist/**',
            '**/build/**',
            '**/target/**', // Maven
            '**/bin/**',
            '**/obj/**',
            '**/out/**',
            '**/release/**',
            '**/debug/**',
            // Python specific
            '**/__pycache__/**',
            '**/site-packages/**',
            '**/Scripts/**', // Windows venv
            '**/lib/python*/**', // Unix venv
            '**/Lib/**', // Windows Python
            '**/DLLs/**',
            '**/Include/**',
            // JavaScript/Node.js specific
            '**/.next/**',
            '**/.nuxt/**',
            '**/coverage/**',
            '**/public/build/**',
            // Java specific
            '**/classes/**',
            '**/generated/**',
            '**/META-INF/**',
            // .NET specific
            '**/packages/**',
            // Temporary and cache directories
            '**/tmp/**',
            '**/temp/**',
            '**/cache/**',
            '**/logs/**',
            // Package manager files and directories
            '**/yarn.lock',
            '**/package-lock.json',
            '**/composer.lock',
            '**/Pipfile.lock',
            // Documentation directories that might contain code examples
            '**/docs/**',
            '**/documentation/**'
        ].join(',')}}`;
        console.log('🔍 Searching for ALL files with simplified unknown detection...');
        // ✅ SIMPLIFIED APPROACH: Search for ALL files at once
        const allFiles = await vscode.workspace.findFiles('**/*', // Find ALL files
        excludePattern);
        console.log(`📄 Found ${allFiles.length} total files, categorizing by extension...`);
        // ✅ PROCESS ALL FILES: Categorize each file by its extension
        for (const file of allFiles) {
            // ✅ FIXED: path is now imported
            const fileName = path.basename(file.fsPath);
            const ext = path.extname(file.fsPath).toLowerCase();
            // Skip hidden files (starting with dot)
            if (fileName.startsWith('.')) {
                continue;
            }
            // Get language from extension
            const language = getLanguageFromExtension(ext);
            // Apply basic file filtering
            if (shouldIncludeFile(file, language)) {
                if (!filesByLanguage[language]) {
                    filesByLanguage[language] = [];
                }
                filesByLanguage[language].push(file);
            }
        }
        // Log results
        const totalFiles = Object.values(filesByLanguage).reduce((sum, files) => sum + files.length, 0);
        console.log(`🔍 Categorized ${totalFiles} files into ${Object.keys(filesByLanguage).length} languages`);
        // Log breakdown by language
        for (const [language, files] of Object.entries(filesByLanguage)) {
            console.log(`  📁 ${language}: ${files.length} files`);
        }
        return filesByLanguage;
    }
    catch (error) {
        console.error('❌ Error finding analyzable files:', error);
        return filesByLanguage;
    }
}
/**
 * ✅ UPDATED: Gets language name from file extension - simplified logic
 */
function getLanguageFromExtension(ext) {
    const languageMap = {
        '.js': 'JavaScript',
        '.jsx': 'JavaScript',
        '.ts': 'TypeScript',
        '.tsx': 'TypeScript',
        '.py': 'Python',
        '.c': 'C',
        '.h': 'C/C++ Headers',
        '.cpp': 'C++',
        '.cc': 'C++',
        '.cxx': 'C++',
        '.hpp': 'C/C++ Headers',
        '.cs': 'C#',
        '.java': 'Java',
        '.vue': 'Vue',
        '.rb': 'Ruby',
        '.m': 'Objective-C',
        '.mm': 'Objective-C',
        '.swift': 'Swift',
        '.ttcn': 'TTCN-3',
        '.ttcn3': 'TTCN-3',
        '.3mp': 'TTCN-3',
        '.php': 'PHP',
        '.phtml': 'PHP',
        '.php3': 'PHP',
        '.php4': 'PHP',
        '.php5': 'PHP',
        '.phps': 'PHP',
        '.scala': 'Scala',
        '.sc': 'Scala',
        '.gd': 'GDScript',
        '.go': 'Go',
        '.lua': 'Lua',
        '.rs': 'Rust',
        '.f': 'Fortran',
        '.f77': 'Fortran',
        '.f90': 'Fortran',
        '.f95': 'Fortran',
        '.f03': 'Fortran',
        '.f08': 'Fortran',
        '.for': 'Fortran',
        '.ftn': 'Fortran',
        '.kt': 'Kotlin',
        '.kts': 'Kotlin',
        '.sol': 'Solidity',
        '.erl': 'Erlang',
        '.hrl': 'Erlang',
        '.zig': 'Zig',
        '.pl': 'Perl',
        '.pm': 'Perl',
        '.pod': 'Perl',
        '.t': 'Perl',
        '.html': 'HTML',
        '.htm': 'HTML'
    };
    // ✅ SIMPLE LOGIC: If extension not in our map, it's "Unknown Files"
    return languageMap[ext] || 'Unknown Files';
}
/**
 * ✅ SIMPLIFIED: Determines if a file should be included (much simpler now)
 */
function shouldIncludeFile(fileUri, language) {
    // ✅ FIXED: path is now imported
    const fileName = path.basename(fileUri.fsPath);
    // Skip hidden files (already handled above, but double-check)
    if (fileName.startsWith('.')) {
        return false;
    }
    // ✅ SIMPLE LOGIC: Include almost everything, with minimal exclusions
    // For "Unknown Files", apply basic filtering
    if (language === 'Unknown Files') {
        return shouldIncludeUnknownFile(fileUri);
    }
    // For known languages, apply minimal filtering
    switch (language) {
        case 'Python':
            return shouldIncludePythonFile(fileUri);
        case 'Java':
            return shouldIncludeJavaFile(fileUri);
        default:
            return true; // Include all other known language files
    }
}
/**
 * ✅ SIMPLIFIED: Determines if an unknown file should be included
 */
function shouldIncludeUnknownFile(fileUri) {
    // ✅ FIXED: path is now imported
    const fileName = path.basename(fileUri.fsPath);
    const ext = path.extname(fileName).toLowerCase();
    // ✅ MUCH SIMPLER: Only exclude obviously non-useful files
    const excludeExtensions = [
        // Binary files
        '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
        '.mp3', '.mp4', '.avi', '.mkv', '.wav', '.ogg',
        '.zip', '.tar', '.gz', '.rar', '.7z',
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        '.ttf', '.otf', '.woff', '.woff2', '.eot',
        '.dll', '.so', '.dylib', '.exe', '.bin',
        '.jar', '.war', '.ear', '.class',
        '.pyc', '.pyo', '.pyd',
        '.o', '.obj', '.lib', '.a',
        // Minified files
        '.min.js', '.min.css',
        // Temporary files
        '.bak', '.tmp', '.temp', '.swp', '.swo'
    ];
    // ✅ SIMPLE: If not in exclude list, include it
    if (excludeExtensions.includes(ext)) {
        return false;
    }
    // ✅ INCLUDE: .txt, .md, .json, .xml, .yml, .yaml, .ini, .cfg, .conf, etc.
    // These are files users might want to see even if they're not "code"
    return true;
}
// Keep the existing simple functions:
function shouldIncludePythonFile(fileUri) {
    // ✅ FIXED: path is now imported
    const fileName = path.basename(fileUri.fsPath);
    // Exclude specific Python files
    const excludePatterns = [
        /^__pycache__/,
        /\.pyc$/,
        /\.pyo$/,
        /\.pyd$/,
        /^setup\.py$/,
        /^conftest\.py$/
    ];
    return !excludePatterns.some(pattern => pattern.test(fileName));
}
function shouldIncludeJavaFile(fileUri) {
    // ✅ FIXED: path is now imported
    const fileName = path.basename(fileUri.fsPath);
    // Exclude generated files (containing $ usually indicates inner classes)
    return !fileName.includes('$');
}
//# sourceMappingURL=analysisTreeProvider.js.map