import { type ExtensionContext, Uri, workspace } from 'vscode';
import { extension } from './extension';
import { log } from './logger';

/** Everything the extension bundles for the Lua Language Server. */
const CONTENT = ['plugin.lua', 'library'];

/** Marker file recording which extension version last populated storage. */
const VERSION_MARKER = '.version';

async function exists(uri: Uri): Promise<boolean> {
  try {
    await workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

async function isUpToDate(storageUri: Uri, version: string): Promise<boolean> {
  try {
    const marker = await workspace.fs.readFile(
      Uri.joinPath(storageUri, VERSION_MARKER),
    );

    if (Buffer.from(marker).toString('utf8') !== version) {
      return false;
    }
  } catch {
    return false;
  }

  for (const name of CONTENT) {
    if (!(await exists(Uri.joinPath(storageUri, name)))) {
      return false;
    }
  }

  return true;
}

/**
 * Copies plugin.lua and the definition library from the extension bundle
 * into global storage. The copy is skipped when storage already holds this
 * version's files — the library is ~150 files, too much to recopy on every
 * activation. Copy failures propagate to the caller; a missing source is
 * only logged so a development checkout without the plugin submodule can
 * still activate.
 */
export default async function ensureStorage(
  context: ExtensionContext,
): Promise<void> {
  const storageUri = context.globalStorageUri;
  const sourceUri = Uri.joinPath(extension.extensionUri, 'plugin');
  const version: string = extension.packageJSON.version;

  if (await isUpToDate(storageUri, version)) {
    log(`Storage already up to date (v${version}), skipping copy`);
    return;
  }

  let complete = true;

  for (const name of CONTENT) {
    const source = Uri.joinPath(sourceUri, name);

    if (!(await exists(source))) {
      log(`Source not found, skipping copy: ${source.fsPath}`);
      complete = false;
      continue;
    }

    await workspace.fs.copy(source, Uri.joinPath(storageUri, name), {
      overwrite: true,
    });
  }

  // Only stamp the marker when everything copied, so a partial copy
  // (e.g. missing submodule) is retried on the next activation
  if (complete) {
    await workspace.fs.writeFile(
      Uri.joinPath(storageUri, VERSION_MARKER),
      Buffer.from(version, 'utf8'),
    );
    log(`Copied plugin files to storage (v${version})`);
  }
}
