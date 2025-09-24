import * as vscode from 'vscode';
import { uploadCodebase } from './preparation/uploadCodebase.command';


export const registerCommands = (context: vscode.ExtensionContext) => {
    const vsc = vscode.commands;
    context.subscriptions.push(
        vsc.registerCommand('codewave.uploadCodebase', uploadCodebase),
    );
};