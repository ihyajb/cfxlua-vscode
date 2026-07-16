import * as path from 'node:path';
import { id as extensionId, storagePath } from './extension';
import getLuaConfig from './getLuaConfig';
import getSettingsScope, { type SettingsScope } from './getSettingsScope';
import { arraysEqual, cleanLibraryEntries } from './libraryUtils';
import { log } from './logger';

/**
 * Adds or removes library folders from the Lua Language Server's
 * `workspace.library` setting. Also cleans up stale entries from previous
 * extension versions or the archived Overextended fork. The setting is only
 * written when the value actually changes, to avoid dirtying settings.json
 * and triggering needless LLS reloads.
 */
export default async function setLibrary(
  folders: string[],
  enable: boolean,
  scope: SettingsScope = getSettingsScope(),
) {
  const config = getLuaConfig(scope.folder?.uri);
  const current: string[] = config.get('workspace.library') ?? [];
  const library = cleanLibraryEntries(current, extensionId);

  for (const folder of folders) {
    const folderPath = path.join(storagePath, 'library', folder);
    const index = library.indexOf(folderPath);

    if (enable && index === -1) {
      library.push(folderPath);
      log(`Library added: ${folderPath}`);
    } else if (!enable && index > -1) {
      library.splice(index, 1);
      log(`Library removed: ${folderPath}`);
    }
  }

  if (!arraysEqual(current, library)) {
    await config.update('workspace.library', library, scope.target);
  }
}
