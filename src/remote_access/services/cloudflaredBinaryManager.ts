import * as crypto from 'crypto';
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import { spawn } from 'child_process';
import * as vscode from 'vscode';

interface CloudflaredAsset {
    url: string;
    sha256: string;
    fileName: string;
    sizeLabel: string;
}

export const CLOUDFLARED_VERSION = '2026.5.2';

const ASSETS: Record<string, CloudflaredAsset> = {
    'win32-x64': {
        url: `https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-windows-amd64.exe`,
        sha256: '20b9638f685333d623798e733effbad2487093f15ba592f6c7752360ff3b7ab7',
        fileName: 'cloudflared.exe',
        sizeLabel: '51.61 MiB',
    },
    'linux-x64': {
        url: `https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-linux-amd64`,
        sha256: '5286698547f03df745adb2355f04c12dde52ef425491e81f433642d695521886',
        fileName: 'cloudflared',
        sizeLabel: '37.39 MiB',
    },
    'linux-arm64': {
        url: `https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-linux-arm64`,
        sha256: '5a4e8ce2701105271412059f44b6a0bf1ae4542b4d98ff3180c0c019443a5815',
        fileName: 'cloudflared',
        sizeLabel: '35.13 MiB',
    },
};

/** Sealed after the user accepts the download modal once. */
const CLOUDFLARED_CONSENT_KEY = 'codexr.cloudflaredDownloadConsented';

