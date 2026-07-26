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
    assert.match(httpServer, /resolveCookie\(req\.headers\.cookie\)/);
    assert.match(httpServer, /HttpOnly; SameSite=Lax/);
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
