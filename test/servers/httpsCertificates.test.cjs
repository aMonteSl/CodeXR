const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const webpackConfigSource = fs.readFileSync(path.join(projectRoot, 'webpack.config.js'), 'utf8');
const packageVsixSource = fs.readFileSync(path.join(projectRoot, 'scripts', 'package-vsix.mjs'), 'utf8');
const extensionSource = fs.readFileSync(path.join(projectRoot, 'src', 'extension.ts'), 'utf8');
const httpsDefaultServerSource = fs.readFileSync(path.join(projectRoot, 'src', 'servers', 'runtime', 'httpsDefaultServer.ts'), 'utf8');
const httpsCustomServerSource = fs.readFileSync(path.join(projectRoot, 'src', 'servers', 'runtime', 'httpsCustomServer.ts'), 'utf8');

function loadGeneratedHttpsCertificateManager() {
    return require(path.join(projectRoot, 'out', 'servers', 'runtime', 'generatedHttpsCertificateManager.js'));
}

test('GeneratedHttpsCertificateManager creates certificate assets inside VS Code global storage and reuses them', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codexr-generated-certs-'));

    try {
        const { GeneratedHttpsCertificateManager } = loadGeneratedHttpsCertificateManager();
        const manager = new GeneratedHttpsCertificateManager({
            globalStorageUri: { fsPath: tempRoot },
        });

        const first = await manager.ensureDefaultCertificatePair();
        assert.ok(first.certPath.startsWith(tempRoot));
        assert.ok(first.keyPath.startsWith(tempRoot));
        assert.ok(first.metadataPath.startsWith(tempRoot));
        assert.ok(fs.existsSync(first.certPath));
        assert.ok(fs.existsSync(first.keyPath));
        assert.ok(fs.existsSync(first.metadataPath));

        const firstCert = fs.readFileSync(first.certPath, 'utf8');
        const firstKey = fs.readFileSync(first.keyPath, 'utf8');
        const metadata = JSON.parse(fs.readFileSync(first.metadataPath, 'utf8'));

        assert.match(firstCert, /BEGIN CERTIFICATE/);
        assert.match(firstKey, /BEGIN (RSA |EC )?PRIVATE KEY/);
        assert.equal(metadata.version, 1);
        assert.ok(Array.isArray(metadata.sanDnsNames));
        assert.ok(Array.isArray(metadata.sanIpAddresses));

        const second = await manager.ensureDefaultCertificatePair();
        assert.equal(fs.readFileSync(second.certPath, 'utf8'), firstCert);
        assert.equal(fs.readFileSync(second.keyPath, 'utf8'), firstKey);
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('GeneratedHttpsCertificateManager regenerates the pair when a persisted file becomes invalid', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codexr-generated-certs-'));

    try {
        const { GeneratedHttpsCertificateManager } = loadGeneratedHttpsCertificateManager();
        const manager = new GeneratedHttpsCertificateManager({
            globalStorageUri: { fsPath: tempRoot },
        });

        const initial = await manager.ensureDefaultCertificatePair();
        const originalCert = fs.readFileSync(initial.certPath, 'utf8');

        fs.writeFileSync(initial.certPath, 'invalid certificate', 'utf8');

        const regenerated = await manager.ensureDefaultCertificatePair();
        const regeneratedCert = fs.readFileSync(regenerated.certPath, 'utf8');
        const regeneratedKey = fs.readFileSync(regenerated.keyPath, 'utf8');

        assert.match(regeneratedCert, /BEGIN CERTIFICATE/);
        assert.match(regeneratedKey, /BEGIN (RSA |EC )?PRIVATE KEY/);
        assert.notEqual(regeneratedCert, 'invalid certificate');
        assert.notEqual(regeneratedCert, originalCert);
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('runtime no longer references bundled repo certificates and startup prewarms generated local certificates', () => {
    assert.match(extensionSource, /GeneratedHttpsCertificateManager/);
    assert.match(extensionSource, /ensureDefaultCertificatePair\(\)/);
    assert.equal(httpsDefaultServerSource.includes('babia_cert.pem'), false);
    assert.equal(httpsDefaultServerSource.includes('babia_key.pem'), false);
    assert.equal(httpsCustomServerSource.includes('babia_cert.pem'), false);
    assert.equal(httpsCustomServerSource.includes('babia_key.pem'), false);
    assert.match(httpsDefaultServerSource, /generated local certificates/);
    assert.match(httpsCustomServerSource, /generated local certificates/);
});

test('packaging excludes repo certificates from webpack and adds a defensive VSIX guard', () => {
    assert.equal(packageJson.files.includes('certs/**/*'), false);
    assert.equal(webpackConfigSource.includes("from: 'certs'"), false);
    assert.equal(webpackConfigSource.includes("to: 'certs'"), false);
    assert.match(packageVsixSource, /staleDistCertsPath/);
    assert.match(packageVsixSource, /packageJson\.files\.includes\('certs\/\*\*\/\*'\)/);
});
