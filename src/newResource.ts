import { Uri, ViewColumn, window, workspace } from 'vscode';
import { log } from './logger';

const RESOURCE_NAME = /^[A-Za-z0-9_-]+$/;

function manifest(name: string, game: string): string {
  const rdr3 = game.toLowerCase() === 'rdr3';

  return `fx_version 'cerulean'
game '${rdr3 ? 'rdr3' : 'gtav'}'
${rdr3 ? "rdr3_warning 'I acknowledge that this is a prerelease build of RedM, and I am aware my resources *will* become incompatible once RedM ships.'\n" : ''}lua54 'yes'

name '${name}'
author ''
version '1.0.0'
description ''

shared_scripts {
  'shared/*.lua',
}

client_scripts {
  'client/*.lua',
}

server_scripts {
  'server/*.lua',
}
`;
}

const CLIENT = `CreateThread(function()
  print('${'${name}'} client started')
end)
`;

const SERVER = `RegisterCommand('hello', function(source, args, raw)
  print('hello from ${'${name}'}')
end, false)
`;

const SHARED = `-- Loaded on both the client and the server.
`;

async function exists(uri: Uri): Promise<boolean> {
  try {
    await workspace.fs.stat(uri);

    return true;
  } catch {
    return false;
  }
}

/**
 * Picks where a new resource should go: an existing `resources` directory when
 * the workspace has one, otherwise the folder root.
 */
async function resourceRoot(folder: Uri): Promise<Uri> {
  const resources = Uri.joinPath(folder, 'resources');

  return (await exists(resources)) ? resources : folder;
}

/**
 * Scaffolds a resource: a manifest that already declares the right game and
 * Lua 5.4, plus the three script directories the manifest refers to.
 */
export async function newResource(game: string): Promise<void> {
  const folders = workspace.workspaceFolders ?? [];

  if (folders.length === 0) {
    window.showErrorMessage(
      'CfxLua: open a folder before creating a resource.',
    );

    return;
  }

  const folder =
    folders.length === 1
      ? folders[0]
      : await window.showWorkspaceFolderPick({
          placeHolder: 'Where should the resource be created?',
        });

  if (folder === undefined) {
    return;
  }

  const name = await window.showInputBox({
    title: 'New resource',
    prompt: 'Resource name',
    placeHolder: 'my-resource',
    validateInput: (value) => {
      const trimmed = value.trim();

      if (trimmed === '') {
        return 'Enter a name.';
      }

      return RESOURCE_NAME.test(trimmed)
        ? undefined
        : 'Use letters, digits, underscores and hyphens only.';
    },
  });

  if (name === undefined) {
    return;
  }

  const root = await resourceRoot(folder.uri);
  const target = Uri.joinPath(root, name.trim());

  if (await exists(target)) {
    window.showErrorMessage(`CfxLua: ${name.trim()} already exists.`);

    return;
  }

  const files: [string, string][] = [
    ['fxmanifest.lua', manifest(name.trim(), game)],
    ['client/main.lua', CLIENT.replace('${name}', name.trim())],
    ['server/main.lua', SERVER.replace('${name}', name.trim())],
    ['shared/main.lua', SHARED],
  ];

  try {
    for (const [path, contents] of files) {
      await workspace.fs.writeFile(
        Uri.joinPath(target, ...path.split('/')),
        Buffer.from(contents, 'utf8'),
      );
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);

    window.showErrorMessage(
      `CfxLua: could not create the resource — ${message}`,
    );

    return;
  }

  log(`Created resource ${name.trim()} in ${root.fsPath}`);

  const document = await workspace.openTextDocument(
    Uri.joinPath(target, 'fxmanifest.lua'),
  );

  await window.showTextDocument(document, ViewColumn.Active);
}
