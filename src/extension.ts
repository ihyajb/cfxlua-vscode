import * as os from 'node:os';
import {
  ConfigurationTarget,
  type ExtensionContext,
  StatusBarAlignment,
  type StatusBarItem,
  type TextDocument,
  type Uri,
  commands,
  window,
  workspace,
} from 'vscode';
import { invalidateManifests, registerDiagnostics } from './diagnostics';
import ensureStorage from './ensureStorage';
import { findNative } from './findNative';
import { getBaseScope } from './getSettingsScope';
import { MANIFEST_GLOB, shouldConfigure } from './isCfxWorkspace';
import { initLogger, log, showLog } from './logger';
import { registerNativeHover } from './nativeHover';
import { loadCatalog, loadScopeTable, resetNativeIndex } from './nativesIndex';
import { newResource } from './newResource';
import setLibrary from './setLibrary';
import setNativeLibrary from './setNativeLibrary';
import setPlugin from './setPlugin';
import toTildePath from './toTildePath';
import { writeLuarc } from './writeLuarc';

export const id = 'ihyajb.cfxlua-intellisense-aj';
export let storagePath = '';

const GAME_LABELS: Record<string, string> = {
  gtav: 'GTA V',
  rdr3: 'RDR3',
};

/** Definition folders that do not depend on the selected game. */
const SHARED_LIBRARY_FOLDERS = ['runtime', 'manifest', 'natives/CFX-NATIVE'];

const ALL_LIBRARY_FOLDERS = [
  ...SHARED_LIBRARY_FOLDERS,
  'natives/GTAV',
  'natives/RDR3',
];

let statusBarItem: StatusBarItem | undefined;
let configured = false;

/** The effective game for a resource, honoring workspace-folder overrides. */
function getGameFor(resource?: Uri): string {
  return workspace
    .getConfiguration('cfxlua', resource ?? null)
    .get('game', 'gtav');
}

function activeGame(): string {
  return getGameFor(window.activeTextEditor?.document.uri);
}

/** Definition folders for a game: the shared ones plus that game's natives. */
function libraryFolders(game: string): string[] {
  return [...SHARED_LIBRARY_FOLDERS, `natives/${game.toUpperCase()}`];
}

function updateStatusBar(game: string) {
  if (statusBarItem === undefined) {
    return;
  }

  const label = GAME_LABELS[game] || game.toUpperCase();

  statusBarItem.text = `$(game) Game: ${label}`;
  statusBarItem.tooltip = `CfxLua — current: ${label}. Click to switch.`;

  // Only meaningful next to Lua, and showing it in an unrelated project is how
  // users discover an extension has configured something they did not ask for.
  if (configured && window.activeTextEditor?.document.languageId === 'lua') {
    statusBarItem.show();
  } else {
    statusBarItem.hide();
  }
}

/**
 * Applies the language server configuration for `game`.
 *
 * Called on activation for Cfx workspaces, and on demand when the user runs a
 * command in a workspace that was not configured automatically — choosing a game
 * is an explicit request to set the extension up.
 */
async function configure(
  context: ExtensionContext,
  game: string,
): Promise<void> {
  await ensureStorage(context);
  await setPlugin(true);
  await setLibrary(libraryFolders(game), true, { target: getBaseScope() });

  configured = true;
}

