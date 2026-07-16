import { window, OutputChannel } from 'vscode';

let outputChannel: OutputChannel | undefined;

export function initLogger() {
  outputChannel = window.createOutputChannel('CfxLua');
  return outputChannel;
}

export function log(message: string) {
  outputChannel?.appendLine(`[${new Date().toLocaleTimeString()}] ${message}`);
}
