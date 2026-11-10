"use strict";

const STORAGE_KEY = "binaryBoss.highScores.v1";
const LAST_PLAYER_KEY = "binaryBoss.lastPlayer.v1";
const POINTS_PER_ANSWER = 10;

const playerForm = document.querySelector("#player-form");
const playerNameInput = document.querySelector("#player-name");
const answerForm = document.querySelector("#answer-form");
const answerInput = document.querySelector("#answer");
const answerButton = document.querySelector("#answer-button");
const nextButton = document.querySelector("#next-button");
const binaryNumber = document.querySelector("#binary-number");
const currentScore = document.querySelector("#current-score");
const personalBest = document.querySelector("#personal-best");
const gameMessage = document.querySelector("#game-message");
const roundLabel = document.querySelector("#round-label");
const leaderboardList = document.querySelector("#leaderboard-list");
const emptyBoard = document.querySelector("#empty-board");

let activePlayer = "";
let runScore = 0;
let targetNumber = 0;
let lastResult = null;
let leaderboard = [];
let storageReady = false;

function showMessage(message, type = "") {
  gameMessage.textContent = message;
  gameMessage.className = `game-message${type ? ` ${type}` : ""}`;
}

function readLeaderboard() {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === null) {
    return [];
  }

  const parsed = JSON.parse(saved);
  if (!Array.isArray(parsed)) {
    throw new Error("Saved leaderboard data is invalid. Clear this game's saved data to continue.");
  }

  for (const entry of parsed) {
    if (
      typeof entry !== "object"
      || entry === null
      || typeof entry.name !== "string"
      || !Number.isSafeInteger(entry.bestScore)
      || entry.bestScore < 0
    ) {
      throw new Error("Saved leaderboard data is invalid. Clear this game's saved data to continue.");
    }
  }

  return parsed;
}

function saveLeaderboard() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(leaderboard));
}

function sortLeaderboard() {
  leaderboard.sort((first, second) => {
    if (second.bestScore !== first.bestScore) {
      return second.bestScore - first.bestScore;
    }
    return first.name.localeCompare(second.name, undefined, { sensitivity: "base" });
  });
}

function renderLeaderboard() {
  sortLeaderboard();
  leaderboardList.replaceChildren();
  emptyBoard.hidden = leaderboard.length > 0;

  for (const [index, entry] of leaderboard.entries()) {
    const row = document.createElement("li");
    row.className = `leaderboard-entry${index === 0 ? " is-top" : ""}`;

    const rank = document.createElement("span");
    rank.className = "rank";
    rank.textContent = String(index + 1).padStart(2, "0");

    const name = document.createElement("span");
    name.className = "player-name";
    name.textContent = entry.name;

    const score = document.createElement("strong");
    score.className = "best-score";
    score.textContent = String(entry.bestScore).padStart(2, "0");

    row.append(rank, name, score);
    leaderboardList.append(row);
  }
}

function findPlayer(name) {
  const normalizedName = name.trim().toLocaleLowerCase();
  return leaderboard.find((entry) => entry.name.trim().toLocaleLowerCase() === normalizedName);
}

function updatePersonalBest() {
  const player = findPlayer(activePlayer);
  personalBest.textContent = String(player ? player.bestScore : 0).padStart(2, "0");
}

function startNextChallenge() {
  targetNumber = Math.floor(Math.random() * 255) + 1;
  const binary = targetNumber.toString(2).padStart(8, "0");
  binaryNumber.textContent = `${binary.slice(0, 4)} ${binary.slice(4)}`;
  answerInput.value = "";
  answerInput.disabled = false;
  answerButton.disabled = false;
  answerButton.hidden = false;
  nextButton.hidden = true;
  lastResult = null;
  roundLabel.textContent = "SIGNAL ACTIVE";
  answerInput.focus();
}

function recordPlayer(name) {
  let player = findPlayer(name);
  if (player) {
    player.name = name;
  } else {
    player = { name, bestScore: 0 };
    leaderboard.push(player);
  }
  saveLeaderboard();
  renderLeaderboard();
  updatePersonalBest();
}

function handleStorageError(error) {
  storageReady = false;
  playerForm.querySelector("button").disabled = true;
  answerButton.disabled = true;
  nextButton.disabled = true;
  showMessage(error instanceof Error ? error.message : "Could not save scores in this browser.", "error");
}

playerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!storageReady) {
    return;
  }

  const name = playerNameInput.value.trim();
  if (!name) {
    showMessage("Enter a callsign before starting your run.", "error");
    playerNameInput.focus();
    return;
  }

  activePlayer = name;
  runScore = 0;
  currentScore.textContent = "00";

  try {
    recordPlayer(activePlayer);
    window.localStorage.setItem(LAST_PLAYER_KEY, activePlayer);
  } catch (error) {
    handleStorageError(error);
    return;
  }

  playerForm.hidden = true;
  answerForm.hidden = false;
  showMessage(`You're in, ${activePlayer}. Decode the signal to earn ${POINTS_PER_ANSWER} points.`, "success");
  startNextChallenge();
});

answerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!storageReady || !activePlayer || lastResult !== null) {
    return;
  }

  const answer = Number(answerInput.value);
  if (!answerInput.value || !Number.isInteger(answer) || answer < 0 || answer > 255) {
    showMessage("Enter a whole number from 0 to 255.", "error");
    answerInput.focus();
    return;
  }

  answerInput.disabled = true;
  answerButton.disabled = true;
  answerButton.hidden = true;
  nextButton.hidden = false;
  lastResult = answer === targetNumber;

  if (lastResult) {
    runScore += POINTS_PER_ANSWER;
    currentScore.textContent = String(runScore).padStart(2, "0");
    showMessage(`Correct! ${targetNumber} in decimal. +${POINTS_PER_ANSWER} points.`, "success");
  } else {
    showMessage(`Not quite — the signal was ${targetNumber} in decimal. Try the next one.`);
  }

  try {
    const player = findPlayer(activePlayer);
    if (player && runScore > player.bestScore) {
      player.bestScore = runScore;
      saveLeaderboard();
      renderLeaderboard();
      updatePersonalBest();
    }
  } catch (error) {
    handleStorageError(error);
  }
});

nextButton.addEventListener("click", () => {
  if (storageReady) {
    showMessage("New signal incoming. You’ve got this.");
    startNextChallenge();
  }
});

try {
  leaderboard = readLeaderboard();
  renderLeaderboard();
  storageReady = true;
  playerNameInput.value = window.localStorage.getItem(LAST_PLAYER_KEY) || "";
} catch (error) {
  renderLeaderboard();
  handleStorageError(error);
}
