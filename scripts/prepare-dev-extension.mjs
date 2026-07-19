import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDirectory, '..');
const devExtensionRoot = path.join(workspaceRoot, '.vscode-test', 'dev-extension');

const entriesToCopy = [
  'package.json',
  'LICENSE',
  'README.md',
  'CHANGELOG.md',
  'THIRD_PARTY_NOTICES.md',
  'dist',
  'templates',
  'resources',
  'docs',
  'examples',
];

function ensureInsideWorkspace(targetPath) {
  const relative = path.relative(workspaceRoot, targetPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside the workspace: ${targetPath}`);
  }
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function copyEntry(entry) {
  const source = path.join(workspaceRoot, entry);
  const destination = path.join(devExtensionRoot, entry);
  if (!await exists(source)) {
    return;
  }
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.cp(source, destination, {
    recursive: true,
    force: true,
    errorOnExist: false,
  });
}

async function verifyStagedBuild() {
  // The dev host debugs the STAGED copy, not dist/. A silent partial copy
  // here means debugging stale code, so prove the staging is byte-identical.
  const { createHash } = await import('node:crypto');
  const hashOf = async (file) => createHash('sha256').update(await fs.readFile(file)).digest('hex').slice(0, 12);
  const source = path.join(workspaceRoot, 'dist', 'extension.js');
  const staged = path.join(devExtensionRoot, 'dist', 'extension.js');
  const [sourceHash, stagedHash] = await Promise.all([hashOf(source), hashOf(staged)]);
  if (sourceHash !== stagedHash) {
    throw new Error(`[Code-XR Fix] Staged dev extension does not match dist/ (${stagedHash} != ${sourceHash})`);
  }
  return sourceHash;
}

async function main() {
  ensureInsideWorkspace(devExtensionRoot);
  await fs.rm(devExtensionRoot, { recursive: true, force: true });
  await fs.mkdir(devExtensionRoot, { recursive: true });
  for (const entry of entriesToCopy) {
    await copyEntry(entry);
  }
  const buildHash = await verifyStagedBuild();
  console.log(`[Code-XR Fix] Prepared isolated dev extension at ${devExtensionRoot} (build ${buildHash})`);
}

await main();
