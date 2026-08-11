import {
  type Disposable,
  Hover,
  MarkdownString,
  type Position,
  type Range,
  type TextDocument,
  languages,
} from 'vscode';
import { type NativeCatalog, typedSignature } from './nativeCatalog';

/** A hexadecimal literal, which is how an unnamed native is invoked. */
const HASH = /0[xX][0-9a-fA-F]{4,16}/;

/**
 * Resolves the hash under the cursor to the native it belongs to.
 *
 * `Citizen.InvokeNative(0x2F7A49E6)` is the only way to reach a native the
 * runtime does not expose by name, and the language server has nothing to say
 * about the number. Everything else about a native is already on hover from the
 * definition files, so this deliberately only handles hashes.
 */
export function registerNativeHover(
  getCatalog: () => Promise<NativeCatalog | undefined>,
  getGame: (document: TextDocument) => string,
): Disposable {
  return languages.registerHoverProvider(
    { language: 'lua' },
    {
      async provideHover(document: TextDocument, position: Position) {
        // Matched before anything is loaded. Hover fires for every word the
        // pointer crosses, and only a hex literal can produce a result here, so
        // the index is never read on behalf of ordinary identifiers.
        const range: Range | undefined = document.getWordRangeAtPosition(
          position,
          HASH,
        );

        if (range === undefined) {
          return undefined;
        }

        const catalog = await getCatalog();

        if (catalog === undefined) {
          return undefined;
        }

        const name = catalog.fromHash(document.getText(range));

        if (name === undefined) {
          return undefined;
        }

        const native = catalog.lookup(name);

        if (native === undefined) {
          return undefined;
        }

        const url =
          getGame(document).toLowerCase() === 'rdr3'
            ? `https://rdr3natives.com/?native=${native.h}`
            : `https://docs.fivem.net/natives/?_${native.h}`;

        const markdown = new MarkdownString();

        markdown.appendMarkdown(`**\`${native.ns}\` \`${native.a}\`**\n\n`);
        markdown.appendCodeblock(typedSignature(name, native), 'lua');
        markdown.appendMarkdown(`\n[Native Documentation](${url})`);

        return new Hover(markdown, range);
      },
    },
  );
}
