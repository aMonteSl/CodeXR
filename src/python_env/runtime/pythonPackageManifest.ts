export interface CodeXRPythonPackage {
    distribution: string;
    importName: string;
    version: string;
    purpose: string;
    verificationArgs: string[];
}

export const CODEXR_PYTHON_PACKAGES: readonly CodeXRPythonPackage[] = [
    {
        distribution: 'lizard',
        importName: 'lizard',
        version: '1.17.31',
        purpose: 'code complexity analysis',
        verificationArgs: ['-m', 'lizard', '--version'],
    },
    {
        distribution: 'tree-sitter-language-pack',
        importName: 'tree_sitter_language_pack',
        version: '1.8.1',
        purpose: 'structured multi-language dependency parsing',
        verificationArgs: ['-c', 'from tree_sitter_language_pack import get_parser; get_parser("python"); print("ok")'],
    },
] as const;

export function getPinnedPythonRequirement(pkg: CodeXRPythonPackage): string {
    return `${pkg.distribution}==${pkg.version}`;
}
