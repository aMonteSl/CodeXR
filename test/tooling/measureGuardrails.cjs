'use strict';

/**
 * Measures the code-health metrics that v1.2.1 is cleaning up, straight from
 * the TypeScript AST (parse only, no type-checking, ~2 s).
 *
 *   node test/tooling/measureGuardrails.cjs            print the measurement
 *   node test/tooling/measureGuardrails.cjs --write    regenerate the baseline
 *
 * The committed baseline (guardrail-baseline.json) is the "before" number of
 * every cleanup item: a commit that moves a metric regenerates the baseline,
 * and that diff is the item's recorded before/after.
 *
 * Counting units are this script's own and are spelled out in `definitions`;
 * they deliberately do not claim parity with ESLint or Lizard.
 */

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..', '..');
const baselinePath = path.join(__dirname, 'guardrail-baseline.json');
const SK = ts.SyntaxKind;

const CONSOLE_METHODS = new Set(['log', 'warn', 'error', 'debug', 'info', 'trace']);
const SUPPRESSION_PATTERN = /@ts-ignore|@ts-expect-error|@ts-nocheck|eslint-disable/g;
const LARGE_FILE_LINES = 500;
const LONG_FUNCTION_LINES = 80;
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', 'out', 'output', 'artifacts', '.vscode-test', '__pycache__']);

const definitions = {
    'console.total': 'CallExpression nodes whose callee is console.<log|warn|error|debug|info|trace> in src/**/*.ts (console calls inside template strings are text, not nodes, and are not counted)',
    'console.byModule': 'console.total grouped by the first directory under src/ (files directly in src/ count as "(root)")',
    'catch.consoleOnly': 'catch clauses with at least one statement where every statement is a console.* call',
    'catch.emptyNoComment': 'catch clauses with an empty block that also carries no comment explaining the swallow',
    'any.total': 'AnyKeyword type nodes in src/**/*.ts (": any", "as any", "<any>", "any[]", generic arguments)',
    'any.byModule': 'any.total grouped like console.byModule',
    'suppressions.total': 'occurrences of @ts-ignore, @ts-expect-error, @ts-nocheck or eslint-disable in src/**/*.ts',
    'size.filesOver500': `src files with more than ${LARGE_FILE_LINES} physical lines`,
    'functions.over80Lines': `function-like nodes with a body spanning more than ${LONG_FUNCTION_LINES} physical lines`,
    'complexity.overN': 'function-like nodes whose CCN exceeds N, where CCN = 1 + if + for/for-in/for-of + while + do + catch + ?: + case + && + || + ??, nested functions measured separately',
    'reachability.unreachable': 'src modules with no import, export-from, import(), require() or import-type path from src/extension.ts (relative specifiers only)',
    'templates.consoleLog': 'console.log( occurrences in templates/**/*.js, excluding the xr-chart-debug runtime whose console output is its tested contract',
    'eslint.maxWarnings': 'the --max-warnings value of the package.json "lint" script, or null when the script has none',
    'commands.internalByKind': 'registered-but-uncontributed commands in test/commands/internalCommandIds.cjs, per kind; "pending-removal" is the unreachable debt',
};

function toPosix(filePath) {
    return path.relative(projectRoot, filePath).split(path.sep).join('/');
}

function collectFiles(root, extensions) {
    const files = [];
    const stack = [path.join(projectRoot, root)];
    while (stack.length > 0) {
        const current = stack.pop();
        if (!fs.existsSync(current)) {
            continue;
        }
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                if (!SKIPPED_DIRECTORIES.has(entry.name)) {
                    stack.push(fullPath);
                }
                continue;
            }
            if (entry.isFile() && extensions.some((extension) => entry.name.endsWith(extension)) && !entry.name.endsWith('.d.ts')) {
                files.push(fullPath);
            }
        }
    }
    return files.sort();
}

function moduleOf(posixPath) {
    const segments = posixPath.split('/');
    return segments.length > 2 ? segments[1] : '(root)';
}

function isFunctionLike(node) {
    return ts.isFunctionDeclaration(node)
        || ts.isMethodDeclaration(node)
        || ts.isArrowFunction(node)
        || ts.isFunctionExpression(node)
        || ts.isConstructorDeclaration(node)
        || ts.isGetAccessor(node)
        || ts.isSetAccessor(node);
}

function isConsoleCall(node) {
    return ts.isCallExpression(node)
        && ts.isPropertyAccessExpression(node.expression)
        && ts.isIdentifier(node.expression.expression)
        && node.expression.expression.text === 'console'
        && CONSOLE_METHODS.has(node.expression.name.text);
}

