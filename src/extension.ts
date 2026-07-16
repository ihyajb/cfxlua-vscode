import * as os from 'node:os';
import {
  ConfigurationTarget,
  type ExtensionContext,
  StatusBarAlignment,
  type StatusBarItem,
  type Uri,
  commands,
  extensions,
  window,
  workspace,
} from 'vscode';
import ensureStorage from './ensureStorage';
import { getBaseScope } from './getSettingsScope';
import { initLogger, log } from './logger';
import setLibrary from './setLibrary';
import setNativeLibrary from './setNativeLibrary';
import setPlugin from './setPlugin';
import toTildePath from './toTildePath';

export const id = 'ihyajb.cfxlua-intellisense-aj';
export const extension = extensions.getExtension(id)!;
export let storagePath = '';

const GAME_LABELS: Record<string, string> = {
  gtav: 'GTA V',
  rdr3: 'RDR3',
};

const ALL_LIBRARY_FOLDERS = [
  'runtime',
  'natives/CFX-NATIVE',
  'natives/GTAV',
  'natives/RDR3',
];

let statusBarItem: StatusBarItem;

function updateStatusBar(game: string) {
  const label = GAME_LABELS[game] || game.toUpperCase();
  statusBarItem.text = `$(game) Game: ${label}`;
  statusBarItem.tooltip = `Current: ${label} — Click to switch`;
}

/** The effective game for a resource, honoring workspace-folder overrides. */
function getGameFor(resource?: Uri): string {
  return workspace
    .getConfiguration('cfxlua', resource ?? null)
    .get('game', 'gtav');
}

export async function activate(context: ExtensionContext) {
  context.subscriptions.push(initLogger());

  const game = workspace.getConfiguration('cfxlua').get('game', 'gtav');

  // `~`-relative so the value written to settings.json stays portable
  // across machines; file I/O always uses real Uris, never this string
  storagePath = toTildePath(context.globalStorageUri.fsPath, os.homedir());

  log(`Platform: ${os.platform()}, Game: ${game}`);
  log(`Storage path: ${storagePath}`);

  try {
    await ensureStorage(context);

    await setPlugin(true);
    await setLibrary(
      ['runtime', 'natives/CFX-NATIVE', `natives/${game.toUpperCase()}`],
      true,
      { target: getBaseScope() },
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
      const current = getGameFor(window.activeTextEditor?.document.uri);
      setNativeLibrary(current === 'gtav' ? 'rdr3' : 'gtav');
    }),

    // Reflect folder-level game overrides as the user moves between editors
    window.onDidChangeActiveTextEditor((editor) => {
      updateStatusBar(getGameFor(editor?.document.uri));
    }),

    // Apply the setting when it's edited directly (settings.json, Settings
    // Sync) — not just via our commands. setNativeLibrary only writes values
    // that differ, so its own update doesn't re-trigger this in a loop.
    workspace.onDidChangeConfiguration(async (e) => {
      if (!e.affectsConfiguration('cfxlua.game')) {
        return;
      }

      const newGame = getGameFor(window.activeTextEditor?.document.uri);
      updateStatusBar(newGame);
      log(`Game setting changed to: ${newGame}`);
      await setNativeLibrary(newGame);
    }),
  );
}

export async function deactivate() {
  await setPlugin(false);
  await setLibrary(ALL_LIBRARY_FOLDERS, false, { target: getBaseScope() });

  // Also clear folder-level entries written for multi-root workspaces
  for (const folder of workspace.workspaceFolders ?? []) {
    await setLibrary(ALL_LIBRARY_FOLDERS, false, {
      target: ConfigurationTarget.WorkspaceFolder,
      folder,
    });
  }
}
