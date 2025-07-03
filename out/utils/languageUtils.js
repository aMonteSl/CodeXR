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
exports.getLanguageName = getLanguageName;
exports.getFileExtension = getFileExtension;
exports.isSupportedLanguage = isSupportedLanguage;
const path = __importStar(require("path"));
/**
 * Gets the language name based on file extension
 * @param filePath Path to the file
 * @returns Language name or 'Unknown' if not supported
 */
function getLanguageName(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap = {
        '.js': 'JavaScript',
        '.jsx': 'JavaScript',
        '.ts': 'TypeScript',
        '.tsx': 'TypeScript',
        '.py': 'Python',
        '.java': 'Java',
        '.c': 'C',
        '.h': 'C',
        '.cpp': 'C++',
        '.cc': 'C++',
        '.cxx': 'C++',
        '.hpp': 'C++',
        '.cs': 'C#',
        '.rb': 'Ruby',
        '.php': 'PHP',
        '.phtml': 'PHP',
        '.php3': 'PHP',
        '.php4': 'PHP',
        '.php5': 'PHP',
        '.phps': 'PHP',
        '.go': 'Go',
        '.rs': 'Rust',
        '.swift': 'Swift',
        '.kt': 'Kotlin',
        '.kts': 'Kotlin',
        '.html': 'HTML',
        '.htm': 'HTML',
        '.vue': 'Vue',
        '.scala': 'Scala',
        '.sc': 'Scala',
        '.lua': 'Lua',
        '.erl': 'Erlang',
        '.hrl': 'Erlang',
        '.zig': 'Zig',
        '.pl': 'Perl',
        '.pm': 'Perl',
        '.pod': 'Perl',
        '.t': 'Perl',
        '.sol': 'Solidity',
        '.ttcn3': 'TTCN-3',
        '.ttcn': 'TTCN-3',
        '.3mp': 'TTCN-3',
        '.m': 'Objective-C',
        '.mm': 'Objective-C++',
        '.f': 'Fortran',
        '.f77': 'Fortran',
        '.f90': 'Fortran',
        '.f95': 'Fortran',
        '.f03': 'Fortran',
        '.f08': 'Fortran',
        '.for': 'Fortran',
        '.ftn': 'Fortran',
        '.gd': 'GDScript'
    };
    return languageMap[ext] || 'Unknown';
}
/**
 * Gets the file extension without the dot
 * @param filePath Path to the file
 * @returns File extension without dot or empty string
 */
function getFileExtension(filePath) {
    const ext = path.extname(filePath);
    return ext.startsWith('.') ? ext.substring(1) : ext;
}
/**
 * Checks if a file extension is supported for analysis
 * @param filePath Path to the file
 * @returns Boolean indicating if the extension is supported
 */
function isSupportedLanguage(filePath) {
    const languageName = getLanguageName(filePath);
    return languageName !== 'Unknown';
}
//# sourceMappingURL=languageUtils.js.map