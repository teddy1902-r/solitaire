/*
 * V5 — correction du mélange visible.
 *
 * Objectif :
 * - casser les longues suites visibles du type K-Q-J-10-9
 * - garder une partie gagnable
 * - éviter les colonnes qui se ressemblent trop
 */

const v5BaseBuildDeal = guaranteedBuildDeal;

function v5CloneCandidate(candidate) {
  return {
    ...candidate,
    columns: guaranteedCloneColumns(candidate.columns),
    stock: candidate.stock.map(guaranteedCloneCard),
    solutionEvents: Array.isArray(candidate.solutionEvents)
      ? candidate.solutionEvents.map(event => ({ ...event }))
      : undefined,
    reverseMoves: Array.isArray(candidate.reverseMoves)
      ? candidate.reverseMoves.map(move => ({ ...move }))
      : undefined
  };
}

function v5IsNaturalVisiblePair(a, b) {
  return (
    a &&
    b &&
    a.faceUp &&
    b.faceUp &&
    a.suit === b.suit &&
    VALUE_NUMBER[a.value] === VALUE_NUMBER[b.value] + 1
  );
}

function v5ResetAllFaceUp(candidate) {
  candidate.columns.forEach(column => {
    column.forEach(card => {
      card.faceUp = true;
    });
  });
}

function v5CollectRunBreakTargets(candidate) {
  const targets = [];

  candidate.columns.forEach((column, columnIndex) => {
    let runStart = -1;
    let runLength = 1;

    for (let i = 0; i < column.length - 1; i++) {
      const current = column[i];
      const next = column[i + 1];

      if (v5IsNaturalVisiblePair(current, next)) {
        if (runStart === -1) runStart = i;
        runLength++;
      } else {
        if (runLength >= 3 && runStart !== -1) {
          for (let j = runStart + 1; j < runStart + runLength - 1; j++) {
            if (j < column.length - 1) {
              targets.push({
                columnIndex,
                cardIndex: j,
                priority: runLength
              });
            }
          }
        }
        runStart = -1;
        runLength = 1;
      }
    }

    if (runLength >= 3 && runStart !== -1) {
      for (let j = runStart + 1; j < runStart + runLength - 1; j++) {
        if (j < column.length - 1) {
          targets.push({
            columnIndex,
            cardIndex: j,
            priority: runLength
          });
        }
      }
    }
  });

  targets.sort((a, b) => b.priority - a.priority);
  return targets;
}

function v5AddTargetedHiddenCards(candidate, targetHidden) {
  let hidden = 0;

  v5ResetAllFaceUp(candidate);

  const priorityTargets = v5CollectRunBreakTargets(candidate);

  for (const target of priorityTargets) {
    if (hidden >= targetHidden) break;

    const column = candidate.columns[target.columnIndex];
    const card = column[target.cardIndex];
    if (!card) continue;
    if (target.cardIndex === column.length - 1) continue;
    if (!card.faceUp) continue;

    card.faceUp = false;

    if (guaranteedSimulateSolution(candidate)) {
      hidden++;
    } else {
      card.faceUp = true;
    }
  }

  const extraTargets = [];
  candidate.columns.forEach((column, columnIndex) => {
    for (let i = 0; i < column.length - 1; i++) {
      extraTargets.push({ columnIndex, cardIndex: i });
    }
  });

  guaranteedShuffle(extraTargets);

  for (const target of extraTargets) {
    if (hidden >= targetHidden) break;

    const column = candidate.columns[target.columnIndex];
    const card = column[target.cardIndex];
    if (!card || !card.faceUp) continue;
    if (target.cardIndex === column.length - 1) continue;

    card.faceUp = false;

    if (guaranteedSimulateSolution(candidate)) {
      hidden++;
    } else {
      card.faceUp = true;
    }
  }

  return hidden;
}

function v5VisibleMetrics(columns) {
  let longestNaturalRun = 1;
  let brokenLinks = 0;
  let suitChanges = 0;
  let repeatedTopRanksPenalty = 0;

  const topRankCount = {};

  columns.forEach(column => {
    if (!column.length) return;

    const firstVisible = column.find(card => card.faceUp);
    if (firstVisible) {
      topRankCount[firstVisible.value] = (topRankCount[firstVisible.value] || 0) + 1;
    }

    let currentRun = 0;

    for (let i = 0; i < column.length; i++) {
      if (!column[i].faceUp) {
        currentRun = 0;
        continue;
      }

      if (
        i < column.length - 1 &&
        v5IsNaturalVisiblePair(column[i], column[i + 1])
      ) {
        currentRun = currentRun === 0 ? 2 : currentRun + 1;
        longestNaturalRun = Math.max(longestNaturalRun, currentRun);
      } else {
        if (
          i < column.length - 1 &&
          column[i].faceUp &&
          column[i + 1].faceUp
        ) {
          brokenLinks++;
          if (column[i].suit !== column[i + 1].suit) {
            suitChanges++;
          }
        }
        currentRun = 1;
      }
    }
  });

  Object.values(topRankCount).forEach(count => {
    if (count > 2) repeatedTopRanksPenalty += (count - 2);
  });

  const score =
    brokenLinks * 2 +
    suitChanges * 1.5 -
    longestNaturalRun * 4 -
    repeatedTopRanksPenalty * 5;

  return {
    score,
    longestNaturalRun,
    repeatedTopRanksPenalty
  };
}

guaranteedBuildDeal = function(level) {
  let bestCandidate = null;
  let bestMetrics = null;

  const wantedHidden = Math.max(level.hiddenTarget || 12, 18);

  for (let attempt = 0; attempt < 35; attempt++) {
    const rawCandidate = v5BaseBuildDeal(level);
    if (!rawCandidate) continue;

    const candidate = v5CloneCandidate(rawCandidate);

    v5ResetAllFaceUp(candidate);
    candidate.hiddenCount = v5AddTargetedHiddenCards(candidate, wantedHidden);

    if (!guaranteedSimulateSolution(candidate)) {
      continue;
    }

    const metrics = v5VisibleMetrics(candidate.columns);

    if (!bestCandidate || metrics.score > bestMetrics.score) {
      bestCandidate = v5CloneCandidate(candidate);
      bestMetrics = metrics;
    }

    if (
      metrics.longestNaturalRun <= 2 &&
      metrics.repeatedTopRanksPenalty <= 1
    ) {
      return candidate;
    }
  }

  if (bestCandidate) {
    return bestCandidate;
  }

  return v5BaseBuildDeal(level);
};
