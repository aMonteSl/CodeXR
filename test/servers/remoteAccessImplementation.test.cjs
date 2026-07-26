const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');

function readProjectFile(...parts) {
    return fs.readFileSync(path.join(projectRoot, ...parts), 'utf8');
}

test('remote access defaults to disabled and is exposed in server configuration', () => {
    const settings = readProjectFile('src', 'servers', 'storage', 'serverSettingsManager.ts');
    const items = readProjectFile('src', 'views', 'servers', 'items', 'serverItems.ts');
    assert.match(settings, /remoteAccess: \{ \.\.\.DEFAULT_REMOTE_ACCESS_SETTINGS \}/);
    assert.match(settings, /version: '1\.2\.0'/);
    assert.match(items, /Cross-network connections/);
    assert.match(items, /codexr\.server\.config\.remoteAccess/);
});

test('remote HTTP and WebSocket access require server-issued sessions', () => {
    const httpServer = readProjectFile('src', 'servers', 'runtime', 'httpServer.ts');
    // Cookie policy and the pairing endpoints live in the extracted remote/ modules.
    const accessPolicy = readProjectFile('src', 'servers', 'runtime', 'remote', 'remoteAccessPolicy.ts');
    const pairingApi = readProjectFile('src', 'servers', 'runtime', 'remote', 'remotePairingApi.ts');
    const roomServer = readProjectFile(
        'src',
        'servers',
        'runtime',
        'collaboration',
        'collaborationRoomServer.ts',
    );
    const broadcastServer = readProjectFile(
        'src',
        'servers',
        'runtime',
        'broadcast',
        'screenBroadcastSignalingServer.ts',
    );
    assert.match(accessPolicy, /resolveCookie\(req\.headers\.cookie\)/);
    assert.match(pairingApi, /HttpOnly; SameSite=Lax/);
    assert.match(httpServer, /Resource not found/);
    assert.match(httpServer, /safeRequestUrl/);
    assert.match(roomServer, /authorizeUpgrade/);
    assert.match(roomServer, /peer\.session\?\.profile/);
    assert.doesNotMatch(roomServer, /broadcastProfileConfiguration/);
    assert.match(broadcastServer, /this\.authorizeUpgrade\(req\)/);
});

test('cloudflared is pinned, checksum-verified, and launched without a shell', () => {
    const binaryManager = readProjectFile(
        'src',
        'remote_access',
        'services',
        'cloudflaredBinaryManager.ts',
    );
    const remoteManager = readProjectFile(
        'src',
        'remote_access',
        'services',
        'remoteAccessManager.ts',
    );
    assert.match(binaryManager, /CLOUDFLARED_VERSION = '2026\.5\.2'/);
    assert.match(binaryManager, /20b9638f685333d623798e733effbad2487093f15ba592f6c7752360ff3b7ab7/);
    assert.match(binaryManager, /createHash\('sha256'\)/);
    assert.match(remoteManager, /shell: false/);
    assert.match(remoteManager, /windowsHide: true/);
    assert.match(remoteManager, /trycloudflare\\\.com/);
    assert.match(remoteManager, /revokeAll\(\)/);
});

test('active servers exposes expandable information, participants, and conditional invitations', () => {
    const provider = readProjectFile(
        'src',
        'views',
        'active_servers',
        'ActiveServersSectionProvider.ts',
    );
    const items = readProjectFile(
        'src',
        'views',
        'active_servers',
        'items',
        'activeServerItems.ts',
    );
    const actions = readProjectFile(
        'src',
        'active_servers',
        'views',
        'interactions',
        'handleServerActions.ts',
    );
    assert.match(items, /TreeItemCollapsibleState\.Collapsed/);
    assert.match(items, /Local network address/);
    assert.match(items, /Connected users/);
    assert.match(items, /server\.remoteAccess\?\.status === 'shared'/);
    assert.match(provider, /getConnectedParticipants\(\)/);
    assert.match(provider, /onConnectedParticipantsChanged/);
    assert.match(actions, /clipboard\.writeText\(state\.invitationUrl\)/);
});

test('external browser pairing selects identity before requesting the code', () => {
    const pairingPage = readProjectFile('src', 'servers', 'runtime', 'remote', 'pairingPage.ts');
    const authority = readProjectFile(
        'src',
        'remote_access',
        'security',
        'remoteSessionAuthority.ts',
    );
    assert.match(pairingPage, /\/api\/remote\/identity/);
    assert.match(pairingPage, /name="identity"/);
    assert.match(pairingPage, /identityToken/);
    assert.match(authority, /consumeBrowserIdentity/);
    assert.match(authority, /invalid-browser-identity/);
});

