import { describe, it } from 'bun:test';
import * as assert from 'node:assert';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { gunzipSync } from 'node:zlib';
import {
  type IndexedNative,
  NativeCatalog,
  type NativeIndex,
  callSnippet,
  typedSignature,
} from '../../nativeCatalog';
import {
  CLIENT,
  SERVER,
  type ScopeTable,
  findWrongSideCalls,
} from '../../nativeScope';

const native = (over: Partial<IndexedNative>): IndexedNative => ({
  h: '0x1',
  ns: 'TEST',
  a: 'client',
  ...over,
});

const index: NativeIndex = {
  version: 1,
  sets: {
    GTAV: {
      natives: {
        SetNuiFocus: native({ h: '0xa1', p: 'hasFocus', t: 'boolean' }),
        SetEntityCoords: native({ h: '0xb2', p: 'entity', t: 'Entity' }),
        GetEntityCoords: native({
          h: '0xc3',
          p: 'entity',
          t: 'Entity',
          r: 'vector3',
        }),
        GetEntityMatrix: native({
          h: '0xc4',
          p: 'entity',
          t: 'Entity',
          r: 'vector3 right,vector3 forward',
        }),
      },
      aliases: { OldNuiFocus: 'SetNuiFocus' },
    },
    'CFX-NATIVE': {
      natives: {
        SetEntityCoords: native({ h: '0xb2', a: 'server', p: 'entity' }),
        GetPlayerIdentifier: native({ h: '0xd4', a: 'server', p: 'playerSrc' }),
      },
      aliases: {},
    },
    RDR3: { natives: { PromptSetEnabled: native({}) }, aliases: {} },
  },
};

/** Shaped like the table fivem-lls-addon builds: name to side bitmask. */
const scopes: ScopeTable = {
  SetNuiFocus: CLIENT,
  GetPlayerIdentifier: SERVER,
  SetEntityCoords: CLIENT | SERVER,
  RegisterCommand: CLIENT | SERVER,
  // Wait and CreateThread are deliberately absent: the builder drops every
  // global the Lua runtime declares, so the game's WAIT native cannot make
  // Wait(0) look client-only in a server script.
};

describe('NativeCatalog', () => {
  const catalog = new NativeCatalog(index, 'gtav');

  it('merges the game set with the CFX set', () => {
    assert.ok(catalog.names().includes('SetNuiFocus'));
    assert.ok(catalog.names().includes('GetPlayerIdentifier'));
  });

  it('excludes the other game', () => {
    assert.ok(!catalog.names().includes('PromptSetEnabled'));
    assert.ok(
      new NativeCatalog(index, 'rdr3').names().includes('PromptSetEnabled'),
    );
  });

  it('returns names sorted, and the same array on repeat calls', () => {
    const first = catalog.names();

    assert.deepStrictEqual(first, [...first].sort());
    assert.strictEqual(catalog.names(), first);
  });

  it('prefers the game set over the shared set', () => {
    // Both declare SetEntityCoords; the game's own signature should win.
    assert.strictEqual(catalog.lookup('SetEntityCoords')?.t, 'Entity');
  });

  it('resolves a hash back to a native', () => {
    assert.strictEqual(catalog.fromHash('0XB2'), 'SetEntityCoords');
    assert.strictEqual(catalog.fromHash('0xa1'), 'SetNuiFocus');
    assert.strictEqual(catalog.fromHash('0xdeadbeef'), undefined);
  });

  it('resolves deprecated aliases', () => {
    assert.strictEqual(catalog.resolveAlias('OldNuiFocus'), 'SetNuiFocus');
  });

  it('renders signatures from the joined fields', () => {
    const definition = catalog.lookup('GetEntityCoords');

    assert.ok(definition !== undefined);
    assert.strictEqual(
      typedSignature('GetEntityCoords', definition),
      'function GetEntityCoords(entity: Entity): vector3',
    );
    assert.strictEqual(
      callSnippet('GetEntityCoords', definition),
      'GetEntityCoords(${1:entity})',
    );
  });

  it('renders multiple named returns', () => {
    const definition = catalog.lookup('GetEntityMatrix');

    assert.ok(definition !== undefined);
    assert.strictEqual(
      typedSignature('GetEntityMatrix', definition),
      'function GetEntityMatrix(entity: Entity): vector3 right, vector3 forward',
    );
  });

  it('handles natives with no parameters or returns', () => {
    const definition = new NativeCatalog(index, 'rdr3').lookup(
      'PromptSetEnabled',
    );

    assert.ok(definition !== undefined);
    assert.strictEqual(
      typedSignature('PromptSetEnabled', definition),
      'function PromptSetEnabled()',
    );
    assert.strictEqual(
      callSnippet('PromptSetEnabled', definition),
      'PromptSetEnabled()',
    );
  });
});

