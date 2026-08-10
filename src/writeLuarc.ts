import * as path from 'node:path';
import { Uri, window, workspace } from 'vscode';
import { storagePath } from './extension';
import { log } from './logger';
import { IGNORE_DIRS, NONSTANDARD_SYMBOLS } from './setPlugin';

/** Keys in `.luarc.json` are the settings keys without the `Lua.` prefix. */
function luarc(folders: string[]): string {
  const config = {
    $schema:
      'https://raw.githubusercontent.com/LuaLS/vscode-lua/master/setting/schema.json',
    'runtime.version': 'Lua 5.4',
    'runtime.plugin': path.join(storagePath, 'plugin.lua'),
    'runtime.nonstandardSymbol': NONSTANDARD_SYMBOLS,
    'workspace.ignoreDir': IGNORE_DIRS,
    'workspace.library': folders.map((folder) =>
      path.join(storagePath, 'library', folder),
    ),
  };

  return `${JSON.stringify(config, undefined, 2)}\n`;
}

async function exists(uri: Uri): Promise<boolean> {
  try {
    await workspace.fs.stat(uri);

    return true;
  } catch {
    return false;
  }
}

/**
 * Writes the configuration this extension applies into a `.luarc.json` in the
 * workspace.
 *
 * Everything the extension configures otherwise lives in per-user VS Code
 * settings, which a team cannot commit and `lua-language-server --check` cannot
 * read. A checked-in `.luarc.json` makes the same setup reviewable, shareable
 * with teammates on other editors, and usable in CI.
 */
export async function writeLuarc(folders: string[]): Promise<void> {
  const workspaceFolders = workspace.workspaceFolders ?? [];

  if (workspaceFolders.length === 0) {
    window.showErrorMessage('CfxLua: open a folder first.');

    return;
  }

  const folder =
    workspaceFolders.length === 1
      ? workspaceFolders[0]
      : await window.showWorkspaceFolderPick({
          placeHolder: 'Where should .luarc.json be written?',
        });

  if (folder === undefined) {
    return;
  }

  const target = Uri.joinPath(folder.uri, '.luarc.json');

  if (await exists(target)) {
    const overwrite = await window.showWarningMessage(
      '.luarc.json already exists. Overwrite it?',
      { modal: true },
      'Overwrite',
    );

    if (overwrite !== 'Overwrite') {
      return;
    }
  }

  try {
    await workspace.fs.writeFile(target, Buffer.from(luarc(folders), 'utf8'));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);

    window.showErrorMessage(`CfxLua: could not write .luarc.json — ${message}`);

    return;
  }

  log(`Wrote ${target.fsPath}`);

  const document = await workspace.openTextDocument(target);

  await window.showTextDocument(document);
}
