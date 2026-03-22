import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { X509Certificate } from 'crypto';
import type * as vscode from 'vscode';
import { generate as generateSelfSigned } from 'selfsigned';

export interface GeneratedHttpsCertificatePaths {
    certPath: string;
    keyPath: string;
    metadataPath: string;
}

export interface GeneratedHttpsCertificateMetadata {
    version: number;
    generatedAt: string;
    expiresAt: string;
    fingerprint: string;
    sanDnsNames: string[];
    sanIpAddresses: string[];
}

type CertificateStorageContext = Pick<vscode.ExtensionContext, 'globalStorageUri'>;

const CERTIFICATE_METADATA_VERSION = 1;
const CERTIFICATE_DIRECTORY_NAME = 'server-certs';
const CERTIFICATE_FILENAME = 'codexr-default-cert.pem';
const KEY_FILENAME = 'codexr-default-key.pem';
const METADATA_FILENAME = 'metadata.json';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const CERTIFICATE_VALIDITY_DAYS = 365;

export class GeneratedHttpsCertificateManager {
    constructor(private readonly context: CertificateStorageContext) {}

    public async ensureDefaultCertificatePair(): Promise<GeneratedHttpsCertificatePaths> {
        const paths = this.getDefaultCertificatePaths();
        await fs.promises.mkdir(path.dirname(paths.certPath), { recursive: true });

        if (await this.hasReusableCertificatePair(paths)) {
            return paths;
        }

        return this.generateCertificatePair(paths);
    }

    public getDefaultCertificatePaths(): GeneratedHttpsCertificatePaths {
        const certificateDirectory = path.join(this.context.globalStorageUri.fsPath, CERTIFICATE_DIRECTORY_NAME);
        return {
            certPath: path.join(certificateDirectory, CERTIFICATE_FILENAME),
            keyPath: path.join(certificateDirectory, KEY_FILENAME),
            metadataPath: path.join(certificateDirectory, METADATA_FILENAME),
        };
    }

    private async hasReusableCertificatePair(paths: GeneratedHttpsCertificatePaths): Promise<boolean> {
        if (!fs.existsSync(paths.certPath) || !fs.existsSync(paths.keyPath)) {
            return false;
        }

        try {
            const certPem = await fs.promises.readFile(paths.certPath, 'utf8');
            const keyPem = await fs.promises.readFile(paths.keyPath, 'utf8');

            if (!this.isValidCertificatePem(certPem) || !this.isValidPrivateKeyPem(keyPem)) {
                return false;
            }

            const certificate = new X509Certificate(certPem);
            const expiresAt = new Date(certificate.validTo);
            if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
                return false;
            }

            if (!fs.existsSync(paths.metadataPath)) {
                await this.writeMetadata(
                    paths.metadataPath,
                    this.buildMetadata(certificate, this.getDefaultDnsNames(), this.getDefaultIpAddresses()),
                );
            }

            return true;
        } catch {
            return false;
        }
    }

    private async generateCertificatePair(paths: GeneratedHttpsCertificatePaths): Promise<GeneratedHttpsCertificatePaths> {
        const sanDnsNames = this.getDefaultDnsNames();
        const sanIpAddresses = this.getDefaultIpAddresses();
        const notBeforeDate = new Date();
        const notAfterDate = new Date(notBeforeDate.getTime() + CERTIFICATE_VALIDITY_DAYS * ONE_DAY_MS);

        const generated = await generateSelfSigned(
            [
                { name: 'commonName', value: 'localhost' },
            ],
            {
                algorithm: 'sha256',
                keySize: 2048,
                notBeforeDate,
                notAfterDate,
                extensions: [
                    {
                        name: 'basicConstraints',
                        cA: false,
                    },
                    {
                        name: 'keyUsage',
                        digitalSignature: true,
                        keyEncipherment: true,
                    },
                    {
                        name: 'extKeyUsage',
                        serverAuth: true,
                        clientAuth: false,
                    },
                    {
                        name: 'subjectAltName',
                        altNames: [
                            ...sanDnsNames.map((value) => ({ type: 2 as const, value })),
                            ...sanIpAddresses.map((ip) => ({ type: 7 as const, ip })),
                        ],
                    },
                ],
            },
        );

        await fs.promises.writeFile(paths.certPath, generated.cert, 'utf8');
        await fs.promises.writeFile(paths.keyPath, generated.private, 'utf8');
        await this.applyBestEffortPermissions(paths.certPath, paths.keyPath);

        const certificate = new X509Certificate(generated.cert);
        await this.writeMetadata(paths.metadataPath, this.buildMetadata(certificate, sanDnsNames, sanIpAddresses));

        return paths;
    }

    private getDefaultDnsNames(): string[] {
        return ['localhost'];
    }

    private getDefaultIpAddresses(): string[] {
        const addresses = new Set<string>(['127.0.0.1', '::1']);
        const interfaces = os.networkInterfaces();

        for (const interfaceDetails of Object.values(interfaces)) {
            if (!interfaceDetails) {
                continue;
            }

            for (const iface of interfaceDetails) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    addresses.add(iface.address);
                }
            }
        }

        return Array.from(addresses);
    }

    private buildMetadata(
        certificate: X509Certificate,
        sanDnsNames: string[],
        sanIpAddresses: string[],
    ): GeneratedHttpsCertificateMetadata {
        return {
            version: CERTIFICATE_METADATA_VERSION,
            generatedAt: new Date().toISOString(),
            expiresAt: new Date(certificate.validTo).toISOString(),
            fingerprint: certificate.fingerprint256,
            sanDnsNames,
            sanIpAddresses,
        };
    }

    private async writeMetadata(metadataPath: string, metadata: GeneratedHttpsCertificateMetadata): Promise<void> {
        await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    }

    private async applyBestEffortPermissions(certPath: string, keyPath: string): Promise<void> {
        if (process.platform === 'win32') {
            return;
        }

        try {
            await fs.promises.chmod(certPath, 0o644);
        } catch {
            // Best effort only.
        }

        try {
            await fs.promises.chmod(keyPath, 0o600);
        } catch {
            // Best effort only.
        }
    }

    private isValidCertificatePem(certPem: string): boolean {
        return certPem.includes('BEGIN CERTIFICATE');
    }

    private isValidPrivateKeyPem(keyPem: string): boolean {
        return [
            'BEGIN PRIVATE KEY',
            'BEGIN RSA PRIVATE KEY',
            'BEGIN EC PRIVATE KEY',
        ].some((marker) => keyPem.includes(marker));
    }
}

