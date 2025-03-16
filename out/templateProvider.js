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
exports.BabiaXRTemplateProvider = void 0;
const vscode = __importStar(require("vscode"));
const babiaxrManager_1 = require("./babiaxrManager");
/**
 * Proveedor de datos para la vista de plantillas de BabiaXR
 */
class BabiaXRTemplateProvider {
    context;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    constructor(context) {
        this.context = context;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element) {
            // Elementos raíz - Tipos de gráficos disponibles
            return Promise.resolve([
                new BabiaXRTemplateItem("Crear Visualización", "Selecciona un tipo de visualización para BabiaXR", vscode.TreeItemCollapsibleState.Collapsed, {
                    command: 'integracionvsaframe.showBabiaXRTemplates',
                    title: 'Mostrar plantillas de BabiaXR'
                })
            ]);
        }
        else if (element.label === "Crear Visualización") {
            // Mostrar tipos de gráficos disponibles
            return Promise.resolve([
                new BabiaXRTemplateItem(babiaxrManager_1.ChartType.BarChart, "Visualiza datos categóricos con barras", vscode.TreeItemCollapsibleState.None, {
                    command: 'integracionvsaframe.createBabiaXRVisualization',
                    title: 'Crear gráfico de barras',
                    arguments: [babiaxrManager_1.ChartType.BarChart]
                }),
                new BabiaXRTemplateItem(babiaxrManager_1.ChartType.PieChart, "Visualiza proporciones como sectores circulares", vscode.TreeItemCollapsibleState.None, {
                    command: 'integracionvsaframe.createBabiaXRVisualization',
                    title: 'Crear gráfico circular',
                    arguments: [babiaxrManager_1.ChartType.PieChart]
                }),
                new BabiaXRTemplateItem(babiaxrManager_1.ChartType.TimeSeries, "Visualiza datos que cambian a lo largo del tiempo", vscode.TreeItemCollapsibleState.None, {
                    command: 'integracionvsaframe.createBabiaXRVisualization',
                    title: 'Crear serie temporal',
                    arguments: [babiaxrManager_1.ChartType.TimeSeries]
                })
            ]);
        }
        return Promise.resolve([]);
    }
}
exports.BabiaXRTemplateProvider = BabiaXRTemplateProvider;
/**
 * Elemento para la vista de árbol de plantillas BabiaXR
 */
class BabiaXRTemplateItem extends vscode.TreeItem {
    label;
    tooltip;
    collapsibleState;
    command;
    constructor(label, tooltip, collapsibleState, command) {
        super(label, collapsibleState);
        this.label = label;
        this.tooltip = tooltip;
        this.collapsibleState = collapsibleState;
        this.command = command;
        this.tooltip = tooltip;
        this.command = command;
        // Establecer icono según el tipo
        if (label === "Crear Visualización") {
            this.iconPath = new vscode.ThemeIcon('add');
        }
        else {
            this.iconPath = new vscode.ThemeIcon('graph');
        }
    }
}
//# sourceMappingURL=templateProvider.js.map