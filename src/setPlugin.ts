import * as path from 'node:path';
import { id as extensionId, storagePath } from './extension';
import getLuaConfig from './getLuaConfig';
import { getBaseScope } from './getSettingsScope';
import { log } from './logger';

/** Nonstandard Lua operators supported by the Cfx runtime. */
export const NONSTANDARD_SYMBOLS = [
  '/**/',
  '`',
  '+=',
  '-=',
  '*=',
  '/=',
  '<<=',
  '>>=',
  '&=',
  '|=',
  '^=',
];

/** Directories the Lua Language Server should ignore for performance. */
export const IGNORE_DIRS = [
  '.vscode',
  '.git',
  '.github',
  'node_modules',
  '\\[cfx\\]',
];

/**
 * Note: `Lua.runtime.plugin` is window-scoped in the sumneko extension, and
 * none of these values depend on the selected game, so everything here is
 * written at the base (user/workspace) scope — never per folder.
 * Each setting is only written when its value actually changes.
 */
export default async function setPlugin(enable: boolean) {
  const config = getLuaConfig();
  const pluginPath = path.join(storagePath, 'plugin.lua');
  const settingsScope = getBaseScope();

  if (enable) {
    if (config.get('runtime.version') !== 'Lua 5.4') {
      await config.update('runtime.version', 'Lua 5.4', settingsScope);
    }

    if (config.get('runtime.plugin') !== pluginPath) {
      await config.update('runtime.plugin', pluginPath, settingsScope);
    }

    // Ensure all Cfx-specific operators are registered
    const nonstandardSymbol: string[] =
      config.get('runtime.nonstandardSymbol') ?? [];
    let symbolsChanged = false;

    for (const sym of NONSTANDARD_SYMBOLS) {
      if (!nonstandardSymbol.includes(sym)) {
        nonstandardSymbol.push(sym);
        symbolsChanged = true;
      }
    }

    if (symbolsChanged) {
      await config.update(
        'runtime.nonstandardSymbol',
        nonstandardSymbol,
        settingsScope,
      );
    }

    // Ignore common directories to drastically reduce workspace indexing time
    const ignoreDir: string[] = config.get('workspace.ignoreDir') ?? [];
    let ignoreChanged = false;

    for (const dir of IGNORE_DIRS) {
      if (!ignoreDir.includes(dir)) {
        ignoreDir.push(dir);
        ignoreChanged = true;
      }
    }

    if (ignoreChanged) {
      await config.update('workspace.ignoreDir', ignoreDir, settingsScope);
    }

    log('Plugin enabled');
    return;
  }

  // On disable, only remove the plugin path if it's ours — matching on the
  // extension id also catches malformed paths written by older versions
  const currentPlugin = config.get('runtime.plugin');

  if (
    typeof currentPlugin === 'string' &&
    currentPlugin.includes(extensionId)
  ) {
    await config.update('runtime.plugin', undefined, settingsScope);
    log('Plugin disabled');
  }
}
