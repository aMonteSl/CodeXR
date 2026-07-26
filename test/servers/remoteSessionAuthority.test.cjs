const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');

function loadAuthority() {
    return require(path.join(
        projectRoot,
        'out',
        'remote_access',
        'security',
        'remoteSessionAuthority.js',
    )).RemoteSessionAuthority;
}

function profile(name = 'Host', avatarId = 'avatar-1') {
    return {
        identityMode: 'custom',
        customName: name,
        avatarId,
    };
}

test('remote session authority pairs once per code and keeps invitation links reusable', () => {
    const RemoteSessionAuthority = loadAuthority();
    const authority = new RemoteSessionAuthority();
    const invitationToken = authority.createInvitation();
    assert.equal(authority.isInvitationValid(invitationToken), true);
    assert.equal(authority.isInvitationValid('not-a-real-invitation'), false);
    const codes = new Map();
    authority.onPairingRequest((event) => codes.set(event.requestId, event.code));

    const first = authority.createPairingRequest({
        invitationToken,
        remoteAddress: '203.0.113.10',
        installationId: 'installation-one',
        profile: profile('Leia'),
    });
    const firstResult = authority.confirmPairing(
        first.requestId,
        codes.get(first.requestId),
        '203.0.113.10',
    );
    assert.ok(firstResult.extensionToken);
    assert.ok(firstResult.browserToken);
    assert.throws(
        () => authority.confirmPairing(first.requestId, codes.get(first.requestId), '203.0.113.10'),
        /pairing-expired/,
    );

    const second = authority.createPairingRequest({
        invitationToken,
        remoteAddress: '203.0.113.11',
        installationId: 'installation-two',
        profile: profile('Rey', 'avatar-2'),
    });
    assert.doesNotThrow(() => authority.confirmPairing(
        second.requestId,
        codes.get(second.requestId),
        '203.0.113.11',
    ));
});

test('remote session authority binds pairing attempts to an address and burns a code on the first miss', () => {
    const RemoteSessionAuthority = loadAuthority();
    const authority = new RemoteSessionAuthority();
    const invitationToken = authority.createInvitation();
    const createdEvents = [];
    const failures = [];
    authority.onPairingRequest((event) => createdEvents.push(event));
    authority.onPairingFailed((event) => failures.push(event));
    const request = authority.createPairingRequest({
        invitationToken,
        remoteAddress: '198.51.100.20',
        installationId: 'installation-secure',
        profile: profile(),
    });

    // A correct code from the wrong address is rejected without consuming the code.
    assert.throws(
        () => authority.confirmPairing(request.requestId, createdEvents[0].code, '198.51.100.21'),
        /invalid-pairing-code/,
    );
    assert.equal(failures.length, 0);

    // The first wrong guess burns the code and warns the host exactly once.
    assert.throws(
        () => authority.confirmPairing(request.requestId, '999999', '198.51.100.20'),
        /invalid-pairing-code/,
    );
    assert.equal(failures.length, 1);
    assert.equal(failures[0].requestId, request.requestId);
    assert.equal(failures[0].reason, 'invalid-code');
    assert.equal(failures[0].remoteAddress, '198.51.100.20');

    // The burnt code stays dead even when the right digits arrive, and repeated
    // submissions do not spam the host with more warnings.
    assert.throws(
        () => authority.confirmPairing(request.requestId, createdEvents[0].code, '198.51.100.20'),
        /pairing-code-revoked/,
    );
    assert.throws(
        () => authority.confirmPairing(request.requestId, '111111', '198.51.100.20'),
        /pairing-code-revoked/,
    );
    assert.equal(failures.length, 1);

    // The request survives so the host can hand over a replacement.
    const pending = authority.listPendingPairingRequests();
    assert.equal(pending.length, 1);
    assert.equal(pending[0].requestId, request.requestId);
    assert.equal(pending[0].codeValid, false);
    assert.equal(pending[0].displayName, 'Host');
});

test('remote session authority regenerates pairing codes and invalidates the previous one', () => {
    const RemoteSessionAuthority = loadAuthority();
    const authority = new RemoteSessionAuthority();
    const invitationToken = authority.createInvitation();
    const createdEvents = [];
    authority.onPairingRequest((event) => createdEvents.push(event));
    const request = authority.createPairingRequest({
        invitationToken,
        remoteAddress: '198.51.100.30',
        installationId: 'installation-regen',
        profile: profile('Padme'),
    });
    const originalCode = createdEvents[0].code;

    const regenerated = authority.regeneratePairingCode(request.requestId);
    assert.equal(createdEvents.length, 2);
    assert.equal(createdEvents[1].requestId, request.requestId);
    assert.equal(createdEvents[1].regenerated, true);
    assert.equal(createdEvents[1].displayName, 'Padme');
    assert.equal(createdEvents[1].code, regenerated.code);
    assert.notEqual(regenerated.code, originalCode);

    // The superseded code no longer pairs, the fresh one does.
    assert.throws(
        () => authority.confirmPairing(request.requestId, originalCode, '198.51.100.30'),
        /invalid-pairing-code/,
    );
    const afterBurn = authority.regeneratePairingCode(request.requestId);
    const paired = authority.confirmPairing(request.requestId, afterBurn.code, '198.51.100.30');
    assert.ok(paired.extensionToken);
    assert.equal(authority.listPendingPairingRequests().length, 0);

    assert.throws(
        () => authority.regeneratePairingCode('not-a-real-request'),
        /pairing-expired/,
    );
});

