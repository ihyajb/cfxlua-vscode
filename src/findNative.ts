import { type QuickPickItem, SnippetString, Uri, env, window } from 'vscode';
import {
  type IndexedNative,
  type NativeCatalog,
  callSignature,
  callSnippet,
  typedSignature,
} from './nativesIndex';

interface NativeItem extends QuickPickItem {
  name: string;
  native: IndexedNative;
}

/** Where a native's documentation lives, which differs per game. */
function documentationUrl(game: string, native: IndexedNative): string {
  return game.toLowerCase() === 'rdr3'
    ? `https://rdr3natives.com/?native=${native.h}`
    : `https://docs.fivem.net/natives/?_${native.h}`;
}

function items(catalog: NativeCatalog): NativeItem[] {
  const result: NativeItem[] = [];

  for (const name of catalog.names().sort()) {
    const native = catalog.lookup(name);

    if (native === undefined) {
      continue;
    }

    result.push({
      name,
      native,
      label: name,
      // Matched against as well as the label, so a namespace or a hash finds it.
      description: `${native.ns} · ${native.a} · ${native.h}`,
      detail: typedSignature(name, native),
    });
  }

  return result;
}

/**
 * Searches the natives available to the selected game and acts on one.
 *
 * The alternative is a trip to a website to find a name, a signature or a hash,
 * all of which are already on disk.
 */
export async function findNative(
  catalog: NativeCatalog,
  game: string,
): Promise<void> {
  const picked = await window.showQuickPick(items(catalog), {
    title: `${game.toUpperCase()} natives`,
    placeHolder: 'Search by name, namespace or hash',
    matchOnDescription: true,
  });

  if (picked === undefined) {
    return;
  }

  const editor = window.activeTextEditor;
  const canInsert =
    editor !== undefined && editor.document.languageId === 'lua';

  const actions: (QuickPickItem & { id: string })[] = [
    ...(canInsert
      ? [
          {
            id: 'insert',
            label: '$(edit) Insert call',
            detail: callSignature(picked.name, picked.native),
          },
        ]
      : []),
    {
      id: 'docs',
      label: '$(link-external) Open documentation',
      detail: documentationUrl(game, picked.native),
    },
    {
      id: 'hash',
      label: '$(clippy) Copy hash',
      detail: picked.native.h,
    },
    {
      id: 'signature',
      label: '$(clippy) Copy signature',
      detail: typedSignature(picked.name, picked.native),
    },
  ];

  const action = await window.showQuickPick(actions, { title: picked.name });

  if (action === undefined) {
    return;
  }

  switch (action.id) {
    case 'insert':
      if (editor !== undefined) {
        await editor.insertSnippet(
          new SnippetString(callSnippet(picked.name, picked.native)),
        );
      }

      return;

    case 'docs':
      await env.openExternal(Uri.parse(documentationUrl(game, picked.native)));

      return;

    case 'hash':
      await env.clipboard.writeText(picked.native.h);
      window.setStatusBarMessage(`Copied ${picked.native.h}`, 2000);

      return;

    case 'signature':
      await env.clipboard.writeText(typedSignature(picked.name, picked.native));
      window.setStatusBarMessage(`Copied ${picked.name} signature`, 2000);

      return;
  }
}