export async function activate(context: ExtensionContext) {
  context.subscriptions.push(initLogger());

  const game = activeGame();

  // `~`-relative so the value written to settings.json stays portable
  // across machines; file I/O always uses real Uris, never this string
  storagePath = toTildePath(context.globalStorageUri.fsPath, os.homedir());

  log(`Platform: ${os.platform()}, Game: ${game}`);
  log(`Storage path: ${storagePath}`);

  statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 0);
  statusBarItem.command = 'cfxlua.game.toggle';
  context.subscriptions.push(statusBarItem);

  /** Configures on demand, so commands work in a workspace we left alone. */
  const ensureConfigured = async (): Promise<boolean> => {
    if (configured) {
      return true;
    }

    try {
      await configure(context, activeGame());
      log('Configured on request');
      updateStatusBar(activeGame());

      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);

      log(`Configuration error: ${message}`);
      window.showErrorMessage(`CfxLua: failed to configure — ${message}`);

      return false;
    }
  };

  try {
    if (await shouldConfigure()) {
      await configure(context, game);
      log('Extension activated successfully');
    } else {
      log('Activated without configuring this workspace');
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);

    log(`Activation error: ${message}`);
    window.showErrorMessage(`CfxLua: Failed to activate — ${message}`);
  }

  updateStatusBar(game);

  /**
   * The definition data is read on first use, not here. Loading it during
   * activation cost every window the full parse — including windows that are
   * never configured and windows where nothing ever asks for it.
   */
  const catalog = () => loadCatalog(context.extensionUri, activeGame());

  const manifestWatcher = workspace.createFileSystemWatcher(MANIFEST_GLOB);

  const onManifestAppeared = async (): Promise<void> => {
    invalidateManifests();

    if (configured) {
      return;
    }

    if (await shouldConfigure()) {
      log('Resource manifest appeared; configuring');
      await ensureConfigured();
    }
  };

  context.subscriptions.push(
    registerDiagnostics({
      scopesFor: (document: TextDocument) =>
        loadScopeTable(context.extensionUri, getGameFor(document.uri)),
    }),

    registerNativeHover(catalog, (document) => getGameFor(document.uri)),

    manifestWatcher,
    manifestWatcher.onDidCreate(onManifestAppeared),
    manifestWatcher.onDidDelete(() => invalidateManifests()),
    manifestWatcher.onDidChange(() => invalidateManifests()),

    commands.registerCommand('cfxlua.game.gtav', async () => {
      if (await ensureConfigured()) {
        await setNativeLibrary('gtav');
      }
    }),

    commands.registerCommand('cfxlua.game.rdr3', async () => {
      if (await ensureConfigured()) {
        await setNativeLibrary('rdr3');
      }
    }),

    commands.registerCommand('cfxlua.game.toggle', async () => {
      if (!(await ensureConfigured())) {
        return;
      }

      const current = activeGame();

      await setNativeLibrary(current === 'gtav' ? 'rdr3' : 'gtav');
    }),

    commands.registerCommand('cfxlua.natives.find', async () => {
      const loaded = await catalog();

      if (loaded === undefined) {
        window.showWarningMessage(
          'CfxLua: the native index is unavailable, so native search is disabled.',
        );

        return;
      }

      await findNative(loaded, activeGame());
    }),

    commands.registerCommand('cfxlua.resource.new', () =>
      newResource(activeGame()),
    ),

    commands.registerCommand('cfxlua.config.writeLuarc', async () => {
      if (await ensureConfigured()) {
        await writeLuarc(libraryFolders(activeGame()));
      }
    }),

    commands.registerCommand('cfxlua.config.repair', async () => {
      resetNativeIndex();
      invalidateManifests();

      try {
        await configure(context, activeGame());
        window.showInformationMessage('CfxLua: configuration reapplied.');
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);

        window.showErrorMessage(`CfxLua: repair failed — ${message}`);
      }
    }),

    commands.registerCommand('cfxlua.config.remove', () => removeConfig()),

    commands.registerCommand('cfxlua.showLog', () => showLog()),

    // Reflect folder-level game overrides as the user moves between editors
    window.onDidChangeActiveTextEditor((editor) => {
      updateStatusBar(getGameFor(editor?.document.uri));
    }),

    // A folder added to a multi-root workspace may be the Cfx one.
    workspace.onDidChangeWorkspaceFolders(async () => {
      invalidateManifests();

      if (!configured && (await shouldConfigure())) {
        log('Workspace folders changed; configuring');
        await ensureConfigured();
      }
    }),

    // Apply the setting when it's edited directly (settings.json, Settings
    // Sync) — not just via our commands. setNativeLibrary only writes values
    // that differ, so its own update doesn't re-trigger this in a loop.
    workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration('cfxlua.autoConfigure')) {
        if (!configured && (await shouldConfigure())) {
          await ensureConfigured();
        }
      }

      if (!e.affectsConfiguration('cfxlua.game')) {
        return;
      }

      const newGame = activeGame();

      updateStatusBar(newGame);
      log(`Game setting changed to: ${newGame}`);

      if (configured) {
        await setNativeLibrary(newGame);
      }
    }),
  );
}

/**
 * Removes everything the extension wrote to settings.
 *
 * This used to run on `deactivate`, which meant every window close stripped the
 * settings and every launch wrote them back: two settings.json writes and two
 * language server reloads per session, a spurious diff in any tracked
 * `.code-workspace`, and no guarantee the writes even completed, since VS Code
 * does not wait for async work during shutdown. As a command it runs when the
 * user actually wants it, and completes.
 */
async function removeConfig(): Promise<void> {
  const confirmed = await window.showWarningMessage(
    'Remove the Lua Language Server settings this extension added?',
    { modal: true, detail: 'Your own Lua settings are left untouched.' },
    'Remove',
  );

  if (confirmed !== 'Remove') {
    return;
  }

  await setPlugin(false);
  await setLibrary(ALL_LIBRARY_FOLDERS, false, { target: getBaseScope() });

  // Also clear folder-level entries written for multi-root workspaces
  for (const folder of workspace.workspaceFolders ?? []) {
    await setLibrary(ALL_LIBRARY_FOLDERS, false, {
      target: ConfigurationTarget.WorkspaceFolder,
      folder,
    });
  }

  configured = false;
  updateStatusBar(activeGame());

  log('Configuration removed');
  window.showInformationMessage('CfxLua: configuration removed.');
}

export function deactivate() {
  // Deliberately empty: the settings are idempotent and are left in place so a
  // restart does not rewrite them. Use "CfxLua: Remove configuration" to undo.
}
