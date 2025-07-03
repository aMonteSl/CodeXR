"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPackage = checkPackage;
exports.installPackage = installPackage;
const processUtils_1 = require("./utils/processUtils");
const environmentModel_1 = require("./models/environmentModel");
/**
 * Checks if a package is installed
 * @param packageName Name of the package to check
 * @param envInfo Python environment information
 * @param outputChannel Output channel to show progress
 * @returns Package information
 */
async function checkPackage(packageName, envInfo, outputChannel) {
    try {
        if (!envInfo.pipExecutable) {
            throw new Error('No pip executable found in environment');
        }
        // Check if package is installed
        outputChannel.appendLine(`Checking if ${packageName} is installed...`);
        try {
            const output = await (0, processUtils_1.executeCommand)(envInfo.pipExecutable, ['show', packageName], { showOutput: true, outputChannel });
            // Extract version from output
            const versionMatch = output.match(/Version: ([\d\.]+)/);
            const version = versionMatch ? versionMatch[1] : undefined;
            return {
                name: packageName,
                status: environmentModel_1.PackageStatus.INSTALLED,
                version
            };
        }
        catch (error) {
            // Package is not installed
            return {
                name: packageName,
                status: environmentModel_1.PackageStatus.NOT_INSTALLED
            };
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            name: packageName,
            status: environmentModel_1.PackageStatus.ERROR,
            error: errorMessage
        };
    }
}
/**
 * Installs a package
 * @param packageName Name of the package to install
 * @param envInfo Python environment information
 * @param outputChannel Output channel to show progress
 * @returns Package information
 */
async function installPackage(packageName, envInfo, outputChannel) {
    try {
        // Check if package is already installed
        const packageInfo = await checkPackage(packageName, envInfo, outputChannel);
        if (packageInfo.status === environmentModel_1.PackageStatus.INSTALLED) {
            return packageInfo;
        }
        if (packageInfo.status === environmentModel_1.PackageStatus.ERROR) {
            throw new Error(packageInfo.error);
        }
        if (!envInfo.pipExecutable) {
            throw new Error('No pip executable found in environment');
        }
        // Install the package
        outputChannel.appendLine(`Installing ${packageName}...`);
        outputChannel.show();
        await (0, processUtils_1.executeCommand)(envInfo.pipExecutable, ['install', packageName, '--upgrade'], { showOutput: true, outputChannel });
        // Verify the package was installed
        const newPackageInfo = await checkPackage(packageName, envInfo, outputChannel);
        if (newPackageInfo.status !== environmentModel_1.PackageStatus.INSTALLED) {
            throw new Error(`Failed to install ${packageName}`);
        }
        // Return the installed package info
        return {
            ...newPackageInfo,
            status: environmentModel_1.PackageStatus.INSTALLED_NOW
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`Error installing ${packageName}: ${errorMessage}`);
        return {
            name: packageName,
            status: environmentModel_1.PackageStatus.ERROR,
            error: errorMessage
        };
    }
}
//# sourceMappingURL=packageManager.js.map