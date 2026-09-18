const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    createFakeVscode,
    fakeExtensionContext,
    withFakeVscode,
    ExtensionMode,
} = require('./fakeVscode.cjs');

const projectRoot = path.resolve(__dirname, '..', '..');
const compiledLogger = path.join(projectRoot, 'out', 'core', 'logging', 'logger.js');

function requireVscodeOutsideTheScope() {
    // Resolved through Module._load like any other request: once the scope is
    // closed this must fail again, exactly as it does in a plain Node process.
    return require('vscode');
}

test('enums carry the real VS Code values', () => {
    const { vscode } = createFakeVscode();

    // The one ad-hoc stub this helper replaces had Development and Production swapped.
    assert.deepEqual({ ...vscode.ExtensionMode }, { Production: 1, Development: 2, Test: 3 });
    assert.deepEqual({ ...vscode.TreeItemCollapsibleState }, { None: 0, Collapsed: 1, Expanded: 2 });
    assert.deepEqual({ ...vscode.ConfigurationTarget }, { Global: 1, Workspace: 2, WorkspaceFolder: 3 });
    assert.equal(vscode.ProgressLocation.Notification, 15);
    assert.equal(vscode.ViewColumn.Beside, -2);
});

test('a compiled module that imports vscode loads and runs inside the scope', () => {
    const fake = createFakeVscode();
    const context = fakeExtensionContext({ extensionMode: ExtensionMode.Development });

    try {
        withFakeVscode(fake, ({ requireOut }) => {
            const { CodeXRLogger } = requireOut('core/logging/logger.js');
            CodeXRLogger.initialize(context);
            CodeXRLogger.getLogger('PROBE').warn('loaded under the fake');
        });

        const channel = fake.channels.get('CodeXR');
        assert.ok(channel, 'the module created its output channel through the fake');
        assert.equal(channel.lines.length, 1);
        assert.match(channel.lines[0], /^\[[^\]]+\] \[WARN\] \[PROBE\] loaded under the fake$/);
        assert.ok(context.subscriptions.length >= 1);
    } finally {
        context.cleanup();
    }
});

test('the scope always closes: the hook is restored and compiled modules are evicted', async () => {
    const fake = createFakeVscode();

    // sync callback
    withFakeVscode(fake, ({ requireOut }) => {
        requireOut('core/logging/logger.js');
        assert.ok(require.cache[compiledLogger], 'cached while the scope is open');
    });
    assert.equal(require.cache[compiledLogger], undefined, 'evicted: a singleton bound to a dead fake must not reach the next suite');
    assert.throws(requireVscodeOutsideTheScope, /Cannot find module 'vscode'/);

    // async callback: cleanup waits for the promise
    let releaseCallback;
    const pending = withFakeVscode(fake, async ({ requireOut }) => {
        requireOut('core/logging/logger.js');
        await new Promise((resolve) => { releaseCallback = resolve; });
        return 'done';
    });
    assert.ok(require.cache[compiledLogger], 'still cached while the async callback is pending');
    releaseCallback();
    assert.equal(await pending, 'done');
    assert.equal(require.cache[compiledLogger], undefined);
    assert.throws(requireVscodeOutsideTheScope, /Cannot find module 'vscode'/);

    // a throwing callback
    assert.throws(() => withFakeVscode(fake, () => { throw new Error('boom'); }), /boom/);
    assert.throws(requireVscodeOutsideTheScope, /Cannot find module 'vscode'/);
    await assert.rejects(withFakeVscode(fake, async () => { throw new Error('async boom'); }), /async boom/);
    assert.throws(requireVscodeOutsideTheScope, /Cannot find module 'vscode'/);
});

test('modules that were already cached before the scope are left alone', () => {
    const policyPath = path.join(projectRoot, 'out', 'core', 'logging', 'logPolicy.js');
    const policyBefore = require(policyPath);

    withFakeVscode(createFakeVscode(), ({ requireOut }) => {
        requireOut('core/logging/logger.js');
    });

    assert.equal(require(policyPath), policyBefore, 'a vscode-free module another suite holds is not reloaded behind its back');
});

