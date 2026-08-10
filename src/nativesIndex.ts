import { gunzipSync } from 'node:zlib';
import { Uri, workspace } from 'vscode';
import { log } from './logger';
import type { NativeIndex } from './nativeCatalog';

export * from './nativeCatalog';

/** Built by fivem-lls-addon; see its scripts/build-index.mjs. */
const INDEX_FILE = 'natives-index.json.gz';

const SUPPORTED_VERSION = 1;

let cached: NativeIndex | undefined;
let loaded = false;

/**
 * Loads the native index shipped alongside the definition library.
 *
 * Read from the extension directory rather than global storage: nothing but the
 * extension itself consumes it, so there is no reason to copy 360 KiB into the
 * user's profile. Returns undefined when the index is missing — a development
 * checkout without the submodule, or an older addon — and every feature built on
 * it then stays quiet rather than failing.
 */
export async function loadNativeIndex(
  extensionUri: Uri,
): Promise<NativeIndex | undefined> {
  if (loaded) {
    return cached;
  }

  loaded = true;

  const uri = Uri.joinPath(extensionUri, 'plugin', INDEX_FILE);

  try {
    const compressed = await workspace.fs.readFile(uri);
    const parsed = JSON.parse(
      gunzipSync(Buffer.from(compressed)).toString('utf8'),
    ) as NativeIndex;

    if (parsed.version !== SUPPORTED_VERSION) {
      log(
        `Native index version ${parsed.version} is not supported (expected ${SUPPORTED_VERSION})`,
      );

      return undefined;
    }

    const count = Object.values(parsed.sets).reduce(
      (total, set) => total + Object.keys(set.natives).length,
      0,
    );

    log(`Loaded native index: ${count} natives`);

    cached = parsed;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);

    log(`Native index unavailable (${message}); index features are disabled`);
  }

  return cached;
}

/** Test seam and reload hook. */
export function resetNativeIndex(): void {
  cached = undefined;
  loaded = false;
}
