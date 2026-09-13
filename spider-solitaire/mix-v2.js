/*
 * Mélange renforcé du Spider Solitaire.
 *
 * Ce fichier conserve le générateur garanti existant, mais fragmente beaucoup
 * plus les suites et refuse les plateaux qui paraissent encore trop rangés.
 */

GUARANTEED_LEVELS[0].swaps = 55;
GUARANTEED_LEVELS[0].maxChunk = 3;
GUARANTEED_LEVELS[0].hiddenTarget = 10;
GUARANTEED_LEVELS[0].minMix = 22;

GUARANTEED_LEVELS[1].swaps = 85;
GUARANTEED_LEVELS[1].maxChunk = 4;
GUARANTEED_LEVELS[1].hiddenTarget = 18;
GUARANTEED_LEVELS[1].minMix = 27;

GUARANTEED_LEVELS[2].swaps = 120;
GUARANTEED_LEVELS[2].maxChunk = 5;
GUARANTEED_LEVELS[2].hiddenTarget = 28;
GUARANTEED_LEVELS[2].minMix = 31;

/*
 * Favorise les petits paquets : plus les morceaux sont courts, plus les
 * couleurs et les valeurs sont entremêlées visuellement.
 */
guaranteedTryScrambleCycle = function(cols, maxChunk) {
  for (let attempt = 0; attempt < 140; attempt++) {
    const indexes = guaranteedShuffle([0,1,2,3,4,5,6,7,8,9]);
    const a = indexes[0];
    const c = indexes[1];
    const b = indexes[2];

    const legalA = guaranteedLegalReverseLengths(cols[a], maxChunk);
    const legalC = guaranteedLegalReverseLengths(cols[c], maxChunk);
    const common = legalA.filter(length => legalC.includes(length));
    if (!common.length) continue;

    common.sort((x, y) => x - y);
    let length;
    const roll = Math.random();
    if (roll < 0.68) {
      length = common[0];
    } else if (roll < 0.9) {
      length = common[Math.min(1, common.length - 1)];
    } else {
      length = guaranteedRandomItem(common);
    }

    const trial = guaranteedCloneColumns(cols);
    const trialMoves = [];

    guaranteedReverseMove(trial, a, b, length, trialMoves);
    if (!guaranteedLegalReverseLengths(trial[c], maxChunk).includes(length)) continue;

    guaranteedReverseMove(trial, c, a, length, trialMoves);
    if (!guaranteedLegalReverseLengths(trial[b], maxChunk).includes(length)) continue;

    guaranteedReverseMove(trial, b, c, length, trialMoves);
    return { columns: trial, moves: trialMoves };
  }

  return null;
};

/*
 * Mesure le désordre visible sur les 54 cartes de départ.
 * Un point est gagné à chaque frontière qui casse une suite naturelle,
 * avec un bonus lorsque la couleur change.
 */
function guaranteedStrongMixScore(cols) {
  let score = 0;

  for (const column of cols) {
    for (let i = 0; i < column.length - 1; i++) {
      const a = column[i];
      const b = column[i + 1];
      const natural =
        a.suit === b.suit &&
        VALUE_NUMBER[a.value] === VALUE_NUMBER[b.value] + 1;

      if (!natural) score += 1;
      if (a.suit !== b.suit) score += 0.65;
    }
  }

  return score;
}

/*
 * Refuse une distribution trop ordonnée, même si elle est mathématiquement
 * gagnable. On garde donc uniquement les parties à la fois solvables ET bien
 * mélangées.
 */
guaranteedBuildDeal = function(level) {
  const wantedMix = level.minMix || 24;

  for (let attempt = 0; attempt < 180; attempt++) {
    const candidate = guaranteedMakeCandidate(level);
    if (!candidate) continue;
    if (guaranteedStrongMixScore(candidate.columns) < wantedMix) continue;
    if (!guaranteedSimulateSolution(candidate)) continue;

    candidate.hiddenCount = guaranteedAddHiddenCards(candidate, level.hiddenTarget);
    if (!guaranteedSimulateSolution(candidate)) continue;

    return candidate;
  }

  /* Deuxième passe : on baisse très légèrement le seuil mais on conserve un
     mélange nettement supérieur à l'ancienne version. */
  for (let attempt = 0; attempt < 180; attempt++) {
    const candidate = guaranteedMakeCandidate(level);
    if (!candidate) continue;
    if (guaranteedStrongMixScore(candidate.columns) < wantedMix - 4) continue;
    if (!guaranteedSimulateSolution(candidate)) continue;

    candidate.hiddenCount = guaranteedAddHiddenCards(candidate, level.hiddenTarget);
    if (!guaranteedSimulateSolution(candidate)) continue;

    return candidate;
  }

  throw new Error("Impossible de générer une partie très mélangée et garantie.");
};
