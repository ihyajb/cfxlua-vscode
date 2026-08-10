import * as assert from 'node:assert';
import { describe, it } from 'node:test';
import { tokenize } from '../../lua';

const identifiers = (source: string): string[] =>
  tokenize(source)
    .filter((token) => token.type === 'identifier')
    .map((token) => token.value);

describe('tokenize', () => {
  it('reads identifiers and punctuation', () => {
    assert.deepStrictEqual(identifiers('GetPlayerPed(-1)'), ['GetPlayerPed']);
  });

  it('skips line comments', () => {
    assert.deepStrictEqual(identifiers('-- SetNuiFocus(true)\nWait(0)'), [
      'Wait',
    ]);
  });

  it('skips block comments, including levelled ones', () => {
    assert.deepStrictEqual(identifiers('--[[ SetNuiFocus() ]] Wait(0)'), [
      'Wait',
    ]);
    assert.deepStrictEqual(identifiers('--[==[ Hidden() ]==] Wait(0)'), [
      'Wait',
    ]);
  });

  it('does not read identifiers out of strings', () => {
    assert.deepStrictEqual(identifiers("print('SetNuiFocus(true)')"), [
      'print',
    ]);
    assert.deepStrictEqual(identifiers('print("Wait(0)")'), ['print']);
  });

  it('keeps string contents', () => {
    const tokens = tokenize("client_script 'client/main.lua'");

    assert.deepStrictEqual(
      tokens.map((token) => [token.type, token.value]),
      [
        ['identifier', 'client_script'],
        ['string', 'client/main.lua'],
      ],
    );
  });

  it('handles escapes without ending the string early', () => {
    const tokens = tokenize("print('it\\'s fine') Wait(0)");

    assert.deepStrictEqual(identifiers("print('it\\'s fine') Wait(0)"), [
      'print',
      'Wait',
    ]);
    assert.strictEqual(tokens[2].value, "it's fine");
  });

  it('does not let an unterminated string swallow the file', () => {
    assert.deepStrictEqual(identifiers("print('oops\nWait(0)"), [
      'print',
      'Wait',
    ]);
  });

  it('reads long strings', () => {
    const tokens = tokenize('local sql = [[SELECT * FROM users]]');

    assert.strictEqual(tokens[3].type, 'string');
    assert.strictEqual(tokens[3].value, 'SELECT * FROM users');
  });

  it('reads hex literals as numbers, not identifiers', () => {
    const tokens = tokenize('Citizen.InvokeNative(0x2F7A49E6)');

    assert.deepStrictEqual(identifiers('Citizen.InvokeNative(0x2F7A49E6)'), [
      'Citizen',
      'InvokeNative',
    ]);
    assert.ok(tokens.some((token) => token.type === 'number'));
  });

  it('reports offsets that point back at the source', () => {
    const source = 'Wait(0)\nSetNuiFocus(true)';
    const token = tokenize(source).find(
      (candidate) => candidate.value === 'SetNuiFocus',
    );

    assert.ok(token !== undefined);
    assert.strictEqual(
      source.slice(token.offset, token.offset + 'SetNuiFocus'.length),
      'SetNuiFocus',
    );
  });
});
