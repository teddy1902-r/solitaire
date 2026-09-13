/*
 * V4 — vrai mélange des 54 cartes visibles, avec solution garantie.
 *
 * L'ancienne méthode mélangeait surtout le sommet des 104 cartes puis retirait
 * 50 cartes pour la pioche. Une grande partie du mélange partait donc dans le
 * talon et les colonnes visibles restaient presque K-Q-J-10-9-8.
 *
 * Ici on construit toujours la partie A L'ENVERS depuis un état résolu, mais on
 * alterne : mélange -> retrait d'une distribution -> mélange -> retrait...
 * puis on mélange encore les 54 cartes finales. En rejouant tous ces événements
 * à l'envers, on possède une solution complète de la partie.
 */

GUARANTEED_LEVELS[0].hiddenTarget = 12;
GUARANTEED_LEVELS[1].hiddenTarget = 18;
GUARANTEED_LEVELS[2].hiddenTarget = 24;

function realMixSettings(level) {
  if (level.key === "easy") {
    return { stageCycles: 7, finalCycles: 14, maxChunk: 3 };
  }
  if (level.key === "hard") {
    return { stageCycles: 12, finalCycles: 24, maxChunk: 4 };
  }
  return { stageCycles: 9, finalCycles: 19, maxChunk: 4 };
}

function realScrambleStage(cols, wantedCycles, maxChunk, events) {
  let current = cols;
  let successes = 0;
  let attempts = 0;
  const maxAttempts = wantedCycles * 12 + 40;

  while (successes < wantedCycles && attempts++ < maxAttempts) {
    const cycle = guaranteedTryScrambleCycle(current, maxChunk);
    if (!cycle) continue;

    current = cycle.columns;
    cycle.moves.forEach(move => {
      events.push({
        type: "move",
        from: move.from,
        to: move.to,
        length: move.length
      });
    });
    successes++;
  }

  return current;
}

function realMixMetrics(cols) {
  let broken = 0;
  let suitChanges = 0;
  let longestNatural = 1;

  cols.forEach(column => {
    let currentNatural = column.length ? 1 : 0;

    for (let i = 0; i < column.length - 1; i++) {
      const a = column[i];
      const b = column[i + 1];
      const natural =
        a.suit === b.suit &&
        VALUE_NUMBER[a.value] === VALUE_NUMBER[b.value] + 1;

      if (natural) {
        currentNatural++;
      } else {
        broken++;
        currentNatural = 1;
      }

      if (a.suit !== b.suit) suitChanges++;
      longestNatural = Math.max(longestNatural, currentNatural);
    }
  });

  return {
    broken,
    suitChanges,
    longestNatural,
    score: broken + suitChanges * 0.75
  };
}

function realBuildCandidate(level) {
  const settings = realMixSettings(level);
  let cols = guaranteedSolvedColumns();
  const events = [];
  const balanceMoves = [];

  if (!guaranteedBalanceSolvedBoard(cols, balanceMoves)) return null;

  balanceMoves.forEach(move => {
    events.push({
      type: "move",
      from: move.from,
      to: move.to,
      length: move.length
    });
  });

  const expectedFull = [11,11,11,11,10,10,10,10,10,10];
  if (!cols.every((column, index) => column.length === expectedFull[index])) {
    return null;
  }

  const removedRounds = [];

  for (let round = 0; round < 5; round++) {
    cols = realScrambleStage(
      cols,
      settings.stageCycles,
      settings.maxChunk,
      events
    );

    if (cols.some(column => column.length === 0)) return null;

    const removed = [];
    for (let columnIndex = 0; columnIndex < 10; columnIndex++) {
      const card = cols[columnIndex].pop();
      if (!card) return null;
      removed.push(card);
    }

    removedRounds.push(removed);
    events.push({ type: "undeal" });
  }

  cols = realScrambleStage(
    cols,
    settings.finalCycles,
    settings.maxChunk,
    events
  );

  const expectedInitial = [6,6,6,6,5,5,5,5,5,5];
  if (!cols.every((column, index) => column.length === expectedInitial[index])) {
    return null;
  }

  const forwardPopSequence = removedRounds
    .slice()
    .reverse()
    .flat();

  const generatedStock = forwardPopSequence
    .slice()
    .reverse()
    .map(card => ({ ...card, faceUp: false }));

  cols.forEach(column => {
    column.forEach(card => { card.faceUp = true; });
  });

  return {
    columns: cols,
    stock: generatedStock,
    solutionEvents: events
  };
}

guaranteedSimulateSolution = function(candidate) {
  if (!candidate || !Array.isArray(candidate.solutionEvents)) return false;

  const simColumns = guaranteedCloneColumns(candidate.columns);
  const simStock = candidate.stock.map(guaranteedCloneCard);
  const state = { completed: 0 };

  for (let eventIndex = candidate.solutionEvents.length - 1;
       eventIndex >= 0;
       eventIndex--) {
    const event = candidate.solutionEvents[eventIndex];

    if (event.type === "undeal") {
      if (simStock.length < 10) return false;
      if (simColumns.some(column => column.length === 0)) return false;

      for (let columnIndex = 0; columnIndex < 10; columnIndex++) {
        const card = simStock.pop();
        if (!card) return false;
        card.faceUp = true;
        simColumns[columnIndex].push(card);
      }

      guaranteedRemoveCompletedSim(simColumns, state);
      continue;
    }

    if (event.type !== "move") return false;

    const from = event.to;
    const to = event.from;
    const length = event.length;
    const source = simColumns[from];
    const destination = simColumns[to];

    if (!source || !destination || source.length < length) return false;

    const moving = source.slice(source.length - length);
    if (!moving.every(card => card.faceUp)) return false;
    if (!guaranteedIsSameSuitRun(moving)) return false;

    const firstMoving = moving[0];
    if (destination.length) {
      const destinationCard = destination[destination.length - 1];
      if (!destinationCard.faceUp) return false;
      if (
        VALUE_NUMBER[destinationCard.value] !==
        VALUE_NUMBER[firstMoving.value] + 1
      ) return false;
    }

    source.splice(source.length - length, length);
    destination.push(...moving);

    if (source.length && !source[source.length - 1].faceUp) {
      source[source.length - 1].faceUp = true;
    }

    guaranteedRemoveCompletedSim(simColumns, state);
  }

  guaranteedRemoveCompletedSim(simColumns, state);

  return (
    state.completed === 8 &&
    simStock.length === 0 &&
    simColumns.every(column => column.length === 0)
  );
};

guaranteedBuildDeal = function(level) {
  let best = null;
  let bestScore = -Infinity;

  for (let attempt = 0; attempt < 55; attempt++) {
    const candidate = realBuildCandidate(level);
    if (!candidate) continue;
    if (!guaranteedSimulateSolution(candidate)) continue;

    const metrics = realMixMetrics(candidate.columns);
    if (metrics.score > bestScore) {
      best = candidate;
      bestScore = metrics.score;
    }

    if (metrics.broken < 24 || metrics.longestNatural > 3) continue;

    candidate.hiddenCount = guaranteedAddHiddenCards(
      candidate,
      level.hiddenTarget
    );

    if (guaranteedSimulateSolution(candidate)) return candidate;
  }

  if (!best) {
    throw new Error("Impossible de générer une partie gagnable.");
  }

  best.hiddenCount = guaranteedAddHiddenCards(best, level.hiddenTarget);
  if (!guaranteedSimulateSolution(best)) {
    best.columns.forEach(column => {
      column.forEach(card => { card.faceUp = true; });
    });
  }

  return best;
};
