// DOM Elements
const modeSelection = document.getElementById('mode-selection');
const topicSelection = document.getElementById('topic-selection');
const topicsGrid = document.getElementById('topics-grid');
const gameScreen = document.getElementById('game-screen');
const soloGame = document.getElementById('solo-game');
const battleModeBtn = document.getElementById('battle-mode-btn');
const soloModeBtn = document.getElementById('solo-mode-btn');
const backToMenuBtn = document.getElementById('back-to-menu');

// New Navigation Buttons
const backToMenuFromTopic = document.getElementById('back-to-menu-from-topic');
const backToMenuFromBattle = document.getElementById('back-to-menu-from-battle');
const quitBattleBtn = document.getElementById('quit-battle-btn');

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
let currentDifficulty = 'Medium';
let currentLanguage = 'ko'; // 'ko' or 'en'

const TRANSLATIONS = {
    ko: {
        soloMode: "SOLO MODE",
        battleMode: "BATTLE MODE",
        chooseTopic: "CHOOSE TOPIC",
        backToMenu: "BACK TO MENU",
        enterRoomId: "ENTER ROOM ID",
        joinBattle: "JOIN BATTLE",
        quitBattle: "QUIT BATTLE",
        quitGame: "QUIT GAME",
        gameOver: "GAME OVER",
        finalScore: "FINAL SCORE",
        save: "SAVE",
        playAgain: "PLAY AGAIN",
        share: "SHARE IMAGE",
        topRanking: "TOP 10 RANKING",
        aiReview: "AI REVIEW",
        generating: "GENERATING QUIZ...",
        fight: "FIGHT!",
        waiting: "WAITING...",
        loading: "LOADING..."
    },
    en: {
        soloMode: "SOLO MODE",
        battleMode: "BATTLE MODE",
        chooseTopic: "CHOOSE TOPIC",
        backToMenu: "BACK TO MENU",
        enterRoomId: "ENTER ROOM ID",
        joinBattle: "JOIN BATTLE",
        quitBattle: "QUIT BATTLE",
        quitGame: "QUIT GAME",
        gameOver: "GAME OVER",
        finalScore: "FINAL SCORE",
        save: "SAVE",
        playAgain: "PLAY AGAIN",
        share: "SHARE IMAGE",
        topRanking: "TOP 10 RANKING",
        aiReview: "AI REVIEW",
        generating: "GENERATING QUIZ...",
        fight: "FIGHT!",
        waiting: "WAITING...",
        loading: "LOADING..."
    }
};

const TOPICS = [
    { id: "history", name: "한국사", nameEn: "World History", icon: "🇰🇷", iconEn: "🌍" },
    { id: "general", name: "일반상식", nameEn: "General Knowledge", icon: "🧠", iconEn: "💡" },
    { id: "science", name: "과학", nameEn: "Science", icon: "🧪", iconEn: "🔬" },
    { id: "sports", name: "스포츠", nameEn: "Sports", icon: "⚽", iconEn: "🏆" },
    { id: "movies", name: "영화", nameEn: "Movies", icon: "🎬", iconEn: "🍿" },
    { id: "music", name: "음악", nameEn: "Music", icon: "🎵", iconEn: "🎸" },
    { id: "geography", name: "지리/여행", nameEn: "Geography", icon: "🗺️", iconEn: "✈️" }
];

// --- Initialization ---
function initTopicSelection() {
    // ... (rest of the logic) ...
}

function renderTopics() {
    if (!topicsGrid) return;
    topicsGrid.innerHTML = '';
    TOPICS.forEach(topic => {
        const btn = document.createElement('button');
        const displayName = currentLanguage === 'ko' ? topic.name : topic.nameEn;
        const displayIcon = currentLanguage === 'ko' ? topic.icon : (topic.iconEn || topic.icon);
        
        btn.innerHTML = `<div class="text-3xl mb-2">${displayIcon}</div><div class="text-sm">${displayName}</div>`;
        btn.className = "bg-gray-800 hover:bg-gray-700 text-white p-6 rounded-xl border-2 border-transparent hover:border-blue-500 transition-all flex flex-col items-center justify-center";
        btn.style.fontFamily = "'Press Start 2P', cursive";
        btn.addEventListener('click', () => fetchQuiz(topic.id)); // Send unique ID (history, science, etc.)
        topicsGrid.appendChild(btn);
    });
}