test('guest pairing pages stay self-contained for the response CSP', () => {
    const pairingPage = readProjectFile('src', 'servers', 'runtime', 'remote', 'pairingPage.ts');
    // No img-src directive is sent, and an unpaired guest cannot fetch static
    // assets, so external references and data: images would break the page.
    assert.doesNotMatch(pairingPage, /<link\b/);
    assert.doesNotMatch(pairingPage, /<img\b/);
    assert.doesNotMatch(pairingPage, /src=["']https?:/);
    assert.doesNotMatch(pairingPage, /@import/);
    assert.doesNotMatch(pairingPage, /url\(\s*["']?(https?:|data:)/);
});

test('the host can remove a guest from the participant modal and the tree context menu', () => {
    const actions = readProjectFile(
        'src', 'active_servers', 'views', 'interactions', 'handleServerActions.ts',
    );
    const commands = readProjectFile(
        'src', 'active_servers', 'commands', 'activeServersCommands.ts',
    );
    const items = readProjectFile(
        'src', 'views', 'active_servers', 'items', 'activeServerItems.ts',
    );
    const manifest = JSON.parse(readProjectFile('package.json'));

    // The details modal offers the action, but never on the host's own row.
    assert.match(actions, /const REMOVE_PARTICIPANT_ACTION = 'Remove from Session'/);
    assert.match(actions, /participant\.role === 'host' \? \[\] : \[REMOVE_PARTICIPANT_ACTION\]/);
    // Removing always goes through an explicit confirmation...
    assert.match(actions, /showWarningMessage\(\s*`Remove \$\{participant\.displayName\} from the session\?`/);
    assert.match(actions, /if \(confirmation !== 'Remove'\) \{\s*return;/);
    // ...and the guest is told what it costs them, per connection scope.
    assert.match(actions, /Their remote session will be revoked/);
    assert.match(actions, /outcome\.sessionRevoked/);

    // Guest rows carry their own context value and the participant payload.
    assert.match(items, /participant\.role === 'host' \? 'activeServerParticipant' : 'activeServerParticipantGuest'/);
    assert.match(items, /public readonly participant\?: ConnectedParticipantSummary/);

    // The command accepts both call shapes: modal arguments and a tree item,
    // and never fails silently when the target cannot be resolved.
    assert.match(commands, /id: 'codeXR\.activeServers\.removeParticipant'/);
    assert.match(commands, /extractParticipantFromTreeItem/);
    assert.match(commands, /Could not tell which participant to remove/);

    // The rendered item is rebuilt twice by the modular tree; the participant
    // must survive both conversions or the context menu has no target at all
    // (this is exactly what broke the right-click path once).
    const modularTree = readProjectFile('src', 'views', 'ModularTreeDataProvider.ts');
    assert.match(modularTree, /\(modularItem as any\)\.participant = child\.participant;/);
    assert.match(modularTree, /\(element as any\)\.activeServer,\s*\n\s*\(element as any\)\.participant,/);

    // Contributed, and shown only on guest rows.
    const contributed = manifest.contributes.commands
        .find((command) => command.command === 'codeXR.activeServers.removeParticipant');
    assert.ok(contributed, 'removeParticipant must be a contributed command');
    assert.equal(contributed.title, 'Remove from Session');
    const menuEntry = manifest.contributes.menus['view/item/context']
        .find((entry) => entry.command === 'codeXR.activeServers.removeParticipant');
    assert.ok(menuEntry, 'removeParticipant must be in the tree context menu');
    assert.match(menuEntry.when, /viewItem == activeServerParticipantGuest/);
});

test('participant removal is server-authoritative and revokes remote sessions', () => {
    const room = readProjectFile('src', 'servers', 'runtime', 'collaboration', 'collaborationRoomServer.ts');
    const httpServer = readProjectFile('src', 'servers', 'runtime', 'httpServer.ts');
    const authority = readProjectFile('src', 'remote_access', 'security', 'remoteSessionAuthority.ts');

    // Both kick paths share one wire format, so browsers cannot tell them apart.
    assert.match(room, /public removeParticipant\(roomId: string, peerId: string\): ParticipantRemovalResult/);
    assert.match(room, /private disconnectRemovedPeer\(/);
    assert.match(room, /type: 'participant-kick'/);
    assert.match(room, /socket\.close\(4001, 'Removed by room host'\)/);

    // The room reports the session; the server owns revoking it.
    assert.doesNotMatch(room, /revokeSession/);
    assert.match(httpServer, /result\.removed && result\.remote && !!result\.sessionId/);
    assert.match(httpServer, /this\.remoteSessionAuthority\.revokeSession\(result\.sessionId\)/);
    assert.match(authority, /public revokeSession\(sessionId: string\): boolean/);
});
