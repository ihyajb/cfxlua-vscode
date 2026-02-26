import { workspace, Uri } from 'vscode';
import { log } from './logger';

/**
 * Copies a file or directory from the extension source to global storage.
 * Uses `copy` instead of `rename` so the source remains intact for future reloads.
 */
export default async function copyToStorage(
  name: string,
  source: Uri,
  target: Uri,
): Promise<void> {
  const sourceFile = Uri.joinPath(source, name);

  try {
    await workspace.fs.stat(sourceFile);
    await workspace.fs.copy(sourceFile, Uri.joinPath(target, name), {
      overwrite: true,
    });
  } catch {
    // Source doesn't exist — already handled or extension in unexpected state
    log(`Source not found, skipping copy: ${sourceFile.fsPath}`);
  }
}
