const SUITS = ['♥', '♦', '♣', '♠'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

let deck = [];
let stock = [];
let waste = [];
let foundations = { '♥': [], '♦': [], '♣': [], '♠': [] };
let tableau = [[], [], [], [], [], [], []];

let draggedCards = [];
let sourceLocation = null;
let selectedCards = [];
let selectedSource = null;

let moves = 0;
let score = 0;
let seconds = 0;
let timerInterval = null;
let gameStarted = false;
let gameWon = false;
let autoFinishing = false;
let gameId = 0;

const USE_NATIVE_DRAG =
  typeof window.matchMedia !== 'function' ||
  window.matchMedia('(pointer: fine)').matches;

function hasPlayerIdentity() {
  return Boolean(
    window.solitaireCommunity &&
    typeof window.solitaireCommunity.getPlayer === 'function' &&
    window.solitaireCommunity.getPlayer()
  );
}

function requestPlayerIdentity() {
  window.dispatchEvent(new CustomEvent('solitaire-needs-player'));
}

function initGame() {
  if (!hasPlayerIdentity()) {
    requestPlayerIdentity();
    return false;
  }

  gameId++;
  clearInterval(timerInterval);
  timerInterval = null;

  deck = createDeck();
  shuffle(deck);

  stock = [];
  waste = [];
  foundations = { '♥': [], '♦': [], '♣': [], '♠': [] };
  tableau = [[], [], [], [], [], [], []];

  clearInteractionState();

  moves = 0;
  score = 0;
  seconds = 0;
  gameStarted = false;
  gameWon = false;
  autoFinishing = false;

  for (let col = 0; col < 7; col++) {
    for (let row = col; row < 7; row++) {
      const card = deck.pop();
      if (col === row) card.faceUp = true;
      tableau[row].push(card);
    }
  }

  stock = deck;
  document.getElementById('win-modal').classList.add('hidden');
  updateStats();
  render();

  window.dispatchEvent(new CustomEvent('solitaire-game-started'));
  return true;
}

function createDeck() {
  const newDeck = [];

  for (const suit of SUITS) {
    for (let i = 0; i < VALUES.length; i++) {
      newDeck.push({
        suit,
        value: VALUES[i],
        rank: i + 1,
        color: suit === '♥' || suit === '♦' ? 'red' : 'black',
        faceUp: false
      });
    }
  }

  return newDeck;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function startTimer() {
  if (gameStarted || gameWon || autoFinishing) return;

  gameStarted = true;
  timerInterval = setInterval(() => {
    seconds++;
    updateStats();
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function updateStats() {
  document.getElementById('timer-val').textContent = formatTime(seconds);
  document.getElementById('moves-val').textContent = moves;
  document.getElementById('score-val').textContent = score;
}

function registerMove(points = 0) {
  startTimer();
  moves++;
  score = Math.max(0, score + points);
  updateStats();
}

function render() {
  renderStock();
  renderWaste();
  renderFoundations();
  renderTableau();
}

function createCardElement(card) {
  const cardEl = document.createElement('div');
  cardEl.classList.add('card');

  if (card.color) cardEl.classList.add(card.color);

  if (!card.faceUp) {
    cardEl.classList.add('face-down');
    cardEl.innerHTML = `
      <div class="card-back-pattern">
        <div class="geo-back-logo">
          <span class="sq g"></span>
          <span class="sq o"></span>
          <span class="sq b"></span>
          <span class="sq y"></span>
        </div>
        <div class="geo-back-text">GEOCACHING</div>
      </div>
    `;
  } else {
    cardEl.innerHTML = `
      <div class="card-corner top">
        <span>${card.value}</span>
        <span>${card.suit}</span>
      </div>
      <div class="card-suit-large">${card.suit}</div>
      <div class="card-corner bottom">
        <span>${card.value}</span>
        <span>${card.suit}</span>
      </div>
    `;
  }

  return cardEl;
}

function renderStock() {
  const stockEl = document.getElementById('stock');
  stockEl.innerHTML = '';
  stockEl.onclick = null;

  if (stock.length > 0) {
    const cardEl = createCardElement({ faceUp: false });
    stockEl.appendChild(cardEl);
    stockEl.onclick = drawFromStock;
  } else if (waste.length > 0) {
    stockEl.innerHTML = '<div class="stock-reset">↻</div>';
    stockEl.onclick = resetStock;
  }
}

function drawFromStock() {
  if (gameWon || autoFinishing || stock.length === 0) return;

  clearInteractionState();

  const card = stock.pop();
  card.faceUp = true;
  waste.push(card);

  registerMove();
  render();
}

function resetStock() {
  if (
    gameWon ||
    autoFinishing ||
    stock.length !== 0 ||
    waste.length === 0
  ) {
    return;
  }

  clearInteractionState();

  while (waste.length > 0) {
    const card = waste.pop();
    card.faceUp = false;
    stock.push(card);
  }

  registerMove();
  render();
}

function renderWaste() {
  const wasteEl = document.getElementById('waste');
  wasteEl.innerHTML = '';

  if (waste.length === 0) return;

  const topCard = waste[waste.length - 1];
  const cardEl = createCardElement(topCard);
  const source = { type: 'waste' };

  addDragEvents(cardEl, [topCard], source);

  cardEl.addEventListener('click', e => {
    e.stopPropagation();
    if (autoFinishing) return;

    if (isSameSource(selectedSource, source)) {
      clearSelection();
      return;
    }

    selectCards([topCard], source, cardEl);
  });

  cardEl.addEventListener('dblclick', e => {
    e.preventDefault();
    e.stopPropagation();
    if (autoFinishing) return;
    moveCardAutomaticallyToFoundation(topCard, source);
  });

  wasteEl.appendChild(cardEl);
}

function renderFoundations() {
  document.querySelectorAll('.foundation').forEach(el => {
    const suit = el.dataset.suit;
    const cards = foundations[suit];
    const foundationSource = { type: 'foundation', suit };

    el.innerHTML = '';

    if (cards.length > 0) {
      const topCard = cards[cards.length - 1];
      const cardEl = createCardElement(topCard);

      addDragEvents(cardEl, [topCard], foundationSource);

      cardEl.addEventListener('click', e => {
        e.stopPropagation();
        if (autoFinishing) return;

        if (
          selectedCards.length > 0 &&
          selectedSource?.type !== 'foundation'
        ) {
          if (!tryMoveToFoundation(suit)) {
            flashInvalid(cardEl);
          }
          return;
        }

        if (isSameSource(selectedSource, foundationSource)) {
          clearSelection();
          return;
        }

        selectCards([topCard], foundationSource, cardEl);
      });

      el.appendChild(cardEl);
    }

    el.onclick = () => {
      if (autoFinishing) return;
      if (selectedCards.length > 0 && !tryMoveToFoundation(suit)) {
        flashInvalid(el);
      }
    };

    el.ondragover = e => {
      if (USE_NATIVE_DRAG && !autoFinishing) e.preventDefault();
    };

    el.ondrop = e => {
      e.preventDefault();
      if (autoFinishing) return;
      handleDropOnFoundation(suit);
    };
  });
}

function getCardSpacing(card, totalCards) {
  const width = window.innerWidth;
  let faceDownSpacing;
  let faceUpSpacing;

  if (width > 900) {
    faceDownSpacing = 20;
    faceUpSpacing = 30;
  } else if (width > 700) {
    faceDownSpacing = 18;
    faceUpSpacing = 27;
  } else if (width > 380) {
    faceDownSpacing = 13;
    faceUpSpacing = 22;
  } else {
    faceDownSpacing = 11;
    faceUpSpacing = 19;
  }

  if (totalCards >= 10) {
    faceDownSpacing -= 2;
    faceUpSpacing -= 3;
  }

  if (totalCards >= 13) {
    faceDownSpacing -= 2;
    faceUpSpacing -= 3;
  }

  if (totalCards >= 16) {
    faceDownSpacing -= 1;
    faceUpSpacing -= 2;
  }

  faceDownSpacing = Math.max(faceDownSpacing, 7);
  faceUpSpacing = Math.max(faceUpSpacing, 13);

  return card.faceUp ? faceUpSpacing : faceDownSpacing;
}

function renderTableau() {
  const colEls = document.querySelectorAll('.column');

  colEls.forEach((el, colIndex) => {
    el.innerHTML = '';

    const cards = tableau[colIndex];
    let topPosition = 0;

    cards.forEach((card, cardIndex) => {
      const cardEl = createCardElement(card);
      cardEl.style.top = `${topPosition}px`;

      if (cardIndex < cards.length - 1) {
        topPosition += getCardSpacing(card, cards.length);
      }

      if (card.faceUp) {
        const movingCards = cards.slice(cardIndex);
        const source = {
          type: 'tableau',
          colIndex,
          cardIndex
        };

        addDragEvents(cardEl, movingCards, source);

        cardEl.addEventListener('click', e => {
          e.stopPropagation();
          if (autoFinishing) return;

          if (selectedCards.length > 0) {
            if (isSameSource(selectedSource, source)) {
              clearSelection();
              return;
            }

            if (
              selectedSource?.type === 'tableau' &&
              selectedSource.colIndex === colIndex
            ) {
              selectCards(movingCards, source, cardEl);
              return;
            }

            if (tryMoveToTableau(colIndex)) {
              return;
            }

            flashInvalid(cardEl);
            return;
          }

          selectCards(movingCards, source, cardEl);
        });

        cardEl.addEventListener('dblclick', e => {
          e.preventDefault();
          e.stopPropagation();
          if (autoFinishing) return;

          if (cardIndex === cards.length - 1) {
            moveCardAutomaticallyToFoundation(card, source);
          }
        });
      }

      el.appendChild(cardEl);
    });

    const stockHeight =
      document.getElementById('stock').getBoundingClientRect().height || 150;

    const minimumHeight = window.innerWidth <= 700 ? 380 : 480;

    el.style.minHeight = `${Math.max(
      topPosition + stockHeight + 15,
      minimumHeight
    )}px`;

    el.onclick = () => {
      if (autoFinishing) return;
      if (selectedCards.length > 0 && !tryMoveToTableau(colIndex)) {
        flashInvalid(el);
      }
    };

    el.ondragover = e => {
      if (USE_NATIVE_DRAG && !autoFinishing) e.preventDefault();
    };

    el.ondrop = e => {
      e.preventDefault();
      if (autoFinishing) return;
      handleDropOnTableau(colIndex);
    };
  });
}

function selectCards(cards, source, element) {
  if (gameWon || autoFinishing) return;

  startTimer();
  clearSelection();

  selectedCards = [...cards];
  selectedSource = { ...source };

  element.classList.add('selected');
}

function clearSelection() {
  selectedCards = [];
  selectedSource = null;

  document.querySelectorAll('.card.selected').forEach(el => {
    el.classList.remove('selected');
  });
}

function clearDragState() {
  draggedCards = [];
  sourceLocation = null;
}

function clearInteractionState() {
  clearSelection();
  clearDragState();
}

function isSameSource(a, b) {
  if (!a || !b || a.type !== b.type) return false;

  if (a.type === 'waste') return true;

  if (a.type === 'foundation') {
    return a.suit === b.suit;
  }

  if (a.type === 'tableau') {
    return (
      a.colIndex === b.colIndex &&
      a.cardIndex === b.cardIndex
    );
  }

  return false;
}

function sourceContainsCards(cards, source) {
  if (!source || !cards || cards.length === 0) return false;

  if (source.type === 'waste') {
    return cards.length === 1 && waste[waste.length - 1] === cards[0];
  }

  if (source.type === 'foundation') {
    const pile = foundations[source.suit];
    return cards.length === 1 && pile[pile.length - 1] === cards[0];
  }

  if (source.type === 'tableau') {
    const pile = tableau[source.colIndex];

    if (
      !pile ||
      source.cardIndex < 0 ||
      source.cardIndex + cards.length > pile.length
    ) {
      return false;
    }

    return cards.every(
      (card, offset) => pile[source.cardIndex + offset] === card
    );
  }

  return false;
}

function addDragEvents(element, cards, source) {
  if (!USE_NATIVE_DRAG) {
    element.draggable = false;
    return;
  }

  element.draggable = true;

  element.addEventListener('dragstart', e => {
    if (gameWon || autoFinishing) {
      e.preventDefault();
      return;
    }

    clearSelection();
    startTimer();

    draggedCards = [...cards];
    sourceLocation = { ...source };

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'solitaire-card');
    }
  });

  element.addEventListener('dragend', clearDragState);
}

function handleDropOnTableau(targetColIndex) {
  if (autoFinishing || draggedCards.length === 0) return;

  const moved = moveCardsToTableau(
    draggedCards,
    sourceLocation,
    targetColIndex
  );

  if (!moved) {
    const target = document.querySelector(
      `.column[data-col="${targetColIndex}"]`
    );
    flashInvalid(target);
  }

  clearDragState();
}

function handleDropOnFoundation(targetSuit) {
  if (autoFinishing || draggedCards.length !== 1) return;

  const moved = moveCardsToFoundation(
    draggedCards,
    sourceLocation,
    targetSuit
  );

  if (!moved) {
    const target = Array.from(document.querySelectorAll('.foundation')).find(
      el => el.dataset.suit === targetSuit
    );
    flashInvalid(target);
  }

  clearDragState();
}

function tryMoveToTableau(targetColIndex) {
  if (autoFinishing || selectedCards.length === 0) return false;

  return moveCardsToTableau(
    selectedCards,
    selectedSource,
    targetColIndex
  );
}

function tryMoveToFoundation(targetSuit) {
  if (autoFinishing || selectedCards.length !== 1) return false;

  return moveCardsToFoundation(
    selectedCards,
    selectedSource,
    targetSuit
  );
}

function moveCardsToTableau(cards, source, targetColIndex) {
  if (
    !cards ||
    cards.length === 0 ||
    !source ||
    gameWon ||
    autoFinishing
  ) {
    return false;
  }

  if (!sourceContainsCards(cards, source)) {
    clearInteractionState();
    return false;
  }

  if (
    source.type === 'tableau' &&
    source.colIndex === targetColIndex
  ) {
    return false;
  }

  const targetCol = tableau[targetColIndex];
  const targetCard = targetCol[targetCol.length - 1];
  const movingCard = cards[0];

  let valid = false;

  if (!targetCard) {
    valid = movingCard.rank === 13;
  } else {
    valid =
      targetCard.faceUp &&
      movingCard.color !== targetCard.color &&
      movingCard.rank === targetCard.rank - 1;
  }

  if (!valid) return false;

  removeCardsFromSource(cards, source);
  targetCol.push(...cards);

  const flipped = checkTableauFlip();
  let points = source.type === 'foundation' ? -5 : 5;

  if (flipped) points += 5;

  clearInteractionState();
  registerMove(points);
  render();

  if (!checkWin()) {
    maybeStartAutoFinish();
  }

  return true;
}

function moveCardsToFoundation(cards, source, targetSuit) {
  if (
    !cards ||
    cards.length !== 1 ||
    !source ||
    gameWon ||
    autoFinishing
  ) {
    return false;
  }

  if (!sourceContainsCards(cards, source)) {
    clearInteractionState();
    return false;
  }

  const movingCard = cards[0];

  if (movingCard.suit !== targetSuit) return false;

  const targetFoundation = foundations[targetSuit];
  const topCard = targetFoundation[targetFoundation.length - 1];

  const valid = !topCard
    ? movingCard.rank === 1
    : movingCard.rank === topCard.rank + 1;

  if (!valid) return false;

  removeCardsFromSource(cards, source);
  targetFoundation.push(movingCard);

  const flipped = checkTableauFlip();
  let points = 10;

  if (flipped) points += 5;

  clearInteractionState();
  registerMove(points);
  render();

  if (!checkWin()) {
    maybeStartAutoFinish();
  }

  return true;
}

function removeCardsFromSource(cards, source) {
  if (source.type === 'waste') {
    waste.pop();
    return;
  }

  if (source.type === 'tableau') {
    tableau[source.colIndex].splice(source.cardIndex, cards.length);
    return;
  }

  if (source.type === 'foundation') {
    foundations[source.suit].pop();
  }
}

function checkTableauFlip() {
  let flipped = false;

  tableau.forEach(col => {
    if (col.length === 0) return;

    const topCard = col[col.length - 1];

    if (!topCard.faceUp) {
      topCard.faceUp = true;
      flipped = true;
    }
  });

  return flipped;
}

function moveCardAutomaticallyToFoundation(card, source) {
  if (!card || !source || gameWon || autoFinishing) return;

  clearSelection();
  moveCardsToFoundation([card], source, card.suit);
}

function canAutoFinish() {
  if (gameWon || autoFinishing) return false;
  if (stock.length !== 0 || waste.length !== 0) return false;

  const remainingCards = tableau.reduce(
    (total, col) => total + col.length,
    0
  );

  if (remainingCards === 0) return false;

  return tableau.every(col =>
    col.every(card => card.faceUp)
  );
}

function maybeStartAutoFinish() {
  if (!canAutoFinish()) return;
  autoFinishGame();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function autoFinishGame() {
  if (!canAutoFinish()) return;

  const currentGameId = gameId;
  autoFinishing = true;
  stopTimer();
  clearInteractionState();

  const remainingCards = tableau
    .flat()
    .slice()
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
    });

  for (const card of remainingCards) {
    if (currentGameId !== gameId || gameWon) return;

    let sourceCol = -1;
    let sourceIndex = -1;

    for (let colIndex = 0; colIndex < tableau.length; colIndex++) {
      const index = tableau[colIndex].indexOf(card);
      if (index !== -1) {
        sourceCol = colIndex;
        sourceIndex = index;
        break;
      }
    }

    if (sourceCol === -1) continue;

    tableau[sourceCol].splice(sourceIndex, 1);
    card.faceUp = true;
    foundations[card.suit].push(card);

    // Même valeur qu'un placement manuel dans une fondation.
    // Le score augmente, mais le nombre de coups du joueur ne change pas.
    score += 10;
    updateStats();
    render();

    await sleep(85);
  }

  if (currentGameId !== gameId) return;

  autoFinishing = false;
  checkWin();
}

function flashInvalid(element) {
  if (!element) return;

  element.classList.remove('invalid-move');
  void element.offsetWidth;
  element.classList.add('invalid-move');

  setTimeout(() => {
    element.classList.remove('invalid-move');
  }, 260);
}

function checkWin() {
  const total = Object.values(foundations).reduce(
    (sum, foundation) => sum + foundation.length,
    0
  );

  if (total !== 52) return false;

  gameWon = true;
  autoFinishing = false;
  stopTimer();
  clearInteractionState();

  const result = {
    score,
    seconds,
    moves,
    finishedAt: new Date().toISOString()
  };

  document.getElementById('final-time').textContent = formatTime(seconds);
  document.getElementById('final-moves').textContent = moves;
  document.getElementById('final-score').textContent = score;

  window.dispatchEvent(
    new CustomEvent('solitaire-win', { detail: result })
  );

  setTimeout(() => {
    if (gameWon) {
      document.getElementById('win-modal').classList.remove('hidden');
    }
  }, 300);

  return true;
}

document.getElementById('restart-btn').addEventListener('click', initGame);
document.getElementById('modal-restart-btn').addEventListener('click', initGame);

let resizeTimer;

window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);

  resizeTimer = setTimeout(() => {
    clearInteractionState();
    if (hasPlayerIdentity()) renderTableau();
  }, 150);
});

window.solitaireGame = {
  initGame,
  formatTime,
  getResult() {
    return {
      score,
      seconds,
      moves,
      won: gameWon
    };
  }
};

// Le jeu est volontairement NON lancé ici.
// community.js appelle initGame() uniquement après validation du pseudo Geocaching.
