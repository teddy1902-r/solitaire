
const API_URL = "https://TON-WORKER.workers.dev";

const VALUES = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const VALUE_NUMBER = {A:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,J:11,Q:12,K:13};
const SUITS = ["♠","♥"];

const PIP_LAYOUTS = {
  A: [[2,3]],
  2: [[2,1],[2,5]],
  3: [[2,1],[2,3],[2,5]],
  4: [[1,1],[3,1],[1,5],[3,5]],
  5: [[1,1],[3,1],[2,3],[1,5],[3,5]],
  6: [[1,1],[3,1],[1,3],[3,3],[1,5],[3,5]],
  7: [[1,1],[3,1],[2,2],[1,3],[3,3],[1,5],[3,5]],
  8: [[1,1],[3,1],[2,2],[1,3],[3,3],[2,4],[1,5],[3,5]],
  9: [[1,1],[3,1],[1,2],[3,2],[2,3],[1,4],[3,4],[1,5],[3,5]],
  10:[[1,1],[3,1],[2,2],[1,2],[3,2],[1,4],[3,4],[2,4],[1,5],[3,5]]
};

const COURT = {
  J: { icon: "🤵", label: "J" },
  Q: { icon: "👸", label: "Q" },
  K: { icon: "🤴", label: "K" }
};

let columns = [];
let stock = [];
let selectedColumn = null;
let selectedIndex = null;
let moves = 0;
let completed = 0;
let seconds = 0;
let timerInterval = null;
let started = false;
let finished = false;
let playerName = "";
let gameId = null;
let messageTimeout = null;

const board = document.getElementById("board");
const stockButton = document.getElementById("stock");
const startScreen = document.getElementById("startScreen");
const winScreen = document.getElementById("winScreen");
const leaderboardScreen = document.getElementById("leaderboardScreen");
const playerInput = document.getElementById("playerName");
const playerNameDisplay = document.getElementById("playerNameDisplay");
const movesDisplay = document.getElementById("moves");
const completedDisplay = document.getElementById("completed");
const timerDisplay = document.getElementById("timer");
const dealsDisplay = document.getElementById("deals");
const liveScoreDisplay = document.getElementById("liveScore");
const startError = document.getElementById("startError");
const submitStatus = document.getElementById("submitStatus");

function apiConfigured(){ return !API_URL.includes("TON-WORKER"); }
function cleanPlayerName(name){ return name.trim().replace(/\s+/g," ").replace(/[<>]/g,""); }
function formatTime(totalSeconds){
  const minutes=Math.floor(totalSeconds/60), secs=totalSeconds%60;
  return String(minutes).padStart(2,"0")+":"+String(secs).padStart(2,"0");
}
function calculateScore(totalSeconds,totalMoves){ return Math.max(0,100000-totalSeconds*5-totalMoves*20); }
function formatDate(isoDate){
  if(!isoDate) return "—";
  try{return new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"2-digit",year:"2-digit"}).format(new Date(isoDate));}
  catch{return "—";}
}
function showMessage(text){
  const message=document.getElementById("message");
  message.textContent=text; message.classList.add("show");
  clearTimeout(messageTimeout);
  messageTimeout=setTimeout(()=>message.classList.remove("show"),1900);
}
function clearSelection(){ selectedColumn=null; selectedIndex=null; }

