// Hashes what the extension ships from dist/, so a cleanup commit can PROVE it
// changed nothing (or exactly what it meant to).
//
//   CODEXR_NO_SOURCEMAPS=1 npm run package
//   node scripts/dist-fingerprint.mjs --out before.json
//   ...make the change, rebuild the same way...
//   node scripts/dist-fingerprint.mjs --out after.json
//   node scripts/dist-diff.mjs before.json after.json --expect-identical-bundle
//
// The production build is deterministic (two builds of the same tree give the
// same sha256), which is what makes this a proof rather than a smoke test.
// Compare fingerprints taken on the SAME machine: the working tree is CRLF on
// Windows and LF elsewhere, and the copied templates differ accordingly.
// It only reads and hashes; it never builds anything.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function listFiles(directory) {
    const files = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const entryPath = join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...listFiles(entryPath));
        } else if (entry.isFile()) {
            files.push(entryPath);
        }
    }
    return files;
}

/**
 * @param {string} distDirectory absolute path of a dist/ directory
 * @returns {{ schemaVersion: 1, bundle: { path: string, sha256: string, bytes: number } | null, fileCount: number, totalBytes: number, files: Record<string, string> }}
 */
export function fingerprintDist(distDirectory) {
    if (!existsSync(distDirectory) || !statSync(distDirectory).isDirectory()) {
        throw new Error(`${distDirectory} does not exist. Build first: CODEXR_NO_SOURCEMAPS=1 npm run package`);
    }

    const files = {};
    let totalBytes = 0;
    let bundle = null;
    for (const file of listFiles(distDirectory).sort()) {
        const content = readFileSync(file);
        const sha256 = createHash('sha256').update(content).digest('hex');
        const relativePath = relative(distDirectory, file).split(sep).join('/');
        files[relativePath] = sha256;
        totalBytes += content.length;
        if (relativePath === 'extension.js') {
            bundle = { path: relativePath, sha256, bytes: content.length };
        }
    }

    return { schemaVersion: 1, bundle, fileCount: Object.keys(files).length, totalBytes, files };
}

function main(argv) {
    const outIndex = argv.indexOf('--out');
    const distIndex = argv.indexOf('--dist');
    const distDirectory = resolve(distIndex >= 0 ? argv[distIndex + 1] : join(workspaceRoot, 'dist'));
    const fingerprint = fingerprintDist(distDirectory);
    const json = `${JSON.stringify(fingerprint, null, 2)}\n`;

    if (outIndex >= 0) {
        writeFileSync(resolve(argv[outIndex + 1]), json);
        const bundle = fingerprint.bundle ? `${fingerprint.bundle.sha256.slice(0, 12)} (${fingerprint.bundle.bytes} bytes)` : 'MISSING';
        console.log(`dist fingerprint: extension.js ${bundle}, ${fingerprint.fileCount} files, ${fingerprint.totalBytes} bytes -> ${argv[outIndex + 1]}`);
    } else {
        process.stdout.write(json);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    try {
        main(process.argv.slice(2));
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}
