import { mkdirSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(scriptDir, '..');
const packageJson = JSON.parse(readFileSync(resolve(workspaceRoot, 'package.json'), 'utf8'));
const outputDir = resolve(workspaceRoot, 'artifacts');
const outputPath = resolve(outputDir, `code-xr-${packageJson.version}.vsix`);
const vsceEntrypoint = resolve(workspaceRoot, 'node_modules', '@vscode', 'vsce', 'vsce');
const nodeCommand = process.execPath;

mkdirSync(outputDir, { recursive: true });

const child = spawn(
    nodeCommand,
    [vsceEntrypoint, 'package', '--out', outputPath],
    {
        cwd: workspaceRoot,
        stdio: 'inherit',
        shell: false,
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
