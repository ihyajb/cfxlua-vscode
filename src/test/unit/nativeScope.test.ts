import * as assert from 'node:assert';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { gunzipSync } from 'node:zlib';
import {
  type IndexedNative,
  NativeCatalog,
  type NativeIndex,
  callSnippet,
  typedSignature,
} from '../../nativeCatalog';
import { findWrongSideCalls } from '../../nativeScope';

const native = (over: Partial<IndexedNative>): IndexedNative => ({
  h: '0x1',
  ns: 'TEST',
  a: 'client',
  p: [],
  t: [],
  r: [],
  ...over,
});

const index: NativeIndex = {
  version: 1,
  sets: {
    GTAV: {
      natives: {
        // Client only: no server RPC variant exists.
        SetNuiFocus: native({
          h: '0xa1',
          a: 'client',
          p: ['hasFocus'],
          t: ['boolean'],
        }),
        // Also published as a server RPC native, below.
        SetEntityCoords: native({
          h: '0xb2',
          a: 'client',
          p: ['entity'],
          t: ['Entity'],
        }),
        GetEntityCoords: native({
          h: '0xc3',
          a: 'client',
          p: ['entity'],
          t: ['Entity'],
          r: ['vector3'],
        }),
      },
      aliases: { OldNuiFocus: 'SetNuiFocus' },
    },
    'CFX-NATIVE': {
      natives: {
        SetEntityCoords: native({
          h: '0xb2',
          a: 'server',
          p: ['entity'],
          t: ['Entity'],
        }),
        GetPlayerIdentifier: native({
          h: '0xd4',
          a: 'server',
          p: ['playerSrc'],
        }),
        RegisterCommand: native({ h: '0xe5', a: 'shared', p: ['commandName'] }),
      },
      aliases: {},
    },
    RDR3: { natives: { PromptSetEnabled: native({}) }, aliases: {} },
  },
};

const catalog = new NativeCatalog(index, 'gtav');

