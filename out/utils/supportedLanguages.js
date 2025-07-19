"use strict";
/**
 * Supported languages configuration for file detection and analysis
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORTED_LANGUAGES = void 0;
exports.getLanguageByExtension = getLanguageByExtension;
exports.getAllSupportedExtensions = getAllSupportedExtensions;
exports.isSupportedExtension = isSupportedExtension;
exports.getLanguageStats = getLanguageStats;
exports.SUPPORTED_LANGUAGES = {
    // Web Technologies
    html: {
        extensions: ['.html', '.htm'],
        name: 'HTML'
    },
    javascript: {
        extensions: ['.js', '.mjs', '.cjs'],
        name: 'JavaScript'
    },
    typescript: {
        extensions: ['.ts', '.tsx'],
        name: 'TypeScript'
    },
    vue: {
        extensions: ['.vue'],
        name: 'Vue'
    },
    // Backend Languages
    python: {
        extensions: ['.py', '.pyw', '.pyi'],
        name: 'Python'
    },
    ruby: {
        extensions: ['.rb', '.rbw'],
        name: 'Ruby'
    },
    php: {
        extensions: ['.php', '.phtml', '.php3', '.php4', '.php5'],
        name: 'PHP'
    },
    perl: {
        extensions: ['.pl', '.pm'],
        name: 'Perl'
    },
    // System Languages
    c: {
        extensions: ['.c', '.h'],
        name: 'C'
    },
    cplusplus: {
        extensions: ['.cpp', '.cxx', '.cc', '.hpp', '.hxx'],
        name: 'C++'
    },
    csharp: {
        extensions: ['.cs'],
        name: 'C#'
    },
    go: {
        extensions: ['.go'],
        name: 'Go'
    },
    rust: {
        extensions: ['.rs'],
        name: 'Rust'
    },
    zig: {
        extensions: ['.zig'],
        name: 'Zig'
    },
    // JVM Languages
    java: {
        extensions: ['.java'],
        name: 'Java'
    },
    kotlin: {
        extensions: ['.kt', '.kts'],
        name: 'Kotlin'
    },
    scala: {
        extensions: ['.scala', '.sc'],
        name: 'Scala'
    },
    // Mobile
    objectivec: {
        extensions: ['.m', '.mm'],
        name: 'Objective-C'
    },
    swift: {
        extensions: ['.swift'],
        name: 'Swift'
    },
    // Scripting
    lua: {
        extensions: ['.lua'],
        name: 'Lua'
    },
    // Specialized
    solidity: {
        extensions: ['.sol'],
        name: 'Solidity'
    },
    gdscript: {
        extensions: ['.gd'],
        name: 'GDScript'
    },
    ttcn3: {
        extensions: ['.ttcn', '.ttcn3'],
        name: 'TTCN-3'
    },
    erlang: {
        extensions: ['.erl', '.hrl'],
        name: 'Erlang'
    },
    fortran: {
        extensions: ['.f90', '.f95', '.f03', '.f08', '.f'],
        name: 'Fortran'
    }
};
/**
 * Get language configuration by file extension
 */
function getLanguageByExtension(extension) {
    const normalizedExt = extension.toLowerCase();
    for (const [key, config] of Object.entries(exports.SUPPORTED_LANGUAGES)) {
        if (config.extensions.includes(normalizedExt)) {
            return { ...config, icon: key }; // Add the key as icon identifier
        }
    }
    return null;
}
/**
 * Get all supported extensions as a flat array
 */
function getAllSupportedExtensions() {
    return Object.values(exports.SUPPORTED_LANGUAGES)
        .flatMap(config => config.extensions);
}
/**
 * Check if a file extension is supported
 */
function isSupportedExtension(extension) {
    return getLanguageByExtension(extension) !== null;
}
/**
 * Get language statistics for logging
 */
function getLanguageStats() {
    const languages = Object.keys(exports.SUPPORTED_LANGUAGES);
    const extensions = getAllSupportedExtensions();
    return {
        totalLanguages: languages.length,
        totalExtensions: extensions.length
    };
}
//# sourceMappingURL=supportedLanguages.js.map