function cyclomaticComplexity(functionNode) {
    let complexity = 1;
    const visit = (node) => {
        if (node !== functionNode && isFunctionLike(node)) {
            return;
        }
        switch (node.kind) {
            case SK.IfStatement:
            case SK.ForStatement:
            case SK.ForInStatement:
            case SK.ForOfStatement:
            case SK.WhileStatement:
            case SK.DoStatement:
            case SK.CatchClause:
            case SK.ConditionalExpression:
            case SK.CaseClause:
                complexity += 1;
                break;
            case SK.BinaryExpression: {
                const operator = node.operatorToken.kind;
                if (operator === SK.AmpersandAmpersandToken || operator === SK.BarBarToken || operator === SK.QuestionQuestionToken) {
                    complexity += 1;
                }
                break;
            }
            default:
                break;
        }
        ts.forEachChild(node, visit);
    };
    visit(functionNode);
    return complexity;
}

function functionName(node) {
    if (node.name && typeof node.name.getText === 'function') {
        return node.name.getText();
    }
    const parent = node.parent;
    if (parent && (ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent)) && parent.name) {
        return parent.name.getText();
    }
    if (ts.isConstructorDeclaration(node)) {
        return 'constructor';
    }
    return '<anonymous>';
}

function resolveRelativeImport(fromFile, specifier) {
    const stripped = specifier.endsWith('.js') ? specifier.slice(0, -3) : specifier;
    const base = path.resolve(path.dirname(fromFile), stripped);
    for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), base]) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            return candidate;
        }
    }
    return undefined;
}

function importSpecifierOf(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
        return node.moduleSpecifier.text;
    }
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && ts.isStringLiteralLike(node.moduleReference.expression)) {
        return node.moduleReference.expression.text;
    }
    if (ts.isCallExpression(node) && node.arguments.length > 0 && ts.isStringLiteralLike(node.arguments[0])) {
        const isDynamicImport = node.expression.kind === SK.ImportKeyword;
        const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
        if (isDynamicImport || isRequire) {
            return node.arguments[0].text;
        }
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)) {
        return node.argument.literal.text;
    }
    return undefined;
}

function isConsoleOnlyCatch(catchClause) {
    const statements = catchClause.block.statements;
    return statements.length > 0
        && statements.every((statement) => ts.isExpressionStatement(statement) && isConsoleCall(statement.expression));
}

function isEmptyUncommentedCatch(catchClause, sourceText) {
    if (catchClause.block.statements.length > 0) {
        return false;
    }
    const blockText = sourceText.slice(catchClause.block.getStart(), catchClause.block.getEnd());
    return !/\/\/|\/\*/.test(blockText);
}

function increment(map, key, amount = 1) {
    map[key] = (map[key] || 0) + amount;
}

function sortedObject(map) {
    return Object.fromEntries(Object.keys(map).sort().map((key) => [key, map[key]]));
}

function topEntries(map, limit) {
    return Object.entries(map)
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, limit)
        .map(([file, count]) => ({ file, count }));
}

