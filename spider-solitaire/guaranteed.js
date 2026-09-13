/*
 * Générateur de parties garanties gagnables pour le Spider Solitaire.
 *
 * Principe : on part de 8 suites déjà résolues, puis on effectue des
 * opérations inverses qui correspondent à des coups légaux en sens normal.
 * On retire ensuite les 5 distributions du talon. Le chemin inverse constitue
 * donc toujours une solution valide. Un simulateur interne vérifie la partie
 * avant de l'afficher et n'accepte les cartes cachées que si la solution reste
 * jouable.
 */

const GUARANTEED_LEVELS = [
  { key: "easy", label: "Facile", swaps: 4, maxChunk: 2, hiddenTarget: 8 },
  { key: "medium", label: "Moyenne", swaps: 11, maxChunk: 3, hiddenTarget: 18 },
  { key: "hard", label: "Difficile", swaps: 22, maxChunk: 4, hiddenTarget: 30 }
];

let guaranteedLastDifficulty = null;

function guaranteedRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function guaranteedShuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function guaranteedCloneCard(card) {
  return { ...card };
}

function guaranteedCloneColumns(source) {
  return source.map(column => column.map(guaranteedCloneCard));
}

function guaranteedCard(suit, value, copy, serial) {
  return {
    value,
    suit,
    faceUp: true,
    id: `g-${Date.now()}-${copy}-${serial}-${Math.random().toString(36).slice(2)}`
  };
}

function guaranteedSolvedColumns() {
  const result = Array.from({ length: 10 }, () => []);
  let columnIndex = 0;
  let serial = 0;

  SUITS.forEach(suit => {
    for (let copy = 0; copy < 4; copy++) {
      const run = [];
      for (let rank = 13; rank >= 1; rank--) {
        const value = VALUES.find(v => VALUE_NUMBER[v] === rank);
        run.push(guaranteedCard(suit, value, copy, serial++));
      }
      result[columnIndex++] = run;
    }
  });

  return result;
}

function guaranteedIsSameSuitRun(cards) {
  for (let i = 0; i < cards.length - 1; i++) {
    if (
      cards[i].suit !== cards[i + 1].suit ||
      VALUE_NUMBER[cards[i].value] !== VALUE_NUMBER[cards[i + 1].value] + 1
    ) {
      return false;
    }
  }
  return true;
}

/*
 * Une opération inverse est valide lorsque le paquet retiré aurait pu être
 * posé légalement sur la carte qui reste dessous en jouant dans le sens normal.
 */
function guaranteedLegalReverseLengths(column, maxLength = Infinity) {
  const result = [];
  const n = column.length;

  for (let length = 1; length <= Math.min(n, maxLength); length++) {
    const moving = column.slice(n - length);
    if (!guaranteedIsSameSuitRun(moving)) continue;

    if (length === n) {
      result.push(length);
      continue;
    }

    const below = column[n - length - 1];
    const first = moving[0];
    if (VALUE_NUMBER[below.value] === VALUE_NUMBER[first.value] + 1) {
      result.push(length);
    }
  }

  return result;
}

function guaranteedReverseMove(cols, from, to, length, moveLog) {
  const moving = cols[from].splice(cols[from].length - length, length);
  cols[to].push(...moving);
  moveLog.push({ from, to, length });
}

function guaranteedBalanceSolvedBoard(cols, moveLog) {
  const target = [11, 11, 11, 11, 10, 10, 10, 10, 10, 10];
  let guard = 0;

  while (guard++ < 500) {
    const lengths = cols.map(column => column.length);
    if (lengths.every((length, index) => length === target[index])) return true;

    const candidates = [];

    for (let from = 0; from < 10; from++) {
      const excess = cols[from].length - target[from];
      if (excess <= 0) continue;

      const legalLengths = guaranteedLegalReverseLengths(cols[from], excess);
      for (const length of legalLengths) {
        for (let to = 0; to < 10; to++) {
          if (to === from) continue;
          const deficit = target[to] - cols[to].length;
          if (deficit >= length) candidates.push({ from, to, length });
        }
      }
    }

    if (!candidates.length) return false;
    const choice = guaranteedRandomItem(candidates);
    guaranteedReverseMove(cols, choice.from, choice.to, choice.length, moveLog);
  }

  return false;
}

