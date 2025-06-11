import * as vscode from 'vscode';
import { TreeItemType } from '../../ui/treeProvider';
import { getChartDimensions, getDimensionMapping, ANALYSIS_FIELDS } from '../xr/dimensionMapping';

// ✅ DEFINIR TIPO PARA LAS DIMENSIONES
type ChartDimension = {
  key: string;
  label: string;
  description: string;
};

/**
 * Tree item for dimension mapping configuration
 */
export class DimensionMappingItem extends vscode.TreeItem {
  public type = TreeItemType.DIMENSION_MAPPING;

  constructor(currentChartType: string, extensionPath: string, private context: vscode.ExtensionContext) {
    super(
      'Dimension Mapping',
      vscode.TreeItemCollapsibleState.Collapsed
    );
    
    this.description = `Configure field mapping for ${currentChartType} charts`;
    this.iconPath = new vscode.ThemeIcon('symbol-misc');
    this.chartType = currentChartType;
  }

  private chartType: string;

  async getChildren(): Promise<DimensionMappingOptionItem[]> {
    const dimensions = getChartDimensions(this.chartType);
    const currentMapping = getDimensionMapping(this.chartType, this.context);
    
    return dimensions.map(dimension => {
      const currentField = currentMapping[dimension.key] || 'Not mapped';
      const fieldLabel = ANALYSIS_FIELDS.find(f => f.key === currentField)?.displayName || currentField;
      
      return new DimensionMappingOptionItem(
        this.chartType,
        dimension,
        fieldLabel,
        this.context
      );
    });
  }
}

/**
 * Individual dimension mapping option
 */
export class DimensionMappingOptionItem extends vscode.TreeItem {
  public type = TreeItemType.DIMENSION_MAPPING_OPTION;
  
  constructor(
    private chartType: string,
    private dimension: ChartDimension, // ✅ USAR EL TIPO DEFINIDO
    private currentMapping: string,
    private context: vscode.ExtensionContext
  ) {
    // ✅ CALCULAR TODOS LOS VALORES ANTES DE LLAMAR A super()
    const allMapping = getDimensionMapping(chartType, context);
    const usedValues = Object.entries(allMapping)
      .filter(([key, value]) => key !== dimension.key)
      .map(([key, value]) => value);
    
    const isDuplicated = usedValues.includes(currentMapping);
    const label = `${dimension.label}: ${currentMapping}${isDuplicated ? ' 🔄' : ''}`;
    const description = isDuplicated 
      ? `${dimension.description} (SHARED: Can swap with another dimension)`
      : dimension.description;
    const iconPath = isDuplicated 
      ? new vscode.ThemeIcon('arrow-swap', new vscode.ThemeColor('list.warningForeground'))
      : new vscode.ThemeIcon('symbol-property');
    
    // ✅ AHORA LLAMAR A super() CON LOS VALORES CALCULADOS
    super(label, vscode.TreeItemCollapsibleState.None);
    
    // ✅ ASIGNAR PROPIEDADES DESPUÉS DE super()
    this.description = description;
    this.iconPath = iconPath;
    this.command = {
      command: 'codexr.setDimensionMapping',
      title: 'Set Dimension Mapping',
      arguments: [chartType, dimension.key, dimension.label]
    };
  }
}