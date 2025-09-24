import * as vscode from 'vscode';
import { registerCommands } from './commands';

export function activate(ctx: vscode.ExtensionContext) {
	console.log('CodeWave-X is now active!');
	
	//commands
	registerCommands(ctx);
}

export function deactivate() {}