test('remote session authority validates profiles and scopes updates by installation', () => {
    const RemoteSessionAuthority = loadAuthority();
    const authority = new RemoteSessionAuthority();
    assert.throws(
        () => authority.createLocalBrowserToken('invalid-installation', profile('Host', 'avatar-99')),
        /invalid-profile/,
    );

    const firstToken = authority.createLocalBrowserToken('shared-installation', profile('Luke'));
    const secondToken = authority.createLocalBrowserToken('other-installation', profile('Ahsoka'));
    const firstSession = authority.exchangeBrowserToken(firstToken);
    const secondSession = authority.exchangeBrowserToken(secondToken);
    assert.equal(authority.exchangeBrowserToken(firstToken), null);

    const updated = authority.updateInstallationProfile(
        'shared-installation',
        profile('Mara Jade', 'avatar-4'),
    );
    assert.equal(updated.length, 1);
    assert.equal(firstSession.profile.customName, 'Mara Jade');
    assert.equal(secondSession.profile.customName, 'Ahsoka');
    assert.equal(authority.resolveCookie(`codexr_session=${firstSession.sessionId}`).sessionId, firstSession.sessionId);

    const invitationToken = authority.createInvitation();
    const codes = new Map();
    authority.onPairingRequest((event) => codes.set(event.requestId, event.code));
    const remoteRequests = [1, 2].map((suffix) => authority.createPairingRequest({
        invitationToken,
        remoteAddress: `192.0.2.${suffix}`,
        installationId: 'remote-shared-installation',
        profile: profile('Remote User'),
    }));
    const remoteResults = remoteRequests.map((request, index) => authority.confirmPairing(
        request.requestId,
        codes.get(request.requestId),
        `192.0.2.${index + 1}`,
    ));
    const remoteSessions = remoteResults.map((result) => authority.exchangeBrowserToken(result.browserToken));
    const remoteUpdates = authority.updateExtensionProfile(
        remoteResults[0].extensionToken,
        profile('Remote Updated', 'avatar-5'),
    );
    assert.equal(remoteUpdates.length, 2);
    assert.deepEqual(
        remoteSessions.map((session) => session.profile.customName),
        ['Remote Updated', 'Remote Updated'],
    );
});

test('remote browser identity is authoritative, single-use, and bound to invitation and address', () => {
    const RemoteSessionAuthority = loadAuthority();
    const authority = new RemoteSessionAuthority();
    const invitationToken = authority.createInvitation();
    const identity = authority.createBrowserIdentity({
        invitationToken,
        remoteAddress: '203.0.113.40',
    });
    assert.equal(typeof identity.anonymousAlias, 'string');
    assert.equal(identity.anonymousAlias.length > 1, true);

    const events = [];
    authority.onPairingRequest((event) => events.push(event));
    const request = authority.createPairingRequest({
        invitationToken,
        remoteAddress: '203.0.113.40',
        installationId: 'browser-installation',
        profile: {
            identityMode: 'anonymous',
            customName: 'Ignored Name',
            avatarId: 'avatar-1',
        },
        clientKind: 'browser',
        identityToken: identity.identityToken,
    });
    assert.equal(events[0].displayName, identity.anonymousAlias);
    assert.throws(
        () => authority.createPairingRequest({
            invitationToken,
            remoteAddress: '203.0.113.40',
            installationId: 'browser-installation-2',
            profile: {
                identityMode: 'anonymous',
                customName: '',
                avatarId: 'avatar-1',
            },
            clientKind: 'browser',
            identityToken: identity.identityToken,
        }),
        /invalid-browser-identity/,
    );

    const paired = authority.confirmPairing(request.requestId, events[0].code, '203.0.113.40');
    const session = authority.exchangeBrowserToken(paired.browserToken);
    assert.equal(session.clientKind, 'browser');
    assert.equal(session.remote, true);
    assert.equal(session.anonymousAlias, identity.anonymousAlias);
    assert.equal(session.profile.identityMode, 'anonymous');

    const wrongAddressIdentity = authority.createBrowserIdentity({
        invitationToken,
        remoteAddress: '203.0.113.41',
    });
    assert.throws(
        () => authority.createPairingRequest({
            invitationToken,
            remoteAddress: '203.0.113.42',
            installationId: 'browser-wrong-address',
            profile: {
                identityMode: 'anonymous',
                customName: '',
                avatarId: 'avatar-1',
            },
            clientKind: 'browser',
            identityToken: wrongAddressIdentity.identityToken,
        }),
        /invalid-browser-identity/,
    );
});

test('remote browser identity accepts a validated custom Unicode name', () => {
    const RemoteSessionAuthority = loadAuthority();
    const authority = new RemoteSessionAuthority();
    const invitationToken = authority.createInvitation();
    const identity = authority.createBrowserIdentity({
        invitationToken,
        remoteAddress: '198.51.100.50',
    });
    const events = [];
    authority.onPairingRequest((event) => events.push(event));
    const request = authority.createPairingRequest({
        invitationToken,
        remoteAddress: '198.51.100.50',
        installationId: 'browser-custom',
        profile: {
            identityMode: 'custom',
            customName: 'Álvaro Ω',
            avatarId: 'avatar-1',
        },
        clientKind: 'browser',
        identityToken: identity.identityToken,
    });
    assert.equal(events[0].displayName, 'Álvaro Ω');
    const paired = authority.confirmPairing(request.requestId, events[0].code, '198.51.100.50');
    const session = authority.exchangeBrowserToken(paired.browserToken);
    assert.equal(session.profile.customName, 'Álvaro Ω');
    assert.equal(session.clientKind, 'browser');
});
