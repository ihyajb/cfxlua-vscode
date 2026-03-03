import { workspace, ConfigurationTarget } from 'vscode';
import { log } from './logger';
import * as fs from 'node:fs';
import * as path from 'node:path';

export default function getSettingsScope(): ConfigurationTarget {
  // Preference: workspace file (multi-root) > workspace folder settings > global
  if (workspace.workspaceFile) {
    log('Workspace file present; using Workspace configuration scope');
    return ConfigurationTarget.Workspace;
  }

  if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
    const folderPath = workspace.workspaceFolders[0].uri.fsPath;
    const settingsPath = path.join(folderPath, '.vscode', 'settings.json');

    if (fs.existsSync(settingsPath)) {
      log('Found workspace settings.json; using Workspace configuration scope');
      return ConfigurationTarget.Workspace;
    }
  }

  log('No workspace configuration detected; using Global configuration scope');
  return ConfigurationTarget.Global;
}
