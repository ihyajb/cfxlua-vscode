import * as path from 'node:path';
import { storagePath, id as extensionId } from './extension';
import getLuaConfig from './getLuaConfig';
import getSettingsScope from './getSettingsScope';
import { log } from './logger';

/**
 * Adds or removes library folders from the Lua Language Server's
 * `workspace.library` setting. Also cleans up stale entries from
 * previous extension versions or the archived Overextended fork.
 */
export default async function setLibrary(folders: string[], enable: boolean) {
  const config = getLuaConfig();
  const library: string[] = config.get('workspace.library') ?? [];

  for (const folder of folders) {
    const folderPath = path.join(storagePath, 'library', folder);

    // Walk backwards so splicing doesn't shift unvisited indices
    for (let i = library.length - 1; i >= 0; i--) {
      const entry = library[i];

      // Remove legacy entries that reference the extension root instead of globalStorage
      if (entry.includes(extensionId) && !entry.includes('globalStorage')) {
        library.splice(i, 1);
        continue;
      }

      // Remove leftover entries from the archived Overextended fork
      if (entry.includes('overextended.cfxlua-vscode')) {
        library.splice(i, 1);
      }
    }

    const index = library.indexOf(folderPath);

    if (enable && index === -1) {
      library.push(folderPath);
      log(`Library added: ${folderPath}`);
    } else if (!enable && index > -1) {
      library.splice(index, 1);
      log(`Library removed: ${folderPath}`);
    }
  }

  await config.update('workspace.library', library, getSettingsScope());
}
