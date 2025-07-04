import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ChartType } from '../models/chartModel';
import { TreeItem } from '../../ui/treeItems/baseItems';
import { TreeItemType } from '../../ui/treeProvider';
import { 
  CreateVisualizationItem, 
  ChartTypeItem,
  BabiaXRConfigItem,
  BabiaXRConfigOption,
  BabiaXRExampleItem,
  BabiaXRExamplesContainer
} from '../../ui/treeItems/chartItems';

/**
 * Provider for BabiaXR visualization tree items
 */
export class BabiaTreeProvider {
  /**
   * Constructor for the BabiaXR Tree Provider
   * @param context Extension context for storage
   */
  constructor(private readonly context: vscode.ExtensionContext) {}
  
  /**
   * Gets child elements of the BabiaXR section
   * @returns Tree items for BabiaXR section
   */
  public getBabiaXRChildren(): Thenable<TreeItem[]> {
    const items: TreeItem[] = [];
    
    items.push(new CreateVisualizationItem());
    items.push(new BabiaXRExamplesContainer());
    
    return Promise.resolve(items);
  }
  
  /**
   * Gets BabiaXR configuration options
   * @returns Tree items for BabiaXR configuration
   */
  public getBabiaXRConfigChildren(): Thenable<TreeItem[]> {
    const bgColor = this.context.globalState.get<string>('babiaBackgroundColor') || '#112233';
    const envPreset = this.context.globalState.get<string>('babiaEnvironmentPreset') || 'forest';
    const groundColor = this.context.globalState.get<string>('babiaGroundColor') || '#445566';
    const chartPalette = this.context.globalState.get<string>('babiaChartPalette') || 'ubuntu';
    
    return Promise.resolve([
      new BabiaXRConfigOption(
        'Background Color', 
        'Set default background color for visualizations',
        'codexr.setBackgroundColor',
        bgColor
      ),
      new BabiaXRConfigOption(
        'Environment Preset', 
        'Set default environment preset',
        'codexr.setEnvironmentPreset',
        envPreset
      ),
      new BabiaXRConfigOption(
        'Ground Color', 
        'Set default ground color',
        'codexr.setGroundColor',
        groundColor
      ),
      new BabiaXRConfigOption(
        'Chart Palette', 
        'Set default color palette for charts',
        'codexr.setChartPalette',
        chartPalette
      )
    ]);
  }
  
  /**
   * Gets the child elements when user expands the "Create Visualization" item
   * @returns Tree items for visualization types
   */
  public getCreateVisualizationChildren(): Thenable<TreeItem[]> {
    return Promise.resolve([
      new ChartTypeItem(
        ChartType.BARSMAP_CHART,
        "Visualize data with 3D bars in a map layout"
      ),
      new ChartTypeItem(
        ChartType.BARS_CHART,
        "Visualize data with simple 2D bars"
      ),
      new ChartTypeItem(
        ChartType.CYLS_CHART,
        "Visualize data with cylinder-shaped bars"
      ),
      // ✅ ADDED: Bubbles chart option for BabiaXR
      new ChartTypeItem(
        ChartType.BUBBLES_CHART,
        "Visualize data with 3D bubbles in X/Z space"
      ),
      new ChartTypeItem(
        ChartType.PIE_CHART,
        "Visualize proportions as circular sectors"
      ),
      new ChartTypeItem(
        ChartType.DONUT_CHART,
        "Visualize proportions with a hole in the center"
      )
    ]);
  }
  