export class CloudflaredBinaryManager {
    private readonly binaryDirectory: string;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.binaryDirectory = path.join(context.globalStorageUri.fsPath, 'remote-access', CLOUDFLARED_VERSION);
    }

    public async resolveBinary(offerDownload: boolean): Promise<string | null> {
        const systemBinary = await this.findSystemBinary();
        if (systemBinary) {
            return systemBinary;
        }

        const asset = this.getAsset();
        if (!asset) {
            throw new Error(
                `There is no automatic cloudflared download for ${process.platform}/${process.arch}. Install it on your PATH to use remote connections.`,
            );
        }
        const managedPath = path.join(this.binaryDirectory, asset.fileName);
        if (await this.matchesChecksum(managedPath, asset.sha256) && await this.isValidBinary(managedPath)) {
            return managedPath;
        }
        if (!offerDownload) {
            return null;
        }

        // The consent modal appears once per installation: accepting it is
        // remembered, so later downloads (a missing binary, a version bump)
        // proceed directly with just the progress notification. Declining
        // never seals the marker, so the question comes back next time.
        if (!this.context.globalState.get<boolean>(CLOUDFLARED_CONSENT_KEY)) {
            const answer = await vscode.window.showInformationMessage(
                `CodeXR needs cloudflared ${CLOUDFLARED_VERSION} (${asset.sizeLabel}) to create the temporary link. It is downloaded once from GitHub/Cloudflare, verified with SHA-256 and stored in global storage. License: Apache-2.0.`,
                { modal: true },
                'Download cloudflared',
            );
            if (answer !== 'Download cloudflared') {
                return null;
            }
            await this.context.globalState.update(CLOUDFLARED_CONSENT_KEY, true);
        }
        await this.download(asset, managedPath);
        return managedPath;
    }

    private getAsset(): CloudflaredAsset | null {
        return ASSETS[`${process.platform}-${process.arch}`] || null;
    }

    /**
     * Removes CodeXR's own managed download when the user disables
     * cross-network connections. Never touches a system-wide `cloudflared`
     * found on PATH: that installation is not CodeXR's to remove. A later
     * re-enable re-downloads if needed; prior consent still stands, so that
     * redownload proceeds without asking again.
     */
    public async uninstallManagedBinary(): Promise<void> {
        await fs.promises.rm(this.binaryDirectory, { recursive: true, force: true });
    }

    private async findSystemBinary(): Promise<string | null> {
        const executable = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
        const candidates = String(process.env.PATH || '')
            .split(path.delimiter)
            .filter(Boolean)
            .map((directory) => path.join(directory.replace(/^"|"$/g, ''), executable));
        for (const candidate of candidates) {
            if (fs.existsSync(candidate) && await this.isValidBinary(candidate)) {
                return candidate;
            }
        }
        return null;
    }

    private isValidBinary(binaryPath: string): Promise<boolean> {
        return new Promise((resolve) => {
            const child = spawn(binaryPath, ['--version'], {
                shell: false,
                windowsHide: true,
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            const timer = setTimeout(() => {
                child.kill();
                resolve(false);
            }, 5000);
            child.once('error', () => {
                clearTimeout(timer);
                resolve(false);
            });
            child.once('exit', (code) => {
                clearTimeout(timer);
                resolve(code === 0);
            });
        });
    }

    private async download(asset: CloudflaredAsset, destination: string): Promise<void> {
        await fs.promises.mkdir(path.dirname(destination), { recursive: true });
        const temporaryPath = `${destination}.download`;
        await fs.promises.rm(temporaryPath, { force: true });
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Downloading cloudflared ${CLOUDFLARED_VERSION}`,
                cancellable: false,
            }, async (progress) => {
                let reported = 0;
                await this.downloadToFile(asset.url, temporaryPath, (received, total) => {
                    if (total > 0) {
                        const percentage = Math.max(0, Math.min(100, (received / total) * 100));
                        progress.report({ increment: percentage - reported });
                        reported = percentage;
                    }
                });
            });
            if (!await this.matchesChecksum(temporaryPath, asset.sha256)) {
                throw new Error('The cloudflared SHA-256 checksum does not match the pinned version.');
            }
            if (process.platform !== 'win32') {
                await fs.promises.chmod(temporaryPath, 0o755);
            }
            await fs.promises.rm(destination, { force: true });
            await fs.promises.rename(temporaryPath, destination);
            if (!await this.isValidBinary(destination)) {
                throw new Error('The downloaded cloudflared executable could not be validated.');
            }
        } catch (error) {
            await fs.promises.rm(temporaryPath, { force: true });
            throw error;
        }
    }

    private downloadToFile(
        url: string,
        destination: string,
        onProgress: (received: number, total: number) => void,
        redirects = 0,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = https.get(url, (response) => {
                const status = response.statusCode || 0;
                const redirect = response.headers.location;
                if (status >= 300 && status < 400 && redirect && redirects < 5) {
                    response.resume();
                    this.downloadToFile(
                        new URL(redirect, url).toString(),
                        destination,
                        onProgress,
                        redirects + 1,
                    ).then(resolve, reject);
                    return;
                }
                if (status !== 200) {
                    response.resume();
                    reject(new Error(`Cloudflare responded with HTTP ${status || 'unknown'}.`));
                    return;
                }
                const total = Number(response.headers['content-length'] || 0);
                if (total > 100 * 1024 * 1024) {
                    response.resume();
                    reject(new Error('The cloudflared download exceeds the expected size limit.'));
                    return;
                }
                let received = 0;
                const output = fs.createWriteStream(destination, { flags: 'wx', mode: 0o700 });
                response.on('data', (chunk: Buffer) => {
                    received += chunk.length;
                    if (received > 100 * 1024 * 1024) {
                        response.destroy(new Error('The cloudflared download exceeds the expected size limit.'));
                        return;
                    }
                    onProgress(received, total);
                });
                response.pipe(output);
                output.once('finish', () => output.close(() => resolve()));
                output.once('error', reject);
                response.once('error', reject);
            });
            request.once('error', reject);
        });
    }

    private async matchesChecksum(filePath: string, expected: string): Promise<boolean> {
        try {
            const hash = crypto.createHash('sha256');
            await new Promise<void>((resolve, reject) => {
                fs.createReadStream(filePath)
                    .on('data', (chunk) => hash.update(chunk))
                    .once('end', resolve)
                    .once('error', reject);
            });
            return hash.digest('hex') === expected;
        } catch {
            return false;
        }
    }
}
