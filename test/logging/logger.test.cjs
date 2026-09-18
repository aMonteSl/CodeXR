const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const {
    createFakeVscode,
    fakeExtensionContext,
    withFakeVscode,
    ExtensionMode,
} = require(path.join(projectRoot, 'test', 'helpers', 'fakeVscode.cjs'));

const LINE = /^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\] \[(DEBUG|INFO|WARN|ERROR)\] \[([^\]]+)\] (.*)$/;

/**
 * Loads a fresh CodeXRLogger (it keeps static state) bound to a fresh fake
 * vscode, runs the scenario and hands back what reached the output channel.
 */
function withLogger(options, scenario) {
    const fake = createFakeVscode({ config: options.config });
    const context = fakeExtensionContext({ extensionMode: options.extensionMode });
    try {
        withFakeVscode(fake, ({ requireOut }) => {
            const { CodeXRLogger } = requireOut('core/logging/logger.js');
            scenario({ CodeXRLogger, fake, context });
        });
    } finally {
        context.cleanup();
    }
    return fake;
}

const channelLines = (fake) => (fake.channels.get('CodeXR') ? fake.channels.get('CodeXR').lines : []);

test('the logger writes to one "CodeXR" output channel and hands it to the extension for disposal', () => {
    const fake = withLogger({ extensionMode: ExtensionMode.Production }, ({ CodeXRLogger, context }) => {
        CodeXRLogger.initialize(context);
        CodeXRLogger.initialize(context);

        assert.equal(context.subscriptions.length, 2, 'the channel and ONE configuration listener - a second initialize adds neither');
    });

    assert.deepEqual([...fake.channels.keys()], ['CodeXR']);
});

test('every line is "[ISO timestamp] [LEVEL] [SCOPE] message"', () => {
    const fake = withLogger({ extensionMode: ExtensionMode.Development }, ({ CodeXRLogger, context }) => {
        CodeXRLogger.initialize(context);
        const logger = CodeXRLogger.getLogger('SERVERS');
        logger.debug('d');
        logger.info('i');
        logger.warn('w');
        logger.error('e');
    });

    const parsed = channelLines(fake).map((line) => LINE.exec(line));
    assert.ok(parsed.every(Boolean), 'all four lines have the documented shape');
    assert.deepEqual(parsed.map((match) => [match[2], match[3], match[4]]), [
        ['DEBUG', 'SERVERS', 'd'],
        ['INFO', 'SERVERS', 'i'],
        ['WARN', 'SERVERS', 'w'],
        ['ERROR', 'SERVERS', 'e'],
    ]);
    assert.ok(!Number.isNaN(Date.parse(parsed[0][1])));
});

test('production hides debug and info unless codeXR.debug.verboseLogs is on; warn and error always show', () => {
    const levelsSeen = (fake) => channelLines(fake).map((line) => LINE.exec(line)[2]);
    const logAllLevels = ({ CodeXRLogger, context }) => {
        CodeXRLogger.initialize(context);
        const logger = CodeXRLogger.getLogger('SCOPE');
        logger.debug('d');
        logger.info('i');
        logger.warn('w');
        logger.error('e');
    };

    assert.deepEqual(levelsSeen(withLogger({ extensionMode: ExtensionMode.Production }, logAllLevels)), ['WARN', 'ERROR']);
    assert.deepEqual(
        levelsSeen(withLogger({ extensionMode: ExtensionMode.Production, config: { 'codeXR.debug.verboseLogs': true } }, logAllLevels)),
        ['DEBUG', 'INFO', 'WARN', 'ERROR'],
    );
    assert.deepEqual(levelsSeen(withLogger({ extensionMode: ExtensionMode.Development }, logAllLevels)), ['DEBUG', 'INFO', 'WARN', 'ERROR']);
    // Test mode is not Development: it logs like production.
    assert.deepEqual(levelsSeen(withLogger({ extensionMode: ExtensionMode.Test }, logAllLevels)), ['WARN', 'ERROR']);
});