async function apiRequest(path,options={}){
  if(!apiConfigured()) throw new Error("API non configurée.");
  const response=await fetch(`${API_URL}${path}`,{
    ...options,
    headers:{"Content-Type":"application/json",...(options.headers||{})}
  });
  let data={}; try{data=await response.json();}catch{}
  if(!response.ok) throw new Error(data.error||"Erreur serveur.");
  return data;
}
async function createServerGame(){
  const data=await apiRequest("/api/start",{method:"POST",body:JSON.stringify({player:playerName})});
  gameId=data.gameId;
}
async function startGameFromPseudo(){
  startError.textContent="";
  const cleaned=cleanPlayerName(playerInput.value);
  if(cleaned.length<2){startError.textContent="Entre un pseudo Géocaching d'au moins 2 caractères.";return;}
  if(cleaned.length>30){startError.textContent="Le pseudo est trop long.";return;}
  playerName=cleaned; playerNameDisplay.textContent=playerName;
  const startBtn=document.getElementById("startBtn");
  startBtn.disabled=true; startBtn.textContent="Connexion…";
  try{await createServerGame(); startScreen.classList.remove("visible"); newGame(false);}
  catch(error){startError.textContent=error.message;}
  finally{startBtn.disabled=false; startBtn.textContent="Commencer la partie";}
}

function createDeck(){
  const deck=[];
  SUITS.forEach(suit=>{
    for(let copy=0;copy<4;copy++){
      VALUES.forEach(value=>deck.push({
        value,suit,faceUp:false,
        id:Date.now()+"-"+Math.random().toString(36).slice(2)
      }));
    }
  });
  return shuffle(deck);
}
function shuffle(array){
  for(let i=array.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [array[i],array[j]]=[array[j],array[i]];
  }
  return array;
}
async function newGame(requestNewServerGame=true){
  clearInterval(timerInterval); winScreen.classList.remove("visible");
  if(requestNewServerGame){
    if(!playerName){startScreen.classList.add("visible");return;}
    try{await createServerGame();}
    catch{showMessage("Impossible de démarrer une nouvelle partie.");return;}
  }
  const deck=createDeck();
  columns=Array.from({length:10},()=>[]);
  for(let col=0;col<10;col++){
    const amount=col<4?6:5;
    for(let i=0;i<amount;i++){
      const card=deck.pop();
      if(i===amount-1) card.faceUp=true;
      columns[col].push(card);
    }
  }
  stock=deck; selectedColumn=null; selectedIndex=null;
  moves=0; completed=0; seconds=0; started=true; finished=false;
  updateTimer(); updateStats();
  timerInterval=setInterval(()=>{if(!finished){seconds++;updateTimer();updateStats();}},1000);
  render();
}

function cornerHTML(card, bottom=false){
  return `<div class="corner ${bottom?"corner-bottom":""}">
    <span class="corner-rank">${card.value}</span>
    <span class="corner-suit">${card.suit}</span>
  </div>`;
}
function pipHTML(card){
  const coords=PIP_LAYOUTS[card.value]||[];
  return `<div class="pip-area">${coords.map(([x,y])=>{
    const flip=y>=4?" flip":"";
    const ace=card.value==="A"?" ace-pip":"";
    return `<span class="pip${flip}${ace}" style="grid-column:${x};grid-row:${y}">${card.suit}</span>`;
  }).join("")}</div>`;
}
function courtHTML(card){
  const court=COURT[card.value];
  return `<div class="court-card">
    <div class="court-frame">
      <div class="court-icon">${court.icon}</div>
      <div class="court-name">${court.label}</div>
      <div class="court-suit">${card.suit}</div>
    </div>
  </div>`;
}
function cardFaceHTML(card){
  const middle=COURT[card.value]?courtHTML(card):pipHTML(card);
  return `${cornerHTML(card)}${middle}${cornerHTML(card,true)}`;
}

function render(){
  board.innerHTML="";
  columns.forEach((column,columnIndex)=>{
    const columnElement=document.createElement("div");
    columnElement.className="column";
    columnElement.addEventListener("click",event=>{
      if(event.target===columnElement) moveToEmptyColumn(columnIndex);
    });
    let top=0;
    column.forEach((card,cardIndex)=>{
      const cardElement=document.createElement("div");
      cardElement.className="card";
      cardElement.style.top=`${top}px`;
      cardElement.style.zIndex=String(cardIndex+1);
      top+=card.faceUp?30:14;
      if(!card.faceUp){
        cardElement.classList.add("face-down");
      }else{
        cardElement.classList.add(card.suit==="♥"?"red":"black");
        cardElement.innerHTML=cardFaceHTML(card);
        cardElement.addEventListener("click",event=>{
          event.stopPropagation(); cardClick(columnIndex,cardIndex);
        });
      }
      if(selectedColumn===columnIndex&&selectedIndex!==null&&cardIndex>=selectedIndex){
        cardElement.classList.add("selected");
      }
      columnElement.appendChild(cardElement);
    });
    board.appendChild(columnElement);
  });
  updateStats();
}

