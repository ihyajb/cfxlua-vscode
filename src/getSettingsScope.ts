import {
  ConfigurationTarget,
  type WorkspaceFolder,
  window,
  workspace,
} from 'vscode';

export interface SettingsScope {
  target: ConfigurationTarget;
  folder?: WorkspaceFolder;
}

/** Workspace when a .code-workspace file is open, otherwise user settings. */
export function getBaseScope(): ConfigurationTarget {
  return workspace.workspaceFile
    ? ConfigurationTarget.Workspace
    : ConfigurationTarget.Global;
}

/**
 * Scope for game-specific settings. In a multi-root workspace these are
 * written per folder (based on the active editor) so FiveM and RedM
 * resources can coexist; otherwise they fall back to the base scope.
 */
export default function getSettingsScope(): SettingsScope {
  const folders = workspace.workspaceFolders ?? [];

  if (folders.length > 1) {
    const document = window.activeTextEditor?.document;
    const folder = document && workspace.getWorkspaceFolder(document.uri);

    if (folder) {
      return { target: ConfigurationTarget.WorkspaceFolder, folder };
    }
  }

  return { target: getBaseScope() };
}