function updateLanguageUI() {
    const t = TRANSLATIONS[currentLanguage];
    
    // Update simple text elements
    if(soloModeBtn) soloModeBtn.innerText = t.soloMode;
    if(battleModeBtn) battleModeBtn.innerText = t.battleMode;
    document.querySelector('#topic-selection h2').innerText = t.chooseTopic;
    if(backToMenuFromTopic) backToMenuFromTopic.innerText = t.backToMenu;
    if(backToMenuFromBattle) backToMenuFromBattle.innerText = t.backToMenu;
    if(quitBattleBtn) quitBattleBtn.innerText = t.quitBattle;
    if(backToMenuBtn) backToMenuBtn.innerText = t.quitGame;
    document.querySelector('#end-screen h2').innerText = t.gameOver;
    document.querySelector('#end-screen p').innerHTML = `${t.finalScore}: <span id="final-score" class="text-green-400">${score}</span>`;
    if(saveScoreBtn) saveScoreBtn.innerText = t.save;
    if(playAgainBtn) playAgainBtn.innerText = t.playAgain;
    if(shareImgBtn) shareImgBtn.innerText = t.share;
    document.querySelector('#leaderboard-section h3').innerText = t.topRanking;
    document.querySelector('#ai-review-section h3 span:last-child').innerText = t.aiReview;

    renderTopics();
}

initTopicSelection();
// Call updateLanguageUI once to set initial text
updateLanguageUI();

// --- Firebase Initialization ---
try {
    if (typeof firebase !== 'undefined' && typeof firebaseConfig !== 'undefined') {
        const app = firebase.initializeApp(firebaseConfig);
        db = firebase.firestore(app);
        rtdb = firebase.database(app);
        console.log("Firebase initialized successfully");
    }
} catch (e) { console.error(e); }


// --- Navigation Functions ---
function resetToMainMenu() {
    modeSelection.classList.remove('hidden');
    topicSelection.classList.add('hidden');
    battleSetup.classList.add('hidden');
    battleScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    endScreen.classList.add('hidden');
    
    // Clean up battle if active
    if (currentRoomId && rtdb) {
        rtdb.ref(`rooms/${currentRoomId}/players/${myPlayerId}`).remove();
        rtdb.ref(`rooms/${currentRoomId}`).off();
        currentRoomId = null;
    }
}

// --- Event Listeners ---
soloModeBtn.addEventListener('click', () => {
    modeSelection.classList.add('hidden');
    topicSelection.classList.remove('hidden');
});

battleModeBtn.addEventListener('click', () => {
    modeSelection.classList.add('hidden');
    battleSetup.classList.remove('hidden');
});

// Back Buttons
if (backToMenuFromTopic) backToMenuFromTopic.addEventListener('click', resetToMainMenu);
if (backToMenuFromBattle) backToMenuFromBattle.addEventListener('click', resetToMainMenu);
if (quitBattleBtn) quitBattleBtn.addEventListener('click', resetToMainMenu);
if (backToMenuBtn) backToMenuBtn.addEventListener('click', resetToMainMenu); // Quit Game button

joinRoomBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim();
    if (roomId) joinBattleRoom(roomId);
    else alert("Please enter a Room ID");
});

playAgainBtn.addEventListener('click', () => {
    endScreen.classList.add('hidden');
    topicSelection.classList.remove('hidden'); // Go back to topic selection
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
    } catch (e) { 
        console.error(e);
        alert("Failed to save score");
        saveScoreBtn.disabled = false;
    }
});

