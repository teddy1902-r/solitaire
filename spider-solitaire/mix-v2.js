/*
 * Mélange renforcé du Spider Solitaire Géocaching.
 *
 * Les parties restent garanties gagnables : le générateur part toujours de
 * suites complètes et conserve les coups inverses qui servent de solution.
 * En revanche, il effectue davantage de mélanges et refuse les plateaux qui
 * contiennent encore de longues suites déjà assemblées.
 */

GUARANTEED_LEVELS[0].swaps = 70;
GUARANTEED_LEVELS[0].maxChunk = 4;
GUARANTEED_LEVELS[0].hiddenTarget = 12;
GUARANTEED_LEVELS[0].minMix = 34;
GUARANTEED_LEVELS[0].maxNaturalRun = 5;

GUARANTEED_LEVELS[1].swaps = 110;
GUARANTEED_LEVELS[1].maxChunk = 5;
GUARANTEED_LEVELS[1].hiddenTarget = 20;
GUARANTEED_LEVELS[1].minMix = 38;
GUARANTEED_LEVELS[1].maxNaturalRun = 5;

GUARANTEED_LEVELS[2].swaps = 150;
GUARANTEED_LEVELS[2].maxChunk = 5;
GUARANTEED_LEVELS[2].hiddenTarget = 28;
GUARANTEED_LEVELS[2].minMix = 41;
GUARANTEED_LEVELS[2].maxNaturalRun = 4;

/*
 * Mélange les morceaux avec des longueurs réellement variées.
 * Chaque cycle reste une suite de coups inverses légaux, donc la solution
 * enregistrée par guaranteed.js reste valable.
 */
guaranteedTryScrambleCycle = function(cols, maxChunk) {
  for (let attempt = 0; attempt < 180; attempt++) {
    const indexes = guaranteedShuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const a = indexes[0];
    const c = indexes[1];
    const b = indexes[2];

    const legalA = guaranteedLegalReverseLengths(cols[a], maxChunk);
    const legalC = guaranteedLegalReverseLengths(cols[c], maxChunk);
    const common = legalA.filter(length => legalC.includes(length));
    if (!common.length) continue;

    /*
     * On ne choisit plus presque toujours le plus petit morceau : cela évite
     * de conserver de longues suites intactes dans les colonnes.
     */
    const shuffledLengths = guaranteedShuffle(common.slice());
    const length = shuffledLengths[0];

    const trial = guaranteedCloneColumns(cols);
    const trialMoves = [];

    guaranteedReverseMove(trial, a, b, length, trialMoves);
    if (!guaranteedLegalReverseLengths(trial[c], maxChunk).includes(length)) {
      continue;
    }

    guaranteedReverseMove(trial, c, a, length, trialMoves);
    if (!guaranteedLegalReverseLengths(trial[b], maxChunk).includes(length)) {
      continue;
    }

    guaranteedReverseMove(trial, b, c, length, trialMoves);
    return { columns: trial, moves: trialMoves };
  }

  return null;
};

/*
 * Mesure le désordre réel des cartes du tableau.
 * Une frontière qui casse une suite naturelle rapporte un point et un
 * changement de couleur rapporte un bonus.
 */
function guaranteedMixMetrics(cols) {
  let score = 0;
  let longestNaturalRun = 1;

  for (const column of cols) {
    let currentNaturalRun = column.length ? 1 : 0;

    for (let i = 0; i < column.length - 1; i++) {
      const a = column[i];
      const b = column[i + 1];
      const natural =
        a.suit === b.suit &&
        VALUE_NUMBER[a.value] === VALUE_NUMBER[b.value] + 1;

      if (!natural) {
        score += 1;
        currentNaturalRun = 1;
      } else {
        currentNaturalRun += 1;
      }

      if (a.suit !== b.suit) score += 0.65;
      longestNaturalRun = Math.max(longestNaturalRun, currentNaturalRun);
    }
  }

  return { score, longestNaturalRun };
}

function guaranteedStrongMixScore(cols) {
  return guaranteedMixMetrics(cols).score;
}

/*
 * Change aussi l'ordre des colonnes. Cela empêche notamment les suites de
 * même couleur de rester regroupées à gauche ou à droite du plateau.
 * Les numéros de colonnes des coups de solution sont remappés en même temps.
 */
function guaranteedRandomizeColumnOrder(candidate) {
  const order = guaranteedShuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const oldToNew = Array(10);

  order.forEach((oldIndex, newIndex) => {
    oldToNew[oldIndex] = newIndex;
  });

  candidate.columns = order.map(oldIndex => candidate.columns[oldIndex]);
  candidate.reverseMoves = candidate.reverseMoves.map(move => ({
    ...move,
    from: oldToNew[move.from],
    to: oldToNew[move.to]
  }));

  return candidate;
}

/*
 * Génère plusieurs candidats, conserve uniquement ceux qui sont à la fois
 * gagnables et suffisamment désordonnés, puis ajoute les cartes cachées.
 * Le meilleur candidat disponible sert de secours pour éviter de bloquer le
 * bouton « Nouvelle partie » sur un appareil plus lent.
 */
guaranteedBuildDeal = function(level) {
  const wantedMix = level.minMix || 34;
  const maxNaturalRun = level.maxNaturalRun || 5;
  let bestCandidate = null;
  let bestScore = -Infinity;

  for (let attempt = 0; attempt < 220; attempt++) {
    const candidate = guaranteedMakeCandidate(level);
    if (!candidate) continue;
    if (!guaranteedSimulateSolution(candidate)) continue;

    guaranteedRandomizeColumnOrder(candidate);
    if (!guaranteedSimulateSolution(candidate)) continue;

    const metrics = guaranteedMixMetrics(candidate.columns);

    if (metrics.score > bestScore) {
      bestScore = metrics.score;
      bestCandidate = candidate;
    }

    if (
      metrics.score < wantedMix ||
      metrics.longestNaturalRun > maxNaturalRun
    ) {
      continue;
    }

    candidate.hiddenCount = guaranteedAddHiddenCards(
      candidate,
      level.hiddenTarget
    );

    if (!guaranteedSimulateSolution(candidate)) continue;
    return candidate;
  }

  if (!bestCandidate) {
    throw new Error("Impossible de générer une partie très mélangée et gagnable.");
  }

  bestCandidate.hiddenCount = guaranteedAddHiddenCards(
    bestCandidate,
    level.hiddenTarget
  );

  if (!guaranteedSimulateSolution(bestCandidate)) {
    throw new Error("Impossible de valider la partie générée.");
  }

  return bestCandidate;
};
