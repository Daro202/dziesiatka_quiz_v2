console.log("Dziesiątka game.js działa — wersja serwerowa v2");

const defaultState = {
    currentRound: "WARM UP",
    question: "",
    answer: "",
    answerVisible: false,
    currentPlayerId: null,
    players: [],
    allQuestions: [],
    questionSet: "all",
    usedQuestionIds: []
};

let currentState = structuredClone(defaultState);
let lastLocalSaveAt = 0;

function isAdminPage() {
    return document.getElementById("adminPlayers") !== null;
}

function isAudiencePage() {
    return document.getElementById("audienceQuestion") !== null;
}

function apiPath(path) {
    return path;
}

function loadState() {
    return structuredClone(currentState);
}

async function fetchStateFromServer() {
    try {
        const response = await fetch(apiPath("api/state"), {
            method: "GET",
            cache: "no-store"
        });

        const data = await response.json();

        if (!data.ok) {
            console.error("Błąd pobierania stanu:", data.error);
            return;
        }

        currentState = data.state;
        renderAll(currentState);

    } catch (error) {
        console.error("Nie udało się pobrać stanu z serwera:", error);
    }
}

async function saveState(state) {
    currentState = structuredClone(state);
    lastLocalSaveAt = Date.now();

    renderAll(currentState);

    try {
        const response = await fetch(apiPath("api/state"), {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(currentState)
        });

        const data = await response.json();

        if (!data.ok) {
            console.error("Błąd zapisu stanu:", data.error);
            alert("Nie udało się zapisać stanu gry na serwerze.");
            return;
        }

        currentState = data.state;
        renderAll(currentState);

    } catch (error) {
        console.error("Nie udało się zapisać stanu na serwerze:", error);
        alert("Nie udało się połączyć z serwerem przy zapisie stanu gry.");
    }
}

function setRound(roundName) {
    const state = loadState();

    state.currentRound = roundName;
    state.question = "";
    state.answer = "";
    state.answerVisible = false;

    saveState(state);
}

async function loadQuestionsFromExcel() {
    try {
        const response = await fetch(apiPath("api/questions"), {
            method: "GET",
            cache: "no-store"
        });

        const data = await response.json();

        if (!data.ok) {
            alert("Błąd ładowania pytań: " + data.error);
            return;
        }

        const questionSetSelect = document.getElementById("questionSet");
        const selectedSet = questionSetSelect ? questionSetSelect.value : "all";

        const state = loadState();
        state.allQuestions = data.questions;
        state.questionSet = selectedSet;
        state.usedQuestionIds = [];
        state.question = "";
        state.answer = "";
        state.answerVisible = false;

        await saveState(state);

        alert(`Załadowano pytań: ${data.count}`);

    } catch (error) {
        console.error(error);
        alert("Nie udało się załadować pytań z Excela.");
    }
}

function getFilteredQuestions(state) {
    return state.allQuestions.filter(q => {
        if (q.round !== state.currentRound) {
            return false;
        }

        if (state.usedQuestionIds.includes(q.id)) {
            return false;
        }

        if (state.questionSet === "all") {
            return true;
        }

        const value = String(q[state.questionSet] || "").trim();
        return value === "1";
    });
}

function drawQuestionForCurrentRound() {
    const state = loadState();

    if (!state.allQuestions || state.allQuestions.length === 0) {
        alert("Najpierw załaduj pytania z Excela.");
        return;
    }

    const questionSetSelect = document.getElementById("questionSet");
    if (questionSetSelect) {
        state.questionSet = questionSetSelect.value;
    }

    const availableQuestions = getFilteredQuestions(state);

    if (availableQuestions.length === 0) {
        alert("Brak dostępnych pytań w tej rundzie i zestawie.");
        return;
    }

    const randomIndex = Math.floor(Math.random() * availableQuestions.length);
    const selectedQuestion = availableQuestions[randomIndex];

    state.question = selectedQuestion.question;
    state.answer = selectedQuestion.answer;
    state.answerVisible = false;

    if (!state.usedQuestionIds) {
        state.usedQuestionIds = [];
    }

    state.usedQuestionIds.push(selectedQuestion.id);

    saveState(state);
}

