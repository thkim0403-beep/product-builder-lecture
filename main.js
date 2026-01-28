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
function initApp() {
    initStaticEventListeners();
    renderTopics();
    initTopicScreenListeners();
    updateLanguageUI();
    
    // Ensure visual state matches initial 'ko' state
    const koBtn = document.querySelector('.lang-btn[data-lang="ko"]');
    if(koBtn) {
        const allBtns = document.querySelectorAll('.lang-btn');
        allBtns.forEach(b => {
            b.classList.remove('ring-2', 'ring-yellow-400', 'scale-105');
            b.style.opacity = '0.6';
        });
        koBtn.classList.add('ring-2', 'ring-yellow-400', 'scale-105');
        koBtn.style.opacity = '1';
    }
}

function initStaticEventListeners() {
    // Language Buttons (Static)
    const langBtns = document.querySelectorAll('.lang-btn');
    langBtns.forEach(btn => {
        // Clone to remove old listeners (simple way to avoid duplicates)
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', () => {
            currentLanguage = newBtn.dataset.lang;
            updateLanguageUI();
            
            // Visual feedback
            const allBtns = document.querySelectorAll('.lang-btn');
            allBtns.forEach(b => {
                b.classList.remove('ring-2', 'ring-yellow-400', 'scale-105');
                b.style.opacity = '0.6';
            });
            newBtn.classList.add('ring-2', 'ring-yellow-400', 'scale-105');
            newBtn.style.opacity = '1';
        });
    });

    // Navigation Buttons
    if(soloModeBtn) soloModeBtn.onclick = () => {
        modeSelection.classList.add('hidden');
        topicSelection.classList.remove('hidden');
    };

    if(battleModeBtn) battleModeBtn.onclick = () => {
        modeSelection.classList.add('hidden');
        battleSetup.classList.remove('hidden');
    };

    // Back Buttons
    if (backToMenuFromBattle) backToMenuFromBattle.onclick = resetToMainMenu;
    if (quitBattleBtn) quitBattleBtn.onclick = resetToMainMenu;
    if (backToMenuBtn) backToMenuBtn.onclick = resetToMainMenu;

    // Battle Join
    if (joinRoomBtn) joinRoomBtn.onclick = () => {
        const roomId = roomIdInput.value.trim();
        if (roomId) joinBattleRoom(roomId);
        else alert("Please enter a Room ID");
    };
    
    // Play Again
    if (playAgainBtn) playAgainBtn.onclick = () => {
        endScreen.classList.add('hidden');
        topicSelection.classList.remove('hidden');
    };

    // Save Score
    if (saveScoreBtn) saveScoreBtn.onclick = async () => {
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
    };

    // Share
    if (shareImgBtn) shareImgBtn.onclick = async () => {
        try {
            const element = document.getElementById('end-screen');
            const canvas = await html2canvas(element, { backgroundColor: '#111827', scale: 2 });
            const dataUrl = canvas.toDataURL('image/png');
            
            if (navigator.share) {
                const blob = await (await fetch(dataUrl)).blob();
                const file = new File([blob], 'quiz-result.png', { type: 'image/png' });
                await navigator.share({
                    title: 'AI QUIZ BATTLE',
                    text: `I scored ${score} points! #AIQuizBattle`,
                    files: [file]
                });
            } else {
                const link = document.createElement('a');
                link.download = `quiz-result-${Date.now()}.png`;
                link.href = dataUrl;
                link.click();
            }
        } catch (e) {
            console.error("Share failed", e);
            alert("Image share failed. Please try a screenshot.");
        }
    };
}

function initTopicScreenListeners() {
    // Difficulty Buttons
    const difficultyBtns = document.querySelectorAll('.difficulty-btn');
    difficultyBtns.forEach(btn => {
        btn.onclick = () => {
            currentDifficulty = btn.dataset.level;
            difficultyBtns.forEach(b => {
                b.classList.remove('ring-4', 'ring-yellow-400', 'scale-110');
                b.style.opacity = '0.6';
            });
            btn.classList.add('ring-4', 'ring-yellow-400', 'scale-110');
            btn.style.opacity = '1';
        };
        
        // Initial Visual State
        if(btn.dataset.level === currentDifficulty) {
             btn.classList.add('ring-4', 'ring-yellow-400', 'scale-110');
             btn.style.opacity = '1';
        } else {
             btn.style.opacity = '0.6';
        }
    });

    // Back Button inside Topic Selection
    const backBtn = document.getElementById('back-to-menu-from-topic');
    if(backBtn) backBtn.onclick = resetToMainMenu;
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
        btn.addEventListener('click', () => fetchQuiz(topic.id)); 
        topicsGrid.appendChild(btn);
    });
}

