// DOM Elements
const modeSelection = document.getElementById('mode-selection');
const topicSelection = document.getElementById('topic-selection');
const topicsGrid = document.getElementById('topics-grid');
const gameScreen = document.getElementById('game-screen');
const soloGame = document.getElementById('solo-game');
const battleModeBtn = document.getElementById('battle-mode-btn');
const soloModeBtn = document.getElementById('solo-mode-btn');
const backToMenuBtn = document.getElementById('back-to-menu');

// Solo Game Elements
const scoreEl = document.getElementById('score');
const questionNumberEl = document.getElementById('question-number');
const totalQuestionsEl = document.getElementById('total-questions');
const questionTextEl = document.getElementById('question-text');
const answersContainer = document.getElementById('answers-container');
const endScreen = document.getElementById('end-screen');
const finalScoreEl = document.getElementById('final-score');
const playAgainBtn = document.getElementById('play-again-btn');

// Leaderboard & Review Elements
const saveScoreSection = document.getElementById('save-score-section');
const playerNameInput = document.getElementById('player-name');
const saveScoreBtn = document.getElementById('save-score-btn');
const leaderboardSection = document.getElementById('leaderboard-section');
const leaderboardList = document.getElementById('leaderboard-list');
const aiReviewSection = document.getElementById('ai-review-section');
const aiExplanationText = document.getElementById('ai-explanation-text');
const shareImgBtn = document.getElementById('share-img-btn');

// Battle Mode Elements
const battleSetup = document.getElementById('battle-setup');
const battleScreen = document.getElementById('battle-screen');
const roomIdInput = document.getElementById('room-id-input');
const joinRoomBtn = document.getElementById('join-room-btn');
const playerBar = document.getElementById('player-bar');
const opponentBar = document.getElementById('opponent-bar');
const battleStatus = document.getElementById('battle-status');
const battleQuestionText = document.getElementById('battle-question-text');
const battleAnswersContainer = document.getElementById('battle-answers-container');

// --- Global State ---
let currentQuizData = [];
let currentQuestionIndex = 0;
let score = 0;
let wrongAnswers = [];
let db;
let rtdb;
let myPlayerId = 'player_' + Math.random().toString(36).substr(2, 9);
let currentRoomId = null;
let isBattleMode = false;

const TOPICS = [
    { name: "한국사", icon: "🇰🇷" },
    { name: "일반상식", icon: "🧠" },
    { name: "과학", icon: "🧪" },
    { name: "스포츠", icon: "⚽" },
    { name: "영화", icon: "🎬" },
    { name: "음악", icon: "🎵" }
];

// --- Initialization ---
function initTopicSelection() {
    if (!topicsGrid) return;
    topicsGrid.innerHTML = '';
    TOPICS.forEach(topic => {
        const btn = document.createElement('button');
        btn.innerHTML = `<div class="text-3xl mb-2">${topic.icon}</div><div class="text-sm">${topic.name}</div>`;
        btn.className = "bg-gray-800 hover:bg-gray-700 text-white p-6 rounded-xl border-2 border-transparent hover:border-blue-500 transition-all flex flex-col items-center justify-center";
        btn.style.fontFamily = "'Press Start 2P', cursive";
        btn.addEventListener('click', () => fetchQuiz(topic.name));
        topicsGrid.appendChild(btn);
    });
}

initTopicSelection();

// --- Firebase Initialization ---
try {
    if (typeof firebase !== 'undefined' && typeof firebaseConfig !== 'undefined') {
        const app = firebase.initializeApp(firebaseConfig);
        db = firebase.firestore(app);
        rtdb = firebase.database(app);
        console.log("Firebase initialized successfully");
    }
} catch (e) { console.error(e); }

// --- Event Listeners ---
soloModeBtn.addEventListener('click', () => {
    isBattleMode = false;
    modeSelection.classList.add('hidden');
    topicSelection.classList.remove('hidden');
});

battleModeBtn.addEventListener('click', () => {
    isBattleMode = true;
    modeSelection.classList.add('hidden');
    battleSetup.classList.remove('hidden');
});

joinRoomBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim();
    if (roomId) joinBattleRoom(roomId);
});

backToMenuBtn.addEventListener('click', () => {
    location.reload(); // Simple way to reset everything
});

playAgainBtn.addEventListener('click', () => {
    endScreen.classList.add('hidden');
    topicSelection.classList.remove('hidden');
});

saveScoreBtn.addEventListener('click', async () => {
    const name = playerNameInput.value.trim().toUpperCase();
    if (!name) return alert("ENTER NAME");
    if (!db) return alert("DB NOT CONNECTED");

    saveScoreBtn.disabled = true;
    try {
        await db.collection("scores").add({ name, score, date: new Date() });
        saveScoreSection.classList.add('hidden');
        fetchAndDisplayLeaderboard();
    } catch (e) { console.error(e); }
});

