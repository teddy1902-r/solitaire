const SOLITAIRE_API_URL = 'https://solitaire-scores.teddysegura-ts.workers.dev';
const PLAYER_STORAGE_KEY = 'solitaireGeocachingPseudo';
const HIDDEN_LEADERBOARD_PSEUDOS = new Set(['teddytest']);

let currentPlayer = '';
let lastSubmittedVictory = '';

const playerGate = document.getElementById('player-gate');
const loginForm = document.getElementById('geo-login-form');
const pseudoInput = document.getElementById('geo-pseudo');
const loginError = document.getElementById('geo-login-error');
const playerChip = document.getElementById('player-chip');
const changePlayerBtn = document.getElementById('change-player-btn');
const leaderboardBtn = document.getElementById('leaderboard-btn');
const leaderboardModal = document.getElementById('leaderboard-modal');
const closeLeaderboardBtn = document.getElementById('close-leaderboard-btn');
const closeWinBtn = document.getElementById('close-win-btn');
const victoryCloseBtn = document.getElementById('victory-close-btn');
const loginLeaderboard = document.getElementById('login-leaderboard');
const fullLeaderboard = document.getElementById('leaderboard-full');
const victoryLeaderboard = document.getElementById('victory-leaderboard');
const victoryRankingSection = document.getElementById('victory-ranking-section');
const loginApiStatus = document.getElementById('login-api-status');
const leaderboardApiStatus = document.getElementById('leaderboard-api-status');
const finalPlayer = document.getElementById('final-player');
const finalDate = document.getElementById('final-date');
const resultSaveStatus = document.getElementById('result-save-status');
const certitudeBox = document.getElementById('certitude-box');
const certitudeWord = document.getElementById('certitude-word');

function normalizePseudo(value) {
  return value.trim().replace(/\s+/g, ' ');
}

function isValidPseudo(value) {
  return value.length >= 1 && value.length <= 40;
}

