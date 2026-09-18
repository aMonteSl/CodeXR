'use strict';

/**
 * A scoped fake of the `vscode` module, so suites can EXECUTE compiled modules
 * that import it (from out/) instead of only reading their source as text.
 *
 *   const { createFakeVscode, withFakeVscode, fakeExtensionContext } = require('../helpers/fakeVscode.cjs');
 *
 *   test('...', async () => {
 *       const fake = createFakeVscode();
 *       await withFakeVscode(fake, async ({ requireOut }) => {
 *           const { Something } = requireOut('some/module.js');
 *           ...
 *       });
 *       assert.deepEqual(fake.messages, [...]);
 *   });
 *
 * Why it is scoped: the unit runner executes every suite in ONE process
 * (`--test-isolation=none`), so a `vscode` hook or a module bound to a fake
 * would leak into every later suite. `withFakeVscode` installs the hook, runs
 * the callback (sync or async), and then ALWAYS restores `Module._load` and
 * evicts from `require.cache` every out/ module that was loaded meanwhile -
 * including singletons such as the logger, which would otherwise keep a
 * reference to a dead fake.
 *
 * What is real: the enums (with the real numeric values), EventEmitter,
 * Disposable, Uri, TreeItem, ThemeIcon, ThemeColor, MarkdownString,
 * CancellationTokenSource, and recorders for output channels, messages,
 * dialogs, commands, progress and configuration.
 * Everything else is an auto-stub: callable, constructible and extendable
 * (`class X extends vscode.Whatever` works). Pass `{ strict: true }` to make an
 * unlisted API throw instead, which keeps a test honest about what it touches.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const url = require('node:url');
const Module = require('node:module');

const projectRoot = path.resolve(__dirname, '..', '..');
const compiledRoot = path.join(projectRoot, 'out');

// ---------------------------------------------------------------- enums (real values)

const ExtensionMode = Object.freeze({ Production: 1, Development: 2, Test: 3 });
const TreeItemCollapsibleState = Object.freeze({ None: 0, Collapsed: 1, Expanded: 2 });
const ConfigurationTarget = Object.freeze({ Global: 1, Workspace: 2, WorkspaceFolder: 3 });
const ProgressLocation = Object.freeze({ SourceControl: 1, Window: 10, Notification: 15 });
const ViewColumn = Object.freeze({ Active: -1, Beside: -2, One: 1, Two: 2, Three: 3, Four: 4, Five: 5, Six: 6, Seven: 7, Eight: 8, Nine: 9 });
const StatusBarAlignment = Object.freeze({ Left: 1, Right: 2 });
const FileType = Object.freeze({ Unknown: 0, File: 1, Directory: 2, SymbolicLink: 64 });
const UIKind = Object.freeze({ Desktop: 1, Web: 2 });

// ---------------------------------------------------------------- real minimal classes

class Disposable {
    constructor(callOnDispose) {
        this._callOnDispose = callOnDispose;
    }

    static from(...disposables) {
        return new Disposable(() => {
            for (const disposable of disposables) {
                if (disposable && typeof disposable.dispose === 'function') {
                    disposable.dispose();
                }
            }
        });
    }

    dispose() {
        if (typeof this._callOnDispose === 'function') {
            const callOnDispose = this._callOnDispose;
            this._callOnDispose = undefined;
            callOnDispose();
        }
    }
}

class EventEmitter {
    constructor() {
        this._listeners = new Set();
        this.event = (listener, thisArgs, disposables) => {
            const bound = thisArgs ? listener.bind(thisArgs) : listener;
            this._listeners.add(bound);
            const disposable = new Disposable(() => this._listeners.delete(bound));
            if (Array.isArray(disposables)) {
                disposables.push(disposable);
            }
            return disposable;
        };
    }

    fire(data) {
        for (const listener of [...this._listeners]) {
            listener(data);
        }
    }

    dispose() {
        this._listeners.clear();
    }
}

class CancellationTokenSource {
    constructor() {
        this._emitter = new EventEmitter();
        this.token = { isCancellationRequested: false, onCancellationRequested: this._emitter.event };
    }

    cancel() {
        if (!this.token.isCancellationRequested) {
            this.token.isCancellationRequested = true;
            this._emitter.fire(undefined);
        }
    }

    dispose() {
        this._emitter.dispose();
    }
}

class Uri {
    constructor(scheme, authority, uriPath, query, fragment, fsPathOverride) {
        this.scheme = scheme;
        this.authority = authority || '';
        this.path = uriPath || '';
        this.query = query || '';
        this.fragment = fragment || '';
        this._fsPath = fsPathOverride;
    }

    static file(fsPath) {
        const resolved = path.resolve(fsPath);
        return new Uri('file', '', url.pathToFileURL(resolved).pathname, '', '', resolved);
    }

    static parse(value) {
        const parsed = new URL(value);
        const scheme = parsed.protocol.replace(/:$/, '');
        const fsPath = scheme === 'file' ? url.fileURLToPath(parsed) : undefined;
        return new Uri(scheme, parsed.host, decodeURIComponent(parsed.pathname), parsed.search.replace(/^\?/, ''), parsed.hash.replace(/^#/, ''), fsPath);
    }

    static joinPath(base, ...segments) {
        if (base.scheme === 'file') {
            return Uri.file(path.join(base.fsPath, ...segments));
        }
        return new Uri(base.scheme, base.authority, path.posix.join(base.path, ...segments), base.query, base.fragment);
    }

    static from(components) {
        return new Uri(components.scheme, components.authority, components.path, components.query, components.fragment);
    }

    get fsPath() {
        return this._fsPath !== undefined ? this._fsPath : this.path;
    }

    with(change) {
        return new Uri(
            change.scheme !== undefined ? change.scheme : this.scheme,
            change.authority !== undefined ? change.authority : this.authority,
            change.path !== undefined ? change.path : this.path,
            change.query !== undefined ? change.query : this.query,
            change.fragment !== undefined ? change.fragment : this.fragment,
        );
    }

    toString() {
        if (this.scheme === 'file' && this._fsPath !== undefined) {
            return url.pathToFileURL(this._fsPath).toString();
        }
        const authority = this.authority ? `//${this.authority}` : '';
        const query = this.query ? `?${this.query}` : '';
        const fragment = this.fragment ? `#${this.fragment}` : '';
        return `${this.scheme}:${authority}${this.path}${query}${fragment}`;
    }

    toJSON() {
        return { scheme: this.scheme, authority: this.authority, path: this.path, query: this.query, fragment: this.fragment, fsPath: this.fsPath };
    }
}

class ThemeColor {
    constructor(id) {
        this.id = id;
    }
}

class ThemeIcon {
    constructor(id, color) {
        this.id = id;
        this.color = color;
    }
}
ThemeIcon.File = new ThemeIcon('file');
ThemeIcon.Folder = new ThemeIcon('folder');

class MarkdownString {
    constructor(value = '', supportThemeIcons = false) {
        this.value = value;
        this.supportThemeIcons = supportThemeIcons;
        this.isTrusted = undefined;
        this.supportHtml = undefined;
    }

    appendText(value) {
        this.value += value;
        return this;
    }

    appendMarkdown(value) {
        this.value += value;
        return this;
    }

    appendCodeblock(value, language = '') {
        this.value += `\n\`\`\`${language}\n${value}\n\`\`\`\n`;
        return this;
    }
}

class TreeItem {
    constructor(labelOrUri, collapsibleState = TreeItemCollapsibleState.None) {
        if (labelOrUri instanceof Uri) {
            this.resourceUri = labelOrUri;
        } else {
            this.label = labelOrUri;
        }
        this.collapsibleState = collapsibleState;
    }
}

// ---------------------------------------------------------------- auto-stub

function createAutoStub(name) {
    const target = function fakeVscodeAutoStub() {};
    const members = new Map();
    return new Proxy(target, {
        get(_target, property) {
            if (property === 'prototype') {
                return target.prototype;
            }
            // Never look thenable: `await stub` must resolve to the stub, not hang.
            if (property === 'then') {
                return undefined;
            }
            if (property === Symbol.toPrimitive) {
                return () => `[fakeVscode ${name}]`;
            }
            if (typeof property === 'symbol') {
                return target[property];
            }
            if (!members.has(property)) {
                members.set(property, createAutoStub(`${name}.${property}`));
            }
            return members.get(property);
        },
        set(_target, property, value) {
            members.set(property, value);
            return true;
        },
        apply() {
            return createAutoStub(`${name}()`);
        },
        construct(_target, argumentsList, newTarget) {
            return Reflect.construct(target, argumentsList, newTarget);
        },
    });
}

function createNamespace(name, implementation, strict) {
    return new Proxy(implementation, {
        get(target, property) {
            if (property in target || typeof property === 'symbol') {
                return target[property];
            }
            // `then` keeps a namespace from looking like a promise; `__esModule` is
            // what tsc's __importStar / __importDefault read from EVERY module
            // imported with `import * as vscode`. Neither is a vscode API, so
            // strict mode must not refuse them.
            if (property === 'then' || property === '__esModule') {
                return undefined;
            }
            if (strict) {
                throw new Error(`fakeVscode (strict): ${name}.${property} is not implemented. List it in createFakeVscode({ overrides }) or drop strict mode.`);
            }
            target[property] = createAutoStub(`${name}.${property}`);
            return target[property];
        },
    });
}

// ---------------------------------------------------------------- the fake

/**
 * @param {{ strict?: boolean, overrides?: Record<string, unknown>, config?: Record<string, unknown> }} [options]
 *   `overrides` is merged per namespace: `{ window: { showQuickPick: ... }, extensions: { ... } }`.
 */
