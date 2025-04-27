import * as vscode from 'vscode';
import { executeCommand } from './utils/processUtils';
import { PythonEnvironmentInfo } from './models/environmentModel';
import { PackageInfo, PackageStatus } from './models/environmentModel';

/**
 * Checks if a package is installed
 * @param packageName Name of the package to check
 * @param envInfo Python environment information
 * @param outputChannel Output channel to show progress
 * @returns Package information
 */
export async function checkPackage(
  packageName: string, 
  envInfo: PythonEnvironmentInfo,
  outputChannel: vscode.OutputChannel
): Promise<PackageInfo> {
  try {
    if (!envInfo.pipExecutable) {
      throw new Error('No pip executable found in environment');
    }
    
    // Check if package is installed
    outputChannel.appendLine(`Checking if ${packageName} is installed...`);
    
    try {
      const output = await executeCommand(
        envInfo.pipExecutable,
        ['show', packageName],
        { showOutput: true, outputChannel }
      );
      
      // Extract version from output
      const versionMatch = output.match(/Version: ([\d\.]+)/);
      const version = versionMatch ? versionMatch[1] : undefined;
      
      return {
        name: packageName,
        status: PackageStatus.INSTALLED,
        version
      };
    } catch (error) {
      // Package is not installed
      return {
        name: packageName,
        status: PackageStatus.NOT_INSTALLED
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return {
      name: packageName,
      status: PackageStatus.ERROR,
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
export async function installPackage(
  packageName: string, 
  envInfo: PythonEnvironmentInfo,
  outputChannel: vscode.OutputChannel
): Promise<PackageInfo> {
  try {
    // Check if package is already installed
    const packageInfo = await checkPackage(packageName, envInfo, outputChannel);
    
    if (packageInfo.status === PackageStatus.INSTALLED) {
      return packageInfo;
    }
    
    if (packageInfo.status === PackageStatus.ERROR) {
      throw new Error(packageInfo.error);
    }
    
    if (!envInfo.pipExecutable) {
      throw new Error('No pip executable found in environment');
    }
    
    // Install the package
    outputChannel.appendLine(`Installing ${packageName}...`);
    outputChannel.show();
    
    await executeCommand(
      envInfo.pipExecutable,
      ['install', packageName, '--upgrade'],
      { showOutput: true, outputChannel }
    );
    
    // Verify the package was installed
    const newPackageInfo = await checkPackage(packageName, envInfo, outputChannel);
    
    if (newPackageInfo.status !== PackageStatus.INSTALLED) {
      throw new Error(`Failed to install ${packageName}`);
    }
    
    // Return the installed package info
    return {
      ...newPackageInfo,
      status: PackageStatus.INSTALLED_NOW
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`Error installing ${packageName}: ${errorMessage}`);
    
    return {
      name: packageName,
      status: PackageStatus.ERROR,
      error: errorMessage
    };
  }
}