function measureSource() {
    const files = collectFiles('src', ['.ts', '.tsx']);
    const consoleByModule = {};
    const consoleByFile = {};
    const anyByModule = {};
    const anyByFile = {};
    const lineCounts = {};
    const functions = [];
    const graph = new Map();
    let consoleTotal = 0;
    let anyTotal = 0;
    let catchConsoleOnly = 0;
    let catchEmptyNoComment = 0;
    let suppressions = 0;
    let totalLines = 0;

    for (const file of files) {
        const posixPath = toPosix(file);
        const moduleName = moduleOf(posixPath);
        const text = fs.readFileSync(file, 'utf8');
        const lines = text.split('\n').length;
        const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true);
        const dependencies = new Set();

        lineCounts[posixPath] = lines;
        totalLines += lines;
        suppressions += (text.match(SUPPRESSION_PATTERN) || []).length;

        const visit = (node) => {
            if (isConsoleCall(node)) {
                consoleTotal += 1;
                increment(consoleByModule, moduleName);
                increment(consoleByFile, posixPath);
            }
            if (node.kind === SK.AnyKeyword) {
                anyTotal += 1;
                increment(anyByModule, moduleName);
                increment(anyByFile, posixPath);
            }
            if (ts.isCatchClause(node)) {
                if (isConsoleOnlyCatch(node)) {
                    catchConsoleOnly += 1;
                }
                if (isEmptyUncommentedCatch(node, text)) {
                    catchEmptyNoComment += 1;
                }
            }
            if (isFunctionLike(node) && node.body) {
                const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
                const endLine = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
                functions.push({
                    file: posixPath,
                    name: functionName(node),
                    line: startLine,
                    lines: endLine - startLine + 1,
                    ccn: cyclomaticComplexity(node),
                });
            }
            const specifier = importSpecifierOf(node);
            if (specifier && specifier.startsWith('.')) {
                const resolved = resolveRelativeImport(file, specifier);
                if (resolved) {
                    dependencies.add(resolved);
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
        graph.set(file, dependencies);
    }

    const entryPoint = path.join(projectRoot, 'src', 'extension.ts');
    const reachable = new Set([entryPoint]);
    const pending = [entryPoint];
    while (pending.length > 0) {
        for (const dependency of graph.get(pending.pop()) || []) {
            if (!reachable.has(dependency)) {
                reachable.add(dependency);
                pending.push(dependency);
            }
        }
    }
    const unreachable = files.filter((file) => !reachable.has(file)).map(toPosix);
    const overComplexity = (threshold) => functions.filter((entry) => entry.ccn > threshold).length;
    const largeFiles = Object.keys(lineCounts).filter((file) => lineCounts[file] > LARGE_FILE_LINES).sort();

    return {
        ratcheted: {
            'console.total': consoleTotal,
            'console.byModule': sortedObject(consoleByModule),
            'catch.consoleOnly': catchConsoleOnly,
            'catch.emptyNoComment': catchEmptyNoComment,
            'any.total': anyTotal,
            'any.byModule': sortedObject(anyByModule),
            'suppressions.total': suppressions,
            'size.filesOver500': largeFiles,
            'functions.over80Lines': functions.filter((entry) => entry.lines > LONG_FUNCTION_LINES).length,
            'complexity.over10': overComplexity(10),
            'complexity.over15': overComplexity(15),
            'complexity.over20': overComplexity(20),
            'complexity.over30': overComplexity(30),
            'reachability.unreachable': unreachable,
        },
        informational: {
            'src.files': files.length,
            'src.lines': totalLines,
            'src.functions': functions.length,
            'src.unreachableLines': unreachable.reduce((sum, file) => sum + lineCounts[file], 0),
            'console.topFiles': topEntries(consoleByFile, 15),
            'any.topFiles': topEntries(anyByFile, 15),
            'complexity.worst10': functions
                .slice()
                .sort((left, right) => right.ccn - left.ccn || left.file.localeCompare(right.file) || left.line - right.line)
                .slice(0, 10)
                .map((entry) => ({ ccn: entry.ccn, lines: entry.lines, function: entry.name, file: entry.file })),
            'size.largest10': topEntries(lineCounts, 10).map((entry) => ({ file: entry.file, lines: entry.count })),
        },
    };
}

function measureTemplates() {
    const files = collectFiles('templates', ['.js']).filter((file) => !toPosix(file).includes('/xr-chart-debug/'));
    let consoleLog = 0;
    for (const file of files) {
        consoleLog += (fs.readFileSync(file, 'utf8').match(/console\.log\(/g) || []).length;
    }
    return consoleLog;
}

function measureLintMaxWarnings() {
    const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
    const match = /--max-warnings[= ](\d+)/.exec((manifest.scripts && manifest.scripts.lint) || '');
    return match ? Number(match[1]) : null;
}

function measureInternalCommands() {
    const listPath = path.join(projectRoot, 'test', 'commands', 'internalCommandIds.cjs');
    if (!fs.existsSync(listPath)) {
        return {};
    }
    const byKind = {};
    for (const entry of require(listPath).INTERNAL_COMMAND_IDS) {
        increment(byKind, entry.kind);
    }
    return sortedObject(byKind);
}

function measure() {
    const source = measureSource();
    source.ratcheted['templates.consoleLog'] = measureTemplates();
    source.ratcheted['eslint.maxWarnings'] = measureLintMaxWarnings();
    source.ratcheted['commands.internalByKind'] = measureInternalCommands();
    return {
        schemaVersion: 1,
        generatedBy: 'node test/tooling/measureGuardrails.cjs --write',
        definitions,
        ratcheted: source.ratcheted,
        informational: source.informational,
        waivers: [],
    };
}

function readBaseline() {
    return JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
}

/**
 * Compares two `ratcheted` blocks. Every metric is "lower is better": a bigger
 * number or a new list entry is WORSE; a smaller number or a vanished entry has
 * MOVED in the right direction. Both must show up in the committed baseline -
 * only a worse value is refused.
 */
function compareRatcheted(measured, baseline) {
    const worse = [];
    const moved = [];
    const record = (target, metric, from, to, detail) => target.push({ metric, from, to, detail });

    const compareNumber = (metric, from, to) => {
        if (from === to) {
            return;
        }
        if (from === null || from === undefined) {
            // A metric that starts being measured (a lint ceiling that did not exist) is progress.
            record(moved, metric, from, to, 'now measured');
        } else if (to === null || to === undefined) {
            record(worse, metric, from, to, 'no longer measured');
        } else {
            record(to > from ? worse : moved, metric, from, to);
        }
    };

    const metrics = new Set([...Object.keys(baseline), ...Object.keys(measured)]);
    for (const metric of [...metrics].sort()) {
        const from = baseline[metric];
        const to = measured[metric];

        if (from === undefined) {
            // A metric the baseline has never recorded cannot have regressed.
            record(moved, metric, 'not measured', Array.isArray(to) ? to.length : JSON.stringify(to), 'now measured');
            continue;
        }

        if (Array.isArray(from) || Array.isArray(to)) {
            const before = new Set(from || []);
            const after = new Set(to || []);
            const added = [...after].filter((entry) => !before.has(entry)).sort();
            const removed = [...before].filter((entry) => !after.has(entry)).sort();
            if (added.length > 0) {
                record(worse, metric, before.size, after.size, `new: ${added.join(', ')}`);
            }
            if (removed.length > 0) {
                record(moved, metric, before.size, after.size, `gone: ${removed.join(', ')}`);
            }
        } else if ((from && typeof from === 'object') || (to && typeof to === 'object')) {
            const keys = new Set([...Object.keys(from || {}), ...Object.keys(to || {})]);
            for (const key of [...keys].sort()) {
                const left = (from || {})[key] || 0;
                const right = (to || {})[key] || 0;
                if (metric === 'commands.internalByKind') {
                    // Only the unreachable ones are a debt; the rest is pinned by the contract test.
                    if (left !== right) {
                        record(key === 'pending-removal' && right > left ? worse : moved, `${metric}.${key}`, left, right);
                    }
                } else {
                    compareNumber(`${metric}.${key}`, left, right);
                }
            }
        } else {
            compareNumber(metric, from, to);
        }
    }
    return { worse, moved };
}

function describeChange(change) {
    const detail = change.detail ? ` (${change.detail})` : '';
    return `${change.metric}: ${change.from} -> ${change.to}${detail}`;
}

/**
 * Rewrites the baseline. A regression is refused unless it is explained:
 * `--allow-regression "<reason>"` records a waiver (the expected use is a new
 * lint rule that raises the warning ceiling once).
 */
function writeBaseline(measurement, options = {}) {
    const previous = fs.existsSync(baselinePath) ? readBaseline() : undefined;
    const waivers = previous ? previous.waivers.slice() : [];

    if (previous) {
        const { worse } = compareRatcheted(measurement.ratcheted, previous.ratcheted);
        if (worse.length > 0 && !options.allowRegression) {
            const error = new Error(
                `Refusing to write a baseline that is worse than the committed one:\n  - ${worse.map(describeChange).join('\n  - ')}\n`
                + 'Fix the regression, or rerun with --allow-regression "<reason>" to record a waiver.',
            );
            error.worse = worse;
            throw error;
        }
        for (const change of worse) {
            waivers.push({ metric: change.metric, from: change.from, to: change.to, reason: options.allowRegression, date: options.date });
        }
    }

    const next = { ...measurement, waivers };
    fs.writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`);
    return next;
}

if (require.main === module) {
    const measurement = measure();
    if (process.argv.includes('--write')) {
        const flagIndex = process.argv.indexOf('--allow-regression');
        const allowRegression = flagIndex >= 0 ? process.argv[flagIndex + 1] : undefined;
        if (flagIndex >= 0 && !allowRegression) {
            console.error('--allow-regression needs a reason.');
            process.exit(1);
        }
        try {
            writeBaseline(measurement, { allowRegression, date: new Date().toISOString().slice(0, 10) });
            console.log(`Baseline written to ${toPosix(baselinePath)}`);
        } catch (error) {
            console.error(error.message);
            process.exit(1);
        }
    } else {
        console.log(JSON.stringify(measurement, null, 2));
    }
}

module.exports = { measure, readBaseline, writeBaseline, compareRatcheted, describeChange, baselinePath, definitions };