function createFakeVscode(options = {}) {
    const strict = options.strict === true;
    const overrides = options.overrides || {};
    const configValues = new Map(Object.entries(options.config || {}));
    const configListeners = new Set();
    const registeredCommands = new Map();
    const answers = [];

    const fake = {
        vscode: undefined,
        /** name -> { name, lines, shown, disposed } */
        channels: new Map(),
        /** commandId -> callback */
        registeredCommands,
        /** [{ id, args }] */
        executedCommands: [],
        /** [{ kind: 'info' | 'warning' | 'error', message, items }] */
        messages: [],
        /** [{ kind: 'quickPick' | 'inputBox' | 'openDialog' | 'saveDialog', options }] */
        dialogs: [],
        /** [{ title, report }] */
        progressReports: [],
        /** text written through env.clipboard */
        clipboard: '',
        /** Uris handed to env.openExternal */
        openedExternal: [],
        /** Queues the value the next message/dialog call resolves to (FIFO). Unqueued calls resolve to undefined. */
        queueAnswer(value) {
            answers.push(value);
        },
        setConfig(key, value) {
            configValues.set(key, value);
        },
        /** Fires onDidChangeConfiguration; affectsConfiguration(section) is true for the key and its parents. */
        fireConfigChange(key) {
            const event = { affectsConfiguration: (section) => key === section || key.startsWith(`${section}.`) };
            for (const listener of [...configListeners]) {
                listener(event);
            }
        },
    };

    const nextAnswer = () => Promise.resolve(answers.length > 0 ? answers.shift() : undefined);
    const showMessage = (kind) => (message, ...rest) => {
        const items = rest.filter((entry) => typeof entry === 'string' || (entry && typeof entry === 'object' && 'title' in entry));
        fake.messages.push({ kind, message, items });
        return nextAnswer();
    };
    const recordDialog = (kind) => (...args) => {
        fake.dialogs.push({ kind, options: kind === 'quickPick' ? { items: args[0], options: args[1] } : args[0] });
        return nextAnswer();
    };

    const windowNamespace = {
        activeTextEditor: undefined,
        visibleTextEditors: [],
        createOutputChannel(name) {
            const channel = {
                name,
                lines: [],
                shown: false,
                disposed: false,
                append(value) {
                    channel.lines.push(String(value));
                },
                appendLine(value) {
                    channel.lines.push(String(value));
                },
                replace(value) {
                    channel.lines = [String(value)];
                },
                clear() {
                    channel.lines = [];
                },
                show() {
                    channel.shown = true;
                },
                hide() {
                    channel.shown = false;
                },
                dispose() {
                    channel.disposed = true;
                },
            };
            fake.channels.set(name, channel);
            return channel;
        },
        showInformationMessage: showMessage('info'),
        showWarningMessage: showMessage('warning'),
        showErrorMessage: showMessage('error'),
        showQuickPick: recordDialog('quickPick'),
        showInputBox: recordDialog('inputBox'),
        showOpenDialog: recordDialog('openDialog'),
        showSaveDialog: recordDialog('saveDialog'),
        withProgress(progressOptions, task) {
            const tokenSource = new CancellationTokenSource();
            const progress = {
                report(report) {
                    fake.progressReports.push({ title: progressOptions && progressOptions.title, report });
                },
            };
            return Promise.resolve(task(progress, tokenSource.token));
        },
        ...(overrides.window || {}),
    };

    const workspaceNamespace = {
        workspaceFolders: undefined,
        getConfiguration(section) {
            const fullKey = (key) => (section ? `${section}.${key}` : key);
            return {
                get(key, defaultValue) {
                    return configValues.has(fullKey(key)) ? configValues.get(fullKey(key)) : defaultValue;
                },
                has(key) {
                    return configValues.has(fullKey(key));
                },
                inspect(key) {
                    return { key: fullKey(key), globalValue: configValues.get(fullKey(key)) };
                },
                update(key, value) {
                    if (value === undefined) {
                        configValues.delete(fullKey(key));
                    } else {
                        configValues.set(fullKey(key), value);
                    }
                    return Promise.resolve();
                },
            };
        },
        onDidChangeConfiguration(listener) {
            configListeners.add(listener);
            return new Disposable(() => configListeners.delete(listener));
        },
        ...(overrides.workspace || {}),
    };

    const commandsNamespace = {
        registerCommand(id, callback, thisArg) {
            if (registeredCommands.has(id)) {
                // The real API throws on a duplicate id; so does the fake.
                throw new Error(`command '${id}' already exists`);
            }
            registeredCommands.set(id, thisArg ? callback.bind(thisArg) : callback);
            return new Disposable(() => registeredCommands.delete(id));
        },
        executeCommand(id, ...args) {
            fake.executedCommands.push({ id, args });
            const callback = registeredCommands.get(id);
            return Promise.resolve(callback ? callback(...args) : undefined);
        },
        getCommands() {
            return Promise.resolve([...registeredCommands.keys()]);
        },
        ...(overrides.commands || {}),
    };

    const envNamespace = {
        appName: 'fakeVscode',
        language: 'en',
        machineId: 'fake-machine-id',
        sessionId: 'fake-session-id',
        uriScheme: 'vscode',
        uiKind: UIKind.Desktop,
        clipboard: {
            writeText(value) {
                fake.clipboard = String(value);
                return Promise.resolve();
            },
            readText() {
                return Promise.resolve(fake.clipboard);
            },
        },
        openExternal(target) {
            fake.openedExternal.push(target);
            return Promise.resolve(true);
        },
        ...(overrides.env || {}),
    };

    const extensionsNamespace = {
        all: [],
        getExtension() {
            return undefined;
        },
        ...(overrides.extensions || {}),
    };

    const topLevel = {
        ExtensionMode,
        TreeItemCollapsibleState,
        ConfigurationTarget,
        ProgressLocation,
        ViewColumn,
        StatusBarAlignment,
        FileType,
        UIKind,
        Disposable,
        EventEmitter,
        CancellationTokenSource,
        Uri,
        ThemeColor,
        ThemeIcon,
        MarkdownString,
        TreeItem,
        window: createNamespace('vscode.window', windowNamespace, strict),
        workspace: createNamespace('vscode.workspace', workspaceNamespace, strict),
        commands: createNamespace('vscode.commands', commandsNamespace, strict),
        env: createNamespace('vscode.env', envNamespace, strict),
        extensions: createNamespace('vscode.extensions', extensionsNamespace, strict),
    };
    for (const [key, value] of Object.entries(overrides)) {
        if (!['window', 'workspace', 'commands', 'env', 'extensions'].includes(key)) {
            topLevel[key] = value;
        }
    }

    fake.vscode = createNamespace('vscode', topLevel, strict);
    return fake;
}