/*
 * Cycle A→B, C→A, B→C : les longueurs des colonnes restent identiques mais
 * les paquets sont davantage mélangés. Chaque étape est elle-même l'inverse
 * d'un coup légal, donc la solution continue d'exister.
 */
function guaranteedTryScrambleCycle(cols, maxChunk) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const indexes = guaranteedShuffle([0,1,2,3,4,5,6,7,8,9]);
    const a = indexes[0];
    const c = indexes[1];
    const b = indexes[2];

    const legalA = guaranteedLegalReverseLengths(cols[a], maxChunk);
    const legalC = guaranteedLegalReverseLengths(cols[c], maxChunk);
    const common = legalA.filter(length => legalC.includes(length));
    if (!common.length) continue;

    const length = guaranteedRandomItem(common);
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
}

function guaranteedMakeCandidate(level) {
  let cols = guaranteedSolvedColumns();
  const reverseMoves = [];

  if (!guaranteedBalanceSolvedBoard(cols, reverseMoves)) return null;

  for (let i = 0; i < level.swaps; i++) {
    const cycle = guaranteedTryScrambleCycle(cols, level.maxChunk);
    if (!cycle) continue;
    cols = cycle.columns;
    reverseMoves.push(...cycle.moves);
  }

  const expected = [11, 11, 11, 11, 10, 10, 10, 10, 10, 10];
  if (!cols.every((column, index) => column.length === expected[index])) return null;

  const removedRounds = [];
  for (let round = 0; round < 5; round++) {
    const removed = [];
    for (let columnIndex = 0; columnIndex < 10; columnIndex++) {
      removed.push(cols[columnIndex].pop());
    }
    removedRounds.push(removed);
  }

  const initialExpected = [6, 6, 6, 6, 5, 5, 5, 5, 5, 5];
  if (!cols.every((column, index) => column.length === initialExpected[index])) return null;

  const forwardDealSequence = removedRounds
    .slice()
    .reverse()
    .flat();

  const generatedStock = forwardDealSequence
    .slice()
    .reverse()
    .map(card => ({ ...card, faceUp: false }));

  cols.forEach(column => column.forEach(card => { card.faceUp = true; }));

  return {
    columns: cols,
    stock: generatedStock,
    reverseMoves
  };
}

function guaranteedRemoveCompletedSim(simColumns, state) {
  let found = true;

  while (found) {
    found = false;

    for (let columnIndex = 0; columnIndex < 10; columnIndex++) {
      const column = simColumns[columnIndex];
      if (column.length < 13) continue;

      const sequence = column.slice(-13);
      const suit = sequence[0].suit;
      let valid = true;

      for (let i = 0; i < 13; i++) {
        const card = sequence[i];
        if (
          !card.faceUp ||
          card.suit !== suit ||
          VALUE_NUMBER[card.value] !== 13 - i
        ) {
          valid = false;
          break;
        }
      }

      if (valid) {
        column.splice(-13);
        state.completed++;
        if (column.length && !column[column.length - 1].faceUp) {
          column[column.length - 1].faceUp = true;
        }
        found = true;
        break;
      }
    }
  }
}