test('a lazy message is only built when its level is emitted', () => {
    let built = 0;
    const fake = withLogger({ extensionMode: ExtensionMode.Production }, ({ CodeXRLogger, context }) => {
        CodeXRLogger.initialize(context);
        const logger = CodeXRLogger.getLogger('SCOPE');
        logger.debug(() => { built += 1; return 'expensive debug'; });
        logger.warn(() => { built += 1; return 'cheap enough'; });
    });

    assert.equal(built, 1, 'the debug factory never ran: gated levels cost nothing');
    assert.match(channelLines(fake)[0], /\[WARN\] \[SCOPE\] cheap enough$/);
});

test('metadata is appended as a second line: an Error by its stack, a string as is, anything else as JSON', () => {
    const circular = {};
    circular.self = circular;
    const failure = new Error('port in use');

    const fake = withLogger({ extensionMode: ExtensionMode.Production }, ({ CodeXRLogger, context }) => {
        CodeXRLogger.initialize(context);
        const logger = CodeXRLogger.getLogger('SCOPE');
        logger.error('with error', failure);
        logger.error('with string', 'plain detail');
        logger.error('with object', { port: 3000, tags: ['a'] });
        logger.error('with circular', circular);
        logger.error('without metadata');
    });

    const lines = channelLines(fake);
    assert.equal(lines.length, 9, 'four messages with a metadata line each, one without');
    assert.equal(lines[1], failure.stack);
    assert.equal(lines[3], 'plain detail');
    assert.equal(lines[5], JSON.stringify({ port: 3000, tags: ['a'] }, null, 2));
    assert.equal(lines[7], '[object Object]', 'JSON.stringify threw on the cycle, so the logger fell back to String()');
    assert.match(lines[8], /\[ERROR\] \[SCOPE\] without metadata$/);
});

test('changing codeXR.debug.verboseLogs takes effect at once and is announced', () => {
    const fake = withLogger({ extensionMode: ExtensionMode.Production }, ({ CodeXRLogger, context, fake: scoped }) => {
        CodeXRLogger.initialize(context);
        const logger = CodeXRLogger.getLogger('SCOPE');

        logger.debug('before');
        scoped.setConfig('codeXR.debug.verboseLogs', true);
        scoped.fireConfigChange('codeXR.debug.verboseLogs');
        logger.debug('after');
        scoped.fireConfigChange('editor.fontSize');
    });

    assert.deepEqual(channelLines(fake).map((line) => LINE.exec(line).slice(2, 5)), [
        ['INFO', 'LOGGER', 'Verbose logging enabled.'],
        ['DEBUG', 'SCOPE', 'after'],
    ]);
});

test('turning verbose logging off is not announced, because info is gated the moment it is off', () => {
    const fake = withLogger(
        { extensionMode: ExtensionMode.Production, config: { 'codeXR.debug.verboseLogs': true } },
        ({ CodeXRLogger, context, fake: scoped }) => {
            CodeXRLogger.initialize(context);
            scoped.setConfig('codeXR.debug.verboseLogs', false);
            scoped.fireConfigChange('codeXR.debug.verboseLogs');
            CodeXRLogger.getLogger('SCOPE').info('after');
        },
    );

    assert.deepEqual(channelLines(fake), []);
});

test('anything logged before initialize() is dropped - even errors', () => {
    // CURRENT CONTRACT, pinned on purpose. activate() logs through
    // initializeExtensionContext before it initializes the logger, so this
    // window is not empty, and a failed activation never leaves it. The logging
    // programme replaces the drop with a bounded buffer that is flushed when
    // the channel attaches; that commit flips THIS assertion, deliberately.
    let built = 0;
    const fake = withLogger({ extensionMode: ExtensionMode.Development }, ({ CodeXRLogger, context }) => {
        const logger = CodeXRLogger.getLogger('EARLY');
        logger.error('lost error', new Error('nobody will see this'));
        logger.warn(() => { built += 1; return 'lost warning'; });

        CodeXRLogger.initialize(context);
        logger.warn('first visible line');
    });

    assert.deepEqual(channelLines(fake).map((line) => LINE.exec(line)[4]), ['first visible line']);
    assert.equal(built, 0, 'with no channel the message factory is not even invoked');
});
