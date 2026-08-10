import { type Token, tokenize } from './lua';

export type Side = 'client' | 'server';

/** Script globs a manifest loads, by the side they run on. */
export interface ManifestScripts {
  client: string[];
  server: string[];
  shared: string[];
}

export interface ManifestDirective {
  name: string;
  offset: number;
}

export interface ParsedManifest {
  scripts: ManifestScripts;
  /** Every directive the manifest invokes, in source order. */
  directives: ManifestDirective[];
}

const SCRIPT_DIRECTIVES: Record<string, keyof ManifestScripts> = {
  client_script: 'client',
  client_scripts: 'client',
  server_script: 'server',
  server_scripts: 'server',
  shared_script: 'shared',
  shared_scripts: 'shared',
};

/**
 * Manifest keys with a defined meaning. Used to spot near-misses — a manifest
 * may also carry arbitrary metadata keys, so an unrecognised key is only
 * reported when it looks like a misspelling of one of these.
 */
export const MANIFEST_DIRECTIVES: string[] = [
  'after_level_meta',
  'author',
  'before_level_meta',
  'chat_theme',
  'client_script',
  'client_scripts',
  'clr_disable_task_scheduler',
  'convar_category',
  'data_file',
  'dependencies',
  'dependency',
  'description',
  'disable_lazy_natives',
  'escrow_ignore',
  'export',
  'exports',
  'file',
  'files',
  'fx_version',
  'game',
  'games',
  'license',
  'loadscreen',
  'loadscreen_cursor',
  'loadscreen_manual_shutdown',
  'lua54',
  'name',
  'nui_callback_strict_mode',
  'provide',
  'rdr3_warning',
  'replace_level_meta',
  'repository',
  'resource_manifest_version',
  'server_export',
  'server_exports',
  'server_only',
  'server_script',
  'server_scripts',
  'shared_script',
  'shared_scripts',
  'this_is_a_map',
  'ui_page',
  'use_experimental_fxv2_oal',
  'version',
  'webpack_config',
];

const DIRECTIVE_SET = new Set(MANIFEST_DIRECTIVES);

/**
 * Reads a manifest.
 *
 * A manifest is a flat list of directives, each followed by its string
 * arguments, so every string between one identifier and the next belongs to the
 * identifier before it. That is enough to attribute script globs without
 * parsing Lua properly, and it handles both `client_script 'a.lua'` and
 * `client_scripts { 'a.lua', 'b.lua' }`.
 */
export function parseManifest(text: string): ParsedManifest {
  const tokens: Token[] = tokenize(text);
  const scripts: ManifestScripts = { client: [], server: [], shared: [] };
  const directives: ManifestDirective[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type !== 'identifier') {
      continue;
    }

    const next = tokens[i + 1];

    // A directive is an identifier applied to a string or a table.
    const invoked =
      next !== undefined &&
      (next.type === 'string' ||
        (next.type === 'punctuation' &&
          (next.value === '{' || next.value === '(')));

    if (!invoked) {
      continue;
    }

    directives.push({ name: token.value, offset: token.offset });

    const side = SCRIPT_DIRECTIVES[token.value];

    if (side === undefined) {
      continue;
    }

    for (let j = i + 1; j < tokens.length; j++) {
      if (tokens[j].type === 'identifier') {
        break;
      }

      if (tokens[j].type === 'string') {
        const value = tokens[j].value.trim();

        // `@resource/file.lua` loads another resource's file, not one of ours.
        if (value !== '' && !value.startsWith('@')) {
          scripts[side].push(value);
        }
      }
    }
  }

  return { scripts, directives };
}

/**
 * Converts a manifest script glob to a regular expression.
 *
 * Manifest globs use `*` within a path segment and `**` across segments, the
 * same as the resource loader. Matching is case-insensitive so a path that
 * differs only in case on Windows still resolves.
 */
export function globToRegExp(pattern: string): RegExp {
  let source = '';
  let i = 0;

  const normalized = pattern.replace(/\\/g, '/').replace(/^\.\//, '');

  while (i < normalized.length) {
    const char = normalized[i];

    if (char === '*') {
      if (normalized[i + 1] === '*') {
        // `**/` may match nothing at all, so the separator is optional.
        if (normalized[i + 2] === '/') {
          source += '(?:.*/)?';
          i += 3;
          continue;
        }

        source += '.*';
        i += 2;
        continue;
      }

      source += '[^/]*';
      i++;
      continue;
    }

    if (char === '?') {
      source += '[^/]';
      i++;
      continue;
    }

    source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    i++;
  }

  return new RegExp(`^${source}$`, 'i');
}

/**
 * Which sides a file runs on, given the manifest of the resource containing it.
 *
 * `path` is relative to the manifest's directory, with forward slashes. An empty
 * result means the manifest does not load this file, in which case callers
 * should not assume anything about where it runs.
 */
export function sidesForFile(
  manifest: ParsedManifest,
  path: string,
): Set<Side> {
  const normalized = path.replace(/\\/g, '/');
  const sides = new Set<Side>();

  const matches = (patterns: string[]): boolean =>
    patterns.some((pattern) => globToRegExp(pattern).test(normalized));

  if (matches(manifest.scripts.shared)) {
    sides.add('client');
    sides.add('server');

    return sides;
  }

  if (matches(manifest.scripts.client)) {
    sides.add('client');
  }

  if (matches(manifest.scripts.server)) {
    sides.add('server');
  }

  return sides;
}

/** Distance between two words, capped: anything past `limit` returns `limit + 1`. */
function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) {
    return limit + 1;
  }

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];

    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }

    previous = current;
  }

  return previous[b.length];
}

/**
 * The manifest key `name` was probably meant to be, or undefined.
 *
 * Only close misses on reasonably long names are reported, because any other
 * identifier is a legitimate metadata key.
 */
export function suggestDirective(name: string): string | undefined {
  if (DIRECTIVE_SET.has(name) || name.length < 5) {
    return undefined;
  }

  let best: string | undefined;
  let bestDistance = 3;

  for (const candidate of MANIFEST_DIRECTIVES) {
    const distance = editDistance(name, candidate, 2);

    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
}

export function isManifestPath(path: string): boolean {
  return /[\\/](fxmanifest|__resource)\.lua$/i.test(path);
}