test('unlisted APIs are callable, constructible and extendable; strict mode refuses them', () => {
    const { vscode } = createFakeVscode();

    class Panel extends vscode.SomeFutureBaseClass {
        constructor() {
            super();
            this.ready = true;
        }
    }
    assert.equal(new Panel().ready, true);
    assert.doesNotThrow(() => vscode.languages.registerHoverProvider('ts', {}).dispose());
    assert.equal(typeof vscode.window.createWebviewPanel, 'function');

    const strict = createFakeVscode({ strict: true });
    assert.throws(() => strict.vscode.languages, /strict.*vscode\.languages is not implemented/);
    assert.throws(() => strict.vscode.window.createWebviewPanel, /strict.*vscode\.window\.createWebviewPanel is not implemented/);
    assert.equal(strict.vscode.window.showInformationMessage.name !== undefined, true);
});

test('strict mode still loads a compiled module that does `import * as vscode`', () => {
    // tsc compiles that import to __importStar(require('vscode')), which reads
    // vscode.__esModule before anything else. A strict fake that refused it could
    // not load a single compiled module.
    const fake = createFakeVscode({ strict: true });
    const context = fakeExtensionContext();

    try {
        withFakeVscode(fake, ({ requireOut }) => {
            const { CodeXRLogger } = requireOut('core/logging/logger.js');
            CodeXRLogger.initialize(context);
            CodeXRLogger.getLogger('STRICT').error('loaded');
        });
    } finally {
        context.cleanup();
    }

    assert.match(fake.channels.get('CodeXR').lines[0], /\[ERROR\] \[STRICT\] loaded$/);
});

test('an auto-stub never looks like a promise', async () => {
    const { vscode } = createFakeVscode();

    const awaited = await vscode.tasks.fetchTasks();
    assert.equal(typeof awaited, 'function', 'awaiting a stub resolves instead of hanging on a fake then()');
});

test('configuration reads defaults until a test sets a value, and change events reach listeners', () => {
    const fake = createFakeVscode({ config: { 'codeXR.debug.verboseLogs': true } });
    const { vscode } = fake;
    const seen = [];
    const subscription = vscode.workspace.onDidChangeConfiguration((event) => {
        seen.push([event.affectsConfiguration('codeXR.debug.verboseLogs'), event.affectsConfiguration('codeXR'), event.affectsConfiguration('other')]);
    });

    assert.equal(vscode.workspace.getConfiguration().get('codeXR.debug.verboseLogs', false), true);
    assert.equal(vscode.workspace.getConfiguration('codeXR.debug').get('verboseLogs', false), true);
    assert.equal(vscode.workspace.getConfiguration().get('codeXR.unset', 'fallback'), 'fallback');

    fake.setConfig('codeXR.debug.verboseLogs', false);
    fake.fireConfigChange('codeXR.debug.verboseLogs');
    assert.equal(vscode.workspace.getConfiguration().get('codeXR.debug.verboseLogs', true), false);
    assert.deepEqual(seen, [[true, true, false]]);

    subscription.dispose();
    fake.fireConfigChange('codeXR.debug.verboseLogs');
    assert.equal(seen.length, 1, 'a disposed listener is not called again');
});

