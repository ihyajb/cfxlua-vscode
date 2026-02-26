import { workspace } from 'vscode';
import setLibrary from './setLibrary';
import getSettingsScope from './getSettingsScope';
import { log } from './logger';

const VALID_GAMES = ['GTAV', 'RDR3'] as const;
type Game = (typeof VALID_GAMES)[number];

export default async function setNativeLibrary(game?: string) {
  const config = workspace.getConfiguration('cfxlua');

  if (!game) {
    game = config.get('game') || 'gtav';
  }

  await config.update('game', game, getSettingsScope());

  const upperGame = game.toUpperCase() as Game;

  if (!VALID_GAMES.includes(upperGame)) {
    log(`Invalid game identifier: ${game}`);
    return;
  }

  // Remove all other game natives, then enable the selected one
  const toRemove = VALID_GAMES.filter((g) => g !== upperGame).map(
    (g) => `natives/${g}`,
  );

  if (toRemove.length > 0) {
    await setLibrary(toRemove, false);
  }

  await setLibrary([`natives/${upperGame}`], true);
  log(`Switched native library to ${upperGame}`);
}