describe('findWrongSideCalls', () => {
  it('flags a client-only native in a server script', () => {
    const found = findWrongSideCalls(
      'SetNuiFocus(true, true)',
      scopes,
      'server',
    );

    assert.strictEqual(found.length, 1);
    assert.strictEqual(found[0].name, 'SetNuiFocus');
    assert.strictEqual(found[0].offset, 0);
    assert.deepStrictEqual(found[0].supported, ['client']);
  });

  it('flags a server-only native in a client script', () => {
    const found = findWrongSideCalls(
      'GetPlayerIdentifier(source, 0)',
      scopes,
      'client',
    );

    assert.deepStrictEqual(
      found.map((call) => call.name),
      ['GetPlayerIdentifier'],
    );
  });

  it('stays quiet about natives valid on both sides', () => {
    assert.deepStrictEqual(
      findWrongSideCalls('SetEntityCoords(ped)', scopes, 'server'),
      [],
    );
    assert.deepStrictEqual(
      findWrongSideCalls("RegisterCommand('x')", scopes, 'server'),
      [],
    );
  });

  it('stays quiet about names absent from the table', () => {
    assert.deepStrictEqual(
      findWrongSideCalls(
        "TriggerClientEvent('x', -1)\nCreateThread(function() end)\nWait(0)",
        scopes,
        'server',
      ),
      [],
    );
  });

  it('ignores mentions that are not calls', () => {
    assert.deepStrictEqual(
      findWrongSideCalls('local fn = SetNuiFocus', scopes, 'server'),
      [],
    );
  });

  it('ignores a local function that shares a native name', () => {
    assert.deepStrictEqual(
      findWrongSideCalls('local function SetNuiFocus() end', scopes, 'server'),
      [],
    );
    assert.deepStrictEqual(
      findWrongSideCalls('function SetNuiFocus() end', scopes, 'server'),
      [],
    );
  });

  it('ignores method and field calls', () => {
    assert.deepStrictEqual(
      findWrongSideCalls('nui:SetNuiFocus(true)', scopes, 'server'),
      [],
    );
    assert.deepStrictEqual(
      findWrongSideCalls('helpers.SetNuiFocus(true)', scopes, 'server'),
      [],
    );
  });

  it('ignores occurrences in comments and strings', () => {
    assert.deepStrictEqual(
      findWrongSideCalls(
        "-- SetNuiFocus(true)\nprint('SetNuiFocus(true)')\n--[[ SetNuiFocus(1) ]]",
        scopes,
        'server',
      ),
      [],
    );
  });

  it('allows whitespace between the name and the call', () => {
    assert.deepStrictEqual(
      findWrongSideCalls('SetNuiFocus  (true)', scopes, 'server').map(
        (call) => call.name,
      ),
      ['SetNuiFocus'],
    );
  });

  it('reports every offending call in a file, with usable offsets', () => {
    const source = [
      'RegisterCommand("x", function()',
      '  SetNuiFocus(true, true)',
      '  SetEntityCoords(ped)',
      '  SetNuiFocus(false, false)',
      'end)',
    ].join('\n');

    const found = findWrongSideCalls(source, scopes, 'server');

    assert.strictEqual(found.length, 2);

    for (const call of found) {
      assert.strictEqual(
        source.slice(call.offset, call.offset + call.name.length),
        call.name,
      );
    }
  });
});

/**
 * The rule is only as good as the data behind it, so these run against the
 * artifacts that actually ship. A regression here means real users would see
 * warnings on natives that are perfectly legal where they wrote them.
 */
describe('against the shipped artifacts', () => {
  const read = (name: string): unknown => {
    const file = path.join(__dirname, '..', '..', '..', 'plugin', name);

    return JSON.parse(gunzipSync(readFileSync(file)).toString('utf8'));
  };

  let shipped: ScopeTable | undefined;

  try {
    shipped = (
      read('native-scopes.json.gz') as {
        games: Record<string, ScopeTable>;
      }
    ).games.GTAV;
  } catch {
    shipped = undefined;
  }

  const withScopes = it.skipIf(shipped === undefined);

  withScopes('flags a client-only native in a server script', () => {
    assert.deepStrictEqual(
      findWrongSideCalls(
        'SetNuiFocus(true, true)',
        shipped as ScopeTable,
        'server',
      ).map((call) => call.name),
      ['SetNuiFocus'],
    );
  });

  withScopes('leaves server-usable game natives alone', () => {
    // Every one of these is a GTAV native with a server RPC variant, and all of
    // them are routinely called from server scripts.
    const source = [
      'SetEntityCoords(ped, 0.0, 0.0, 0.0, false, false, false, false)',
      'GetEntityCoords(ped)',
      'GetPlayerName(source)',
      'GetPlayerPed(source)',
      'DeleteEntity(veh)',
      'CreateVehicle(model, 0.0, 0.0, 0.0, 0.0, true, true)',
      'SetPedArmour(ped, 100)',
      'GetVehicleNumberPlateText(veh)',
    ].join('\n');

    assert.deepStrictEqual(
      findWrongSideCalls(source, shipped as ScopeTable, 'server'),
      [],
    );
  });

  withScopes('leaves the runtime API alone on both sides', () => {
    const source = [
      'CreateThread(function() end)',
      'Wait(0)',
      'SetTimeout(100, function() end)',
      "TriggerEvent('x')",
      "TriggerClientEvent('x', -1)",
      "RegisterNetEvent('x')",
      "AddEventHandler('x', function() end)",
      'GetPlayers()',
      "exports('x', function() end)",
      "PerformHttpRequest('https://example.com', function() end)",
    ].join('\n');

    for (const side of ['client', 'server'] as const) {
      assert.deepStrictEqual(
        findWrongSideCalls(source, shipped as ScopeTable, side),
        [],
        `unexpected warning on the ${side}`,
      );
    }
  });

  withScopes('excludes runtime globals from the table entirely', () => {
    const table = shipped as ScopeTable;

    for (const name of ['Wait', 'CreateThread', 'SetTimeout', 'GetPlayers']) {
      assert.strictEqual(
        table[name],
        undefined,
        `${name} should not be in the scope table`,
      );
    }
  });
});