describe('NativeCatalog', () => {
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

  it('reports both sides for a native with a server RPC variant', () => {
    assert.deepStrictEqual(
      [...(catalog.sides('SetEntityCoords') ?? [])].sort(),
      ['client', 'server'],
    );
  });

  it('reports one side for natives that only have one', () => {
    assert.deepStrictEqual(
      [...(catalog.sides('SetNuiFocus') ?? [])],
      ['client'],
    );
    assert.deepStrictEqual(
      [...(catalog.sides('GetPlayerIdentifier') ?? [])],
      ['server'],
    );
  });

  it('treats a shared native as available on both sides', () => {
    assert.deepStrictEqual(
      [...(catalog.sides('RegisterCommand') ?? [])].sort(),
      ['client', 'server'],
    );
  });

  it('says nothing about names that are not natives', () => {
    assert.strictEqual(catalog.sides('TriggerEvent'), undefined);
    assert.strictEqual(catalog.sides('MyOwnHelper'), undefined);
  });

  it('resolves a hash back to a native', () => {
    assert.strictEqual(catalog.fromHash('0XB2'), 'SetEntityCoords');
    assert.strictEqual(catalog.fromHash('0xa1'), 'SetNuiFocus');
    assert.strictEqual(catalog.fromHash('0xdeadbeef'), undefined);
  });

  it('resolves deprecated aliases', () => {
    assert.strictEqual(catalog.resolveAlias('OldNuiFocus'), 'SetNuiFocus');
  });

  it('renders signatures and snippets', () => {
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
});

describe('findWrongSideCalls', () => {
  it('flags a client-only native in a server script', () => {
    const found = findWrongSideCalls(
      'SetNuiFocus(true, true)',
      catalog,
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
      catalog,
      'client',
    );

    assert.deepStrictEqual(
      found.map((call) => call.name),
      ['GetPlayerIdentifier'],
    );
  });

  it('stays quiet about natives with a server RPC variant', () => {
    assert.deepStrictEqual(
      findWrongSideCalls('SetEntityCoords(ped)', catalog, 'server'),
      [],
    );
  });

  it('stays quiet about shared natives', () => {
    assert.deepStrictEqual(
      findWrongSideCalls("RegisterCommand('x')", catalog, 'server'),
      [],
    );
  });

  it('stays quiet about runtime globals it knows nothing about', () => {
    assert.deepStrictEqual(
      findWrongSideCalls(
        "TriggerClientEvent('x', -1)\nCreateThread(function() end)",
        catalog,
        'server',
      ),
      [],
    );
  });

  it('ignores mentions that are not calls', () => {
    assert.deepStrictEqual(
      findWrongSideCalls('local fn = SetNuiFocus', catalog, 'server'),
      [],
    );
  });

  it('ignores a local function that shares a native name', () => {
    assert.deepStrictEqual(
      findWrongSideCalls('local function SetNuiFocus() end', catalog, 'server'),
      [],
    );
  });

  it('ignores method and field calls', () => {
    assert.deepStrictEqual(
      findWrongSideCalls('nui:SetNuiFocus(true)', catalog, 'server'),
      [],
    );
    assert.deepStrictEqual(
      findWrongSideCalls('helpers.SetNuiFocus(true)', catalog, 'server'),
      [],
    );
  });

  it('ignores occurrences in comments and strings', () => {
    assert.deepStrictEqual(
      findWrongSideCalls(
        "-- SetNuiFocus(true)\nprint('SetNuiFocus(true)')",
        catalog,
        'server',
      ),
      [],
    );
  });

  it('reports every offending call in a file', () => {
    const source = [
      'RegisterCommand("x", function()',
      '  SetNuiFocus(true, true)',
      '  SetEntityCoords(ped)',
      '  SetNuiFocus(false, false)',
      'end)',
    ].join('\n');

    assert.strictEqual(findWrongSideCalls(source, catalog, 'server').length, 2);
  });
});

/**
 * The rule is only as good as the data behind it, so these run against the index
 * that actually ships. A regression here means real users would see warnings on
 * natives that are perfectly legal where they wrote them.
 */
describe('findWrongSideCalls against the shipped index', () => {
  const file = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'plugin',
    'natives-index.json.gz',
  );

  let shipped: NativeCatalog | undefined;

  try {
    shipped = new NativeCatalog(
      JSON.parse(
        gunzipSync(readFileSync(file)).toString('utf8'),
      ) as NativeIndex,
      'gtav',
    );
  } catch {
    shipped = undefined;
  }

  it(
    'flags a client-only native in a server script',
    { skip: !shipped },
    () => {
      const found = findWrongSideCalls(
        'SetNuiFocus(true, true)',
        shipped as NativeCatalog,
        'server',
      );

      assert.deepStrictEqual(
        found.map((call) => call.name),
        ['SetNuiFocus'],
      );
    },
  );

  it('leaves server-usable game natives alone', { skip: !shipped }, () => {
    // Every one of these is a GTAV native with a server RPC variant, and all
    // of them are routinely called from server scripts.
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
      findWrongSideCalls(source, shipped as NativeCatalog, 'server'),
      [],
    );
  });

  it('leaves the runtime API alone on both sides', { skip: !shipped }, () => {
    const source = [
      'CreateThread(function() end)',
      'Wait(0)',
      "TriggerEvent('x')",
      "TriggerClientEvent('x', -1)",
      "RegisterNetEvent('x')",
      "AddEventHandler('x', function() end)",
      'GetPlayers()',
      "exports('x', function() end)",
      'json.encode({})',
      "PerformHttpRequest('https://example.com', function() end)",
    ].join('\n');

    for (const side of ['client', 'server'] as const) {
      assert.deepStrictEqual(
        findWrongSideCalls(source, shipped as NativeCatalog, side),
        [],
        `unexpected warning on the ${side}`,
      );
    }
  });
});

describe('runtime globals', () => {
  it('never reports Wait, which the runtime provides on both sides', () => {
    // The game natives also declare a `WAIT`, so without the runtime-globals
    // list this is flagged in every server script.
    const shippedCatalog = new NativeCatalog(index, 'gtav');

    assert.deepStrictEqual(
      findWrongSideCalls('Wait(0)', shippedCatalog, 'server'),
      [],
    );
  });
});
