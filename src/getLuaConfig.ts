import { type Uri, workspace } from 'vscode';

export default function getLuaConfig(resource?: Uri) {
  return workspace.getConfiguration('Lua', resource ?? null);
}