shareImgBtn.addEventListener('click', async () => {
    try {
        const element = document.getElementById('end-screen');
        const canvas = await html2canvas(element, { backgroundColor: '#111827', scale: 2 });
        const dataUrl = canvas.toDataURL('image/png');
        
        // Mobile Share API
        if (navigator.share) {
            const blob = await (await fetch(dataUrl)).blob();
            const file = new File([blob], 'quiz-result.png', { type: 'image/png' });
            await navigator.share({
                title: 'AI QUIZ BATTLE',
                text: `I scored ${score} points! #AIQuizBattle`,
                files: [file]
            });
        } else {
            // Desktop Download
            const link = document.createElement('a');
            link.download = `quiz-result-${Date.now()}.png`;
            link.href = dataUrl;
            link.click();
        }
    } catch (e) {
        console.error("Share failed", e);
        alert("Image share failed. Please try a screenshot.");
    }
});

// --- Solo Game Logic ---
async function fetchQuiz(topicId) {
    const originalContent = topicSelection.innerHTML;
    const t = TRANSLATIONS[currentLanguage];
    
    // Display name logic for loading screen
    const topicObj = TOPICS.find(tp => tp.id === topicId);
    const displayTopic = currentLanguage === 'ko' ? topicObj.name : topicObj.nameEn;

    topicSelection.innerHTML = `
        <div class="flex flex-col items-center justify-center space-y-8 py-20">
            <div class="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-blue-500"></div>
            <p class="text-xl animate-pulse text-blue-400" style="font-family: 'Press Start 2P', cursive;">${t.generating}<br>${displayTopic}</p>
        </div>`;

    try {
        const response = await fetch('/api/generate-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: topicId, difficulty: currentDifficulty, lang: currentLanguage })
        });
        
        if (!response.ok) throw new Error("API Error");
        
        const data = await response.json();
        currentQuizData = (Array.isArray(data) && data.length > 0) ? data : getMockQuizData(topic);
        
        topicSelection.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        startSoloGame();
    } catch (e) {
        console.warn("Using mock data due to error", e);
        // Fallback to mock data immediately
        currentQuizData = getMockQuizData(topic);
        topicSelection.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        startSoloGame();
    } finally {
        // Restore UI for next time
        setTimeout(() => {
            topicSelection.innerHTML = originalContent;
            initTopicSelection();
        }, 500);
    }
}

function startSoloGame() {
    currentQuestionIndex = 0;
    score = 0;
    wrongAnswers = [];
    endScreen.classList.add('hidden');
    
    // Reset UI
    saveScoreSection.classList.remove('hidden');
    leaderboardSection.classList.add('hidden');
    aiReviewSection.classList.add('hidden');
    playerNameInput.value = "";
    saveScoreBtn.disabled = false;
    
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
    
    // Randomize answers order if you want, but AI usually gives them fixed.
    // Let's keep AI order for now or shuffle if needed.
    
    q.answers.forEach(a => {
        const btn = document.createElement('button');
        btn.innerText = a;
        btn.className = "bg-gray-700 hover:bg-gray-600 text-white p-6 rounded-xl text-lg md:text-xl transition-colors duration-200 border-b-4 border-gray-900 active:border-b-0 active:translate-y-1";
        btn.style.fontFamily = "'Press Start 2P', cursive";
        btn.onclick = () => handleAnswer(a, q);
        answersContainer.appendChild(btn);
    });
}

function handleAnswer(selected, question) {
    const isCorrect = selected === question.correct;
    
    if (isCorrect) {
        score += 10;
        // Optional: Green flash on correct
    } else {
        wrongAnswers.push(question);
        // Optional: Red flash on wrong
    }
    
    // --- Record Statistics (Fire & Forget) ---
    if (db) {
        // Create a safe ID from the question text (remove special chars, limit length)
        const safeId = question.question.replace(/[^a-zA-Z0-9가-힣]/g, "").substring(0, 50);
        
        const statsRef = db.collection("question_stats").doc(safeId);
        
        statsRef.set({
            question: question.question,
            topic: question.topic || "Unknown", // Assuming topic is passed in question object or accessible
            lastPlayed: new Date()
        }, { merge: true });

        statsRef.update({
            totalAttempts: firebase.firestore.FieldValue.increment(1),
            correctCount: firebase.firestore.FieldValue.increment(isCorrect ? 1 : 0),
            wrongCount: firebase.firestore.FieldValue.increment(isCorrect ? 0 : 1)
        }).catch(e => console.log("Stats update failed (might be first time):", e));
    }

    currentQuestionIndex++;
    updateScore();
    displayQuestion();
}

