import { tokenize } from './lua';
import type { Side } from './manifest';
import type { NativeCatalog } from './nativeCatalog';

/** Identifiers that introduce a declaration rather than a call. */
const DECLARATION_KEYWORDS = new Set(['function', 'local']);

/** Punctuation before an identifier that makes it a field, not a global. */
const FIELD_ACCESS = new Set(['.', ':']);

/**
 * Globals the Cfx Lua runtime provides itself, mirroring library/runtime in
 * fivem-lls-addon.
 *
 * These take precedence over any native of the same name, and they exist on both
 * sides, so they can never be wrong-sided. It matters because the game natives
 * include a `WAIT` — meaning `Wait`, the most-called function in Cfx Lua, is
 * declared as a client native as well as the runtime's own `Citizen.Wait`.
 * Without this list every `Wait(0)` in a server script would be reported.
 */
const RUNTIME_GLOBALS = new Set([
  'AddEventHandler',
  'CreateThread',
  'Citizen',
  'Entity',
  'GetPlayerIdentifiers',
  'GetPlayerTokens',
  'GetPlayers',
  'Player',
  'PerformHttpRequest',
  'PerformHttpRequestAwait',
  'RegisterNUICallback',
  'RegisterNetEvent',
  'RegisterServerEvent',
  'RemoveEventHandler',
  'SendNUIMessage',
  'SetTimeout',
  'TriggerClientEvent',
  'TriggerEvent',
  'TriggerLatentClientEvent',
  'TriggerLatentServerEvent',
  'TriggerServerEvent',
  'Wait',
]);

export interface WrongSideCall {
  name: string;
  /** Offset of the identifier in the source text. */
  offset: number;
  /** The sides the native does support. */
  supported: Side[];
}

/**
 * Finds calls to natives that cannot work on `side`.
 *
 * A native is only reported when the sides it supports and the side the file runs
 * on have nothing in common. That single rule is what keeps this quiet enough to
 * be on by default:
 *
 * - a native with a server RPC variant supports both sides, so it never reports
 * - a shared script runs on both sides, so callers skip it entirely
 * - runtime globals such as `TriggerEvent` are not natives, are absent from the
 *   index, and are left alone rather than guessed at
 */
export function findWrongSideCalls(
  text: string,
  catalog: NativeCatalog,
  side: Side,
): WrongSideCall[] {
  const tokens = tokenize(text);
  const found: WrongSideCall[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type !== 'identifier') {
      continue;
    }

    const next = tokens[i + 1];

    // Only calls; a bare mention of a name is not an invocation.
    if (
      next === undefined ||
      next.type !== 'punctuation' ||
      next.value !== '('
    ) {
      continue;
    }

    const previous = tokens[i - 1];

    if (
      previous !== undefined &&
      ((previous.type === 'identifier' &&
        DECLARATION_KEYWORDS.has(previous.value)) ||
        (previous.type === 'punctuation' && FIELD_ACCESS.has(previous.value)))
    ) {
      continue;
    }

    if (RUNTIME_GLOBALS.has(token.value)) {
      continue;
    }

    const supported = catalog.sides(token.value);

    if (supported === undefined || supported.has(side)) {
      continue;
    }

    found.push({
      name: token.value,
      offset: token.offset,
      supported: [...supported],
    });
  }

  return found;
}
