"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeCommand = executeCommand;
const childProcess = __importStar(require("child_process"));
/**
 * Executes a command with the specified options
 * @param command Command to execute
 * @param args Arguments for the command
 * @param options Options for execution
 * @returns Promise with stdout or rejects with stderr
 */
function executeCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        // Create default options
        const execOptions = {
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
            }
            else {
                reject(new Error(stderr || `Command failed with exit code ${code}`));
            }
        });
        // Handle process errors
        childProcessInstance.on('error', (err) => {
            reject(err);
        });
    });
}
//# sourceMappingURL=processUtils.js.map