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
exports.AnalysisTreeProvider = exports.JavaScriptFileItem = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const codeAnalyzer_1 = require("../codeAnalyzer");
const baseItems_1 = require("../../ui/treeItems/baseItems");
const treeProvider_1 = require("../../ui/treeProvider");
/**
 * Specialized tree item for JavaScript files with analysis metrics
 */
class JavaScriptFileItem extends baseItems_1.TreeItem {
    label;
    filePath;
    metrics;
    constructor(label, filePath, metrics) {
        // Create tooltip text first
        const tooltipText = metrics
            ? `${label}\n\nLines: ${metrics.totalLines}\nCode: ${metrics.codeLines}\nComments: ${metrics.commentLines}\nBlank: ${metrics.blankLines}\nFunctions: ${metrics.functionCount}\nClasses: ${metrics.classCount}`
            : label;
        // Create description text
        const description = metrics
            ? `${metrics.totalLines} lines, ${metrics.functionCount} functions`
            : 'not analyzed';
        super(label, tooltipText, // Pass tooltipText here instead of description
        treeProvider_1.TreeItemType.JS_FILE, vscode.TreeItemCollapsibleState.None, undefined, new vscode.ThemeIcon('file-code'));
        this.label = label;
        this.filePath = filePath;
        this.metrics = metrics;
        // Set description separately since we used tooltip in the super constructor
        this.description = description;
        // Set resource URI properly
        this.resourceUri = vscode.Uri.file(filePath);
        // Set command to open file
        this.command = {
            command: 'vscode.open',
            title: 'Open File',
            arguments: [vscode.Uri.file(filePath)]
        };
    }
}
exports.JavaScriptFileItem = JavaScriptFileItem;
/**
 * Provider for JavaScript analysis tree items
 */
class AnalysisTreeProvider {
    context;
    /**
     * Constructor for the Analysis Tree Provider
     * @param context Extension context for storage
     */
    constructor(context) {
        this.context = context;
    }
    /**
     * Gets JavaScript files with analysis metrics
     * @returns Tree items for JavaScript files with metrics
     */
    async getJavaScriptFilesChildren() {
        try {
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                return [];
            }
            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            // Find JavaScript files in the workspace
            const jsFiles = await vscode.workspace.findFiles('{**/*.js,**/*.jsx}', '**/node_modules/**');
            // Limit to 10 files for performance
            const filesToAnalyze = jsFiles.slice(0, 10);
            // Analyze each file and create tree items
            const items = [];
            for (const file of filesToAnalyze) {
                try {
                    // Check if we have cached analysis first
                    const cachedAnalysis = this.context.globalState.get(`jsAnalysis:${file.fsPath}`);
                    if (cachedAnalysis) {
                        items.push(new JavaScriptFileItem(path.basename(file.fsPath), file.fsPath, cachedAnalysis.metrics));
                    }
                    else {
                        // Analyze file if not cached
                        const analysis = await (0, codeAnalyzer_1.analyzeFile)(file.fsPath);
                        // Cache the analysis for future use
                        this.context.globalState.update(`jsAnalysis:${file.fsPath}`, analysis);
                        items.push(new JavaScriptFileItem(path.basename(file.fsPath), file.fsPath, analysis.metrics));
                    }
                }
                catch (error) {
                    console.error(`Error analyzing file ${file.fsPath}:`, error);
                    // Add file without metrics
                    items.push(new JavaScriptFileItem(path.basename(file.fsPath), file.fsPath));
                }
            }
            return items;
        }
        catch (error) {
            console.error('Error getting JavaScript files:', error);
            return [];
        }
    }
    /**
     * Creates a container item for JavaScript files
     * @returns Container tree item for JavaScript files
     */
    getJavaScriptFilesContainer() {
        return new baseItems_1.TreeItem("JavaScript Files", "JavaScript files in the project", treeProvider_1.TreeItemType.JS_FILES_CONTAINER, vscode.TreeItemCollapsibleState.Collapsed, undefined, new vscode.ThemeIcon('folder'));
    }
}
exports.AnalysisTreeProvider = AnalysisTreeProvider;
//# sourceMappingURL=analysisTreeProvider.js.map