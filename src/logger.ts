import { type LogOutputChannel, window } from 'vscode';

let outputChannel: LogOutputChannel | undefined;

export function initLogger(): LogOutputChannel {
  outputChannel = window.createOutputChannel('CfxLua', { log: true });
  outputChannel.show(true); // Show the output channel, preserve focus
  return outputChannel;
}

export function log(message: string) {
  outputChannel?.info(message);
}

export function warn(message: string) {
  outputChannel?.warn(message);
}