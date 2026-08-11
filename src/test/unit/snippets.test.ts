import { describe, it } from 'bun:test';
import * as assert from 'node:assert';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';

interface Snippet {
  prefix: string;
  body: string[];
  description: string;
}

const snippets: Record<string, Snippet> = JSON.parse(
  readFileSync(
    path.join(__dirname, '..', '..', '..', 'snippets', 'cfxlua.json'),
    'utf8',
  ),
);

const bodies = Object.values(snippets).flatMap((snippet) => snippet.body);

describe('snippets', () => {
  it('every snippet has a prefix, a body and a description', () => {
    for (const [name, snippet] of Object.entries(snippets)) {
      assert.ok(snippet.prefix, `${name} has no prefix`);
      assert.ok(snippet.body.length > 0, `${name} has an empty body`);
      assert.ok(snippet.description, `${name} has no description`);
    }
  });

  it('prefixes are unique', () => {
    const prefixes = Object.values(snippets).map((snippet) => snippet.prefix);

    assert.strictEqual(new Set(prefixes).size, prefixes.length);
  });

  it('never writes gtav as a manifest game value', () => {
    // `gtav` is the name of the definition folder, not a value the manifest
    // accepts — inserting it warns on every manifest it is used in.
    for (const line of bodies) {
      assert.ok(!line.includes('gtav'), `"${line}" should use gta5`);
    }
  });

  it('offers the manifest game values the platform accepts', () => {
    const game = snippets['Resource manifest'].body.find((line) =>
      line.startsWith('game '),
    );

    assert.strictEqual(game, "game '${1|gta5,rdr3,common|}'");
  });

  it('leaves placeholder syntax balanced', () => {
    for (const line of bodies) {
      const opens = (line.match(/\$\{/g) ?? []).length;
      const closes = (line.match(/\}/g) ?? []).length;

      assert.ok(closes >= opens, `unbalanced placeholder in "${line}"`);
    }
  });
});
