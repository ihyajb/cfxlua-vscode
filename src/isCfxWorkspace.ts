import { RelativePattern, type WorkspaceFolder, workspace } from 'vscode';
import { log } from './logger';

/** Matches a resource manifest anywhere in a workspace folder. */
export const MANIFEST_GLOB = '**/{fxmanifest,__resource}.lua';

const EXCLUDE = '**/{node_modules,.git,cache}/**';

/**
 * True when a workspace folder contains a resource manifest.
 *
 * Manifest presence is the only reliable marker of a Cfx project: `.lua` files
 * are not, and neither is a `resources` directory, which plenty of unrelated
 * projects have.
 */
export async function folderIsCfx(folder: WorkspaceFolder): Promise<boolean> {
  const found = await workspace.findFiles(
    new RelativePattern(folder, MANIFEST_GLOB),
    EXCLUDE,
    1,
  );

  return found.length > 0;
}

/**
 * True when any open workspace folder looks like a Cfx project.
 *
 * This gates automatic configuration. Without it the extension writes a Cfx
 * runtime version, a text-rewriting plugin and thousands of game natives into the
 * settings of every Lua project the user opens — a Neovim config, a LÖVE game —
 * because the only activation signal is the Lua language itself.
 */
export async function isCfxWorkspace(): Promise<boolean> {
  const folders = workspace.workspaceFolders ?? [];

  for (const folder of folders) {
    if (await folderIsCfx(folder)) {
      log(`Cfx resource manifest found in ${folder.name}`);

      return true;
    }
  }

  return false;
}

export type AutoConfigure = 'auto' | 'always' | 'never';

/**
 * Whether to configure the Lua Language Server for this window.
 *
 * `auto` only configures Cfx workspaces; `always` restores the old behaviour for
 * anyone whose resources live somewhere a manifest search will not find them.
 */
export async function shouldConfigure(): Promise<boolean> {
  const mode = workspace
    .getConfiguration('cfxlua')
    .get<AutoConfigure>('autoConfigure', 'auto');

  if (mode === 'never') {
    log('Automatic configuration disabled by cfxlua.autoConfigure');

    return false;
  }

  if (mode === 'always') {
    return true;
  }

  const cfx = await isCfxWorkspace();

  if (!cfx) {
    log(
      'No resource manifest in this workspace; skipping configuration. Set cfxlua.autoConfigure to "always" to override.',
    );
  }

  return cfx;
}