function updateScore() { scoreEl.innerText = score; }

async function showEndScreen() {
    gameScreen.classList.add('hidden');
    endScreen.classList.remove('hidden');
    finalScoreEl.innerText = score;
    
    if (wrongAnswers.length > 0) {
        aiReviewSection.classList.remove('hidden');
        aiExplanationText.innerText = "AI IS ANALYZING YOUR MISTAKES...";
        
        try {
            const res = await fetch('/api/explain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wrongAnswers })
            });
            if (res.ok) {
                const data = await res.json();
                aiExplanationText.innerText = data.explanation;
            } else {
                aiExplanationText.innerText = "COULD NOT LOAD EXPLANATION.";
            }
        } catch (e) { 
            aiExplanationText.innerText = "AI CONNECTION FAILED."; 
        }
    }
}

// --- Battle Mode Logic ---
function joinBattleRoom(roomId) {
    if (!rtdb) return alert("Realtime DB Not Initialized");
    
    currentRoomId = roomId;
    battleSetup.classList.add('hidden');
    battleScreen.classList.remove('hidden');
    
    // Reset visual
    playerBar.style.width = '50%';
    opponentBar.style.width = '50%';
    battleStatus.innerText = "JOINING...";

    // Register Player
    rtdb.ref(`rooms/${roomId}/players/${myPlayerId}`).set({ 
        score: 0,
        lastActive: firebase.database.ServerValue.TIMESTAMP
    });
    
    // Use generic battle questions (or fetch from AI in future)
    currentQuizData = getMockQuizData("BATTLE");
    
    // Listen for updates
    rtdb.ref(`rooms/${roomId}`).on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data || !data.players) return;
        
        const players = data.players;
        const playerIds = Object.keys(players);
        
        let myScore = 0;
        let oppScore = 0;
        
        if (players[myPlayerId]) myScore = players[myPlayerId].score || 0;
        
        // Find opponent (anyone who is not me)
        const opponentId = playerIds.find(id => id !== myPlayerId);
        if (opponentId) oppScore = players[opponentId].score || 0;
        
        updateBattleBars(myScore, oppScore);
        
        if (playerIds.length >= 2) {
            battleStatus.innerText = "FIGHT!";
            battleStatus.classList.remove('animate-pulse');
            battleStatus.classList.add('text-red-500');
            battleAnswersContainer.classList.remove('opacity-50', 'pointer-events-none');
        } else {
            battleStatus.innerText = "WAITING FOR RIVAL...";
            battleStatus.classList.add('animate-pulse');
            battleStatus.classList.remove('text-red-500');
            battleAnswersContainer.classList.add('opacity-50', 'pointer-events-none');
        }
    });
    
    displayBattleQuestion(0);
}

function updateBattleBars(myS, oppS) {
    // Determine advantage
    // If scores are equal => 50%
    // If I have 10 more => 60%?
    // Let's say max diff of 50 points swings the bar fully
    const diff = myS - oppS;
    let myPercent = 50 + diff; // 1 point = 1% shift
    
    // Clamp
    myPercent = Math.max(5, Math.min(95, myPercent));
    
    anime({ targets: '#player-bar', width: `${myPercent}%`, duration: 500, easing: 'easeOutQuad' });
    anime({ targets: '#opponent-bar', width: `${100 - myPercent}%`, duration: 500, easing: 'easeOutQuad' });
}