test('messages, dialogs, commands, progress and clipboard are recorded', async () => {
    const fake = createFakeVscode();
    const { vscode } = fake;

    fake.queueAnswer('Retry');
    assert.equal(await vscode.window.showWarningMessage('Port busy', { modal: true }, 'Retry', 'Cancel'), 'Retry');
    assert.equal(await vscode.window.showInformationMessage('Started'), undefined, 'an unscripted message resolves to undefined, like a dismissed toast');
    assert.deepEqual(fake.messages, [
        { kind: 'warning', message: 'Port busy', items: ['Retry', 'Cancel'] },
        { kind: 'info', message: 'Started', items: [] },
    ]);

    fake.queueAnswer({ label: 'bars' });
    assert.deepEqual(await vscode.window.showQuickPick([{ label: 'bars' }], { canPickMany: false }), { label: 'bars' });
    assert.equal(fake.dialogs[0].kind, 'quickPick');

    const calls = [];
    const registration = vscode.commands.registerCommand('codeXR.test.probe', (value) => { calls.push(value); return value * 2; });
    assert.throws(() => vscode.commands.registerCommand('codeXR.test.probe', () => {}), /already exists/, 'a duplicate id throws, as in VS Code');
    assert.equal(await vscode.commands.executeCommand('codeXR.test.probe', 21), 42);
    assert.equal(await vscode.commands.executeCommand('codeXR.test.unknown'), undefined);
    assert.deepEqual(calls, [21]);
    assert.deepEqual(fake.executedCommands.map((entry) => entry.id), ['codeXR.test.probe', 'codeXR.test.unknown']);
    registration.dispose();
    assert.equal(fake.registeredCommands.has('codeXR.test.probe'), false);

    const result = await vscode.window.withProgress({ title: 'Analyzing' }, async (progress) => {
        progress.report({ message: 'step 1', increment: 50 });
        return 'finished';
    });
    assert.equal(result, 'finished');
    assert.deepEqual(fake.progressReports, [{ title: 'Analyzing', report: { message: 'step 1', increment: 50 } }]);

    await vscode.env.clipboard.writeText('https://localhost:3000');
    assert.equal(fake.clipboard, 'https://localhost:3000');
});

test('Uri, TreeItem, EventEmitter and Disposable behave like the real ones where tests look', () => {
    const { vscode } = createFakeVscode();

    const file = vscode.Uri.file(path.join(projectRoot, 'package.json'));
    assert.equal(file.scheme, 'file');
    assert.equal(file.fsPath, path.join(projectRoot, 'package.json'));
    assert.equal(vscode.Uri.joinPath(vscode.Uri.file(projectRoot), 'src', 'extension.ts').fsPath, path.join(projectRoot, 'src', 'extension.ts'));
    assert.equal(vscode.Uri.parse(file.toString()).fsPath, file.fsPath);
    assert.equal(vscode.Uri.parse('https://example.com/a/b?x=1#frag').path, '/a/b');

    const item = new vscode.TreeItem('Servers', vscode.TreeItemCollapsibleState.Expanded);
    assert.equal(item.label, 'Servers');
    assert.equal(item.collapsibleState, 2);
    assert.equal(new vscode.TreeItem(file).resourceUri, file);
    assert.equal(new vscode.ThemeIcon('server', new vscode.ThemeColor('charts.green')).color.id, 'charts.green');

    const emitter = new vscode.EventEmitter();
    const received = [];
    const subscription = emitter.event((value) => received.push(value));
    emitter.fire('first');
    subscription.dispose();
    emitter.fire('second');
    assert.deepEqual(received, ['first']);

    let disposed = 0;
    const disposable = new vscode.Disposable(() => { disposed += 1; });
    disposable.dispose();
    disposable.dispose();
    assert.equal(disposed, 1, 'dispose is idempotent');
});

test('fakeExtensionContext gives real storage directories and isolated state', async () => {
    const context = fakeExtensionContext();

    try {
        assert.equal(context.extensionMode, ExtensionMode.Test);
        assert.ok(fs.statSync(context.globalStorageUri.fsPath).isDirectory());
        assert.ok(fs.statSync(context.storageUri.fsPath).isDirectory());
        assert.equal(context.extension.packageJSON.name, 'code-xr');
        assert.equal(context.globalState.get('missing', 'default'), 'default');
        await context.globalState.update('key', { nested: true });
        assert.deepEqual(context.globalState.get('key'), { nested: true });
        assert.equal(context.workspaceState.get('key'), undefined, 'the two mementos are independent');
        assert.equal(context.asAbsolutePath('templates'), path.join(projectRoot, 'templates'));
    } finally {
        context.cleanup();
    }
    assert.equal(fs.existsSync(context.globalStorageUri.fsPath), false, 'cleanup removes the temp storage');
});
