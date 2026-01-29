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
    
    // Show lang buttons again
    const langSel = document.getElementById('lang-selection');
    if(langSel) langSel.classList.remove('hidden');

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
    const t = TRANSLATIONS[currentLanguage];
    const loadingScreen = document.getElementById('loading-screen');
    const loadingText = document.getElementById('loading-text');
    
    // Display name logic for loading screen
    const topicObj = TOPICS.find(tp => tp.id === topicId);
    const displayTopic = currentLanguage === 'ko' ? topicObj.name : topicObj.nameEn;

    // Show Loading
    topicSelection.classList.add('hidden');
    loadingScreen.classList.remove('hidden');
    if(loadingText) loadingText.innerHTML = `${t.generating}<br>${displayTopic}`;

    try {
        const payload = { topic: topicId, difficulty: currentDifficulty, lang: currentLanguage };
        console.log("Sending Request:", payload);

        const response = await fetch('/api/generate-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const debugInfo = response.headers.get('X-Debug-Log');
        if (debugInfo) {
            try {
                // Decode Base64 (Server sends: btoa(unescape(encodeURIComponent(JSON.stringify(debugLog)))))
                const decodedDebug = decodeURIComponent(escape(atob(debugInfo)));
                console.log("Server Debug Log:", JSON.parse(decodedDebug));
            } catch (e) {
                console.warn("Failed to parse debug log:", e);
                // Fallback for old cached versions or errors
                console.log("Raw Debug Header:", debugInfo);
            }
        }
        
        if (!response.ok) throw new Error("API Error");
        
        const data = await response.json();
        currentQuizData = (Array.isArray(data) && data.length > 0) ? data : getMockQuizData(topicId);
        
        loadingScreen.classList.add('hidden'); // Hide loading
        gameScreen.classList.remove('hidden'); // Show game
        startSoloGame();
    } catch (e) {
        console.warn("Using mock data due to error", e);
        currentQuizData = getMockQuizData(topicId);
        
        loadingScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        startSoloGame();
    }
}

function startSoloGame() {
    currentQuestionIndex = 0;
    score = 0;
    wrongAnswers = [];
    endScreen.classList.add('hidden');
    
    // Hide top navigation during game
    const langSel = document.getElementById('lang-selection');
    if(langSel) langSel.classList.add('hidden');
    
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

// --- Audio System (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    if (type === 'correct') {
        // High pitched 'Ding'
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(1046.5, audioCtx.currentTime + 0.1); // C6
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'wrong') {
        // Low pitched 'Buzz'
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'win') {
        // Victory Fanfare
        const now = audioCtx.currentTime;
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.connect(g);
            g.connect(audioCtx.destination);
            o.type = 'triangle';
            o.frequency.value = freq;
            g.gain.setValueAtTime(0.2, now + i*0.1);
            g.gain.exponentialRampToValueAtTime(0.01, now + i*0.1 + 0.4);
            o.start(now + i*0.1);
            o.stop(now + i*0.1 + 0.4);
        });
    }
}

