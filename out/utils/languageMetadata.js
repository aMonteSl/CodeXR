"use strict";
/**
 * Language metadata for file detection and visualization
 * Maps file extensions to language information including VS Code icons
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtensionToLanguageMap = exports.SupportedLanguages = void 0;
exports.getLanguageForFile = getLanguageForFile;
exports.getAllLanguageNames = getAllLanguageNames;
exports.isLanguageSupported = isLanguageSupported;
/**
 * Supported languages with their file extensions and VS Code icon IDs
 */
exports.SupportedLanguages = [
    { name: "HTML", extensions: [".html", ".htm"], iconId: "html" },
    { name: "JavaScript", extensions: [".js", ".mjs"], iconId: "javascript" },
    { name: "Python", extensions: [".py", ".pyw"], iconId: "python" },
    { name: "Ruby", extensions: [".rb", ".rbw"], iconId: "ruby" },
    { name: "C", extensions: [".c", ".h"], iconId: "c" },
    { name: "Go", extensions: [".go"], iconId: "go" },
    { name: "Kotlin", extensions: [".kt", ".kts"], iconId: "kotlin" },
    { name: "Objective-C", extensions: [".m", ".mm"], iconId: "objective-c" },
    { name: "Perl", extensions: [".pl", ".pm"], iconId: "perl" },
    { name: "PHP", extensions: [".php", ".phtml"], iconId: "php" },
    { name: "Scala", extensions: [".scala", ".sc"], iconId: "scala" },
    { name: "Solidity", extensions: [".sol"], iconId: "solidity" },
    { name: "Zig", extensions: [".zig"], iconId: "zig" },
    { name: "C#", extensions: [".cs"], iconId: "csharp" },
    { name: "C++", extensions: [".cpp", ".cxx", ".cc", ".c++", ".hpp", ".hxx", ".hh", ".h++"], iconId: "cpp" },
    { name: "Erlang", extensions: [".erl", ".hrl"], iconId: "erlang" },
    { name: "Fortran", extensions: [".f", ".f90", ".f95", ".f03", ".f08"], iconId: "fortran" },
    { name: "GDScript", extensions: [".gd"], iconId: "gdscript" },
    { name: "Java", extensions: [".java"], iconId: "java" },
    { name: "Lua", extensions: [".lua"], iconId: "lua" },
    { name: "Swift", extensions: [".swift"], iconId: "swift" },
    { name: "TTCN-3", extensions: [".ttcn", ".ttcn3"], iconId: "ttcn3" },
    { name: "TypeScript", extensions: [".ts", ".tsx"], iconId: "typescript" },
    { name: "Vue", extensions: [".vue"], iconId: "vue" },
    { name: "JSON", extensions: [".json"], iconId: "json" },
    { name: "XML", extensions: [".xml"], iconId: "xml" },
    { name: "CSS", extensions: [".css"], iconId: "css" },
    { name: "Markdown", extensions: [".md", ".markdown"], iconId: "markdown" }
];
/**
 * Create a map from file extension to language info for fast lookup
 */
exports.ExtensionToLanguageMap = new Map();
// Initialize the extension map
exports.SupportedLanguages.forEach(lang => {
    lang.extensions.forEach(ext => {
        exports.ExtensionToLanguageMap.set(ext.toLowerCase(), lang);
    });
});
/**
 * Get language info for a file path based on its extension
 * @param filePath The file path to analyze
 * @returns Language info or null if not recognized
 */
function getLanguageForFile(filePath) {
    const extension = getFileExtension(filePath);
    return exports.ExtensionToLanguageMap.get(extension) || null;
}
/**
 * Extract file extension from a file path
 * @param filePath The file path
 * @returns The lowercase extension including the dot (e.g., ".js")
 */
function getFileExtension(filePath) {
    const lastDot = filePath.lastIndexOf('.');
    if (lastDot === -1 || lastDot === filePath.length - 1) {
        return '';
    }
    return filePath.substring(lastDot).toLowerCase();
}
/**
 * Get all supported language names
 */
function getAllLanguageNames() {
    return exports.SupportedLanguages.map(lang => lang.name);
}
/**
 * Check if a language is supported
 */
function isLanguageSupported(languageName) {
    return exports.SupportedLanguages.some(lang => lang.name === languageName);
}
//# sourceMappingURL=languageMetadata.js.map