function updateLanguageUI() {
    const t = TRANSLATIONS[currentLanguage];
    
    if(soloModeBtn) soloModeBtn.innerText = t.soloMode;
    if(battleModeBtn) battleModeBtn.innerText = t.battleMode;
    
    const topicTitle = document.querySelector('#topic-selection h2');
    if(topicTitle) topicTitle.innerText = t.chooseTopic;
    
    // We need to re-select this button as it might have been recreated
    const backToMenuFromTopicDynamic = document.getElementById('back-to-menu-from-topic');
    if(backToMenuFromTopicDynamic) backToMenuFromTopicDynamic.innerText = t.backToMenu;
    
    if(backToMenuFromBattle) backToMenuFromBattle.innerText = t.backToMenu;
    if(quitBattleBtn) quitBattleBtn.innerText = t.quitBattle;
    if(backToMenuBtn) backToMenuBtn.innerText = t.quitGame;
    
    const endTitle = document.querySelector('#end-screen h2');
    if(endTitle) endTitle.innerText = t.gameOver;
    
    const endScoreP = document.querySelector('#end-screen p');
    if(endScoreP) endScoreP.innerHTML = `${t.finalScore}: <span id="final-score" class="text-green-400">${score}</span>`;
    
    if(saveScoreBtn) saveScoreBtn.innerText = t.save;
    if(playAgainBtn) playAgainBtn.innerText = t.playAgain;
    if(shareImgBtn) shareImgBtn.innerText = t.share;
    
    const lbTitle = document.getElementById('leaderboard-title');
    if(lbTitle) lbTitle.innerText = t.topRanking;
    
    const aiTitle = document.getElementById('ai-review-title');
    if(aiTitle) aiTitle.innerText = t.aiReview;

    renderTopics();
}

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

// --- Solo Game Logic ---
async function fetchQuiz(topicId) {
    const originalContent = topicSelection.innerHTML;
    const t = TRANSLATIONS[currentLanguage];
    
    const topicObj = TOPICS.find(tp => tp.id === topicId);
    const displayTopic = currentLanguage === 'ko' ? topicObj.name : topicObj.nameEn;

    topicSelection.innerHTML = `
        <div class="flex flex-col items-center justify-center space-y-8 py-20">
            <div class="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-blue-500"></div>
            <p class="text-xl animate-pulse text-blue-400" style="font-family: 'Press Start 2P', cursive;">${t.generating}<br>${displayTopic}</p>
        </div>`;

    try {
        const payload = { topic: topicId, difficulty: currentDifficulty, lang: currentLanguage };
        console.log("Sending Request:", payload); // Debug Log

        const response = await fetch('/api/generate-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        // Debug: Show server logs
        const debugInfo = response.headers.get('X-Debug-Log');
        if (debugInfo) {
            console.log("Server Debug Log:", JSON.parse(debugInfo));
            // alert("Server Debug: " + debugInfo); // Uncomment to see alert
        }
        
        if (!response.ok) throw new Error("API Error");
        
        const data = await response.json();
        currentQuizData = (Array.isArray(data) && data.length > 0) ? data : getMockQuizData(topicId);
        
        topicSelection.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        startSoloGame();
    } catch (e) {
        console.warn("Using mock data due to error", e);
        currentQuizData = getMockQuizData(topicId);
        topicSelection.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        startSoloGame();
    } finally {
        setTimeout(() => {
            topicSelection.innerHTML = originalContent;
            renderTopics();
            initTopicScreenListeners(); 
        }, 500);
    }
}

function startSoloGame() {
    currentQuestionIndex = 0;
    score = 0;
    wrongAnswers = [];
    endScreen.classList.add('hidden');
    
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
    } else {
        wrongAnswers.push(question);
    }
    
    // --- Record Statistics (Fire & Forget) ---
    if (db) {
        const safeId = question.question.replace(/[^a-zA-Z0-9가-힣]/g, "").substring(0, 50);
        const statsRef = db.collection("question_stats").doc(safeId);
        
        statsRef.set({
            question: question.question,
            topic: question.topic || "Unknown",
            lastPlayed: new Date()
        }, { merge: true });

        statsRef.update({
            totalAttempts: firebase.firestore.FieldValue.increment(1),
            correctCount: firebase.firestore.FieldValue.increment(isCorrect ? 1 : 0),
            wrongCount: firebase.firestore.FieldValue.increment(isCorrect ? 0 : 1)
        }).catch(e => console.log("Stats update failed:", e));
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
    
    playerBar.style.width = '50%';
    opponentBar.style.width = '50%';
    battleStatus.innerText = "JOINING...";

    rtdb.ref(`rooms/${roomId}/players/${myPlayerId}`).set({ 
        score: 0,
        lastActive: firebase.database.ServerValue.TIMESTAMP
    });
    
    currentQuizData = getMockQuizData("BATTLE");
    
    rtdb.ref(`rooms/${roomId}`).on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data || !data.players) return;
        
        const players = data.players;
        const playerIds = Object.keys(players);
        
        let myScore = 0;
        let oppScore = 0;
        
        if (players[myPlayerId]) myScore = players[myPlayerId].score || 0;
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
    const diff = myS - oppS;
    let myPercent = 50 + diff;
    myPercent = Math.max(5, Math.min(95, myPercent));
    
    anime({ targets: '#player-bar', width: `${myPercent}%`, duration: 500, easing: 'easeOutQuad' });
    anime({ targets: '#opponent-bar', width: `${100 - myPercent}%`, duration: 500, easing: 'easeOutQuad' });
}

function displayBattleQuestion(i) {
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
                 rtdb.ref(`rooms/${currentRoomId}/players/${myPlayerId}/score`).transaction(s => (s || 0) + 10);
            } else {
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
    if (topic === "history") {
        return [
            { question: "조선의 제1대 왕은 누구인가요?", answers: ["태조 이성계", "세종대왕", "정조", "연산군"], correct: "태조 이성계" },
            { question: "임진왜란이 일어난 해는?", answers: ["1392년", "1592년", "1910년", "1950년"], correct: "1592년" },
            { question: "훈민정음을 창제한 왕은?", answers: ["영조", "태종", "세종대왕", "고종"], correct: "세종대왕" }
        ];
    }
    return [
        { question: `Mock Question for ${topic}`, answers: ["A", "B", "C", "D"], correct: "A" }
    ];
}

// Start the app
initApp();