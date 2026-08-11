import {
  Diagnostic,
  type DiagnosticCollection,
  DiagnosticSeverity,
  type Disposable,
  Range,
  type TextDocument,
  Uri,
  languages,
  workspace,
} from 'vscode';
import { log } from './logger';
import {
  type ParsedManifest,
  type Side,
  isManifestPath,
  parseManifest,
  sidesForFile,
  suggestDirective,
} from './manifest';
import { type ScopeTable, findWrongSideCalls } from './nativeScope';

const SIDE_LABEL: Record<Side, string> = {
  client: 'client',
  server: 'server',
};

interface Resource {
  manifest: ParsedManifest;
  /** Directory holding the manifest — the resource root. */
  root: Uri;
}

/**
 * Resolved resources, keyed by the directory their manifest lives in, and the
 * resource each document belongs to.
 *
 * Both exist because diagnostics run every few keystrokes: without them each
 * refresh re-read the manifest from disk and walked the directory tree again.
 * `null` records a miss, so a document outside any resource is not re-walked
 * either. Cleared whenever a manifest changes.
 */
const resources = new Map<string, Resource | null>();
const documentResource = new Map<string, string | null>();

function invalidateManifests(): void {
  resources.clear();
  documentResource.clear();
}

async function readManifest(directory: Uri): Promise<Resource | null> {
  for (const name of ['fxmanifest.lua', '__resource.lua']) {
    try {
      const bytes = await workspace.fs.readFile(Uri.joinPath(directory, name));

      return {
        manifest: parseManifest(Buffer.from(bytes).toString('utf8')),
        root: directory,
      };
    } catch {
      // Not here; the caller keeps walking up.
    }
  }

  return null;
}

/**
 * Finds the manifest governing `file` by walking up to the workspace folder root.
 *
 * Resources nest — `resources/[category]/myresource/client/main.lua` — so the
 * nearest manifest above the file is the one that loads it.
 */
async function findResource(file: Uri): Promise<Resource | null> {
  const documentKey = file.toString();
  const cachedKey = documentResource.get(documentKey);

  if (cachedKey !== undefined) {
    return cachedKey === null ? null : (resources.get(cachedKey) ?? null);
  }

  const folder = workspace.getWorkspaceFolder(file);

  if (folder === undefined) {
    documentResource.set(documentKey, null);

    return null;
  }

  const root = folder.uri.path;
  let directory = Uri.joinPath(file, '..');
  const walked: string[] = [];

  while (directory.path.startsWith(root)) {
    const key = directory.toString();
    const known = resources.get(key);
    const resource =
      known !== undefined ? known : await readManifest(directory);

    resources.set(key, resource);
    walked.push(key);

    if (resource !== null) {
      // Every directory between the file and the manifest resolves to it.
      for (const visited of walked) {
        if (resources.get(visited) === null) {
          resources.set(visited, resource);
        }
      }

      documentResource.set(documentKey, key);

      return resource;
    }

    const parent = Uri.joinPath(directory, '..');

    if (parent.path === directory.path) {
      break;
    }

    directory = parent;
  }

  documentResource.set(documentKey, null);

  return null;
}

/** The path of `file` relative to `root`, with forward slashes. */
function relativePath(root: Uri, file: Uri): string {
  const prefix = root.path.endsWith('/') ? root.path : `${root.path}/`;

  return file.path.startsWith(prefix)
    ? file.path.slice(prefix.length)
    : file.path;
}

/**
 * Flags natives that cannot work in the file they appear in.
 *
 * Calling a client native from a server script is the most common self-inflicted
 * bug in Cfx development and nothing else catches it, because the language server
 * loads every native into every file. This only reports a native when the sides
 * it supports and the sides the file runs on have nothing in common, so a native
 * with a server RPC variant never produces a warning, and neither does anything
 * in a shared script.
 */
function nativeScopeDiagnostics(
  document: TextDocument,
  scopes: ScopeTable,
  sides: Set<Side>,
): Diagnostic[] {
  // Nothing to say about a file that runs on both sides, or one the manifest
  // does not load at all.
  if (sides.size !== 1) {
    return [];
  }

  const [side] = [...sides];

  return findWrongSideCalls(document.getText(), scopes, side).map((call) => {
    const allowed = call.supported.map((s) => SIDE_LABEL[s]).join(' or ');

    const diagnostic = new Diagnostic(
      new Range(
        document.positionAt(call.offset),
        document.positionAt(call.offset + call.name.length),
      ),
      `${call.name} is a ${allowed} native, but this file is loaded as a ${SIDE_LABEL[side]} script.`,
      DiagnosticSeverity.Warning,
    );

    diagnostic.source = 'cfxlua';
    diagnostic.code = 'native-scope';

    return diagnostic;
  });
}

