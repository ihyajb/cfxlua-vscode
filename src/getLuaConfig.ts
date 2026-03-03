import { workspace, type WorkspaceFolder, Uri } from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Determine the most specific scope to use for Lua configuration. The
// precedence mirrors the target logic used when updating settings: 1)
// workspace file (multi-root), 2) workspace folder *with* an existing
// .vscode/settings.json, 3) global (no scope).
export default function getLuaConfig() {
  let scope: Uri | undefined;

  if (workspace.workspaceFile) {
    scope = workspace.workspaceFile;
  } else if (workspace.workspaceFolders && workspace.workspaceFolders[0]) {
    const folder = workspace.workspaceFolders[0];
    const settingsPath = path.join(folder.uri.fsPath, '.vscode', 'settings.json');
    if (fs.existsSync(settingsPath)) {
      scope = folder.uri;
    }
  }

  return workspace.getConfiguration('Lua', scope);
}
