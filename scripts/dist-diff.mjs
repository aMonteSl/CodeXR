// Compares two dist fingerprints (scripts/dist-fingerprint.mjs), or two copies of
// the bundle itself. These are the two characterization standards of a cleanup:
//
//   H1 - an unreachable file was deleted, or the change is types-only. Nothing
//        that ships may move:
//          node scripts/dist-diff.mjs before.json after.json --expect-identical-bundle
//        Deleting a copied asset (a .py, a template) removes files from dist/ by
//        design; name them and everything else must still be identical:
//          ... --expect-identical-bundle --allow-removed code_analysis/python/examples/
//
//   H2 - a dead declaration was removed from a LIVE file. The bundle must shrink
//        and nothing may appear that the commit message cannot explain. Use the
//        unminified build (`npm run compile`) and keep a copy of the old bundle:
//          node scripts/dist-diff.mjs --bundle-lines before/extension.js dist/extension.js
//
// Exit code 0 means the expectation held; 1 means it did not.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** @returns {{ bundleIdentical: boolean, added: string[], removed: string[], changed: string[] }} */
export function diffFingerprints(before, after) {
    const beforeFiles = before.files || {};
    const afterFiles = after.files || {};
    const added = Object.keys(afterFiles).filter((file) => !(file in beforeFiles)).sort();
    const removed = Object.keys(beforeFiles).filter((file) => !(file in afterFiles)).sort();
    const changed = Object.keys(afterFiles).filter((file) => file in beforeFiles && beforeFiles[file] !== afterFiles[file]).sort();
    const bundleIdentical = Boolean(before.bundle && after.bundle && before.bundle.sha256 === after.bundle.sha256);
    return { bundleIdentical, added, removed, changed };
}

/**
 * H1 verdict. `allowRemoved` entries are exact paths, or directory prefixes ending in "/".
 * @returns {string[]} the violations; empty means the expectation held
 */
export function checkIdenticalBundle(diff, allowRemoved = []) {
    const isAllowed = (file) => allowRemoved.some((allowed) => (allowed.endsWith('/') ? file.startsWith(allowed) : file === allowed));
    const violations = [];
    if (!diff.bundleIdentical) {
        violations.push('extension.js changed: the bundle is not byte-identical');
    }
    for (const file of diff.changed.filter((entry) => entry !== 'extension.js')) {
        violations.push(`changed: ${file}`);
    }
    for (const file of diff.added) {
        violations.push(`added: ${file}`);
    }
    for (const file of diff.removed.filter((entry) => !isAllowed(entry))) {
        violations.push(`removed but not expected: ${file}`);
    }
    return violations;
}

/**
 * H2 numbers. Lines are compared as multisets: a line counts as inserted when
 * the new bundle has more copies of it than the old one. Moved code therefore
 * costs nothing, and webpack module-id renumbering shows up as inserted lines.
 */
export function diffBundleLines(beforeText, afterText) {
    const count = (text) => {
        const counts = new Map();
        for (const line of text.split(/\r?\n/)) {
            counts.set(line, (counts.get(line) || 0) + 1);
        }
        return counts;
    };
    const beforeCounts = count(beforeText);
    const afterCounts = count(afterText);
    const inserted = [];
    let insertedLines = 0;
    let deletedLines = 0;
    for (const [line, occurrences] of afterCounts) {
        const extra = occurrences - (beforeCounts.get(line) || 0);
        if (extra > 0) {
            insertedLines += extra;
            inserted.push(line);
        }
    }
    for (const [line, occurrences] of beforeCounts) {
        const missing = occurrences - (afterCounts.get(line) || 0);
        if (missing > 0) {
            deletedLines += missing;
        }
    }
    return {
        bytesBefore: Buffer.byteLength(beforeText),
        bytesAfter: Buffer.byteLength(afterText),
        insertedLines,
        deletedLines,
        inserted,
    };
}

function main(argv) {
    if (argv[0] === '--bundle-lines') {
        const result = diffBundleLines(readFileSync(resolve(argv[1]), 'utf8'), readFileSync(resolve(argv[2]), 'utf8'));
        console.log(`bundle: ${result.bytesBefore} -> ${result.bytesAfter} bytes (${result.bytesAfter - result.bytesBefore}), -${result.deletedLines} / +${result.insertedLines} lines`);
        for (const line of result.inserted.slice(0, 20)) {
            console.log(`  + ${line.trim().slice(0, 160)}`);
        }
        if (result.inserted.length > 20) {
            console.log(`  ... and ${result.inserted.length - 20} more inserted lines`);
        }
        // Shrinking with no insertion is the clean case; anything inserted has to be explained by a human.
        return result.bytesAfter <= result.bytesBefore && result.insertedLines === 0 ? 0 : 1;
    }

    const positional = argv.filter((argument, index) => !argument.startsWith('--') && argv[index - 1] !== '--allow-removed');
    if (positional.length !== 2) {
        console.error('usage: dist-diff.mjs <before.json> <after.json> [--expect-identical-bundle] [--allow-removed <path|dir/>]...');
        console.error('       dist-diff.mjs --bundle-lines <before/extension.js> <after/extension.js>');
        return 1;
    }
    const allowRemoved = argv.flatMap((argument, index) => (argument === '--allow-removed' ? [argv[index + 1]] : []));
    const before = JSON.parse(readFileSync(resolve(positional[0]), 'utf8'));
    const after = JSON.parse(readFileSync(resolve(positional[1]), 'utf8'));
    const diff = diffFingerprints(before, after);

    const sha = (fingerprint) => (fingerprint.bundle ? fingerprint.bundle.sha256.slice(0, 12) : 'missing');
    console.log(`extension.js: ${sha(before)} -> ${sha(after)} (${diff.bundleIdentical ? 'identical' : 'CHANGED'})`);
    console.log(`files: ${before.fileCount} -> ${after.fileCount} | added ${diff.added.length}, removed ${diff.removed.length}, changed ${diff.changed.length}`);
    for (const file of diff.removed) {
        console.log(`  - ${file}`);
    }
    for (const file of diff.added) {
        console.log(`  + ${file}`);
    }
    for (const file of diff.changed) {
        console.log(`  ~ ${file}`);
    }

    if (!argv.includes('--expect-identical-bundle')) {
        return 0;
    }
    const violations = checkIdenticalBundle(diff, allowRemoved);
    if (violations.length === 0) {
        console.log(`Characterization: dist-identical ${sha(after)}`);
        return 0;
    }
    console.error('H1 violated - something that ships changed:');
    for (const violation of violations) {
        console.error(`  - ${violation}`);
    }
    return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    process.exit(main(process.argv.slice(2)));
}
