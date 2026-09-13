/*
 * Mode Spider classique : vrai mélange aléatoire, sans garantie de victoire.
 *
 * Ce fichier remplace uniquement la création des nouvelles parties.
 * Le chrono, le score, le classement et le mot secret restent inchangés.
 */

function randomModeRandomInt(max) {
  if (window.crypto && window.crypto.getRandomValues) {
    const limit = Math.floor(0x100000000 / max) * max;
    const buffer = new Uint32Array(1);
    let value;
    do {
      window.crypto.getRandomValues(buffer);
      value = buffer[0];
    } while (value >= limit);
    return value % max;
  }
  return Math.floor(Math.random() * max);
}

function randomModeShuffle(array) {
  // Plusieurs passes Fisher-Yates pour obtenir un mélange visuellement très franc.
  for (let pass = 0; pass < 4; pass++) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = randomModeRandomInt(i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
  return array;
}

function randomModeCreateDeck() {
  const deck = [];
  let serial = 0;

  SUITS.forEach(suit => {
    for (let copy = 0; copy < 4; copy++) {
      VALUES.forEach(value => {
        deck.push({
          value,
          suit,
          faceUp: false,
          id: `r-${Date.now()}-${serial++}-${Math.random().toString(36).slice(2)}`
        });
      });
    }
  });

  return randomModeShuffle(deck);
}

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

  const deck = randomModeCreateDeck();
  columns = Array.from({ length: 10 }, () => []);

  // Distribution Spider standard : 6 cartes sur les 4 premières colonnes,
  // 5 cartes sur les 6 autres = 54 cartes sur le tableau.
  for (let columnIndex = 0; columnIndex < 10; columnIndex++) {
    const amount = columnIndex < 4 ? 6 : 5;

    for (let cardIndex = 0; cardIndex < amount; cardIndex++) {
      const card = deck.pop();
      card.faceUp = cardIndex === amount - 1;
      columns[columnIndex].push(card);
    }
  }

  // Les 50 cartes restantes constituent les 5 distributions du talon.
  stock = deck;
  stock.forEach(card => {
    card.faceUp = false;
  });

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
};
