/**
 * One native, as stored in the index.
 *
 * Keys are short, and the parameter and return lists are comma-joined strings
 * rather than arrays, because the library holds 14,500 of these and a consumer
 * only ever splits the handful it is about to display. Absent means empty.
 */
export interface IndexedNative {
  /** Native hash, lowercase, `0x`-prefixed. */
  h: string;
  /** Namespace, e.g. `ENTITY`. */
  ns: string;
  /** Apiset: `client`, `server` or `shared`. */
  a: string;
  /** Parameter names, in signature order. */
  p?: string;
  /** Parameter types, aligned with `p`. */
  t?: string;
  /** Return values, each `type` or `type name`. */
  r?: string;
}

export interface NativeSet {
  natives: Record<string, IndexedNative>;
  aliases: Record<string, string>;
}

export interface NativeIndex {
  version: number;
  sets: Record<string, NativeSet>;
}

/** The set loaded alongside whichever game is selected. */
const SHARED_SET = 'CFX-NATIVE';

const split = (value: string | undefined): string[] =>
  value === undefined || value === '' ? [] : value.split(',');

export const paramNames = (native: IndexedNative): string[] => split(native.p);
export const paramTypes = (native: IndexedNative): string[] => split(native.t);
export const returnValues = (native: IndexedNative): string[] =>
  split(native.r);

/**
 * A read-only view of the natives available for one game.
 *
 * Instances are cached per game by the loader, so the derived lookups below are
 * built at most once each per session rather than on every editor change.
 */
export class NativeCatalog {
  private readonly sets: NativeSet[];

  private sortedNames: string[] | undefined;
  private hashes: Map<string, string> | undefined;

  constructor(index: NativeIndex, game: string) {
    // Resolved once. This used to be a getter, which rebuilt the array on every
    // lookup — including once per identifier while scanning a document.
    this.sets = [game.toUpperCase(), SHARED_SET]
      .map((key) => index.sets[key])
      .filter((set): set is NativeSet => set !== undefined);
  }

  /** Every native name the current game can call, sorted. Built once. */
  public names(): string[] {
    if (this.sortedNames === undefined) {
      const names = new Set<string>();

      for (const set of this.sets) {
        for (const name of Object.keys(set.natives)) {
          names.add(name);
        }
      }

      this.sortedNames = [...names].sort();
    }

    return this.sortedNames;
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

  /** The native a hash belongs to, for `Citizen.InvokeNative(0x…)` calls. */
  public fromHash(hash: string): string | undefined {
    if (this.hashes === undefined) {
      this.hashes = new Map();

      for (const set of this.sets) {
        for (const [name, native] of Object.entries(set.natives)) {
          if (native.h !== undefined && !this.hashes.has(native.h)) {
            this.hashes.set(native.h, name);
          }
        }
      }
    }

    return this.hashes.get(hash.toLowerCase());
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
  return `${name}(${paramNames(native).join(', ')})`;
}

/** The full annotated signature, for hover text. */
export function typedSignature(name: string, native: IndexedNative): string {
  const types = paramTypes(native);
  const params = paramNames(native)
    .map((param, i) => `${param}: ${types[i] ?? 'any'}`)
    .join(', ');

  const returns =
    native.r === undefined ? '' : `: ${returnValues(native).join(', ')}`;

  return `function ${name}(${params})${returns}`;
}

/** A snippet body that drops the caller straight into the first argument. */
export function callSnippet(name: string, native: IndexedNative): string {
  const params = paramNames(native)
    .map((param, i) => `\${${i + 1}:${param}}`)
    .join(', ');

  return `${name}(${params})`;
}
