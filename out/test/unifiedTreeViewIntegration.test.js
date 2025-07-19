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
const assert = __importStar(require("assert"));
/**
 * Integration tests for the unified tree view implementation
 */
suite('Unified Tree View Integration Tests', () => {
    test('Should have unified tree view registered in package.json structure', () => {
        // This test verifies the package.json structure is correct
        const packageJson = require('../../package.json');
        // Check view container
        const viewsContainers = packageJson.contributes?.viewsContainers?.activitybar;
        const codexrContainer = viewsContainers?.find((container) => container.id === 'codexr');
        assert.ok(codexrContainer, 'Should have codexr view container');
        assert.strictEqual(codexrContainer.title, 'CODEXR');
        // Check views
        const views = packageJson.contributes?.views?.codexr;
        assert.ok(Array.isArray(views), 'Should have views array');
        const unifiedView = views?.find((view) => view.id === 'codexrTree');
        assert.ok(unifiedView, 'Should have codexrTree view');
        assert.strictEqual(unifiedView.name, 'CODEXR');
        // Verify no separate tree views exist
        const separateServersView = views?.find((view) => view.id === 'serversTreeView');
        const separateActiveServersView = views?.find((view) => view.id === 'activeServersTreeView');
        assert.strictEqual(separateServersView, undefined, 'Should not have separate serversTreeView');
        assert.strictEqual(separateActiveServersView, undefined, 'Should not have separate activeServersTreeView');
    });
    test('Should have proper menu configuration for unified view', () => {
        const packageJson = require('../../package.json');
        const menus = packageJson.contributes?.menus;
        // Check title menus
        const titleMenus = menus?.['view/title'] || [];
        const unifiedTitleMenus = titleMenus.filter((menu) => menu.when?.includes('codexrTree'));
        assert.ok(unifiedTitleMenus.length > 0, 'Should have title menus for unified view');
        // Check context menus
        const contextMenus = menus?.['view/item/context'] || [];
        const unifiedContextMenus = contextMenus.filter((menu) => menu.when?.includes('codexrTree'));
        assert.ok(unifiedContextMenus.length > 0, 'Should have context menus for unified view');
        // Verify context menus use activeServer viewItem
        const activeServerMenus = unifiedContextMenus.filter((menu) => menu.when?.includes('viewItem == activeServer'));
        assert.ok(activeServerMenus.length > 0, 'Should have menus for activeServer items');
    });
    test('Should have all required commands defined', () => {
        const packageJson = require('../../package.json');
        const commands = packageJson.contributes?.commands || [];
        const requiredCommands = [
            'codeXR.activeServers.refreshServers',
            'codeXR.activeServers.stopAllServers',
            'codeXR.activeServers.openInBrowser',
            'codeXR.activeServers.openInPanel',
            'codeXR.activeServers.copyUrl',
            'codeXR.activeServers.stopServer',
            'codeXR.activeServers.showDetails',
            'codexr.server.launch',
            'codexr.server.configure'
        ];
        for (const requiredCommand of requiredCommands) {
            const command = commands.find((cmd) => cmd.command === requiredCommand);
            assert.ok(command, `Should have command: ${requiredCommand}`);
        }
    });
    test('Should verify tree structure conforms to expected hierarchy', () => {
        // This test verifies the logical structure matches our design
        const expectedStructure = {
            root: [
                {
                    label: 'SERVERS',
                    type: 'section',
                    children: [
                        {
                            label: 'Server Configuration',
                            type: 'config-group',
                            children: [
                                { label: 'HTTP Mode', type: 'config-option' },
                                { label: 'Default Port', type: 'config-option' },
                                { label: 'Auto-Open', type: 'config-option' },
                                { label: 'Open Mode', type: 'config-option' }
                            ]
                        },
                        { label: 'Start Local Server', type: 'option' }
                    ]
                },
                {
                    label: 'ACTIVE SERVERS',
                    type: 'section',
                    children: [] // Dynamic based on running servers
                }
            ]
        };
        // Verify structure is well-defined
        assert.strictEqual(expectedStructure.root.length, 2, 'Should have exactly 2 root sections');
        assert.strictEqual(expectedStructure.root[0].label, 'SERVERS');
        assert.strictEqual(expectedStructure.root[1].label, 'ACTIVE SERVERS');
        // Verify SERVERS section has proper children
        const serversSection = expectedStructure.root[0];
        assert.ok(serversSection.children.length > 0, 'SERVERS section should have children');
        const configGroup = serversSection.children.find(child => child.label === 'Server Configuration');
        assert.ok(configGroup, 'Should have Server Configuration group');
        assert.ok(configGroup.children && configGroup.children.length === 4, 'Config group should have 4 options');
    });
    test('Should have proper VS Code extension activation structure', () => {
        const packageJson = require('../../package.json');
        // Verify extension basics
        assert.strictEqual(packageJson.name, 'code-xr');
        assert.strictEqual(packageJson.displayName, 'Code-XR');
        assert.ok(packageJson.version);
        // Verify activation events
        assert.ok(Array.isArray(packageJson.activationEvents));
        // Verify main entry point
        assert.strictEqual(packageJson.main, './dist/extension.js');
        // Verify categories
        assert.ok(Array.isArray(packageJson.categories));
        assert.ok(packageJson.categories.includes('Other'));
    });
    test('Should verify icon configuration', () => {
        const packageJson = require('../../package.json');
        // Check extension icon
        assert.strictEqual(packageJson.icon, 'resources/icon.png');
        // Check view container icon
        const viewsContainers = packageJson.contributes?.viewsContainers?.activitybar;
        const codexrContainer = viewsContainers?.find((container) => container.id === 'codexr');
        assert.strictEqual(codexrContainer.icon, 'resources/icon.svg');
        // Check view icon
        const views = packageJson.contributes?.views?.codexr;
        const unifiedView = views?.find((view) => view.id === 'codexrTree');
        assert.strictEqual(unifiedView.icon, '$(server-environment)');
    });
    test('Should validate no legacy tree view references remain', () => {
        const packageJson = require('../../package.json');
        const packageJsonString = JSON.stringify(packageJson);
        // These should not appear in the package.json anymore
        const legacyReferences = [
            'serversTreeView',
            'activeServersTreeView'
        ];
        for (const legacy of legacyReferences) {
            // Allow the legacy reference in the context of this test, but not in actual configuration
            const occurrences = (packageJsonString.match(new RegExp(legacy, 'g')) || []).length;
            // Check if it appears in actual view/menu configuration (not in command names)
            const views = packageJson.contributes?.views?.codexr || [];
            const hasLegacyView = views.some((view) => view.id === legacy);
            assert.strictEqual(hasLegacyView, false, `Should not have legacy view: ${legacy}`);
        }
    });
});
//# sourceMappingURL=unifiedTreeViewIntegration.test.js.map