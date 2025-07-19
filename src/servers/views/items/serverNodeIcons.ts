import * as vscode from 'vscode';

/**
 * VS Code icon references for server tree items
 */
export const ServerNodeIcons = {
    // Main groups
    servers: new vscode.ThemeIcon('server-environment'),
    configuration: new vscode.ThemeIcon('gear'),
    startServer: new vscode.ThemeIcon('play'),
    
    // Configuration options
    httpMode: new vscode.ThemeIcon('globe'),
    httpModeSecure: new vscode.ThemeIcon('lock'),
    httpModeUnsecure: new vscode.ThemeIcon('unlock'),
    defaultPort: new vscode.ThemeIcon('plug'),
    autoOpen: new vscode.ThemeIcon('eye'),
    openMode: new vscode.ThemeIcon('layout'),
    reset: new vscode.ThemeIcon('discard'),
    
    // Active servers actions
    stopAll: new vscode.ThemeIcon('stop-circle')
} as const;
