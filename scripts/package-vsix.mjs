import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(scriptDir, '..');
const packageJson = JSON.parse(readFileSync(resolve(workspaceRoot, 'package.json'), 'utf8'));
const outputDir = resolve(workspaceRoot, 'artifacts');
const outputPath = resolve(outputDir, `code-xr-${packageJson.version}.vsix`);
const vsceEntrypoint = resolve(workspaceRoot, 'node_modules', '@vscode', 'vsce', 'vsce');
const nodeCommand = process.execPath;
const staleDistCertsPath = resolve(workspaceRoot, 'dist', 'certs');

if (Array.isArray(packageJson.files) && packageJson.files.includes('certs/**/*')) {
    console.error('VSIX packaging is blocked because package.json still includes certs/**/* in the published files list.');
    process.exit(1);
}

if (existsSync(staleDistCertsPath)) {
    rmSync(staleDistCertsPath, { recursive: true, force: true });
    console.log(`Removed stale dist certificate directory before packaging: ${staleDistCertsPath}`);
}

// Source maps are a dev-build aid (webpack keeps emitting them for F5), but
// they are dead weight in the shipped package — the extension.js.map alone is
// ~3.5 MB — and vsce's `files` allowlist does not support negated patterns.
// Strip them from dist right before packaging; the next `npm run compile`
// regenerates them.
function removeSourceMaps(dir) {
    let removed = 0;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const entryPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            removed += removeSourceMaps(entryPath);
        } else if (entry.name.endsWith('.map')) {
            rmSync(entryPath, { force: true });
            removed += 1;
        }
    }
    return removed;
}
const distPath = resolve(workspaceRoot, 'dist');
if (existsSync(distPath)) {
    const removedMaps = removeSourceMaps(distPath);
    if (removedMaps > 0) {
        console.log(`Removed ${removedMaps} source map(s) from dist before packaging.`);
    }
}

mkdirSync(outputDir, { recursive: true });

const child = spawn(
    nodeCommand,
    [vsceEntrypoint, 'package', '--out', outputPath],
    {
        cwd: workspaceRoot,
        stdio: 'inherit',
        shell: false,
        // vsce's vscode:prepublish hook re-runs webpack AFTER the .map sweep
        // above — this tells that rebuild to emit no source maps at all.
        env: { ...process.env, CODEXR_NO_SOURCEMAPS: '1' },
    },
);

child.on('exit', (code) => {
    if (code === 0) {
        console.log(`VSIX package created at ${outputPath}`);
        process.exit(0);
    }

    process.exit(code ?? 1);
});

child.on('error', (error) => {
    console.error(`Failed to start VSIX packaging via ${vsceEntrypoint}:`, error);
    process.exit(1);
});
