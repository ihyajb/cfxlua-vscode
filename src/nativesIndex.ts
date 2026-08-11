import { gunzipSync } from 'node:zlib';
import { Uri, workspace } from 'vscode';
import { log } from './logger';
import { NativeCatalog, type NativeIndex } from './nativeCatalog';
import type { ScopeTable } from './nativeScope';

export * from './nativeCatalog';

interface ScopeIndex {
  version: number;
  games: Record<string, ScopeTable>;
}

/** Both built by fivem-lls-addon; see its scripts/build-index.mjs. */
const SCOPES_FILE = 'native-scopes.json.gz';
const INDEX_FILE = 'natives-index.json.gz';

const SUPPORTED_VERSION = 1;

/**
 * Promises rather than values, so two features asking at the same moment share
 * one read and one parse instead of racing to do both.
 */
let scopesPromise: Promise<ScopeIndex | undefined> | undefined;
let indexPromise: Promise<NativeIndex | undefined> | undefined;

const catalogs = new Map<string, NativeCatalog | undefined>();

async function readJson<T extends { version: number }>(
  extensionUri: Uri,
  name: string,
): Promise<T | undefined> {
  const uri = Uri.joinPath(extensionUri, 'plugin', name);

  try {
    const started = Date.now();
    const compressed = await workspace.fs.readFile(uri);
    const parsed = JSON.parse(
      gunzipSync(Buffer.from(compressed)).toString('utf8'),
    ) as T;

    if (parsed.version !== SUPPORTED_VERSION) {
      log(
        `${name} is version ${parsed.version}, expected ${SUPPORTED_VERSION}; ignoring it`,
      );

      return undefined;
    }

    log(`Loaded ${name} in ${Date.now() - started}ms`);

    return parsed;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);

    log(`${name} unavailable (${message}); features using it are disabled`);

    return undefined;
  }
}

/**
 * The scope table, for the wrong-side check.
 *
 * Loaded on first use rather than during activation. It is a quarter the size of
 * the full index and is the only one of the two that a normal editing session
 * needs, so keeping them apart means a workspace that is never checked — or never
 * configured at all — pays nothing.
 */
export async function loadScopes(
  extensionUri: Uri,
): Promise<ScopeIndex | undefined> {
  scopesPromise ??= readJson<ScopeIndex>(extensionUri, SCOPES_FILE);

  return scopesPromise;
}

/** The scope table for one game, or undefined when unavailable. */
export async function loadScopeTable(
  extensionUri: Uri,
  game: string,
): Promise<ScopeTable | undefined> {
  const scopes = await loadScopes(extensionUri);

  return scopes?.games[game.toUpperCase()];
}

/**
 * The full native index, for search and hash lookup.
 *
 * Only read when one of those features is actually used; nothing in a normal
 * editing session touches it.
 */
export async function loadNativeIndex(
  extensionUri: Uri,
): Promise<NativeIndex | undefined> {
  indexPromise ??= readJson<NativeIndex>(extensionUri, INDEX_FILE);

  return indexPromise;
}

/**
 * A catalog for one game, cached.
 *
 * The cache matters: a catalog builds a sorted name list and a hash map on
 * demand, and an earlier version rebuilt the catalog whenever the active editor
 * changed, which threw both away on every tab switch.
 */
export async function loadCatalog(
  extensionUri: Uri,
  game: string,
): Promise<NativeCatalog | undefined> {
  const key = game.toUpperCase();

  if (catalogs.has(key)) {
    return catalogs.get(key);
  }

  const index = await loadNativeIndex(extensionUri);
  const catalog =
    index === undefined ? undefined : new NativeCatalog(index, key);

  catalogs.set(key, catalog);

  return catalog;
}

/** Drops every cached artifact, so the next use re-reads from disk. */
export function resetNativeIndex(): void {
  scopesPromise = undefined;
  indexPromise = undefined;
  catalogs.clear();
}