function updateQuestionsInfo(state) {
    const infoEl = document.getElementById("questionsInfo");
    if (!infoEl) return;

    const available = getFilteredQuestions(state).length;
    const used = state.usedQuestionIds ? state.usedQuestionIds.length : 0;
    const total = state.allQuestions ? state.allQuestions.length : 0;

    infoEl.textContent =
        `Załadowano: ${total} | Runda: ${state.currentRound} | Zestaw: ${state.questionSet} | Dostępne: ${available} | Użyte: ${used}`;
}

function updateHostPreview(state) {
    const previewQuestionEl = document.getElementById("hostPreviewQuestion");
    const previewAnswerEl = document.getElementById("hostPreviewAnswer");

    if (!previewQuestionEl || !previewAnswerEl) return;

    previewQuestionEl.textContent = state.question || "Brak pytania.";
    previewAnswerEl.textContent = state.answer || "Brak odpowiedzi.";
}

function updateRoundButtons(state) {
    const roundToId = {
        "WARM UP": "round-WARM-UP",
        "SURVIVAL": "round-SURVIVAL",
        "MANDATORY": "round-MANDATORY",
        "BATTLE": "round-BATTLE"
    };

    const roundButtons = document.querySelectorAll(".round-buttons button");

    roundButtons.forEach(button => {
        button.classList.remove("active-round");

        button.style.background = "";
        button.style.color = "";
        button.style.fontWeight = "";
        button.style.border = "";
        button.style.boxShadow = "";
    });

    const activeButton = document.getElementById(roundToId[state.currentRound]);

    if (activeButton) {
        activeButton.classList.add("active-round");
    }
}

function startPlayers() {
    const input = document.getElementById("playersInput");
    if (!input) return;

    const names = input.value
        .split("\n")
        .map(x => x.trim())
        .filter(x => x.length > 0);

    const players = names.map((name, index) => ({
        id: index + 1,
        name: name,
        points: 0,
        lives: 2,
        active: true
    }));

    const state = loadState();
    state.players = players;
    state.currentPlayerId = players.length > 0 ? players[0].id : null;
    state.question = "";
    state.answer = "";
    state.answerVisible = false;

    saveState(state);
}

function selectPlayer(playerId) {
    const state = loadState();
    const player = state.players.find(p => p.id === playerId);

    if (!player || !player.active) return;

    state.currentPlayerId = playerId;
    state.question = "";
    state.answer = "";
    state.answerVisible = false;

    saveState(state);
}

function nextActivePlayer() {
    const state = loadState();

    const activePlayers = state.players.filter(p => p.active);

    if (activePlayers.length === 0) {
        state.currentPlayerId = null;
        saveState(state);
        return;
    }

    if (state.currentPlayerId === null) {
        state.currentPlayerId = activePlayers[0].id;
        state.question = "";
        state.answer = "";
        state.answerVisible = false;
        saveState(state);
        return;
    }

    const currentIndexInAllPlayers = state.players.findIndex(p => p.id === state.currentPlayerId);

    let nextPlayer = null;

    for (let i = 1; i <= state.players.length; i++) {
        const nextIndex = (currentIndexInAllPlayers + i) % state.players.length;
        const candidate = state.players[nextIndex];

        if (candidate.active) {
            nextPlayer = candidate;
            break;
        }
    }

    if (nextPlayer) {
        state.currentPlayerId = nextPlayer.id;
        state.question = "";
        state.answer = "";
        state.answerVisible = false;
    }

    saveState(state);
}

function showQuestion() {
    const questionInput = document.getElementById("questionInput");
    const answerInput = document.getElementById("answerInput");

    if (!questionInput || !answerInput) return;

    const state = loadState();
    state.question = questionInput.value;
    state.answer = answerInput.value;
    state.answerVisible = false;

    saveState(state);
}

function revealAnswer() {
    const state = loadState();

    if (!state.question) {
        alert("Najpierw pokaż albo wylosuj pytanie.");
        return;
    }

    state.answerVisible = true;
    saveState(state);
}

function markCorrect() {
    const state = loadState();
    const player = state.players.find(p => p.id === state.currentPlayerId);

    if (player && player.active) {
        player.points += 1;
    }

    saveState(state);
}

function markWrong() {
    const state = loadState();
    const player = state.players.find(p => p.id === state.currentPlayerId);

    if (player && player.active) {
        player.lives -= 1;

        if (player.lives <= 0) {
            player.lives = 0;
            player.active = false;
        }
    }

    saveState(state);
}