function displayBattleQuestion(i) {
    // Infinite loop for battle
    const q = currentQuizData[i % currentQuizData.length];
    
    battleQuestionText.innerText = q.question;
    battleAnswersContainer.innerHTML = '';
    
    q.answers.forEach(a => {
        const btn = document.createElement('button');
        btn.innerText = a;
        btn.className = "bg-gray-700 hover:bg-gray-600 text-white p-4 rounded-lg font-bold transition-all active:scale-95";
        btn.style.fontFamily = "'Press Start 2P', cursive";
        btn.onclick = () => {
            if (a === q.correct) {
                // +10 points
                 rtdb.ref(`rooms/${currentRoomId}/players/${myPlayerId}/score`).transaction(s => (s || 0) + 10);
            } else {
                // -5 points (penalty)
                 rtdb.ref(`rooms/${currentRoomId}/players/${myPlayerId}/score`).transaction(s => Math.max(0, (s || 0) - 5));
            }
            displayBattleQuestion(i + 1);
        };
        battleAnswersContainer.appendChild(btn);
    });
}

function fetchAndDisplayLeaderboard() {
    leaderboardSection.classList.remove('hidden');
    leaderboardList.innerHTML = '<li class="text-center py-4">LOADING...</li>';
    
    db.collection("scores").orderBy("score", "desc").limit(10).get()
        .then(s => {
            leaderboardList.innerHTML = '';
            let rank = 1;
            s.forEach(doc => {
                const d = doc.data();
                const li = document.createElement('li');
                li.className = "flex justify-between items-center border-b border-gray-700 py-2 last:border-0";
                li.innerHTML = `
                    <div>
                        <span class="text-yellow-500 font-bold w-6 inline-block">${rank}.</span>
                        <span>${d.name}</span>
                    </div>
                    <span class="text-green-400 font-mono">${d.score}</span>
                `;
                leaderboardList.appendChild(li);
                rank++;
            });
            if (s.empty) leaderboardList.innerHTML = '<li class="text-center text-gray-500 py-4">NO RECORDS</li>';
        })
        .catch(e => {
            console.error(e);
            leaderboardList.innerHTML = '<li class="text-center text-red-500">ERROR</li>';
        });
}

function getMockQuizData(topic) {
    // Fallback questions in case AI fails
    if (topic === "한국사") {
        return [
            { question: "조선의 제1대 왕은 누구인가요?", answers: ["태조 이성계", "세종대왕", "정조", "연산군"], correct: "태조 이성계" },
            { question: "임진왜란이 일어난 해는?", answers: ["1392년", "1592년", "1910년", "1950년"], correct: "1592년" },
            { question: "훈민정음을 창제한 왕은?", answers: ["영조", "태종", "세종대왕", "고종"], correct: "세종대왕" }
        ];
    }
    if (topic === "과학") {
        return [
            { question: "물의 화학식은?", answers: ["CO2", "H2O", "O2", "NaCl"], correct: "H2O" },
            { question: "태양계에서 가장 큰 행성은?", answers: ["지구", "화성", "목성", "토성"], correct: "목성" },
            { question: "만유인력의 법칙을 발견한 사람은?", answers: ["뉴턴", "아인슈타인", "갈릴레이", "에디슨"], correct: "뉴턴" }
        ];
    }
    if (topic === "스포츠") {
        return [
            { question: "손흥민 선수의 소속팀은? (2024 기준)", answers: ["토트넘", "맨유", "첼시", "리버풀"], correct: "토트넘" },
            { question: "야구는 몇 명이서 하는 게임인가요?", answers: ["9명", "11명", "5명", "7명"], correct: "9명" },
            { question: "월드컵은 몇 년마다 열리나요?", answers: ["2년", "3년", "4년", "5년"], correct: "4년" }
        ];
    }
    // Default generic questions for other topics
    return [
        { question: `${topic} 분야의 기초 문제입니다. 정답은 1번입니다.`, answers: ["정답", "오답", "오답", "오답"], correct: "정답" },
        { question: `${topic} 퀴즈가 AI 연결 문제로 대체되었습니다.`, answers: ["확인", "취소", "모름", "글쎄요"], correct: "확인" },
        { question: "다음 중 해당 주제와 관련 없는 것은?", answers: ["관련 없음", "관련 있음", "관련 있음", "관련 있음"], correct: "관련 없음" }
    ];
}
