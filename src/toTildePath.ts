import * as path from 'node:path';

/**
 * Rewrites an absolute path inside the user's home directory to a
 * `~`-prefixed path so the value stored in settings.json stays portable
 * across machines (e.g. via Settings Sync). Paths outside the home
 * directory are returned unchanged.
 */
export default function toTildePath(fsPath: string, home: string): string {
  if (!home) {
    return fsPath;
  }

  const relative = path.relative(home, fsPath);

  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return fsPath;
  }

  return path.join('~', relative);
}
