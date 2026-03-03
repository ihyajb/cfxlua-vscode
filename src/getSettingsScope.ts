import { workspace, ConfigurationTarget } from 'vscode';

export default function getSettingsScope(): ConfigurationTarget {
  return workspace.workspaceFile
    ? ConfigurationTarget.Workspace
    : ConfigurationTarget.Global;
}