/**
 * Flags manifest keys that look like a misspelling of a real one.
 *
 * `undefined-global` is off for manifests because arbitrary metadata keys are
 * legal, which also means a typo in `client_scripts` silently loads nothing.
 * Reporting only near-misses keeps custom metadata quiet.
 */
function manifestDiagnostics(
  document: TextDocument,
  manifest: ParsedManifest,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const directive of manifest.directives) {
    const suggestion = suggestDirective(directive.name);

    if (suggestion === undefined) {
      continue;
    }

    const diagnostic = new Diagnostic(
      new Range(
        document.positionAt(directive.offset),
        document.positionAt(directive.offset + directive.name.length),
      ),
      `Unknown manifest key "${directive.name}". Did you mean "${suggestion}"?`,
      DiagnosticSeverity.Warning,
    );

    diagnostic.source = 'cfxlua';
    diagnostic.code = 'manifest-key';

    diagnostics.push(diagnostic);
  }

  return diagnostics;
}

export interface DiagnosticsHost {
  /** The scope table for the game the document belongs to, loaded on demand. */
  scopesFor(document: TextDocument): Promise<ScopeTable | undefined>;
}

async function computeDiagnostics(
  document: TextDocument,
  host: DiagnosticsHost,
): Promise<Diagnostic[]> {
  if (document.languageId !== 'lua' || document.uri.scheme !== 'file') {
    return [];
  }

  const config = workspace.getConfiguration('cfxlua', document.uri);

  if (isManifestPath(document.uri.path)) {
    return config.get('diagnostics.manifestKeys', true)
      ? manifestDiagnostics(document, parseManifest(document.getText()))
      : [];
  }

  if (!config.get('diagnostics.nativeScope', true)) {
    return [];
  }

  const resource = await findResource(document.uri);

  if (resource === null) {
    return [];
  }

  const sides = sidesForFile(
    resource.manifest,
    relativePath(resource.root, document.uri),
  );

  // Checked before the scope table is loaded: a file the manifest does not load,
  // or one it loads on both sides, can never produce a warning, so there is no
  // reason to read the table on its behalf.
  if (sides.size !== 1) {
    return [];
  }

  const scopes = await host.scopesFor(document);

  return scopes === undefined
    ? []
    : nativeScopeDiagnostics(document, scopes, sides);
}

/**
 * Keeps diagnostics in step with the open editors.
 *
 * Work is debounced per document because the scan runs over the whole file, and
 * editing a large script otherwise re-scans it on every keystroke.
 */
export function registerDiagnostics(host: DiagnosticsHost): Disposable {
  const collection: DiagnosticCollection =
    languages.createDiagnosticCollection('cfxlua');

  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const refresh = async (document: TextDocument): Promise<void> => {
    try {
      const diagnostics = await computeDiagnostics(document, host);

      // Nothing to report and nothing reported before: skip the round trip.
      if (
        diagnostics.length === 0 &&
        collection.get(document.uri) === undefined
      ) {
        return;
      }

      collection.set(document.uri, diagnostics);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);

      log(`Diagnostics failed for ${document.uri.fsPath}: ${message}`);
    }
  };

  const schedule = (document: TextDocument, delay: number): void => {
    if (document.languageId !== 'lua') {
      return;
    }

    const key = document.uri.toString();
    const existing = timers.get(key);

    if (existing !== undefined) {
      clearTimeout(existing);
    }

    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        void refresh(document);
      }, delay),
    );
  };

  const refreshAll = (): void => {
    for (const document of workspace.textDocuments) {
      schedule(document, 0);
    }
  };

  const subscriptions: Disposable[] = [
    collection,
    workspace.onDidOpenTextDocument((document) => schedule(document, 0)),
    workspace.onDidChangeTextDocument((event) => schedule(event.document, 400)),
    workspace.onDidCloseTextDocument((document) => {
      const key = document.uri.toString();
      const timer = timers.get(key);

      if (timer !== undefined) {
        clearTimeout(timer);
        timers.delete(key);
      }

      documentResource.delete(key);
      collection.delete(document.uri);
    }),
    // A manifest edit changes which side every file in the resource runs on.
    workspace.onDidSaveTextDocument((document) => {
      if (isManifestPath(document.uri.path)) {
        invalidateManifests();
        refreshAll();
      }
    }),
    workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration('cfxlua.diagnostics') ||
        event.affectsConfiguration('cfxlua.game')
      ) {
        refreshAll();
      }
    }),
  ];

  refreshAll();

  return {
    dispose: () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }

      timers.clear();
      invalidateManifests();

      for (const subscription of subscriptions) {
        subscription.dispose();
      }
    },
  };
}

/** Exported so a manifest created or deleted on disk can drop the cache. */
export { invalidateManifests };