function cardClick(columnIndex,cardIndex){
  if(!started||finished) return;
  if(selectedColumn===null){
    if(canSelectSequence(columnIndex,cardIndex)){
      selectedColumn=columnIndex; selectedIndex=cardIndex; render();
    }
    return;
  }
  if(selectedColumn===columnIndex&&selectedIndex===cardIndex){
    clearSelection(); render(); return;
  }
  if(moveSequence(selectedColumn,selectedIndex,columnIndex)){
    moves++; clearSelection(); afterMove(); return;
  }
  if(canSelectSequence(columnIndex,cardIndex)){
    selectedColumn=columnIndex; selectedIndex=cardIndex;
  }else clearSelection();
  render();
}
function canSelectSequence(columnIndex,cardIndex){
  const column=columns[columnIndex], firstCard=column[cardIndex];
  if(!firstCard||!firstCard.faceUp) return false;
  for(let i=cardIndex;i<column.length-1;i++){
    const current=column[i], next=column[i+1];
    if(VALUE_NUMBER[current.value]!==VALUE_NUMBER[next.value]+1||current.suit!==next.suit) return false;
  }
  return true;
}
function moveSequence(fromColumn,fromIndex,toColumn){
  if(fromColumn===toColumn) return false;
  const source=columns[fromColumn], destination=columns[toColumn], movingCards=source.slice(fromIndex);
  if(!movingCards.length) return false;
  const firstMovingCard=movingCards[0];
  if(destination.length===0){
    source.splice(fromIndex); destination.push(...movingCards); return true;
  }
  const destinationCard=destination[destination.length-1];
  if(VALUE_NUMBER[destinationCard.value]!==VALUE_NUMBER[firstMovingCard.value]+1) return false;
  source.splice(fromIndex); destination.push(...movingCards); return true;
}
function moveToEmptyColumn(columnIndex){
  if(!started||finished||selectedColumn===null||columns[columnIndex].length!==0) return;
  if(moveSequence(selectedColumn,selectedIndex,columnIndex)){
    moves++; clearSelection(); afterMove();
  }
}
function afterMove(){
  flipTopCards(); removeCompletedSequences(); flipTopCards(); render(); checkWin();
}
function flipTopCards(){
  columns.forEach(column=>{
    if(column.length&& !column[column.length-1].faceUp) column[column.length-1].faceUp=true;
  });
}
function removeCompletedSequences(){
  let found=true;
  while(found){
    found=false;
    for(let columnIndex=0;columnIndex<10;columnIndex++){
      const column=columns[columnIndex];
      if(column.length<13) continue;
      const sequence=column.slice(-13), suit=sequence[0].suit;
      let valid=true;
      for(let i=0;i<13;i++){
        const card=sequence[i];
        if(!card.faceUp||VALUE_NUMBER[card.value]!==13-i||card.suit!==suit){valid=false;break;}
      }
      if(valid){
        column.splice(-13); completed++; found=true;
        showMessage(`✅ Suite ${completed}/8 terminée !`);
        flipTopCards(); break;
      }
    }
  }
}
function dealCards(){
  if(!started||finished||stock.length<10) return;
  if(columns.some(column=>column.length===0)){
    showMessage("⚠️ Remplis toutes les colonnes avant de distribuer."); return;
  }
  clearSelection();
  for(let columnIndex=0;columnIndex<10;columnIndex++){
    const card=stock.pop(); card.faceUp=true; columns[columnIndex].push(card);
  }
  moves++; afterMove();
}
function updateStats(){
  movesDisplay.textContent=moves;
  completedDisplay.textContent=completed;
  dealsDisplay.textContent=Math.floor(stock.length/10);
  stockButton.disabled=!started||finished||stock.length<10;
  liveScoreDisplay.textContent=calculateScore(seconds,moves);
}
function updateTimer(){timerDisplay.textContent=formatTime(seconds);}

