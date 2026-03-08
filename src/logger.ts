import { window } from 'vscode';

let outputChannel: ReturnType<typeof window.createOutputChannel> | undefined;

export function initLogger() {
  outputChannel = window.createOutputChannel('CfxLua');
  return outputChannel;
}

export function log(message: string) {
  outputChannel?.appendLine(`[${new Date().toLocaleTimeString()}] ${message}`);
}
