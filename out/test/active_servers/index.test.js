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
// Import Active Servers test suites
require("./activeServersCommands.test");
require("./contextMenuEnhancement.test");
require("./stopAllServers.test");
require("./serverControl.test");
require("./contextMenuIntegration.test");
require("./serverLaunchIntegration.test");
// Removed: Legacy activeServersTreeView.test - superseded by unifiedServersTreeView
require("./enhancedContextMenu.test");
require("./functionalityDemo.test");
require("./activeServersIntegration.test");
require("./activeServerRegistry.test");
require("./activeServerModel.test");
require("./activeServersDisplayIntegration.test");
suite('Active Servers System Integration Tests', () => {
    test('All test suites should be imported and available', () => {
        // This test ensures all our test files are properly imported
        // If any test file has import errors, this test will fail
        assert.ok(true, 'All Active Servers test suites imported successfully');
    });
    test('Test environment should be properly configured', () => {
        // Verify test environment
        assert.ok(typeof suite === 'function', 'Mocha suite function should be available');
        assert.ok(typeof test === 'function', 'Mocha test function should be available');
        assert.ok(typeof assert === 'object', 'Assert module should be available');
    });
});
//# sourceMappingURL=index.test.js.map