async function checkWin(){
  if(completed!==8||finished) return;
  finished=true; clearInterval(timerInterval);
  const localScore=calculateScore(seconds,moves);
  document.getElementById("winnerName").textContent=playerName;
  document.getElementById("finalScore").textContent=localScore;
  document.getElementById("finalTime").textContent=formatTime(seconds);
  document.getElementById("finalMoves").textContent=moves;
  document.getElementById("secretWord").textContent="Validation…";
  submitStatus.textContent="Envoi du score au classement…";
  winScreen.classList.add("visible");
  try{
    const data=await apiRequest("/api/finish",{method:"POST",body:JSON.stringify({gameId,moves,seconds})});
    document.getElementById("finalScore").textContent=data.score;
    document.getElementById("secretWord").textContent=data.secretWord;
    submitStatus.textContent="✅ Score enregistré dans le classement.";
  }catch(error){
    document.getElementById("secretWord").textContent="Erreur";
    submitStatus.textContent="❌ "+error.message;
  }
}
async function showLeaderboard(){
  leaderboardScreen.classList.add("visible");
  const loading=document.getElementById("leaderboardLoading");
  const table=document.getElementById("leaderboardTable");
  const body=document.getElementById("leaderboardBody");
  const empty=document.getElementById("leaderboardEmpty");
  loading.style.display="block"; loading.textContent="Chargement du classement…";
  table.style.display="none"; empty.style.display="none"; body.innerHTML="";
  try{
    const data=await apiRequest("/api/leaderboard?limit=10");
    const scores=Array.isArray(data.scores)?data.scores:[];
    loading.style.display="none";
    if(!scores.length){empty.style.display="block";return;}
    scores.forEach((entry,index)=>{
      const row=document.createElement("tr");
      let rank=index+1;
      if(rank===1)rank="🥇"; if(rank===2)rank="🥈"; if(rank===3)rank="🥉";
      row.innerHTML=`<td>${rank}</td><td>${escapeHtml(entry.player)}</td><td><strong>${entry.score}</strong></td><td>${formatTime(entry.seconds)}</td><td>${entry.moves}</td><td>${formatDate(entry.createdAt)}</td>`;
      body.appendChild(row);
    });
    table.style.display="table";
  }catch(error){loading.textContent="Impossible de charger le classement : "+error.message;}
}
function hideLeaderboard(){leaderboardScreen.classList.remove("visible");}
function escapeHtml(text){const div=document.createElement("div");div.textContent=String(text??"");return div.innerHTML;}

document.getElementById("startBtn").addEventListener("click",startGameFromPseudo);
playerInput.addEventListener("keydown",event=>{if(event.key==="Enter")startGameFromPseudo();});
stockButton.addEventListener("click",dealCards);
document.getElementById("leaderboardBtn").addEventListener("click",showLeaderboard);
document.getElementById("startLeaderboardBtn").addEventListener("click",showLeaderboard);
document.getElementById("winLeaderboardBtn").addEventListener("click",showLeaderboard);
document.getElementById("closeLeaderboardBtn").addEventListener("click",hideLeaderboard);
document.getElementById("newGameBtn").addEventListener("click",()=>newGame(true));
document.getElementById("playAgainBtn").addEventListener("click",()=>newGame(true));

updateTimer(); updateStats();
setTimeout(()=>playerInput.focus(),200);
