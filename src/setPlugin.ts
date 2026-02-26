import { storagePath } from './extension';
import getLuaConfig from './getLuaConfig';
import getSettingsScope from './getSettingsScope';
import { log } from './logger';
import * as path from 'node:path';

/** Nonstandard Lua operators supported by the Cfx runtime. */
const NONSTANDARD_SYMBOLS = [
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
const IGNORE_DIRS = ['.vscode', '.git', '.github', 'node_modules', '\\[cfx\\]'];

export default async function setPlugin(enable: boolean) {
  const config = getLuaConfig();
  const pluginPath = path.join(storagePath, 'plugin.lua');
  const settingsScope = getSettingsScope();

  if (enable) {
    await config.update('runtime.version', 'Lua 5.4', settingsScope);
    await config.update('runtime.plugin', pluginPath, settingsScope);

    // Ensure all Cfx-specific operators are registered
    const nonstandardSymbol: string[] =
      config.get('runtime.nonstandardSymbol') ?? [];

    for (const sym of NONSTANDARD_SYMBOLS) {
      if (!nonstandardSymbol.includes(sym)) {
        nonstandardSymbol.push(sym);
      }
    }

    await config.update(
      'runtime.nonstandardSymbol',
      nonstandardSymbol,
      settingsScope,
    );

    // Ignore common directories to drastically reduce workspace indexing time
    const ignoreDir: string[] = config.get('workspace.ignoreDir') ?? [];

    for (const dir of IGNORE_DIRS) {
      if (!ignoreDir.includes(dir)) {
        ignoreDir.push(dir);
      }
    }

    await config.update('workspace.ignoreDir', ignoreDir, settingsScope);

    log('Plugin enabled');
    return;
  }

  // On disable, only remove the plugin path if it's ours
  if (config.get('runtime.plugin') === pluginPath) {
    await config.update('runtime.plugin', undefined, settingsScope);
    log('Plugin disabled');
  }
}