  /**
   * Gets the available BabiaXR examples
   * @returns Tree items for BabiaXR examples
   */
  public getBabiaXRExamplesChildren(): Thenable<TreeItem[]> {
    try {
      const examplesPath = path.join(this.context.extensionPath, 'examples', 'charts');
      console.log(`🔍 [BabiaTreeProvider] Looking for examples in: ${examplesPath}`);
      
      // First check if the examples directory exists
      if (!fs.existsSync(examplesPath)) {
        console.error(`❌ [BabiaTreeProvider] Examples directory not found: ${examplesPath}`);
        return Promise.resolve([
          new TreeItem(
            "Examples directory not found",
            `Expected path: ${examplesPath}`,
            TreeItemType.BABIAXR_EXAMPLE,
            vscode.TreeItemCollapsibleState.None,
            undefined,
            new vscode.ThemeIcon('error')
          )
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
      
      const result: TreeItem[] = [];
      
      for (const category of categories) {
        const categoryExamples: TreeItem[] = [];
        
        for (const example of category.examples) {
          const examplePath = path.join(examplesPath, example.dir, example.file);
          console.log(`🔍 [BabiaTreeProvider] Checking example: ${examplePath}`);
          
          if (fs.existsSync(examplePath)) {
            console.log(`✅ [BabiaTreeProvider] Found example: ${example.label}`);
            categoryExamples.push(new BabiaXRExampleItem(example.label, examplePath));
          } else {
            console.log(`❌ [BabiaTreeProvider] Missing example: ${examplePath}`);
            // List what's actually in that directory
            const exampleDir = path.dirname(examplePath);
            if (fs.existsSync(exampleDir)) {
              const files = fs.readdirSync(exampleDir);
              console.log(`📁 [BabiaTreeProvider] ${exampleDir} contains: ${files.join(', ')}`);
            } else {
              console.log(`📁 [BabiaTreeProvider] Directory does not exist: ${exampleDir}`);
            }
          }
        }
        
        if (categoryExamples.length > 0) {
          const categoryItem = new TreeItem(
            category.name,
            `Examples of ${category.name}`,
            TreeItemType.BABIAXR_EXAMPLE_CATEGORY,
            vscode.TreeItemCollapsibleState.Collapsed,
            undefined,
            new vscode.ThemeIcon('folder')
          );
          
          categoryItem.children = categoryExamples;
          result.push(categoryItem);
          console.log(`✅ [BabiaTreeProvider] Added category '${category.name}' with ${categoryExamples.length} examples`);
        } else {
          console.log(`⚠️ [BabiaTreeProvider] Category '${category.name}' has no valid examples`);
        }
      }
      
      if (result.length === 0) {
        console.log(`⚠️ [BabiaTreeProvider] No valid examples found in any category`);
        return Promise.resolve([
          new TreeItem(
            "No valid examples found",
            "No HTML files were found in the examples directories",
            TreeItemType.BABIAXR_EXAMPLE,
            vscode.TreeItemCollapsibleState.None,
            undefined,
            new vscode.ThemeIcon('warning')
          )
        ]);
      }
      
      console.log(`✅ [BabiaTreeProvider] Returning ${result.length} example categories`);
      return Promise.resolve(result);
    } catch (error) {
      console.error("❌ [BabiaTreeProvider] Error reading examples directory:", error);
      return Promise.resolve([
        new TreeItem(
          "Error loading examples",
          `${error instanceof Error ? error.message : String(error)}`,
          TreeItemType.BABIAXR_EXAMPLE,
          vscode.TreeItemCollapsibleState.None,
          undefined,
          new vscode.ThemeIcon('error')
        )
      ]);
    }
  }
  
  /**
   * Creates a section item for BabiaXR
   * @returns Section tree item for BabiaXR
   */
  public getBabiaXRSectionItem(): TreeItem {
    return new TreeItem(
      "BabiaXR Visualizations", 
      "Create 3D data visualizations", 
      TreeItemType.BABIAXR_SECTION,
      vscode.TreeItemCollapsibleState.Expanded,
      undefined,
      new vscode.ThemeIcon('graph')
    );
  }
}

export class BabiaExampleItem extends TreeItem {
  constructor(
    label: string,
    description: string,
    command: vscode.Command
  ) {
    super(
      label,
      description,
      TreeItemType.BABIAXR_EXAMPLE,  // Now a string
      vscode.TreeItemCollapsibleState.None,
      command
    );
  }
}

export class BabiaExampleCategoryItem extends TreeItem {
  constructor(
    label: string,
    tooltip: string,
    children: TreeItem[]
  ) {
    super(
      label,
      tooltip,
      TreeItemType.BABIAXR_EXAMPLE_CATEGORY,  // Now a string
      vscode.TreeItemCollapsibleState.Expanded,
      undefined,
      undefined,
      children
    );
  }
}