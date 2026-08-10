export type TokenType = 'identifier' | 'string' | 'number' | 'punctuation';

export interface Token {
  type: TokenType;
  /** For strings, the contents with quotes removed. */
  value: string;
  /** Offset of the token's first character in the source text. */
  offset: number;
}

const IDENTIFIER_START = /[A-Za-z_]/;
const IDENTIFIER_PART = /[A-Za-z0-9_]/;
const DIGIT = /[0-9]/;

/**
 * Reads the `=` run of a Lua long bracket at `index`, returning its level, or
 * -1 when the text at `index` does not open one.
 */
function longBracketLevel(text: string, index: number): number {
  if (text[index] !== '[') {
    return -1;
  }

  let cursor = index + 1;

  while (text[cursor] === '=') {
    cursor++;
  }

  return text[cursor] === '[' ? cursor - index - 1 : -1;
}

/**
 * Tokenises Lua source far enough to tell code from strings and comments.
 *
 * This is not a parser — it exists so callers can look at identifiers without
 * matching things that appear inside a string or a comment. Numbers are
 * recognised only well enough not to be mistaken for identifiers.
 */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    // Whitespace
    if (char === ' ' || char === '\t' || char === '\r' || char === '\n') {
      i++;
      continue;
    }

    // Comments, long form first so `--[[` is not read as a line comment
    if (char === '-' && text[i + 1] === '-') {
      const level = longBracketLevel(text, i + 2);

      if (level >= 0) {
        const close = `]${'='.repeat(level)}]`;
        const end = text.indexOf(close, i + 2);

        i = end === -1 ? text.length : end + close.length;
        continue;
      }

      const newline = text.indexOf('\n', i);

      i = newline === -1 ? text.length : newline + 1;
      continue;
    }

    // Long strings
    const level = longBracketLevel(text, i);

    if (level >= 0) {
      const open = level + 2;
      const close = `]${'='.repeat(level)}]`;
      const end = text.indexOf(close, i + open);
      const stop = end === -1 ? text.length : end;

      tokens.push({
        type: 'string',
        value: text.slice(i + open, stop),
        offset: i,
      });

      i = end === -1 ? text.length : end + close.length;
      continue;
    }

    // Quoted strings
    if (char === "'" || char === '"') {
      let cursor = i + 1;
      let value = '';

      while (cursor < text.length) {
        const current = text[cursor];

        if (current === '\\') {
          value += text[cursor + 1] ?? '';
          cursor += 2;
          continue;
        }

        if (current === char || current === '\n') {
          break;
        }

        value += current;
        cursor++;
      }

      tokens.push({ type: 'string', value, offset: i });
      i = text[cursor] === char ? cursor + 1 : cursor;
      continue;
    }

    // Identifiers and keywords
    if (IDENTIFIER_START.test(char)) {
      let cursor = i;

      while (cursor < text.length && IDENTIFIER_PART.test(text[cursor])) {
        cursor++;
      }

      tokens.push({
        type: 'identifier',
        value: text.slice(i, cursor),
        offset: i,
      });

      i = cursor;
      continue;
    }

    // Numbers, including hex literals such as the hashes passed to InvokeNative
    if (DIGIT.test(char)) {
      let cursor = i;

      while (
        cursor < text.length &&
        /[0-9A-Fa-fxXoObBpP._]/.test(text[cursor])
      ) {
        cursor++;
      }

      tokens.push({ type: 'number', value: text.slice(i, cursor), offset: i });
      i = cursor;
      continue;
    }

    tokens.push({ type: 'punctuation', value: char, offset: i });
    i++;
  }

  return tokens;
}
