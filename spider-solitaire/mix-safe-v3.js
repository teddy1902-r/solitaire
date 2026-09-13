/*
 * Mélange renforcé et sûr.
 *
 * On augmente nettement le nombre d'opérations de mélange du générateur
 * garanti existant, mais on ne remplace PAS son mécanisme de secours.
 * Ainsi, une partie est toujours générée et les cartes s'affichent toujours.
 */

GUARANTEED_LEVELS[0].swaps = 18;
GUARANTEED_LEVELS[0].maxChunk = 3;
GUARANTEED_LEVELS[0].hiddenTarget = 8;

GUARANTEED_LEVELS[1].swaps = 30;
GUARANTEED_LEVELS[1].maxChunk = 4;
GUARANTEED_LEVELS[1].hiddenTarget = 16;

GUARANTEED_LEVELS[2].swaps = 45;
GUARANTEED_LEVELS[2].maxChunk = 4;
GUARANTEED_LEVELS[2].hiddenTarget = 24;
