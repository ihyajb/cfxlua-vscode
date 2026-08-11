import { forEachGlobalCall } from './lua';
import type { Side } from './manifest';

/** Side bits, matching the scope table built by fivem-lls-addon. */
export const CLIENT = 1;
export const SERVER = 2;

/**
 * Native name to the sides it can be called from, as a bitmask.
 *
 * Built at package time from the definition library: apisets are already merged
 * across the sets a game loads, so a native with a server RPC variant is marked
 * as both, and globals the Lua runtime provides itself — `Wait`, `CreateThread` —
 * are absent, because those are not natives whichever side you are on.
 */
export type ScopeTable = Record<string, number>;

export const SIDE_BIT: Record<Side, number> = {
  client: CLIENT,
  server: SERVER,
};

export interface WrongSideCall {
  name: string;
  /** Offset of the identifier in the source text. */
  offset: number;
  /** The sides the native does support. */
  supported: Side[];
}

function sidesOf(bits: number): Side[] {
  if (bits === (CLIENT | SERVER)) return ['client', 'server'];

  return bits === SERVER ? ['server'] : ['client'];
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
 * - anything absent from the table — runtime globals, a resource's own functions —
 *   is left alone rather than guessed at
 */
export function findWrongSideCalls(
  text: string,
  scopes: ScopeTable,
  side: Side,
): WrongSideCall[] {
  const wanted = SIDE_BIT[side];
  const found: WrongSideCall[] = [];

  forEachGlobalCall(text, (name, offset) => {
    const bits = scopes[name];

    // `undefined` for anything that is not a native, and `& wanted` covers both
    // the matching and the both-sides cases without allocating.
    if (bits === undefined || (bits & wanted) !== 0) {
      return;
    }

    found.push({ name, offset, supported: sidesOf(bits) });
  });

  return found;
}
