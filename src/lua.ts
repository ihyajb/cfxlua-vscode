export type TokenType = 'identifier' | 'string' | 'number' | 'punctuation';

export interface Token {
  type: TokenType;
  /** For strings, the contents with quotes removed and escapes resolved. */
  value: string;
  /** Offset of the token's first character in the source text. */
  offset: number;
}

// Character codes, compared directly rather than through regular expressions.
// This scanner runs over every open Lua file on every edit, and testing a regex
// against a one-character string allocates that string for each character.
const TAB = 9;
const LINE_FEED = 10;
const CARRIAGE_RETURN = 13;
const SPACE = 32;
const DOUBLE_QUOTE = 34;
const SINGLE_QUOTE = 39;
const HYPHEN = 45;
const ZERO = 48;
const NINE = 57;
const UPPER_A = 65;
const UPPER_Z = 90;
const BACKSLASH = 92;
const OPEN_BRACKET = 91;
const EQUALS = 61;
const UNDERSCORE = 95;
const LOWER_A = 97;
const LOWER_Z = 122;

function isIdentifierStart(code: number): boolean {
  return (
    (code >= LOWER_A && code <= LOWER_Z) ||
    (code >= UPPER_A && code <= UPPER_Z) ||
    code === UNDERSCORE
  );
}

function isIdentifierPart(code: number): boolean {
  return isIdentifierStart(code) || (code >= ZERO && code <= NINE);
}

function isDigit(code: number): boolean {
  return code >= ZERO && code <= NINE;
}

/**
 * Number-ish characters: enough to swallow a hex literal such as the hashes
 * passed to `Citizen.InvokeNative`, plus exponents and separators, without
 * pretending to validate the literal.
 */
function isNumberPart(code: number): boolean {
  if (isIdentifierPart(code)) {
    // Letters only continue a number when they could belong to one; anything
    // else would mean the number ran into an identifier, which Lua rejects.
    return true;
  }

  return code === 46; // '.'
}

/**
 * Reads the `=` run of a Lua long bracket at `index`, returning its level, or
 * -1 when the text at `index` does not open one.
 */
function longBracketLevel(text: string, index: number): number {
  if (text.charCodeAt(index) !== OPEN_BRACKET) {
    return -1;
  }

  let cursor = index + 1;

  while (text.charCodeAt(cursor) === EQUALS) {
    cursor++;
  }

  return text.charCodeAt(cursor) === OPEN_BRACKET ? cursor - index - 1 : -1;
}

/**
 * Reads a quoted string starting at the opening quote.
 *
 * The common case — no escapes — is a single slice. Only a string that actually
 * contains a backslash pays for character-by-character rebuilding.
 */
function readQuotedString(
  text: string,
  start: number,
  quote: number,
): { value: string; end: number; terminated: boolean } {
  const length = text.length;
  let cursor = start + 1;
  let escaped = false;

  while (cursor < length) {
    const code = text.charCodeAt(cursor);

    if (code === BACKSLASH) {
      escaped = true;
      cursor += 2;
      continue;
    }

    if (code === quote || code === LINE_FEED) {
      break;
    }

    cursor++;
  }

  const terminated = text.charCodeAt(cursor) === quote;
  const stop = cursor > length ? length : cursor;

  if (!escaped) {
    return { value: text.slice(start + 1, stop), end: stop, terminated };
  }

  let value = '';

  for (let i = start + 1; i < stop; i++) {
    if (text.charCodeAt(i) === BACKSLASH) {
      value += text[i + 1] ?? '';
      i++;
      continue;
    }

    value += text[i];
  }

  return { value, end: stop, terminated };
}

/**
 * Tokenises Lua source far enough to tell code from strings and comments.
 *
 * This is not a parser — it exists so callers can look at identifiers without
 * matching things that appear inside a string or a comment.
 */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const length = text.length;
  let i = 0;

  while (i < length) {
    const code = text.charCodeAt(i);

    // Whitespace, by far the most common case
    if (
      code === SPACE ||
      code === LINE_FEED ||
      code === TAB ||
      code === CARRIAGE_RETURN
    ) {
      i++;
      continue;
    }

    if (isIdentifierStart(code)) {
      const start = i;

      i++;
      while (i < length && isIdentifierPart(text.charCodeAt(i))) {
        i++;
      }

      tokens.push({
        type: 'identifier',
        value: text.slice(start, i),
        offset: start,
      });
      continue;
    }

    // Comments, long form first so `--[[` is not read as a line comment
    if (code === HYPHEN && text.charCodeAt(i + 1) === HYPHEN) {
      const level = longBracketLevel(text, i + 2);

      if (level >= 0) {
        const close = level === 0 ? ']]' : `]${'='.repeat(level)}]`;
        const end = text.indexOf(close, i + 2);

        i = end === -1 ? length : end + close.length;
        continue;
      }

      const newline = text.indexOf('\n', i);

      i = newline === -1 ? length : newline + 1;
      continue;
    }

    if (code === SINGLE_QUOTE || code === DOUBLE_QUOTE) {
      const string = readQuotedString(text, i, code);

      tokens.push({ type: 'string', value: string.value, offset: i });
      i = string.terminated ? string.end + 1 : string.end;
      continue;
    }

    if (code === OPEN_BRACKET) {
      const level = longBracketLevel(text, i);

      if (level >= 0) {
        const open = level + 2;
        const close = level === 0 ? ']]' : `]${'='.repeat(level)}]`;
        const end = text.indexOf(close, i + open);
        const stop = end === -1 ? length : end;

        tokens.push({
          type: 'string',
          value: text.slice(i + open, stop),
          offset: i,
        });

        i = end === -1 ? length : end + close.length;
        continue;
      }

      tokens.push({ type: 'punctuation', value: '[', offset: i });
      i++;
      continue;
    }

    if (isDigit(code)) {
      const start = i;

      i++;
      while (i < length && isNumberPart(text.charCodeAt(i))) {
        i++;
      }

      tokens.push({
        type: 'number',
        value: text.slice(start, i),
        offset: start,
      });
      continue;
    }

    tokens.push({ type: 'punctuation', value: text[i], offset: i });
    i++;
  }

  return tokens;
}

