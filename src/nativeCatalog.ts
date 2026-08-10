import type { Side } from './manifest';

/** One native, as stored in the index. Keys are short to keep the file small. */
export interface IndexedNative {
  /** Native hash, lowercase, `0x`-prefixed. */
  h: string;
  /** Namespace, e.g. `ENTITY`. */
  ns: string;
  /** Apiset: `client`, `server` or `shared`. */
  a: string;
  /** Parameter names, in signature order. */
  p: string[];
  /** Parameter types, aligned with `p`. */
  t: string[];
  /** Return values, each `type` or `type name`. */
  r: string[];
}

export interface NativeSet {
  natives: Record<string, IndexedNative>;
  aliases: Record<string, string>;
}

export interface NativeIndex {
  version: number;
  sets: Record<string, NativeSet>;
}

/**
 * A read-only view of the natives available for one game.
 *
 * The CFX set is always loaded alongside the selected game's, and the two
 * overlap: a game native that can also be called from the server appears in
 * both, once as `client` and once as `server`. Merging them is what makes the
 * apiset trustworthy — read either set alone and 159 natives look one-sided when
 * they are not.
 */
export class NativeCatalog {
  private byHash: Map<string, string> | undefined;

  constructor(
    private readonly index: NativeIndex,
    private readonly game: string,
  ) {}

  private get sets(): NativeSet[] {
    const keys = [this.game.toUpperCase(), 'CFX-NATIVE'];

    return keys
      .map((key) => this.index.sets[key])
      .filter((set): set is NativeSet => set !== undefined);
  }

  /** Every native name the current game can call, unsorted. */
  public names(): string[] {
    const names = new Set<string>();

    for (const set of this.sets) {
      for (const name of Object.keys(set.natives)) {
        names.add(name);
      }
    }

    return [...names];
  }

  /**
   * The definition of `name`, preferring the game's own set so its signature and
   * documentation link win over the server RPC variant.
   */
  public lookup(name: string): IndexedNative | undefined {
    for (const set of this.sets) {
      const native = set.natives[name];

      if (native !== undefined) {
        return native;
      }
    }

    return undefined;
  }

  /**
   * Where `name` can be called from, or undefined when it is not a native at all
   * — runtime globals such as `TriggerEvent` are not in the index and must not be
   * reported.
   */
  public sides(name: string): Set<Side> | undefined {
    let found = false;
    const sides = new Set<Side>();

    for (const set of this.sets) {
      const native = set.natives[name];

      if (native === undefined) {
        continue;
      }

      found = true;

      if (native.a === 'shared') {
        sides.add('client');
        sides.add('server');
      } else if (native.a === 'server') {
        sides.add('server');
      } else {
        sides.add('client');
      }
    }

    return found ? sides : undefined;
  }

  /** The native a hash belongs to, for `Citizen.InvokeNative(0x…)` calls. */
  public fromHash(hash: string): string | undefined {
    if (this.byHash === undefined) {
      this.byHash = new Map();

      for (const set of this.sets) {
        for (const [name, native] of Object.entries(set.natives)) {
          if (native.h !== undefined && !this.byHash.has(native.h)) {
            this.byHash.set(native.h.toLowerCase(), name);
          }
        }
      }
    }

    return this.byHash.get(hash.toLowerCase());
  }

  /** The name a deprecated alias points at. */
  public resolveAlias(name: string): string | undefined {
    for (const set of this.sets) {
      const target = set.aliases[name];

      if (target !== undefined) {
        return target;
      }
    }

    return undefined;
  }
}

/** `GetEntityCoords(entity, alive)` — the call signature, without types. */
export function callSignature(name: string, native: IndexedNative): string {
  return `${name}(${native.p.join(', ')})`;
}

/** The full annotated signature, for hover text. */
export function typedSignature(name: string, native: IndexedNative): string {
  const params = native.p
    .map((param, i) => `${param}: ${native.t[i] ?? 'any'}`)
    .join(', ');

  const returns = native.r.length > 0 ? `: ${native.r.join(', ')}` : '';

  return `function ${name}(${params})${returns}`;
}

/** A snippet body that drops the caller straight into the first argument. */
export function callSnippet(name: string, native: IndexedNative): string {
  const params = native.p.map((param, i) => `\${${i + 1}:${param}}`).join(', ');

  return `${name}(${params})`;
}
