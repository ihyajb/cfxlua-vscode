import * as assert from 'node:assert';
import { describe, it } from 'node:test';
import { arraysEqual, cleanLibraryEntries } from '../../libraryUtils';

const EXTENSION_ID = 'ihyajb.cfxlua-intellisense-aj';

describe('arraysEqual', () => {
  it('returns true for identical arrays', () => {
    assert.strictEqual(arraysEqual(['a', 'b'], ['a', 'b']), true);
    assert.strictEqual(arraysEqual([], []), true);
  });

  it('returns false for different lengths', () => {
    assert.strictEqual(arraysEqual(['a'], ['a', 'b']), false);
  });

  it('returns false for different order', () => {
    assert.strictEqual(arraysEqual(['a', 'b'], ['b', 'a']), false);
  });
});

describe('cleanLibraryEntries', () => {
  it('keeps entries unrelated to the extension', () => {
    const entries = ['/some/other/library', '~/my/lua/defs'];
    assert.deepStrictEqual(cleanLibraryEntries(entries, EXTENSION_ID), entries);
  });

  it('keeps current-format globalStorage entries', () => {
    const entries = [
      `~/AppData/Roaming/Code/User/globalStorage/${EXTENSION_ID}/library/runtime`,
      `~/.config/Code/User/globalStorage/${EXTENSION_ID}/library/natives/GTAV`,
    ];
    assert.deepStrictEqual(cleanLibraryEntries(entries, EXTENSION_ID), entries);
  });

  it('removes entries from the archived Overextended fork', () => {
    const entries = [
      '~/.vscode/extensions/overextended.cfxlua-vscode-0.1.0/library/runtime',
    ];
    assert.deepStrictEqual(cleanLibraryEntries(entries, EXTENSION_ID), []);
  });

  it('removes legacy entries pointing at the extension install dir', () => {
    const entries = [
      `~/.vscode/extensions/${EXTENSION_ID}-1.0.0/library/runtime`,
    ];
    assert.deepStrictEqual(cleanLibraryEntries(entries, EXTENSION_ID), []);
  });

  it('removes malformed file: scheme entries', () => {
    const entries = [
      `file:/home/user/.config/Code/User/globalStorage/${EXTENSION_ID}/library/runtime`,
    ];
    assert.deepStrictEqual(cleanLibraryEntries(entries, EXTENSION_ID), []);
  });

  it('removes malformed percent-encoded entries', () => {
    const entries = [
      `~/Library/Application%20Support/Code/User/globalStorage/${EXTENSION_ID}/library/runtime`,
    ];
    assert.deepStrictEqual(cleanLibraryEntries(entries, EXTENSION_ID), []);
  });
});
