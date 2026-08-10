import { type OutputChannel, window } from 'vscode';

let outputChannel: OutputChannel | undefined;

export function initLogger(): OutputChannel {
  outputChannel = window.createOutputChannel('CfxLua');

  return outputChannel;
}

export function log(message: string) {
  outputChannel?.appendLine(`[${new Date().toLocaleTimeString()}] ${message}`);
}

/** Reveals the log, so troubleshooting is a command rather than a menu hunt. */
export function showLog() {
  outputChannel?.show(true);
}
