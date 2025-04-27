import * as childProcess from 'child_process';
import * as vscode from 'vscode';

/**
 * Options for executing a process
 */
interface ExecuteOptions {
  /** Working directory for the process */
  cwd?: string;
  /** Environment variables for the process */
  env?: NodeJS.ProcessEnv;
  /** Show output in output channel */
  showOutput?: boolean;
  /** Output channel to use */
  outputChannel?: vscode.OutputChannel;
}

/**
 * Executes a command with the specified options
 * @param command Command to execute
 * @param args Arguments for the command
 * @param options Options for execution
 * @returns Promise with stdout or rejects with stderr
 */
export function executeCommand(
  command: string, 
  args: string[], 
  options: ExecuteOptions = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Create default options
    const execOptions: childProcess.SpawnOptions = {
      cwd: options.cwd,
      env: options.env || process.env,
      shell: true
    };
    
    // If the platform is windows, use shell
    if (process.platform === 'win32') {
      execOptions.shell = true;
    }
    
    // Write to output channel if requested
    if (options.showOutput && options.outputChannel) {
      options.outputChannel.appendLine(`> ${command} ${args.join(' ')}`);
    }
    
    // Execute the command
    const childProcessInstance = childProcess.spawn(command, args, execOptions);
    
    let stdout = '';
    let stderr = '';
    
    // Collect stdout
    childProcessInstance.stdout?.on('data', (data) => {
      const dataStr = data.toString();
      stdout += dataStr;
      
      if (options.showOutput && options.outputChannel) {
        options.outputChannel.append(dataStr);
      }
    });
    
    // Collect stderr
    childProcessInstance.stderr?.on('data', (data) => {
      const dataStr = data.toString();
      stderr += dataStr;
      
      if (options.showOutput && options.outputChannel) {
        options.outputChannel.append(dataStr);
      }
    });
    
    // Handle process completion
    childProcessInstance.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `Command failed with exit code ${code}`));
      }
    });
    
    // Handle process errors
    childProcessInstance.on('error', (err) => {
      reject(err);
    });
  });
}