function handleAnswer(selected, question) {
    const isCorrect = selected === question.correct;
    
    console.log(`[DEBUG] Answered: "${selected}" | Correct: "${question.correct}" | Result: ${isCorrect ? 'PASS' : 'FAIL'}`);

    if (isCorrect) {
        score += 10;
        playSound('correct'); // Sound Effect
        // Visual Feedback: Green
        const buttons = answersContainer.getElementsByTagName('button');
        for (let btn of buttons) {
            if (btn.innerText === selected) {
                btn.classList.remove('bg-gray-700', 'hover:bg-gray-600');
                btn.classList.add('bg-green-600');
            }
        }
    } else {
        wrongAnswers.push(question);
        playSound('wrong'); // Sound Effect
        // Visual Feedback: Red
        const buttons = answersContainer.getElementsByTagName('button');
        for (let btn of buttons) {
            if (btn.innerText === selected) {
                btn.classList.remove('bg-gray-700', 'hover:bg-gray-600');
                btn.classList.add('bg-red-600');
            }
            // Show correct one as well
            if (btn.innerText === question.correct) {
                btn.classList.remove('bg-gray-700', 'hover:bg-gray-600');
                btn.classList.add('bg-green-600', 'ring-2', 'ring-white');
            }
        }
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

    // Delay next question slightly to show feedback
    setTimeout(() => {
        currentQuestionIndex++;
        updateScore();
        displayQuestion();
    }, 1000);
}

function updateScore() { scoreEl.innerText = score; }

async function showEndScreen() {
    gameScreen.classList.add('hidden');
    endScreen.classList.remove('hidden');
    finalScoreEl.innerText = score;
    console.log(`[DEBUG] Final Score: ${score} | Wrong Answers: ${wrongAnswers.length}`);
    
    // Confetti Effect for High Score
    if (score >= 70) {
        playSound('win');
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 }
        });
    }

    if (wrongAnswers.length > 0) {
        aiReviewSection.classList.remove('hidden');
        aiExplanationText.innerText = "AI IS ANALYZING YOUR MISTAKES...";
        
        try {
            const res = await fetch('/api/explain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wrongAnswers, lang: currentLanguage })
            });
            if (res.ok) {
                const data = await res.json();
                aiExplanationText.innerText = data.explanation;
            } else {
                const errText = await res.text();
                console.error("[DEBUG] Explain API Error:", errText);
                aiExplanationText.innerText = `ERROR: ${res.status} - ${errText.slice(0, 50)}`;
            }
        } catch (e) { 
            console.error("[DEBUG] Explain Fetch Failed:", e);
            aiExplanationText.innerText = `CONNECTION FAILED: ${e.message}`; 
        }
    } else {
        // Perfect Score
        aiReviewSection.classList.remove('hidden');
        aiExplanationText.innerText = currentLanguage === 'ko' ? "완벽합니다! 모든 문제를 맞히셨습니다. 🎉" : "Perfect! You got everything right. 🎉";
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
    if (currentLanguage === 'ko') {
        // Emergency Fallback: Korean Mock Data
        return [
            { question: "현재 AI 서버 연결이 지연되고 있습니다. 이 문제는 비상용 샘플 문제입니다.", answers: ["확인", "취소", "무시", "모름"], correct: "확인" },
            { question: "임진왜란이 일어난 해는 언제인가요?", answers: ["1592년", "1950년", "1392년", "1894년"], correct: "1592년" },
            { question: "대한민국의 수도는 어디인가요?", answers: ["서울", "부산", "인천", "대구"], correct: "서울" },
            { question: "BTS의 멤버가 아닌 사람은?", answers: ["싸이", "RM", "정국", "지민"], correct: "싸이" },
            { question: "영화 '기생충'의 감독은?", answers: ["봉준호", "박찬욱", "이창동", "홍상수"], correct: "봉준호" },
            { question: "한글을 창제한 왕은?", answers: ["세종대왕", "태조", "영조", "정조"], correct: "세종대왕" },
            { question: "독도는 어느 나라 땅인가요?", answers: ["대한민국", "일본", "미국", "중국"], correct: "대한민국" },
            { question: "손흥민 선수가 소속된 리그는?", answers: ["프리미어리그", "라리가", "분데스리가", "세리에A"], correct: "프리미어리그" },
            { question: "물(H2O)을 구성하는 원소가 아닌 것은?", answers: ["탄소", "수소", "산소", "없음"], correct: "탄소" },
            { question: "대한민국의 국화(나라꽃)는?", answers: ["무궁화", "장미", "진달래", "벚꽃"], correct: "무궁화" }
        ];
    }
    
    // English Mock Data
    return [
        { question: "Server is busy. This is a sample question.", answers: ["OK", "Cancel", "Ignore", "Unknown"], correct: "OK" },
        { question: "What is the capital of South Korea?", answers: ["Seoul", "Busan", "Incheon", "Daegu"], correct: "Seoul" },
        { question: "Which year did WW2 end?", answers: ["1945", "1939", "1918", "1950"], correct: "1945" },
        { question: "Who directed the movie 'Parasite'?", answers: ["Bong Joon-ho", "Park Chan-wook", "Lee Chang-dong", "Hong Sang-soo"], correct: "Bong Joon-ho" },
        { question: "What is the chemical formula for water?", answers: ["H2O", "CO2", "NaCl", "O2"], correct: "H2O" }
    ];
}

// Start the app
initApp();