async function resetGame() {
    const confirmed = confirm("Czy na pewno zresetować całą grę?");

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(apiPath("api/reset-state"), {
            method: "POST"
        });

        const data = await response.json();

        if (!data.ok) {
            alert("Nie udało się zresetować gry.");
            return;
        }

        currentState = data.state;
        renderAll(currentState);

    } catch (error) {
        console.error(error);
        alert("Nie udało się połączyć z serwerem przy resecie gry.");
    }
}

function getCurrentPlayer(state) {
    return state.players.find(p => p.id === state.currentPlayerId) || null;
}

function renderAdmin(state) {
    const adminPlayers = document.getElementById("adminPlayers");

    if (adminPlayers) {
        adminPlayers.innerHTML = "";

        state.players.forEach(player => {
            const btn = document.createElement("button");
            btn.className = "player-button";

            if (player.id === state.currentPlayerId) {
                btn.classList.add("selected");
            }

            if (!player.active) {
                btn.classList.add("eliminated");
            }

            btn.textContent = `${player.name} | pkt: ${player.points} | życia: ${player.lives}`;
            btn.onclick = () => selectPlayer(player.id);

            adminPlayers.appendChild(btn);
        });
    }

    updateQuestionsInfo(state);
    updateHostPreview(state);
    updateRoundButtons(state);
}

function renderAudience(state) {
    const questionEl = document.getElementById("audienceQuestion");
    const answerEl = document.getElementById("audienceAnswer");
    const currentPlayerEl = document.getElementById("audienceCurrentPlayer");
    const playersEl = document.getElementById("audiencePlayers");
    const roundEl = document.getElementById("audienceRound");

    if (!questionEl || !answerEl || !currentPlayerEl || !playersEl || !roundEl) return;

    const currentPlayer = getCurrentPlayer(state);

    roundEl.textContent = state.currentRound || "---";
    currentPlayerEl.textContent = currentPlayer ? currentPlayer.name : "---";
    questionEl.textContent = state.question || "Czekamy na pytanie...";

    if (state.answerVisible && state.answer) {
        answerEl.textContent = state.answer;
        answerEl.classList.remove("hidden");
    } else {
        answerEl.textContent = "Odpowiedź ukryta";
        answerEl.classList.add("hidden");
    }

    playersEl.innerHTML = "";

    state.players.forEach(player => {
        const card = document.createElement("div");
        card.className = "player-card";

        if (player.id === state.currentPlayerId) {
            card.classList.add("selected");
        }

        if (!player.active) {
            card.classList.add("eliminated");
        }

        card.innerHTML = `
            <div class="player-name">${player.name}</div>
            <div>Punkty: ${player.points}</div>
            <div>Życia: ${"❤️".repeat(player.lives)}${player.lives === 0 ? "—" : ""}</div>
        `;

        playersEl.appendChild(card);
    });
}

function renderAll(state) {
    renderAdmin(state);
    renderAudience(state);
}

function readCurrentQuestion() {
    const state = loadState();

    if (!state.question) {
        alert("Nie ma pytania do przeczytania.");
        return;
    }

    const utterance = new SpeechSynthesisUtterance(state.question);
    utterance.lang = "pl-PL";
    utterance.rate = 0.9;
    utterance.pitch = 1;

    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
}

function readCurrentAnswer() {
    const state = loadState();

    if (!state.answer) {
        alert("Nie ma odpowiedzi do przeczytania.");
        return;
    }

    const utterance = new SpeechSynthesisUtterance(state.answer);
    utterance.lang = "pl-PL";
    utterance.rate = 0.9;
    utterance.pitch = 1;

    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
}

function stopReading() {
    speechSynthesis.cancel();
}

async function readCurrentQuestionElevenLabs() {
    const state = loadState();

    if (!state.question) {
        alert("Nie ma pytania do przeczytania.");
        return;
    }

    try {
        const response = await fetch(apiPath("api/elevenlabs-tts"), {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                text: state.question
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            alert("Błąd ElevenLabs: " + errorText);
            return;
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        audio.play();

    } catch (error) {
        console.error(error);
        alert("Nie udało się odtworzyć głosu ElevenLabs.");
    }
}

function startPolling() {
    fetchStateFromServer();

    setInterval(() => {
        const justSavedLocally = Date.now() - lastLocalSaveAt < 1000;

        if (isAdminPage() && justSavedLocally) {
            return;
        }

        fetchStateFromServer();

    }, 1000);
}

document.addEventListener("DOMContentLoaded", () => {
    renderAll(currentState);
    startPolling();
});