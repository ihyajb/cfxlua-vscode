import { workspace } from 'vscode';
import getSettingsScope from './getSettingsScope';
import { log } from './logger';
import setLibrary from './setLibrary';

const VALID_GAMES = ['GTAV', 'RDR3'] as const;
type Game = (typeof VALID_GAMES)[number];

export default async function setNativeLibrary(game?: string) {
  const scope = getSettingsScope();
  const config = workspace.getConfiguration('cfxlua', scope.folder?.uri);

  if (!game) {
    game = config.get('game') || 'gtav';
  }

  const upperGame = game.toUpperCase() as Game;

  if (!VALID_GAMES.includes(upperGame)) {
    log(`Invalid game identifier: ${game}`);
    return;
  }

  if (config.get('game') !== game) {
    await config.update('game', game, scope.target);
  }

  // Remove all other game natives, then enable the selected one
  const toRemove = VALID_GAMES.filter((g) => g !== upperGame).map(
    (g) => `natives/${g}`,
  );

  await setLibrary(toRemove, false, scope);
  await setLibrary([`natives/${upperGame}`], true, scope);
  log(`Switched native library to ${upperGame}`);
}
