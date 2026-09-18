const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const vm = require('node:vm');
const WebSocket = require('ws');

const { readAssembledRuntime } = require('../helpers/runtimeAssembly.cjs');
const { collectFiles, readSource } = require('../helpers/sourceText.cjs');

/**
 * The collaboration avatar palette is declared more than once, and the copies
 * cannot import each other: the extension model (COLLABORATION_AVATARS), the
 * room server's own list, the SKINS table of the avatar browser runtime and a
 * validation regex in the collaboration browser client. A colour added in one
 * place only is silently dropped somewhere else: the room swaps it for another
 * colour, or the client resets it to automatic, or the scene paints the
 * fallback skin.
 *
 * COLLABORATION_AVATARS is the source of truth here, so adding a colour
 * everywhere keeps this suite green. Every other declaration is probed through
 * its BEHAVIOUR (which ids does it let through unchanged?) rather than by
 * reading a constant, so the suite survives the room server deriving its list
 * from the model instead of spelling it out.
 */

const projectRoot = path.resolve(__dirname, '..', '..');

function requireOut(relativePath) {
    return require(path.join(projectRoot, 'out', ...relativePath.split('/')));
}

function loadExtensionModel() {
    const model = requireOut('collaboration/model/collaborationProfile.js');
    const palette = model.COLLABORATION_AVATARS.map((avatar) => avatar.id);

    // Every test below compares against this list or iterates it: an empty or
    // repeated one would let them pass for the wrong reason.
    assert.ok(palette.length > 0, 'COLLABORATION_AVATARS is empty');
    assert.equal(new Set(palette).size, palette.length, `duplicate avatar id in ${palette.join(', ')}`);

    return { model, autoId: model.AUTO_AVATAR_ID, palette };
}

/**
 * Ids offered to every validator. The numbered range is what a widened or
 * unanchored pattern would start accepting; the malformed neighbours are
 * derived from the palette so they follow a renamed id scheme.
 */
function buildCandidates(palette, autoId) {
    const numbered = Array.from({ length: 100 }, (_, index) => `avatar-${index}`);
    const malformed = palette.flatMap((id) => [id.toUpperCase(), `x${id}`, `${id}x`, `${id} `, `0${id}`]);
    const sentinelNeighbours = [autoId.toUpperCase(), `${autoId}x`, `x${autoId}`];
    return Array.from(new Set([
        ...palette, autoId, ...numbered, ...malformed, ...sentinelNeighbours, '', 'nope',
    ]));
}

function sorted(values) {
    return Array.from(values).sort();
}

/**
 * Both runtimes share one sandbox, as they share one page: the collaboration
 * client reaches the avatar runtime through the global. A vm context keeps
 * their globals (CodeXRAvatarRuntime, the asset manager singleton) out of this
 * process, which every other suite shares.
 */
function loadBrowserRuntimes() {
    const sandbox = vm.createContext({});
    vm.runInContext(
        readAssembledRuntime('avatar', 'codexrAvatarRuntime.js'),
        sandbox,
        { filename: 'codexrAvatarRuntime.js' },
    );
    vm.runInContext(
        readAssembledRuntime('collaboration', 'codexrCollaborationRuntime.js'),
        sandbox,
        { filename: 'codexrCollaborationRuntime.js' },
    );
    assert.ok(sandbox.CodeXRAvatarRuntime, 'the avatar runtime did not publish its global');
    assert.ok(sandbox.CodeXRCollaborationRuntime, 'the collaboration runtime did not publish its global');
    return {
        avatarRuntime: sandbox.CodeXRAvatarRuntime,
        collaborationRuntime: sandbox.CodeXRCollaborationRuntime,
    };
}

function waitForOpen(socket) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for websocket open')), 2500);
        socket.once('open', () => {
            clearTimeout(timeout);
            resolve();
        });
        socket.once('error', (error) => {
            clearTimeout(timeout);
            reject(error);
        });
    });
}

function joinRoom(socket, roomId) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for room-joined')), 2500);

        function onMessage(raw) {
            const message = JSON.parse(raw.toString('utf8'));
            if (message.type !== 'room-joined') {
                return;
            }
            clearTimeout(timeout);
            socket.off('message', onMessage);
            resolve(message.payload.participant);
        }

        socket.on('message', onMessage);
        socket.send(JSON.stringify({ type: 'room-join', roomId }));
    });
}

