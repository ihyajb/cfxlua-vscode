import {
  type ExtensionContext,
  extensions,
  workspace,
  commands,
  window,
  Uri,
  StatusBarAlignment,
  type StatusBarItem,
} from 'vscode';
import setPlugin from './setPlugin';
import setLibrary from './setLibrary';
import setNativeLibrary from './setNativeLibrary';
import copyToStorage from './moveFile';
import { initLogger, log } from './logger';
import * as path from 'node:path';
import * as os from 'node:os';

export const id = 'ihyajb.cfxlua-intellisense';
export const extension = extensions.getExtension(id)!;
export let storagePath = '';

const GAME_LABELS: Record<string, string> = {
  gtav: 'GTA V',
  rdr3: 'RDR3',
};

let statusBarItem: StatusBarItem;

function updateStatusBar(game: string) {
  const label = GAME_LABELS[game] || game.toUpperCase();
  statusBarItem.text = `$(game) Game: ${label}`;
  statusBarItem.tooltip = `Current: ${label} — Click to switch`;
}

export async function activate(context: ExtensionContext) {
  const logger = initLogger();
  context.subscriptions.push(logger);

  const game = workspace.getConfiguration('cfxlua').get('game', 'gtav');
  const storageUri = context.globalStorageUri;
  const sourceUri = Uri.joinPath(extension.extensionUri, 'plugin');
  const platform = os.platform();
  storagePath = storageUri.toString();

  if (platform === 'win32') {
    storagePath = path.join(
      '~',
      storagePath.substring(storagePath.indexOf('AppData')),
    );
  } else if (platform === 'darwin') {
    storagePath = path.join(
      '~',
      storagePath.substring(storagePath.indexOf('Library')),
    );
  }

  log(`Platform: ${platform}, Game: ${game}`);
  log(`Storage path: ${storagePath}`);

  try {
    await Promise.all([
      copyToStorage('plugin.lua', sourceUri, storageUri),
      copyToStorage('library', sourceUri, storageUri),
    ]);

    await setPlugin(true);
    await setLibrary(
      ['runtime', 'natives/CFX-NATIVE', `natives/${game.toUpperCase()}`],
      true,
    );

    log('Extension activated successfully');
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log(`Activation error: ${message}`);
    window.showErrorMessage(`CfxLua: Failed to activate — ${message}`);
  }

  // Status bar item showing current game with click-to-toggle
  statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 0);
  statusBarItem.command = 'cfxlua.game.toggle';
  updateStatusBar(game);
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(
    commands.registerCommand('cfxlua.game.gtav', () =>
      setNativeLibrary('gtav'),
    ),

    commands.registerCommand('cfxlua.game.rdr3', () =>
      setNativeLibrary('rdr3'),
    ),

    commands.registerCommand('cfxlua.game.toggle', () => {
      const current = workspace
        .getConfiguration('cfxlua')
        .get('game', 'gtav');
      setNativeLibrary(current === 'gtav' ? 'rdr3' : 'gtav');
    }),

    // React to settings changes (e.g. user edits settings.json directly)
    workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('cfxlua.game')) {
        const newGame = workspace
          .getConfiguration('cfxlua')
          .get('game', 'gtav');
        updateStatusBar(newGame);
        log(`Game setting changed to: ${newGame}`);
      }
    }),
  );
}

export async function deactivate() {
  await setPlugin(false);
  await setLibrary(
    ['runtime', 'natives/CFX-NATIVE', 'natives/GTAV', 'natives/RDR3'],
    false,
  );
}