function guaranteedSimulateSolution(candidate) {
  const simColumns = guaranteedCloneColumns(candidate.columns);
  const simStock = candidate.stock.map(guaranteedCloneCard);
  const state = { completed: 0 };

  /* La solution garantie commence par remettre les 5 distributions. */
  for (let round = 0; round < 5; round++) {
    if (simStock.length < 10) return false;
    if (simColumns.some(column => column.length === 0)) return false;

    for (let columnIndex = 0; columnIndex < 10; columnIndex++) {
      const card = simStock.pop();
      card.faceUp = true;
      simColumns[columnIndex].push(card);
    }

    guaranteedRemoveCompletedSim(simColumns, state);
  }

  /* Puis on rejoue à l'envers toutes les opérations de mélange. */
  for (let i = candidate.reverseMoves.length - 1; i >= 0; i--) {
    const reverseMove = candidate.reverseMoves[i];
    const from = reverseMove.to;
    const to = reverseMove.from;
    const length = reverseMove.length;

    const source = simColumns[from];
    const destination = simColumns[to];
    if (source.length < length) return false;

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
}

function guaranteedAddHiddenCards(candidate, target) {
  const positions = [];

  candidate.columns.forEach((column, columnIndex) => {
    /* La carte du dessus reste toujours visible au lancement. */
    for (let cardIndex = 0; cardIndex < column.length - 1; cardIndex++) {
      positions.push({ columnIndex, cardIndex });
    }
  });

  guaranteedShuffle(positions);
  let hidden = 0;

  for (const position of positions) {
    if (hidden >= target) break;

    const card = candidate.columns[position.columnIndex][position.cardIndex];
    card.faceUp = false;

    if (guaranteedSimulateSolution(candidate)) {
      hidden++;
    } else {
      card.faceUp = true;
    }
  }

  return hidden;
}

function guaranteedBuildDeal(level) {
  /* En pratique un candidat valide est trouvé très vite, mais on garde un
     grand filet de sécurité. */
  for (let attempt = 0; attempt < 120; attempt++) {
    const candidate = guaranteedMakeCandidate(level);
    if (!candidate) continue;
    if (!guaranteedSimulateSolution(candidate)) continue;

    candidate.hiddenCount = guaranteedAddHiddenCards(candidate, level.hiddenTarget);
    if (!guaranteedSimulateSolution(candidate)) continue;

    return candidate;
  }

  /* Secours ultra-sûr : niveau facile et sans carte cachée. */
  const fallbackLevel = GUARANTEED_LEVELS[0];
  for (let attempt = 0; attempt < 200; attempt++) {
    const candidate = guaranteedMakeCandidate(fallbackLevel);
    if (candidate && guaranteedSimulateSolution(candidate)) {
      candidate.hiddenCount = 0;
      return candidate;
    }
  }

  throw new Error("Impossible de générer une partie garantie.");
}

function guaranteedPickDifficulty() {
  let choices = GUARANTEED_LEVELS;
  if (guaranteedLastDifficulty) {
    choices = GUARANTEED_LEVELS.filter(level => level.key !== guaranteedLastDifficulty);
  }

  const level = guaranteedRandomItem(choices);
  guaranteedLastDifficulty = level.key;
  return level;
}

/*
 * Remplace uniquement la création d'une nouvelle partie. Le score, le chrono,
 * le classement Cloudflare et le mot secret restent gérés par le code existant.
 */
newGame = async function(requestNewServerGame = true) {
  clearInterval(timerInterval);
  winScreen.classList.remove("visible");

  if (requestNewServerGame) {
    if (!playerName) {
      startScreen.classList.add("visible");
      return;
    }

    try {
      await createServerGame();
    } catch {
      showMessage("Impossible de démarrer une nouvelle partie.");
      return;
    }
  }

  const level = guaranteedPickDifficulty();
  let deal;

  try {
    deal = guaranteedBuildDeal(level);
  } catch (error) {
    console.error(error);
    showMessage("Erreur lors de la génération de la partie.");
    return;
  }

  columns = deal.columns;
  stock = deal.stock;
  selectedColumn = null;
  selectedIndex = null;
  moves = 0;
  completed = 0;
  seconds = 0;
  started = true;
  finished = false;

  updateTimer();
  updateStats();

  timerInterval = setInterval(() => {
    if (!finished) {
      seconds++;
      updateTimer();
      updateStats();
    }
  }, 1000);

  render();

  setTimeout(() => {
    showMessage(`🎯 Difficulté : ${level.label} • partie garantie gagnable`);
  }, 120);
};