const OPEN_PAREN = 40;
const DOT = 46;
const COLON = 58;

/**
 * Keywords that can be followed by `(`, so they reach the call check.
 * `function(` in particular appears in every anonymous callback.
 */
const NOT_A_CALL = new Set([
  'and',
  'do',
  'elseif',
  'function',
  'if',
  'in',
  'not',
  'or',
  'return',
  'then',
  'until',
  'while',
]);

/** Advances past whitespace and comments, returning the next significant offset. */
function skipTrivia(text: string, index: number): number {
  const length = text.length;
  let i = index;

  while (i < length) {
    const code = text.charCodeAt(i);

    if (
      code === SPACE ||
      code === LINE_FEED ||
      code === TAB ||
      code === CARRIAGE_RETURN
    ) {
      i++;
      continue;
    }

    if (code === HYPHEN && text.charCodeAt(i + 1) === HYPHEN) {
      const level = longBracketLevel(text, i + 2);

      if (level >= 0) {
        const close = level === 0 ? ']]' : `]${'='.repeat(level)}]`;
        const end = text.indexOf(close, i + 2);

        i = end === -1 ? length : end + close.length;
        continue;
      }

      const newline = text.indexOf('\n', i);

      i = newline === -1 ? length : newline + 1;
      continue;
    }

    break;
  }

  return i;
}

function isWordAt(
  text: string,
  start: number,
  end: number,
  word: string,
): boolean {
  return end - start === word.length && text.startsWith(word, start);
}

/**
 * Visits every call of a global function: `Name(` where `Name` is not a field,
 * a method, or the name being declared.
 *
 * A tokenised pass over a large script allocates an object and a string for
 * every token, and the callers of this only care about a few hundred of them, so
 * this walks the text once and allocates a string only for names it reports.
 */
export function forEachGlobalCall(
  text: string,
  visit: (name: string, offset: number) => void,
): void {
  const length = text.length;
  let i = 0;
  /** Last significant character before the current token. */
  let previous = 0;
  /** Whether the previous token was `function` or `local`. */
  let declaring = false;

  while (i < length) {
    i = skipTrivia(text, i);

    if (i >= length) {
      return;
    }

    const code = text.charCodeAt(i);

    if (isIdentifierStart(code)) {
      const start = i;

      i++;
      while (i < length && isIdentifierPart(text.charCodeAt(i))) {
        i++;
      }

      const end = i;
      const after = skipTrivia(text, end);

      if (
        !declaring &&
        previous !== DOT &&
        previous !== COLON &&
        text.charCodeAt(after) === OPEN_PAREN
      ) {
        const name = text.slice(start, end);

        if (!NOT_A_CALL.has(name)) {
          visit(name, start);
        }
      }

      declaring =
        isWordAt(text, start, end, 'function') ||
        isWordAt(text, start, end, 'local');
      previous = text.charCodeAt(end - 1);
      i = after;
      continue;
    }

    declaring = false;
    previous = code;

    if (code === SINGLE_QUOTE || code === DOUBLE_QUOTE) {
      const string = readQuotedString(text, i, code);

      i = string.terminated ? string.end + 1 : string.end;
      continue;
    }

    if (code === OPEN_BRACKET) {
      const level = longBracketLevel(text, i);

      if (level >= 0) {
        const close = level === 0 ? ']]' : `]${'='.repeat(level)}]`;
        const end = text.indexOf(close, i + level + 2);

        i = end === -1 ? length : end + close.length;
        continue;
      }

      i++;
      continue;
    }

    if (isDigit(code)) {
      i++;
      while (i < length && isNumberPart(text.charCodeAt(i))) {
        i++;
      }

      continue;
    }

    i++;
  }
}