// ---------------------------------------------------------------- extension context

/**
 * A minimal ExtensionContext backed by a temp directory and in-memory Mementos.
 * Call `context.cleanup()` when done to remove the temp directory.
 */
function fakeExtensionContext(options = {}) {
    const storageRoot = options.root || fs.mkdtempSync(path.join(os.tmpdir(), 'codexr-fake-context-'));
    const extensionPath = options.extensionPath || projectRoot;
    const createMemento = () => {
        const values = new Map();
        return {
            get: (key, defaultValue) => (values.has(key) ? values.get(key) : defaultValue),
            update: (key, value) => {
                if (value === undefined) {
                    values.delete(key);
                } else {
                    values.set(key, value);
                }
                return Promise.resolve();
            },
            keys: () => [...values.keys()],
            setKeysForSync() {},
        };
    };
    const directory = (name) => {
        const directoryPath = path.join(storageRoot, name);
        fs.mkdirSync(directoryPath, { recursive: true });
        return directoryPath;
    };
    const globalStoragePath = directory('global');
    const workspaceStoragePath = directory('workspace');
    const logPath = directory('log');

    return {
        extensionMode: options.extensionMode !== undefined ? options.extensionMode : ExtensionMode.Test,
        extensionPath,
        extensionUri: Uri.file(extensionPath),
        extension: { id: 'aMonteSl.code-xr', packageJSON: JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')) },
        subscriptions: [],
        globalState: createMemento(),
        workspaceState: createMemento(),
        globalStoragePath,
        globalStorageUri: Uri.file(globalStoragePath),
        storagePath: workspaceStoragePath,
        storageUri: Uri.file(workspaceStoragePath),
        logPath,
        logUri: Uri.file(logPath),
        asAbsolutePath: (relativePath) => path.join(extensionPath, relativePath),
        cleanup() {
            if (!options.root) {
                fs.rmSync(storageRoot, { recursive: true, force: true });
            }
        },
    };
}

// ---------------------------------------------------------------- scoped installation

function isCompiledModule(filename) {
    return filename === compiledRoot || filename.startsWith(compiledRoot + path.sep);
}

/**
 * Runs `callback({ requireOut, fake })` with `require('vscode')` resolving to
 * `fake.vscode`. The callback may be sync or async; either way `Module._load`
 * is restored afterwards and every out/ module loaded meanwhile is evicted from
 * `require.cache`, so nothing bound to the fake survives the call.
 */
function withFakeVscode(fake, callback) {
    if (!fake || !fake.vscode) {
        throw new Error('withFakeVscode needs the object returned by createFakeVscode()');
    }

    const originalLoad = Module._load;
    const cachedBefore = new Set(Object.keys(require.cache));
    let restored = false;

    const restore = () => {
        if (restored) {
            return;
        }
        restored = true;
        Module._load = originalLoad;
        for (const filename of Object.keys(require.cache)) {
            if (!cachedBefore.has(filename) && isCompiledModule(filename)) {
                delete require.cache[filename];
            }
        }
    };

    Module._load = function fakeVscodeLoad(request, ...rest) {
        if (request === 'vscode') {
            return fake.vscode;
        }
        return originalLoad.call(this, request, ...rest);
    };

    const api = {
        fake,
        /** Requires a compiled module by its path relative to out/, always freshly loaded. */
        requireOut(relativePath) {
            const filename = path.join(compiledRoot, ...relativePath.split('/'));
            cachedBefore.delete(filename);
            delete require.cache[filename];
            return require(filename);
        },
    };

    let result;
    try {
        result = callback(api);
    } catch (error) {
        restore();
        throw error;
    }

    if (result && typeof result.then === 'function') {
        return result.then(
            (value) => {
                restore();
                return value;
            },
            (error) => {
                restore();
                throw error;
            },
        );
    }

    restore();
    return result;
}

module.exports = {
    createFakeVscode,
    fakeExtensionContext,
    withFakeVscode,
    ExtensionMode,
    TreeItemCollapsibleState,
    ConfigurationTarget,
    ProgressLocation,
    ViewColumn,
    Uri,
    EventEmitter,
    Disposable,
};
