'use strict';

/**
 * Helpers for the suites that assert over SOURCE TEXT (readFileSync + regex)
 * instead of executing code. See "Source-text assertions" in test/README.md for
 * when that is the right tool and how each kind of pin must be treated.
 *
 * They exist for two failure modes of hand-rolled text assertions:
 *  - A negative assertion ("this file must not contain X") goes vacuous the day
 *    the code it guards moves to another file: it keeps passing while looking
 *    at the wrong text. `assertAbsent` demands a canary that proves the
 *    haystack is still the right code, and `readConcatenated` lets a guard
 *    follow code across a file split.
 *  - The working tree is CRLF on Windows and LF elsewhere. Every reader here
 *    returns LF text, so a pattern never depends on the checkout.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const SKIPPED_DIRECTORIES = new Set(['node_modules', '.git', 'artifacts', 'dist', 'out', 'output', '.vscode-test', '__pycache__']);

function toAbsolute(posixPath) {
    return path.join(projectRoot, ...posixPath.split('/'));
}

function toPosix(absolutePath) {
    return path.relative(projectRoot, absolutePath).split(path.sep).join('/');
}

function normalizeEol(text) {
    return text.replace(/\r\n?/g, '\n');
}

/** Reads one project file (posix path relative to the repo root) as LF text. */
function readSource(posixPath) {
    const absolutePath = toAbsolute(posixPath);
    if (!fs.existsSync(absolutePath)) {
        throw new Error(
            `${posixPath} was deleted or moved. A test reads it as text: update this test in the same commit `
            + '(retarget it to the successor files, or remove the assertion together with the code it pinned).',
        );
    }
    return normalizeEol(fs.readFileSync(absolutePath, 'utf8'));
}

/** Reads several files as one LF haystack, so a guard can follow code across a file split. */
function readConcatenated(posixPaths) {
    assert.ok(Array.isArray(posixPaths) && posixPaths.length > 0, 'readConcatenated needs at least one path');
    return posixPaths.map((posixPath) => readSource(posixPath)).join('\n');
}

/** Lists the files under a project directory as sorted posix paths. */
function collectFiles(posixDirectory, options = {}) {
    const extensions = options.extensions || [];
    const exclude = options.exclude || (() => false);
    const files = [];
    const pending = [toAbsolute(posixDirectory)];

    while (pending.length > 0) {
        const current = pending.pop();
        if (!fs.existsSync(current)) {
            continue;
        }
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const entryPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                if (!SKIPPED_DIRECTORIES.has(entry.name)) {
                    pending.push(entryPath);
                }
                continue;
            }
            const posixPath = toPosix(entryPath);
            const extensionMatches = extensions.length === 0 || extensions.some((extension) => entry.name.endsWith(extension));
            if (entry.isFile() && extensionMatches && !exclude(posixPath)) {
                files.push(posixPath);
            }
        }
    }

    return files.sort();
}

/** Reads a whole directory tree as one LF haystack. */
function readSourceTree(posixDirectory, options = {}) {
    const files = collectFiles(posixDirectory, options);
    assert.ok(files.length > 0, `${posixDirectory} contains no matching files`);
    return readConcatenated(files);
}

/**
 * Asserts that `pattern` does not occur in `text`. The canary is mandatory and
 * must match: it proves the haystack still holds the code the guard is about,
 * so the assertion cannot go vacuous when that code moves.
 */
function assertAbsent(text, pattern, options) {
    assert.ok(options && options.canary, 'assertAbsent needs a canary that must be present in the haystack');
    assert.match(text, options.canary, 'canary not found: this negative assertion is looking at the wrong text');
    assert.doesNotMatch(text, pattern, options.message);
}

/** Asserts that every pattern occurs, each one after the previous match. */
function assertOrdered(text, patterns) {
    let offset = 0;
    for (const pattern of patterns) {
        const expression = typeof pattern === 'string'
            ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            : new RegExp(pattern.source, pattern.flags.replace('g', ''));
        const match = expression.exec(text.slice(offset));
        assert.ok(match, `${pattern} not found after offset ${offset}`);
        offset += match.index + match[0].length;
    }
}

module.exports = {
    projectRoot,
    normalizeEol,
    readSource,
    readConcatenated,
    collectFiles,
    readSourceTree,
    assertAbsent,
    assertOrdered,
};
