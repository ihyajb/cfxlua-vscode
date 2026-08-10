import * as assert from 'node:assert';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import toTildePath from '../../toTildePath';

const home = path.resolve(path.sep, 'home', 'user');

describe('toTildePath', () => {
  it('rewrites paths under the home directory', () => {
    const target = path.join(home, '.config', 'Code', 'User', 'globalStorage');
    assert.strictEqual(
      toTildePath(target, home),
      path.join('~', '.config', 'Code', 'User', 'globalStorage'),
    );
  });

  it('returns paths outside the home directory unchanged', () => {
    const target = path.resolve(path.sep, 'opt', 'storage');
    assert.strictEqual(toTildePath(target, home), target);
  });

  it('returns the home directory itself unchanged', () => {
    assert.strictEqual(toTildePath(home, home), home);
  });

  it('returns the path unchanged when home is empty', () => {
    const target = path.join(home, '.config');
    assert.strictEqual(toTildePath(target, ''), target);
  });
});
