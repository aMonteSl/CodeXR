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
exports.BabiaExampleCategoryItem = exports.BabiaExampleItem = exports.BabiaTreeProvider = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chartModel_1 = require("../models/chartModel");
const baseItems_1 = require("../../ui/treeItems/baseItems");
const treeProvider_1 = require("../../ui/treeProvider");
const chartItems_1 = require("../../ui/treeItems/chartItems");
/**
 * Provider for BabiaXR visualization tree items
 */
class BabiaTreeProvider {
    context;
    /**
     * Constructor for the BabiaXR Tree Provider
     * @param context Extension context for storage
     */
    constructor(context) {
        this.context = context;
    }
    /**
     * Gets child elements of the BabiaXR section
     * @returns Tree items for BabiaXR section
     */
    getBabiaXRChildren() {
        const items = [];
        items.push(new chartItems_1.CreateVisualizationItem());
        items.push(new chartItems_1.BabiaXRExamplesContainer());
        return Promise.resolve(items);
    }
    /**
     * Gets BabiaXR configuration options
     * @returns Tree items for BabiaXR configuration
     */
    getBabiaXRConfigChildren() {
        const bgColor = this.context.globalState.get('babiaBackgroundColor') || '#112233';
        const envPreset = this.context.globalState.get('babiaEnvironmentPreset') || 'forest';
        const groundColor = this.context.globalState.get('babiaGroundColor') || '#445566';
        const chartPalette = this.context.globalState.get('babiaChartPalette') || 'ubuntu';
        return Promise.resolve([
            new chartItems_1.BabiaXRConfigOption('Background Color', 'Set default background color for visualizations', 'codexr.setBackgroundColor', bgColor),
            new chartItems_1.BabiaXRConfigOption('Environment Preset', 'Set default environment preset', 'codexr.setEnvironmentPreset', envPreset),
            new chartItems_1.BabiaXRConfigOption('Ground Color', 'Set default ground color', 'codexr.setGroundColor', groundColor),
            new chartItems_1.BabiaXRConfigOption('Chart Palette', 'Set default color palette for charts', 'codexr.setChartPalette', chartPalette)
        ]);
    }
    /**
     * Gets the child elements when user expands the "Create Visualization" item
     * @returns Tree items for visualization types
     */
    getCreateVisualizationChildren() {
        return Promise.resolve([
            new chartItems_1.ChartTypeItem(chartModel_1.ChartType.BARSMAP_CHART, "Visualize data with 3D bars in a map layout"),
            new chartItems_1.ChartTypeItem(chartModel_1.ChartType.BARS_CHART, "Visualize data with simple 2D bars"),
            new chartItems_1.ChartTypeItem(chartModel_1.ChartType.CYLS_CHART, "Visualize data with cylinder-shaped bars"),
            // ✅ ADDED: Bubbles chart option for BabiaXR
            new chartItems_1.ChartTypeItem(chartModel_1.ChartType.BUBBLES_CHART, "Visualize data with 3D bubbles in X/Z space"),
            new chartItems_1.ChartTypeItem(chartModel_1.ChartType.PIE_CHART, "Visualize proportions as circular sectors"),
            new chartItems_1.ChartTypeItem(chartModel_1.ChartType.DONUT_CHART, "Visualize proportions with a hole in the center")
        ]);
    }
    /**
     * Gets the available BabiaXR examples
     * @returns Tree items for BabiaXR examples
     */
    getBabiaXRExamplesChildren() {
        try {
            const examplesPath = path.join(this.context.extensionPath, 'examples', 'charts');
            console.log(`🔍 [BabiaTreeProvider] Looking for examples in: ${examplesPath}`);
            // First check if the examples directory exists
            if (!fs.existsSync(examplesPath)) {
                console.error(`❌ [BabiaTreeProvider] Examples directory not found: ${examplesPath}`);
                return Promise.resolve([
                    new baseItems_1.TreeItem("Examples directory not found", `Expected path: ${examplesPath}`, treeProvider_1.TreeItemType.BABIAXR_EXAMPLE, vscode.TreeItemCollapsibleState.None, undefined, new vscode.ThemeIcon('error'))
                ]);
            }
            // List what's actually in the directory
            const dirContents = fs.readdirSync(examplesPath);
            console.log(`📁 [BabiaTreeProvider] Examples directory contains: ${dirContents.join(', ')}`);
            const categories = [
                {
                    name: "Bar Visualizations",
                    examples: [
                        { dir: "bar-chart", file: "performance.html", label: "2D Bars: Performance Metrics" },
                        { dir: "barsmap", file: "sales.html", label: "3D Bars: Product Sales" },
                        { dir: "cylinder-chart", file: "sales.html", label: "Cylinders: Product Volumes" }
                    ]
                },
                {
                    name: "Circular Visualizations",
                    examples: [
                        { dir: "pie", file: "population.html", label: "Pie Chart: Population Distribution" },
                        { dir: "pie", file: "donut.html", label: "Donut Chart: Population Distribution" }
                    ]
                },
                {
                    name: "Complex Visualizations",
                    examples: [
                        { dir: "cylindermap-chart", file: "sales_by_person.html", label: "Cylinder Map: Sales by Person" },
                        { dir: "bubble-chart", file: "performance.html", label: "3D Bubbles: Team Performance" },
                        { dir: "mix", file: "mix_charts.html", label: "Multi-Chart Dashboard" }
                    ]
                }
            ];
            const result = [];
            for (const category of categories) {
                const categoryExamples = [];
                for (const example of category.examples) {
                    const examplePath = path.join(examplesPath, example.dir, example.file);
                    console.log(`🔍 [BabiaTreeProvider] Checking example: ${examplePath}`);
                    if (fs.existsSync(examplePath)) {
                        console.log(`✅ [BabiaTreeProvider] Found example: ${example.label}`);
                        categoryExamples.push(new chartItems_1.BabiaXRExampleItem(example.label, examplePath));
                    }
                    else {
                        console.log(`❌ [BabiaTreeProvider] Missing example: ${examplePath}`);
                        // List what's actually in that directory
                        const exampleDir = path.dirname(examplePath);
                        if (fs.existsSync(exampleDir)) {
                            const files = fs.readdirSync(exampleDir);
                            console.log(`📁 [BabiaTreeProvider] ${exampleDir} contains: ${files.join(', ')}`);
                        }
                        else {
                            console.log(`📁 [BabiaTreeProvider] Directory does not exist: ${exampleDir}`);
                        }
                    }
                }
                if (categoryExamples.length > 0) {
                    const categoryItem = new baseItems_1.TreeItem(category.name, `Examples of ${category.name}`, treeProvider_1.TreeItemType.BABIAXR_EXAMPLE_CATEGORY, vscode.TreeItemCollapsibleState.Collapsed, undefined, new vscode.ThemeIcon('folder'));
                    categoryItem.children = categoryExamples;
                    result.push(categoryItem);
                    console.log(`✅ [BabiaTreeProvider] Added category '${category.name}' with ${categoryExamples.length} examples`);
                }
                else {
                    console.log(`⚠️ [BabiaTreeProvider] Category '${category.name}' has no valid examples`);
                }
            }
            if (result.length === 0) {
                console.log(`⚠️ [BabiaTreeProvider] No valid examples found in any category`);
                return Promise.resolve([
                    new baseItems_1.TreeItem("No valid examples found", "No HTML files were found in the examples directories", treeProvider_1.TreeItemType.BABIAXR_EXAMPLE, vscode.TreeItemCollapsibleState.None, undefined, new vscode.ThemeIcon('warning'))
                ]);
            }
            console.log(`✅ [BabiaTreeProvider] Returning ${result.length} example categories`);
            return Promise.resolve(result);
        }
        catch (error) {
            console.error("❌ [BabiaTreeProvider] Error reading examples directory:", error);
            return Promise.resolve([
                new baseItems_1.TreeItem("Error loading examples", `${error instanceof Error ? error.message : String(error)}`, treeProvider_1.TreeItemType.BABIAXR_EXAMPLE, vscode.TreeItemCollapsibleState.None, undefined, new vscode.ThemeIcon('error'))
            ]);
        }
    }
    /**
     * Creates a section item for BabiaXR
     * @returns Section tree item for BabiaXR
     */
    getBabiaXRSectionItem() {
        return new baseItems_1.TreeItem("BabiaXR Visualizations", "Create 3D data visualizations", treeProvider_1.TreeItemType.BABIAXR_SECTION, vscode.TreeItemCollapsibleState.Expanded, undefined, new vscode.ThemeIcon('graph'));
    }
}
exports.BabiaTreeProvider = BabiaTreeProvider;
class BabiaExampleItem extends baseItems_1.TreeItem {
    constructor(label, description, command) {
        super(label, description, treeProvider_1.TreeItemType.BABIAXR_EXAMPLE, // Now a string
        vscode.TreeItemCollapsibleState.None, command);
    }
}
exports.BabiaExampleItem = BabiaExampleItem;
class BabiaExampleCategoryItem extends baseItems_1.TreeItem {
    constructor(label, tooltip, children) {
        super(label, tooltip, treeProvider_1.TreeItemType.BABIAXR_EXAMPLE_CATEGORY, // Now a string
        vscode.TreeItemCollapsibleState.Expanded, undefined, undefined, children);
    }
}
exports.BabiaExampleCategoryItem = BabiaExampleCategoryItem;
//# sourceMappingURL=babiaTreeProvider.js.map