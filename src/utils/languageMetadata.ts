/**
 * Language metadata for file detection and visualization
 * Maps file extensions to language information including VS Code icons
 */

export interface LanguageInfo {
    name: string;
    extensions: string[];
    iconId: string;
}

/**
 * Supported languages with their file extensions and VS Code icon IDs
 * CodeXR Programming Languages Support
 */
export const SupportedLanguages: LanguageInfo[] = [
    { name: "Python", extensions: [".py", ".pyw", ".pyi"], iconId: "python" },
    { name: "Ruby", extensions: [".rb", ".rbw"], iconId: "ruby" },
    { name: "Java", extensions: [".java"], iconId: "java" },
    { name: "C", extensions: [".c", ".h"], iconId: "c" },
    { name: "C++", extensions: [".cpp", ".cxx", ".cc", ".c++", ".hpp", ".hxx", ".hh", ".h++"], iconId: "cpp" },
    { name: "C#", extensions: [".cs"], iconId: "csharp" },
    { name: "Erlang", extensions: [".erl", ".hrl"], iconId: "erlang" },
    { name: "Fortran", extensions: [".f", ".f90", ".f95", ".f03", ".f08"], iconId: "fortran" },
    { name: "GDScript", extensions: [".gd"], iconId: "gdscript" },
    { name: "Go", extensions: [".go"], iconId: "go" },
    { name: "JavaScript", extensions: [".js", ".mjs", ".cjs"], iconId: "javascript" },
    { name: "Kotlin", extensions: [".kt", ".kts"], iconId: "kotlin" },
    { name: "Lua", extensions: [".lua"], iconId: "lua" },
    { name: "Objective-C", extensions: [".m", ".mm"], iconId: "objective-c" },
    { name: "PHP", extensions: [".php", ".phtml", ".php3", ".php4", ".php5"], iconId: "php" },
    { name: "Perl", extensions: [".pl", ".pm"], iconId: "perl" },
    { name: "Scala", extensions: [".scala", ".sc"], iconId: "scala" },
    { name: "Solidity", extensions: [".sol"], iconId: "solidity" },
    { name: "Swift", extensions: [".swift"], iconId: "swift" },
    { name: "TypeScript", extensions: [".ts", ".tsx"], iconId: "typescript" },
    { name: "TTCN-3", extensions: [".ttcn", ".ttcn3"], iconId: "ttcn3" },
    { name: "Vue", extensions: [".vue"], iconId: "vue" },
    { name: "Zig", extensions: [".zig"], iconId: "zig" }
];

/**
 * Create a map from file extension to language info for fast lookup
 */
export const ExtensionToLanguageMap = new Map<string, LanguageInfo>();

// Initialize the extension map
SupportedLanguages.forEach(lang => {
    lang.extensions.forEach(ext => {
        ExtensionToLanguageMap.set(ext.toLowerCase(), lang);
    });
});

/**
 * Get language info for a file path based on its extension
 * @param filePath The file path to analyze
 * @returns Language info or null if not recognized
 */
export function getLanguageForFile(filePath: string): LanguageInfo | null {
    const extension = getFileExtension(filePath);
    return ExtensionToLanguageMap.get(extension) || null;
}

/**
 * Extract file extension from a file path
 * @param filePath The file path
 * @returns The lowercase extension including the dot (e.g., ".js")
 */
function getFileExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.');
    if (lastDot === -1 || lastDot === filePath.length - 1) {
        return '';
    }
    return filePath.substring(lastDot).toLowerCase();
}

/**
 * Get all supported language names
 */
export function getAllLanguageNames(): string[] {
    return SupportedLanguages.map(lang => lang.name);
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(languageName: string): boolean {
    return SupportedLanguages.some(lang => lang.name === languageName);
}
