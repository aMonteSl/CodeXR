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
exports.parseFile = parseFile;
exports.findFilesRecursively = findFilesRecursively;
exports.readFileContent = readFileContent;
const ts = __importStar(require("typescript"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Parse a file using TypeScript Compiler API
 */
function parseFile(filePath, options = {}) {
    // Set default options
    const target = options.target || ts.ScriptTarget.Latest;
    const jsx = options.jsx || false;
    // Read file content
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    // Parse the file
    return ts.createSourceFile(path.basename(filePath), fileContent, target, 
    /*setParentNodes*/ true, jsx ? ts.ScriptKind.JSX : undefined);
}
/**
 * Find all files in a directory that match the given extensions
 */
function findFilesRecursively(dirPath, extensions) {
    let results = [];
    // Read all items in the directory
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = fs.statSync(itemPath);
        if (stats.isDirectory()) {
            // Recursively search subdirectories (skip node_modules and .git)
            if (item !== 'node_modules' && item !== '.git') {
                results = results.concat(findFilesRecursively(itemPath, extensions));
            }
        }
        else if (stats.isFile()) {
            // Check if the file has one of the specified extensions
            const ext = path.extname(itemPath).toLowerCase();
            if (extensions.includes(ext)) {
                results.push(itemPath);
            }
        }
    }
    return results;
}
/**
 * Read file content as string
 */
function readFileContent(filePath) {
    return fs.readFileSync(filePath, 'utf-8');
}
//# sourceMappingURL=fileParser.js.map