/** Runs `body` against a live room server and always tears the sockets and the listener down. */
async function withRoomServer(options, body) {
    const { CollaborationRoomServer } = requireOut('servers/runtime/collaboration/collaborationRoomServer.js');
    const server = http.createServer((_req, res) => {
        res.writeHead(200);
        res.end('ok');
    });
    const collaboration = new CollaborationRoomServer(server, '/codexr-room', options);
    const sockets = [];
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `ws://127.0.0.1:${server.address().port}/codexr-room`;

    try {
        await body({
            collaboration,
            async connect(socketOptions) {
                const socket = new WebSocket(url, socketOptions);
                sockets.push(socket);
                await waitForOpen(socket);
                return socket;
            },
        });
    } finally {
        sockets.forEach((socket) => socket.close());
        collaboration.dispose();
        await new Promise((resolve) => server.close(resolve));
    }
}

test('the extension palette holds unique concrete ids, and only a stored profile may also carry the automatic sentinel', () => {
    // Loading the model already proves the palette is non-empty and unique.
    const { model, autoId, palette } = loadExtensionModel();

    assert.equal(palette.includes(autoId), false, 'the automatic sentinel is not a colour a room can allocate');

    assert.deepEqual(sorted(model.VALID_AVATAR_IDS), sorted(palette));
    assert.deepEqual(sorted(model.ASSIGNABLE_AVATAR_IDS), sorted([...palette, autoId]));

    const candidates = buildCandidates(palette, autoId);
    const normalize = (avatarId) => model.normalizeCollaborationProfile({ avatarId }).avatarId;
    const kept = candidates.filter((candidate) => normalize(candidate) === candidate);
    assert.deepEqual(sorted(kept), sorted([...palette, autoId]));
    candidates
        .filter((candidate) => !kept.includes(candidate))
        .forEach((candidate) => assert.equal(normalize(candidate), autoId, `'${candidate}' should fall back to automatic`));
});

test('the room server honours an explicit colour for exactly the extension palette and never echoes anything else', async () => {
    const { autoId, palette } = loadExtensionModel();
    const candidates = buildCandidates(palette, autoId);
    const sessionId = 'avatar-sync-session';
    const emptyRoom = 'codexr-session:avatar-sync-explicit-empty';
    const sharedRoom = 'codexr-session:avatar-sync-explicit-shared';
    const profile = { identityMode: 'anonymous', customName: '', avatarId: autoId };

    await withRoomServer({
        resolveSession(request) {
            return request.headers['x-test-session'] === sessionId ? {
                sessionId,
                installationId: 'avatar-sync-installation',
                profile: { ...profile },
                clientKind: 'codexr',
                remote: false,
                expiresAt: Date.now() + 60_000,
            } : null;
        },
    }, async ({ collaboration, connect }) => {
        // A rejected id is swapped for a free colour, which is a palette id
        // too: alone in a room the swap lands on the first colour and looks
        // exactly like honouring it. The same session therefore also sits in a
        // room where somebody got there first, so the swap lands elsewhere.
        const withSession = { headers: { 'x-test-session': sessionId } };
        const alone = await joinRoom(await connect(withSession), emptyRoom);
        await joinRoom(await connect(), sharedRoom);
        const sharing = await joinRoom(await connect(withSession), sharedRoom);

        function wornBy(roomId, participant) {
            const summary = collaboration.getConnectedParticipants(roomId)
                .find((candidate) => candidate.peerId === participant.peerId);
            assert.ok(summary, `${participant.peerId} is missing from ${roomId}`);
            return summary.avatarId;
        }

        // The same path a colour change in VS Code takes; the room state is
        // updated synchronously, so two peers can try every candidate.
        const resolved = new Map(candidates.map((candidate) => {
            collaboration.updateSessionProfile(sessionId, { ...profile, avatarId: candidate });
            return [candidate, [wornBy(emptyRoom, alone), wornBy(sharedRoom, sharing)]];
        }));

        const [swappedWhenAlone, swappedWhenSharing] = resolved.get('nope');
        assert.notEqual(
            swappedWhenAlone,
            swappedWhenSharing,
            'both rooms swap a rejected id for the same colour, so honouring that colour cannot be told from rejecting it',
        );

        const honoured = candidates.filter(
            (candidate) => resolved.get(candidate).every((avatarId) => avatarId === candidate),
        );
        assert.deepEqual(sorted(honoured), sorted(palette));
        // 'auto' and junk are replaced by a real colour: neither may reach the
        // other participants, whose scenes only know the palette.
        resolved.forEach((avatarIds, candidate) => avatarIds.forEach((avatarId) => assert.ok(
            palette.includes(avatarId),
            `'${candidate}' resolved to '${avatarId}', which is not in the extension palette`,
        )));
    });
});

