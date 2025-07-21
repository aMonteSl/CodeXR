/**
 * Supported languages configuration for file detection and analysis
 */

export interface LanguageConfig {
    extensions: string[];
    name: string;
    icon?: string; // Optional custom icon name
}

export const SUPPORTED_LANGUAGES: Record<string, LanguageConfig> = {
    // Programming Languages - CodeXR Supported
    python: { 
        extensions: ['.py', '.pyw', '.pyi'], 
        name: 'Python' 
    },
    ruby: { 
        extensions: ['.rb', '.rbw'], 
        name: 'Ruby' 
    },
    java: { 
        extensions: ['.java'], 
        name: 'Java' 
    },
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
    erlang: { 
        extensions: ['.erl', '.hrl'], 
        name: 'Erlang' 
    },
    fortran: { 
        extensions: ['.f90', '.f95', '.f03', '.f08', '.f'], 
        name: 'Fortran' 
    },
    gdscript: { 
        extensions: ['.gd'], 
        name: 'GDScript' 
    },
    go: { 
        extensions: ['.go'], 
        name: 'Go' 
    },
    javascript: { 
        extensions: ['.js', '.mjs', '.cjs'], 
        name: 'JavaScript' 
    },
    kotlin: { 
        extensions: ['.kt', '.kts'], 
        name: 'Kotlin' 
    },
    lua: { 
        extensions: ['.lua'], 
        name: 'Lua' 
    },
    objectivec: { 
        extensions: ['.m', '.mm'], 
        name: 'Objective-C' 
    },
    php: { 
        extensions: ['.php', '.phtml', '.php3', '.php4', '.php5'], 
        name: 'PHP' 
    },
    perl: { 
        extensions: ['.pl', '.pm'], 
        name: 'Perl' 
    },
    scala: { 
        extensions: ['.scala', '.sc'], 
        name: 'Scala' 
    },
    solidity: { 
        extensions: ['.sol'], 
        name: 'Solidity' 
    },
    swift: { 
        extensions: ['.swift'], 
        name: 'Swift' 
    },
    typescript: { 
        extensions: ['.ts', '.tsx'], 
        name: 'TypeScript' 
    },
    ttcn3: { 
        extensions: ['.ttcn', '.ttcn3'], 
        name: 'TTCN-3' 
    },
    vue: { 
        extensions: ['.vue'], 
        name: 'Vue' 
    },
    zig: { 
        extensions: ['.zig'], 
        name: 'Zig' 
    }
};

/**
 * Get language configuration by file extension
 */
export function getLanguageByExtension(extension: string): LanguageConfig | null {
    const normalizedExt = extension.toLowerCase();
    
    for (const [key, config] of Object.entries(SUPPORTED_LANGUAGES)) {
        if (config.extensions.includes(normalizedExt)) {
            return { ...config, icon: key }; // Add the key as icon identifier
        }
    }
    
    return null;
}

/**
 * Get all supported extensions as a flat array
 */
export function getAllSupportedExtensions(): string[] {
    return Object.values(SUPPORTED_LANGUAGES)
        .flatMap(config => config.extensions);
}

/**
 * Check if a file extension is supported
 */
export function isSupportedExtension(extension: string): boolean {
    return getLanguageByExtension(extension) !== null;
}

/**
 * Get language statistics for logging
 */
export function getLanguageStats(): { totalLanguages: number; totalExtensions: number } {
    const languages = Object.keys(SUPPORTED_LANGUAGES);
    const extensions = getAllSupportedExtensions();
    
    return {
        totalLanguages: languages.length,
        totalExtensions: extensions.length
    };
}