function formatResultDate(value) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function formatLeaderboardTime(totalSeconds) {
  if (window.solitaireGame?.formatTime) {
    return window.solitaireGame.formatTime(Number(totalSeconds) || 0);
  }

  const seconds = Number(totalSeconds) || 0;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function setPlayer(pseudo) {
  currentPlayer = normalizePseudo(pseudo);
  localStorage.setItem(PLAYER_STORAGE_KEY, currentPlayer);
  playerChip.textContent = `👤 ${currentPlayer}`;
}

function getPlayer() {
  return currentPlayer;
}

function showPlayerGate() {
  document.body.classList.add('community-locked');
  playerGate.classList.remove('hidden');
  loginError.textContent = '';

  const remembered = localStorage.getItem(PLAYER_STORAGE_KEY);
  if (remembered && !pseudoInput.value) {
    pseudoInput.value = remembered;
  }

  setTimeout(() => {
    pseudoInput.focus();
    pseudoInput.select();
  }, 50);
}

function hidePlayerGate() {
  playerGate.classList.add('hidden');
  document.body.classList.remove('community-locked');
}

function closeVictoryModal() {
  document.getElementById('win-modal').classList.add('hidden');
}

function resetVictoryCommunity() {
  lastSubmittedVictory = '';
  resultSaveStatus.textContent = '';
  certitudeWord.textContent = '';
  certitudeBox.hidden = true;
  victoryRankingSection.hidden = true;
  victoryLeaderboard.innerHTML = '<div class="community-empty">Classement en cours de chargement…</div>';
  finalPlayer.textContent = currentPlayer || '—';
  finalDate.textContent = '—';
}

function createLeaderboardRow(entry, index) {
  const row = document.createElement('div');
  row.className = 'leaderboard-row';

  if (
    currentPlayer &&
    String(entry.pseudo).toLocaleLowerCase('fr-FR') ===
      currentPlayer.toLocaleLowerCase('fr-FR')
  ) {
    row.classList.add('me');
  }

  const rank = document.createElement('span');
  rank.className = 'leaderboard-rank';
  rank.textContent = `${index + 1}.`;

  const main = document.createElement('div');
  main.className = 'leaderboard-main';

  const name = document.createElement('strong');
  name.className = 'leaderboard-name';
  name.textContent = entry.pseudo;

  const date = document.createElement('span');
  date.className = 'leaderboard-date';
  date.textContent = formatResultDate(entry.created_at);

  main.append(name, date);

  const result = document.createElement('div');
  result.className = 'leaderboard-result';

  const score = document.createElement('strong');
  score.className = 'leaderboard-score';
  score.textContent = `${entry.score} pts`;

  const meta = document.createElement('span');
  meta.className = 'leaderboard-meta';
  meta.textContent = `${formatLeaderboardTime(entry.seconds)} • ${entry.moves} coups`;

  result.append(score, meta);
  row.append(rank, main, result);

  return row;
}

function renderLeaderboard(entries, container) {
  container.innerHTML = '';

  const visibleEntries = Array.isArray(entries)
    ? entries.filter(entry => {
        const pseudo = String(entry?.pseudo || '').trim().toLocaleLowerCase('fr-FR');
        return !HIDDEN_LEADERBOARD_PSEUDOS.has(pseudo);
      })
    : [];

  if (visibleEntries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'community-empty';
    empty.textContent = 'Aucun score enregistré pour le moment.';
    container.appendChild(empty);
    return;
  }

  visibleEntries.forEach((entry, index) => {
    container.appendChild(createLeaderboardRow(entry, index));
  });
}

async function loadLeaderboard(target = 'both') {
  const containers = [];
  const statuses = [];

  if (target === 'login' || target === 'both') {
    containers.push(loginLeaderboard);
    statuses.push(loginApiStatus);
  }

  if (target === 'full' || target === 'both') {
    containers.push(fullLeaderboard);
    statuses.push(leaderboardApiStatus);
  }

  statuses.forEach(el => {
    el.textContent = 'Connexion au classement…';
  });

  try {
    const response = await fetch(`${SOLITAIRE_API_URL}/leaderboard`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const entries = Array.isArray(data.leaderboard) ? data.leaderboard : [];

    containers.forEach(container => renderLeaderboard(entries, container));
    statuses.forEach(el => {
      el.textContent = '';
    });

    return entries;
  } catch (error) {
    containers.forEach(container => {
      container.innerHTML = '';
      const unavailable = document.createElement('div');
      unavailable.className = 'community-empty';
      unavailable.textContent = 'Le classement est momentanément indisponible.';
      container.appendChild(unavailable);
    });

    statuses.forEach(el => {
      el.textContent = 'Impossible de joindre le classement partagé pour le moment.';
    });

    return [];
  }
}

async function submitVictory(result) {
  if (!currentPlayer) return;

  const victoryKey = `${currentPlayer}|${result.score}|${result.seconds}|${result.moves}|${result.finishedAt}`;
  if (victoryKey === lastSubmittedVictory) return;
  lastSubmittedVictory = victoryKey;

  finalPlayer.textContent = currentPlayer;
  finalDate.textContent = formatResultDate(result.finishedAt);
  resultSaveStatus.textContent = 'Enregistrement du résultat…';
  certitudeWord.textContent = '';
  certitudeBox.hidden = true;

  victoryRankingSection.hidden = false;
  victoryLeaderboard.innerHTML = '<div class="community-empty">Classement en cours de chargement…</div>';

  try {
    const response = await fetch(`${SOLITAIRE_API_URL}/score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        pseudo: currentPlayer,
        score: result.score,
        seconds: result.seconds,
        moves: result.moves
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    if (data.entry?.created_at) {
      finalDate.textContent = formatResultDate(data.entry.created_at);
    }

    resultSaveStatus.textContent = '✅ Résultat enregistré dans le classement.';

    if (data.certitude_word) {
      certitudeWord.textContent = data.certitude_word;
      certitudeBox.hidden = false;
    } else {
      resultSaveStatus.textContent += ' Le mot Certitudes n’est pas encore configuré côté Cloudflare.';
    }

    if (Array.isArray(data.leaderboard)) {
      renderLeaderboard(data.leaderboard, loginLeaderboard);
      renderLeaderboard(data.leaderboard, fullLeaderboard);
      renderLeaderboard(data.leaderboard, victoryLeaderboard);
    } else {
      const entries = await loadLeaderboard('both');
      renderLeaderboard(entries, victoryLeaderboard);
    }
  } catch (error) {
    resultSaveStatus.textContent =
      '⚠️ Le résultat n’a pas pu être envoyé au classement.';

    victoryLeaderboard.innerHTML = '';
    const unavailable = document.createElement('div');
    unavailable.className = 'community-empty';
    unavailable.textContent = 'Classement momentanément indisponible.';
    victoryLeaderboard.appendChild(unavailable);
  }
}

loginForm.addEventListener('submit', event => {
  event.preventDefault();

  const pseudo = normalizePseudo(pseudoInput.value);

  if (!isValidPseudo(pseudo)) {
    loginError.textContent = 'Entre ton identifiant Geocaching pour lancer le jeu.';
    pseudoInput.focus();
    return;
  }

  setPlayer(pseudo);
  resetVictoryCommunity();
  hidePlayerGate();

  if (!window.solitaireGame?.initGame()) {
    showPlayerGate();
  }
});

changePlayerBtn.addEventListener('click', () => {
  pseudoInput.value = currentPlayer || localStorage.getItem(PLAYER_STORAGE_KEY) || '';
  showPlayerGate();
});

leaderboardBtn.addEventListener('click', () => {
  leaderboardModal.classList.remove('hidden');
  loadLeaderboard('full');
});

closeLeaderboardBtn.addEventListener('click', () => {
  leaderboardModal.classList.add('hidden');
});

leaderboardModal.addEventListener('click', event => {
  if (event.target === leaderboardModal) {
    leaderboardModal.classList.add('hidden');
  }
});

if (closeWinBtn) {
  closeWinBtn.addEventListener('click', closeVictoryModal);
}

if (victoryCloseBtn) {
  victoryCloseBtn.addEventListener('click', closeVictoryModal);
}

window.addEventListener('solitaire-needs-player', showPlayerGate);

window.addEventListener('solitaire-game-started', () => {
  resetVictoryCommunity();
});

window.addEventListener('solitaire-win', event => {
  submitVictory(event.detail);
});

window.solitaireCommunity = {
  getPlayer,
  showPlayerGate,
  loadLeaderboard
};

const rememberedPlayer = localStorage.getItem(PLAYER_STORAGE_KEY);
if (rememberedPlayer) {
  pseudoInput.value = rememberedPlayer;
}

showPlayerGate();
loadLeaderboard('login');
