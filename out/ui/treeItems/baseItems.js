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
exports.SectionItem = exports.TreeItem = void 0;
const vscode = __importStar(require("vscode"));
const treeProvider_1 = require("../treeProvider");
/**
 * Base class for all tree items
 */
class TreeItem extends vscode.TreeItem {
    type; // ✅ Añadir esta propiedad
    // Add children property
    children;
    /**
     * Creates a new tree item
     * @param label Display label for the item
     * @param tooltip Tooltip text
     * @param contextValue Context value for command handling
     * @param collapsibleState Whether this item can be collapsed
     * @param command Command to execute on click
     * @param iconPath Icon for the item
     * @param children Pre-loaded child items (optional)
     */
    constructor(label, tooltip, type, collapsibleState, command, iconPath, children) {
        super(label, collapsibleState);
        this.tooltip = tooltip;
        this.type = type; // ✅ Asignar el tipo
        this.command = command;
        this.iconPath = iconPath;
        if (children) {
            this.children = children;
        }
    }
}
exports.TreeItem = TreeItem;
/**
 * Item for the main sections in the tree
 */
class SectionItem extends TreeItem {
    constructor(label, tooltip, contextValue, collapsibleState) {
        super(label, tooltip, contextValue, collapsibleState);
        // Assign icon based on section
        if (contextValue === treeProvider_1.TreeItemType.SERVERS_SECTION) {
            this.iconPath = new vscode.ThemeIcon('server');
        }
        else if (contextValue === treeProvider_1.TreeItemType.BABIAXR_SECTION) {
            this.iconPath = new vscode.ThemeIcon('graph');
        }
    }
}
exports.SectionItem = SectionItem;
//# sourceMappingURL=baseItems.js.map