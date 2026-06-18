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

async function main() {
  ensureInsideWorkspace(devExtensionRoot);
  await fs.rm(devExtensionRoot, { recursive: true, force: true });
  await fs.mkdir(devExtensionRoot, { recursive: true });
  for (const entry of entriesToCopy) {
    await copyEntry(entry);
  }
  console.log(`Prepared isolated CodeXR dev extension at ${devExtensionRoot}`);
}

await main();