shareImgBtn.addEventListener('click', async () => {
    const element = document.getElementById('end-screen');
    const canvas = await html2canvas(element, { backgroundColor: '#111827' });
    const dataUrl = canvas.toDataURL('image/png');
    
    const link = document.createElement('a');
    link.download = `quiz-result-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    
    if (navigator.share) {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], 'result.png', { type: 'image/png' });
        navigator.share({
            files: [file],
            title: 'AI QUIZ BATTLE RESULT',
            text: `My score is ${score}! Can you beat me?`
        }).catch(console.error);
    }
});

// --- Solo Game Logic ---
async function fetchQuiz(topic) {
    const originalContent = topicSelection.innerHTML;
    topicSelection.innerHTML = `<div class="py-20 animate-pulse text-xl">GENERATING ${topic} QUIZ...</div>`;

    try {
        const response = await fetch('/api/generate-quiz', {
            method: 'POST',
            body: JSON.stringify({ topic })
        });
        const data = await response.json();
        currentQuizData = Array.isArray(data) ? data : getMockQuizData(topic);
        topicSelection.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        startSoloGame();
    } catch (e) {
        currentQuizData = getMockQuizData(topic);
        topicSelection.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        startSoloGame();
    } finally {
        topicSelection.innerHTML = originalContent;
        initTopicSelection();
    }
}

function startSoloGame() {
    currentQuestionIndex = 0;
    score = 0;
    wrongAnswers = [];
    endScreen.classList.add('hidden');
    soloGame.classList.remove('hidden');
    answersContainer.classList.remove('hidden');
    updateScore();
    displayQuestion();
}

function displayQuestion() {
    if (currentQuestionIndex >= currentQuizData.length) return showEndScreen();
    const q = currentQuizData[currentQuestionIndex];
    questionNumberEl.innerText = currentQuestionIndex + 1;
    totalQuestionsEl.innerText = currentQuizData.length;
    questionTextEl.innerText = q.question;
    answersContainer.innerHTML = '';
    q.answers.forEach(a => {
        const btn = document.createElement('button');
        btn.innerText = a;
        btn.className = "bg-gray-700 hover:bg-gray-600 p-4 rounded text-xl";
        btn.style.fontFamily = "'Press Start 2P', cursive";
        btn.onclick = () => {
            if (a === q.correct) score += 10;
            else wrongAnswers.push(q);
            currentQuestionIndex++;
            updateScore();
            displayQuestion();
        };
        answersContainer.appendChild(btn);
    });
}

function updateScore() { scoreEl.innerText = score; }

async function showEndScreen() {
    soloGame.classList.add('hidden');
    endScreen.classList.remove('hidden');
    finalScoreEl.innerText = score;
    saveScoreSection.classList.remove('hidden');
    leaderboardSection.classList.add('hidden');
    aiReviewSection.classList.add('hidden');
    
    if (wrongAnswers.length > 0) {
        aiReviewSection.classList.remove('hidden');
        aiExplanationText.innerText = "AI가 해설을 작성 중입니다...";
        try {
            const res = await fetch('/api/explain', {
                method: 'POST',
                body: JSON.stringify({ wrongAnswers })
            });
            const data = await res.json();
            aiExplanationText.innerText = data.explanation;
        } catch (e) { aiExplanationText.innerText = "해설을 가져오지 못했습니다."; }
    }
}

// --- Battle Mode & Leaderboard Logic (Same as before) ---
function joinBattleRoom(roomId) {
    currentRoomId = roomId;
    battleSetup.classList.add('hidden');
    battleScreen.classList.remove('hidden');
    rtdb.ref(`rooms/${roomId}/players/${myPlayerId}`).set({ score: 0 });
    currentQuizData = getMockQuizData("BATTLE");
    displayBattleQuestion(0);
    rtdb.ref(`rooms/${roomId}`).on('value', (s) => {
        const data = s.val();
        if (!data || !data.players) return;
        let myS = 0, oppS = 0;
        Object.keys(data.players).forEach(k => {
            if (k === myPlayerId) myS = data.players[k].score || 0;
            else oppS = data.players[k].score || 0;
        });
        updateBattleBars(myS, oppS);
        battleStatus.innerText = Object.keys(data.players).length > 1 ? "BATTLE!" : "WAITING...";
        battleAnswersContainer.classList.toggle('pointer-events-none', Object.keys(data.players).length < 2);
    });
}

function updateBattleBars(myS, oppS) {
    let myW = 50 + (myS - oppS) * 2;
    myW = Math.max(10, Math.min(90, myW));
    anime({ targets: '#player-bar', width: `${myW}%`, duration: 800 });
    anime({ targets: '#opponent-bar', width: `${100 - myW}%`, duration: 800 });
}

function displayBattleQuestion(i) {
    const q = currentQuizData[i % currentQuizData.length];
    battleQuestionText.innerText = q.question;
    battleAnswersContainer.innerHTML = '';
    q.answers.forEach(a => {
        const btn = document.createElement('button');
        btn.innerText = a;
        btn.className = "bg-gray-700 p-4 rounded";
        btn.onclick = () => {
            if (a === q.correct) rtdb.ref(`rooms/${currentRoomId}/players/${myPlayerId}/score`).transaction(s => (s || 0) + 10);
            displayBattleQuestion(i + 1);
        };
        battleAnswersContainer.appendChild(btn);
    });
}

function fetchAndDisplayLeaderboard() {
    leaderboardSection.classList.remove('hidden');
    db.collection("scores").orderBy("score", "desc").limit(10).get().then(s => {
        leaderboardList.innerHTML = '';
        s.forEach((doc, i) => {
            const d = doc.data();
            const li = document.createElement('li');
            li.innerHTML = `<span>#${i+1} ${d.name}</span> <span class="float-right text-green-400">${d.score}</span>`;
            leaderboardList.appendChild(li);
        });
    });
}

function getMockQuizData(t) {
    return [
        { question: `${t}에 대한 첫 번째 문제입니다.`, answers: ["정답", "오답1", "오답2", "오답3"], correct: "정답" },
        { question: `${t}에 대한 두 번째 문제입니다.`, answers: ["정답", "오답1", "오답2", "오답3"], correct: "정답" }
    ];
}