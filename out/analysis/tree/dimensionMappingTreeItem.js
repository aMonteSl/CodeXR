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
exports.DimensionMappingOptionItem = exports.DimensionMappingItem = void 0;
const vscode = __importStar(require("vscode"));
const treeProvider_1 = require("../../ui/treeProvider");
const dimensionMapping_1 = require("../xr/dimensionMapping");
/**
 * Tree item for dimension mapping configuration
 */
class DimensionMappingItem extends vscode.TreeItem {
    context;
    analysisType;
    type = treeProvider_1.TreeItemType.DIMENSION_MAPPING;
    constructor(currentChartType, extensionPath, context, analysisType = 'File') {
        super(`Dimension Mapping (${analysisType})`, vscode.TreeItemCollapsibleState.Collapsed);
        this.context = context;
        this.analysisType = analysisType;
        this.description = `Configure field mapping for ${analysisType} ${currentChartType} charts`;
        this.iconPath = new vscode.ThemeIcon('symbol-misc');
        this.chartType = currentChartType;
    }
    chartType;
    async getChildren() {
        const dimensions = (0, dimensionMapping_1.getChartDimensions)(this.chartType);
        const currentMapping = (0, dimensionMapping_1.getDimensionMapping)(this.chartType, this.context, this.analysisType);
        return dimensions.map(dimension => {
            const currentField = currentMapping[dimension.key] || 'Not mapped';
            const fieldLabel = dimensionMapping_1.ANALYSIS_FIELDS.find(f => f.key === currentField)?.displayName || currentField;
            return new DimensionMappingOptionItem(this.chartType, dimension, fieldLabel, this.context, this.analysisType);
        });
    }
}
exports.DimensionMappingItem = DimensionMappingItem;
/**
 * Individual dimension mapping option
 */
class DimensionMappingOptionItem extends vscode.TreeItem {
    chartType;
    dimension;
    currentMapping;
    context;
    analysisType;
    type = treeProvider_1.TreeItemType.DIMENSION_MAPPING_OPTION;
    constructor(chartType, dimension, // ✅ USAR EL TIPO DEFINIDO
    currentMapping, context, analysisType = 'File') {
        // ✅ CALCULAR TODOS LOS VALORES ANTES DE LLAMAR A super()
        const allMapping = (0, dimensionMapping_1.getDimensionMapping)(chartType, context, analysisType);
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
        this.chartType = chartType;
        this.dimension = dimension;
        this.currentMapping = currentMapping;
        this.context = context;
        this.analysisType = analysisType;
        // ✅ ASIGNAR PROPIEDADES DESPUÉS DE super()
        this.description = description;
        this.iconPath = iconPath;
        this.command = {
            command: analysisType === 'Directory' ? 'codexr.setDirectoryDimensionMapping' : 'codexr.setDimensionMapping',
            title: `Set ${analysisType} Dimension Mapping`,
            arguments: [chartType, dimension.key, dimension.label, analysisType]
        };
    }
}
exports.DimensionMappingOptionItem = DimensionMappingOptionItem;
//# sourceMappingURL=dimensionMappingTreeItem.js.map