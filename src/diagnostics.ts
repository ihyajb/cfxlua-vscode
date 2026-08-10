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
import type { NativeCatalog } from './nativeCatalog';
import { findWrongSideCalls } from './nativeScope';

const SIDE_LABEL: Record<Side, string> = {
  client: 'client',
  server: 'server',
};

export interface DiagnosticsOptions {
  nativeScope: boolean;
  manifestKeys: boolean;
}

function readOptions(): DiagnosticsOptions {
  const config = workspace.getConfiguration('cfxlua');

  return {
    nativeScope: config.get('diagnostics.nativeScope', true),
    manifestKeys: config.get('diagnostics.manifestKeys', true),
  };
}

/**
 * Finds the manifest governing `file` by walking up to the workspace folder root.
 *
 * Resources nest — `resources/[category]/myresource/client/main.lua` — so the
 * nearest manifest above the file is the one that loads it.
 */
async function findManifest(
  file: Uri,
): Promise<{ uri: Uri; manifest: ParsedManifest; root: Uri } | undefined> {
  const folder = workspace.getWorkspaceFolder(file);

  if (folder === undefined) {
    return undefined;
  }

  const root = folder.uri.path;
  let directory = Uri.joinPath(file, '..');

  while (directory.path.startsWith(root)) {
    for (const name of ['fxmanifest.lua', '__resource.lua']) {
      const uri = Uri.joinPath(directory, name);

      try {
        const bytes = await workspace.fs.readFile(uri);

        return {
          uri,
          manifest: parseManifest(Buffer.from(bytes).toString('utf8')),
          root: directory,
        };
      } catch {
        // Not here; keep walking up.
      }
    }

    const parent = Uri.joinPath(directory, '..');

    if (parent.path === directory.path) {
      break;
    }

    directory = parent;
  }

  return undefined;
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
 * with a server RPC variant — 159 of them — never produces a warning, and neither
 * does anything in a shared script.
 */
function nativeScopeDiagnostics(
  document: TextDocument,
  catalog: NativeCatalog,
  sides: Set<Side>,
): Diagnostic[] {
  // Nothing to say about a file that runs on both sides, or one the manifest
  // does not load at all.
  if (sides.size !== 1) {
    return [];
  }

  const [side] = [...sides];

  return findWrongSideCalls(document.getText(), catalog, side).map((call) => {
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

async function computeDiagnostics(
  document: TextDocument,
  catalog: NativeCatalog | undefined,
): Promise<Diagnostic[]> {
  if (document.languageId !== 'lua' || document.uri.scheme !== 'file') {
    return [];
  }

  const options = readOptions();

  if (isManifestPath(document.uri.path)) {
    return options.manifestKeys
      ? manifestDiagnostics(document, parseManifest(document.getText()))
      : [];
  }

  if (!options.nativeScope || catalog === undefined) {
    return [];
  }

  const found = await findManifest(document.uri);

  if (found === undefined) {
    return [];
  }

  const sides = sidesForFile(
    found.manifest,
    relativePath(found.root, document.uri),
  );

  return nativeScopeDiagnostics(document, catalog, sides);
}

/**
 * Keeps diagnostics in step with the open editors.
 *
 * Work is debounced per document because the native scan runs over the whole
 * file, and editing a large script otherwise re-tokenises it on every keystroke.
 */
export function registerDiagnostics(
  getCatalog: () => NativeCatalog | undefined,
): Disposable {
  const collection: DiagnosticCollection =
    languages.createDiagnosticCollection('cfxlua');

  const timers = new Map<string, NodeJS.Timeout>();

  const refresh = async (document: TextDocument): Promise<void> => {
    try {
      collection.set(
        document.uri,
        await computeDiagnostics(document, getCatalog()),
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);

      log(`Diagnostics failed for ${document.uri.fsPath}: ${message}`);
    }
  };

  const schedule = (document: TextDocument, delay: number): void => {
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

      collection.delete(document.uri);
    }),
    // A manifest edit changes which side every file in the resource runs on.
    workspace.onDidSaveTextDocument((document) => {
      if (isManifestPath(document.uri.path)) {
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

      for (const subscription of subscriptions) {
        subscription.dispose();
      }
    },
  };
}
