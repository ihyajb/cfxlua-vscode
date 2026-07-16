/** True when both arrays contain the same elements in the same order. */
export function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

/**
 * Strips `Lua.workspace.library` entries this extension no longer writes:
 * - entries from the archived Overextended fork
 * - legacy entries pointing at the extension install dir instead of
 *   globalStorage
 * - malformed entries with a `file:` scheme or percent-encoding, written by
 *   versions that derived the storage path from a Uri string
 */
export function cleanLibraryEntries(
  entries: string[],
  extensionId: string,
): string[] {
  return entries.filter((entry) => {
    if (entry.includes('overextended.cfxlua-vscode')) {
      return false;
    }

    if (!entry.includes(extensionId)) {
      return true;
    }

    if (!entry.includes('globalStorage')) {
      return false;
    }

    return !entry.includes('file:') && !entry.includes('%');
  });
}