test('the room server allocates automatic colours from exactly the extension palette, in its order', async () => {
    const { palette } = loadExtensionModel();
    const roomId = 'codexr-session:avatar-sync-automatic';

    await withRoomServer({}, async ({ connect }) => {
        // One peer more than there are colours: a room list that is longer
        // than the palette only shows once the known colours have run out.
        const assigned = [];
        for (let index = 0; index <= palette.length; index += 1) {
            const participant = await joinRoom(await connect(), roomId);
            assigned.push(participant.avatarId);
        }

        const beforeReuse = assigned.slice(0, palette.length);
        assert.deepEqual(sorted(beforeReuse), sorted(palette));
        // Deriving the room list from the model must not change who gets which
        // colour: today the first joiner gets the first colour of the picker.
        assert.deepEqual(beforeReuse, palette);
        assert.ok(
            palette.includes(assigned[palette.length]),
            `once the palette ran out the room assigned '${assigned[palette.length]}'`,
        );
    });
});

test('the avatar scene runtime has a skin for exactly the extension palette', () => {
    const { autoId, palette } = loadExtensionModel();
    const { avatarRuntime } = loadBrowserRuntimes();

    const skinIds = Array.from(avatarRuntime.SKINS, (skin) => skin.id);
    assert.equal(new Set(skinIds).size, skinIds.length, `duplicate skin id in ${skinIds.join(', ')}`);
    assert.deepEqual(sorted(skinIds), sorted(palette));

    // Lookup agrees with the table, and an unresolved 'auto' or an unknown id
    // still paints a real skin instead of failing.
    buildCandidates(palette, autoId).forEach((candidate) => {
        const skinId = avatarRuntime.getSkin(candidate).id;
        if (palette.includes(candidate)) {
            assert.equal(skinId, candidate);
        } else {
            assert.ok(palette.includes(skinId), `'${candidate}' was painted with unknown skin '${skinId}'`);
        }
    });
});

test('every avatar id is the same colour in the VS Code picker and in the scene', () => {
    const { model } = loadExtensionModel();
    const { avatarRuntime } = loadBrowserRuntimes();

    // The picker shows this hex next to the colour name; the scene paints
    // whatever its own table says.
    model.COLLABORATION_AVATARS.forEach((avatar) => {
        assert.equal(
            String(avatarRuntime.getSkin(avatar.id).color).toLowerCase(),
            avatar.color.toLowerCase(),
            `${avatar.id} (${avatar.label}) is painted a different colour than the picker promises`,
        );
    });
});

test('the browser client keeps exactly the extension palette from the session profile and resets anything else to automatic', async () => {
    const { autoId, palette } = loadExtensionModel();
    const { collaborationRuntime } = loadBrowserRuntimes();

    async function profileAvatarAfterSession(avatarId) {
        const client = collaborationRuntime.createClient({
            // The payload shape of GET /api/collaboration/session.
            fetch: async () => ({
                ok: true,
                json: async () => ({
                    roomId: 'codexr-session:avatar-sync-client',
                    collaborationProfile: { identityMode: 'anonymous', customName: '', avatarId },
                }),
            }),
        });
        await client.getSessionInfoAsync();
        return client.getState().profile.avatarId;
    }

    const candidates = buildCandidates(palette, autoId);
    const resolved = new Map();
    for (const candidate of candidates) {
        resolved.set(candidate, await profileAvatarAfterSession(candidate));
    }

    const kept = candidates.filter((candidate) => candidate !== autoId && resolved.get(candidate) === candidate);
    assert.deepEqual(sorted(kept), sorted(palette));
    // The browser's fallback is the extension's sentinel, so 'auto' itself
    // survives and the room still picks a colour for a rejected id.
    candidates
        .filter((candidate) => !kept.includes(candidate))
        .forEach((candidate) => assert.equal(resolved.get(candidate), autoId, `'${candidate}' should reset to automatic`));
});

test('no source file spells an avatar id the extension palette does not have', () => {
    const { palette } = loadExtensionModel();
    const idLiteral = /(['"`])(avatar-\d+)\1/g;

    // Canary: the scan only recognises the numbered scheme. A renamed scheme
    // must retarget it instead of leaving it looking at nothing.
    palette.forEach((id) => assert.match(`'${id}'`, new RegExp(idLiteral.source)));

    // Fallback ids are hard-coded outside the tables too (a component schema
    // default, the presence layer), where no validator ever sees them.
    const trees = [
        { directory: 'src', extensions: ['.ts'] },
        { directory: 'templates', extensions: ['.js', '.html'] },
    ];
    trees.forEach(({ directory, extensions }) => {
        const found = new Set();
        collectFiles(directory, { extensions }).forEach((file) => {
            for (const match of readSource(file).matchAll(idLiteral)) {
                found.add(match[2]);
                assert.ok(palette.includes(match[2]), `${file} names '${match[2]}', which is not in the extension palette`);
            }
        });
        // Both trees declare the whole palette today (the model, the SKINS
        // table): finding less means the scan lost sight of them.
        assert.deepEqual(
            sorted(found),
            sorted(palette),
            `${directory}/ spells [${sorted(found).join(', ')}], the extension palette is [${sorted(palette).join(', ')}]`,
        );
    });
});
