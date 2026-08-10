import { describe, it } from 'bun:test';
import * as assert from 'node:assert';
import {
  globToRegExp,
  isManifestPath,
  parseManifest,
  sidesForFile,
  suggestDirective,
} from '../../manifest';

const MANIFEST = `fx_version 'cerulean'
game 'gtav'
lua54 'yes'

shared_scripts {
  '@ox_lib/init.lua',
  'shared/*.lua',
}

client_script 'client/main.lua'

server_scripts {
  'server/main.lua',
  'server/db/**/*.lua',
}

files {
  'web/dist/index.html',
}
`;

describe('parseManifest', () => {
  const manifest = parseManifest(MANIFEST);

  it('collects script globs by side', () => {
    assert.deepStrictEqual(manifest.scripts.client, ['client/main.lua']);
    assert.deepStrictEqual(manifest.scripts.server, [
      'server/main.lua',
      'server/db/**/*.lua',
    ]);
    assert.deepStrictEqual(manifest.scripts.shared, ['shared/*.lua']);
  });

  it('ignores files belonging to another resource', () => {
    assert.ok(!manifest.scripts.shared.includes('@ox_lib/init.lua'));
  });

  it('does not attribute a later directive\u2019s files to an earlier one', () => {
    assert.ok(!manifest.scripts.server.includes('web/dist/index.html'));
  });

  it('records every directive it sees', () => {
    const names = manifest.directives.map((directive) => directive.name);

    assert.ok(names.includes('fx_version'));
    assert.ok(names.includes('files'));
    assert.strictEqual(
      names.filter((name) => name === 'client_script').length,
      1,
    );
  });

  it('reports the offset of each directive', () => {
    const game = manifest.directives.find(
      (directive) => directive.name === 'game',
    );

    assert.ok(game !== undefined);
    assert.strictEqual(MANIFEST.slice(game.offset, game.offset + 4), 'game');
  });

  it('ignores directives inside comments and strings', () => {
    const parsed = parseManifest(`
-- client_scripts { 'commented.lua' }
--[[ server_scripts { 'blocked.lua' } ]]
description 'server_scripts is mentioned here'
client_scripts { 'real.lua' }
`);

    assert.deepStrictEqual(parsed.scripts.client, ['real.lua']);
    assert.deepStrictEqual(parsed.scripts.server, []);
  });

  it('reads parenthesised calls', () => {
    const parsed = parseManifest("client_scripts({ 'a.lua', 'b.lua' })");

    assert.deepStrictEqual(parsed.scripts.client, ['a.lua', 'b.lua']);
  });

  it('handles a manifest with no scripts', () => {
    const parsed = parseManifest("fx_version 'cerulean'\ngame 'gtav'\n");

    assert.deepStrictEqual(parsed.scripts, {
      client: [],
      server: [],
      shared: [],
    });
  });
});

describe('globToRegExp', () => {
  it('keeps a single star inside one path segment', () => {
    const pattern = globToRegExp('server/*.lua');

    assert.ok(pattern.test('server/main.lua'));
    assert.ok(!pattern.test('server/db/queries.lua'));
  });

  it('lets a double star cross segments', () => {
    const pattern = globToRegExp('server/**/*.lua');

    assert.ok(pattern.test('server/db/queries.lua'));
    assert.ok(pattern.test('server/a/b/c.lua'));
    // `**/` has to be allowed to match nothing, which is how the loader behaves.
    assert.ok(pattern.test('server/main.lua'));
  });

  it('matches literal paths exactly', () => {
    const pattern = globToRegExp('client/main.lua');

    assert.ok(pattern.test('client/main.lua'));
    assert.ok(!pattern.test('client/main.luax'));
    assert.ok(!pattern.test('other/client/main.lua'));
  });

  it('does not treat dots as wildcards', () => {
    assert.ok(!globToRegExp('client/main.lua').test('client/mainxlua'));
  });
});

describe('sidesForFile', () => {
  const manifest = parseManifest(MANIFEST);

  it('resolves a client script', () => {
    assert.deepStrictEqual(
      [...sidesForFile(manifest, 'client/main.lua')],
      ['client'],
    );
  });

  it('resolves a server script, including nested globs', () => {
    assert.deepStrictEqual(
      [...sidesForFile(manifest, 'server/main.lua')],
      ['server'],
    );
    assert.deepStrictEqual(
      [...sidesForFile(manifest, 'server/db/queries.lua')],
      ['server'],
    );
  });

  it('treats a shared script as both sides', () => {
    assert.deepStrictEqual(
      [...sidesForFile(manifest, 'shared/util.lua')].sort(),
      ['client', 'server'],
    );
  });

  it('returns nothing for a file the manifest does not load', () => {
    assert.strictEqual(sidesForFile(manifest, 'tools/build.lua').size, 0);
  });

  it('normalises windows separators', () => {
    assert.deepStrictEqual(
      [...sidesForFile(manifest, 'server\\main.lua')],
      ['server'],
    );
  });
});

describe('suggestDirective', () => {
  it('spots a transposed known key', () => {
    assert.strictEqual(suggestDirective('client_scrpits'), 'client_scripts');
    assert.strictEqual(suggestDirective('server_sripts'), 'server_scripts');
    assert.strictEqual(suggestDirective('fx_verison'), 'fx_version');
  });

  it('says nothing about keys that are correct', () => {
    assert.strictEqual(suggestDirective('client_scripts'), undefined);
    assert.strictEqual(suggestDirective('ui_page'), undefined);
  });

  it('leaves custom metadata alone', () => {
    // Arbitrary metadata keys are legal, so anything not close to a known key
    // has to pass without comment.
    assert.strictEqual(suggestDirective('ox_inventory'), undefined);
    assert.strictEqual(suggestDirective('my_custom_data'), undefined);
    assert.strictEqual(suggestDirective('qbx_core'), undefined);
  });

  it('ignores short names, where an edit distance of two means nothing', () => {
    assert.strictEqual(suggestDirective('gam'), undefined);
    assert.strictEqual(suggestDirective('file'), undefined);
  });
});

describe('isManifestPath', () => {
  it('recognises both manifest names', () => {
    assert.ok(isManifestPath('/resources/my/fxmanifest.lua'));
    assert.ok(isManifestPath('/resources/my/__resource.lua'));
    assert.ok(isManifestPath('c:\\resources\\my\\fxmanifest.lua'));
  });

  it('rejects ordinary scripts', () => {
    assert.ok(!isManifestPath('/resources/my/client/main.lua'));
    assert.ok(!isManifestPath('/resources/my/fxmanifest.lua.bak'));
  });
});
