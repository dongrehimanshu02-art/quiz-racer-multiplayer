const socket = io();
const $ = id => document.getElementById(id);

const views = ["homeView", "lobbyView", "gameView", "resultView"];
function show(view) {
  views.forEach(v => $(v).classList.toggle("hidden", v !== view));
}

let roomCode = new URLSearchParams(location.search).get("room") || "";
let myScore = 0;
let questionTimer = null;
let countdownTimer = null;
let revealTimer = null;
let currentQuestion = null;

if (roomCode) $("roomCode").value = roomCode;

$("roomCode").addEventListener("input", e => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
});

$("joinRace").onclick = () => {
  const code = $("roomCode").value.trim().toUpperCase();
  const name = $("playerName").value.trim();
  $("joinError").textContent = "";
  if (!code || !name) {
    $("joinError").textContent = "Enter the room code and your name.";
    return;
  }
  roomCode = code;
  socket.emit("player:join", { code, name, car: 0 });
};

$("aboutBtn").onclick = () => $("aboutModal").classList.remove("hidden");
$("closeAbout").onclick = () => $("aboutModal").classList.add("hidden");
$("aboutModal").addEventListener("click", e => {
  if (e.target === $("aboutModal")) $("aboutModal").classList.add("hidden");
});

socket.on("join:error", msg => $("joinError").textContent = msg);

socket.on("join:success", data => {
  $("lobbyTitle").textContent = data.title;
  $("lobbyCode").textContent = data.code;
  show("lobbyView");
});

socket.on("players:update", data => {
  $("playerCount").textContent = data.count;
  $("playerGrid").innerHTML = data.players.map(p =>
    `<span class="player-pill">${escapeHtml(p.name)} <b>${p.score}</b></span>`
  ).join("");

  const me = data.players.find(p => p.id === socket.id);
  if (me) {
    myScore = me.score;
    $("myScore").textContent = myScore;
  }
});

socket.on("race:countdown", data => {
  show("gameView");
  clearInterval(countdownTimer);
  clearTimeout(revealTimer);
  $("questionCard").classList.add("hidden");
  $("raceStage").classList.remove("race-running");
  setLights("red");
  $("startMessage").textContent = "GET READY";

  let n = data.seconds;
  renderCountdown(n);
  countdownTimer = setInterval(() => {
    n--;
    if (n > 0) {
      renderCountdown(n);
    } else {
      clearInterval(countdownTimer);
      renderCountdown(0);
    }
  }, 1000);
});

function renderCountdown(n) {
  if (n === 3) {
    setLights("red");
    $("startMessage").textContent = "RED LIGHT";
  } else if (n === 2) {
    setLights("yellow");
    $("startMessage").textContent = "YELLOW LIGHT";
  } else if (n === 1) {
    setLights("green");
    $("startMessage").textContent = "GREEN LIGHT";
  } else {
    setLights("green");
    $("startMessage").textContent = "GO!";
  }
}

function setLights(active) {
  ["red", "yellow", "green"].forEach(name => {
    const el = document.querySelector(`.light.${name}`);
    el.classList.toggle("active", name === active);
  });
}

socket.on("race:start", () => {
  show("gameView");
  $("gameTitle").textContent = "QUIZ RACE";
  $("raceStage").classList.add("race-running");
  $("myCar").style.left = "18%";
  $("startMessage").textContent = "RACE STARTED!";
  setTimeout(() => $("startMessage").classList.add("fade-out"), 900);
});

socket.on("question:start", data => {
  currentQuestion = data.question;
  clearInterval(questionTimer);
  clearTimeout(revealTimer);

  $("questionCard").classList.remove("hidden");
  $("questionNumber").textContent = `Question ${data.number} / ${data.total}`;
  $("questionText").textContent = data.question.text;
  $("answerFeedback").textContent = "";
  $("answerFeedback").className = "feedback";
  $("answers").innerHTML = data.question.options.map((opt, i) =>
    `<button class="answer" data-answer="${i}">${String.fromCharCode(65 + i)}. ${escapeHtml(opt)}</button>`
  ).join("");

  document.querySelectorAll(".answer").forEach(btn => {
    btn.disabled = true;
    btn.onclick = () => submitAnswer(btn);
  });

  $("answers").classList.add("hidden");
  $("timerWrap").classList.add("hidden");
  $("questionStatus").textContent = "READ THE QUESTION... OPTIONS IN 4 SECONDS";
  $("timer").textContent = "15";

  // The car moves a little before each question.
  const percent = Math.min(88, 18 + ((data.number - 1) / data.total) * 70);
  $("myCar").style.left = percent + "%";

  const revealDelay = Number(data.revealDelay) || 4000;
  revealTimer = setTimeout(() => {
    $("answers").classList.remove("hidden");
    $("timerWrap").classList.remove("hidden");
    $("questionStatus").textContent = "CHOOSE YOUR ANSWER!";
    document.querySelectorAll(".answer").forEach(btn => btn.disabled = false);
    startTimer(data.question.timeLimit || 15);
  }, revealDelay);
});

function submitAnswer(btn) {
  document.querySelectorAll(".answer").forEach(x => x.disabled = true);
  clearInterval(questionTimer);
  socket.emit("player:answer", { answer: Number(btn.dataset.answer) });
}

function startTimer(seconds) {
  clearInterval(questionTimer);
  let left = Number(seconds) || 15;
  $("timer").textContent = left.toFixed(1);
  questionTimer = setInterval(() => {
    left -= 0.1;
    $("timer").textContent = Math.max(0, left).toFixed(1);
    if (left <= 0) clearInterval(questionTimer);
  }, 100);
}

socket.on("answer:result", data => {
  myScore = data.totalScore;
  $("myScore").textContent = myScore;
  $("answerFeedback").textContent = data.correct
    ? `✓ Correct! +${data.points} points — Keep racing!`
    : "✗ Wrong answer — 0 points";
  $("answerFeedback").className = data.correct ? "feedback good" : "feedback bad";
  $("questionStatus").textContent = data.correct ? "POINTS ADDED!" : "NO POINTS — NEXT QUESTION";
});

socket.on("question:timeout", () => {
  clearInterval(questionTimer);
  document.querySelectorAll(".answer").forEach(x => x.disabled = true);
  $("answerFeedback").textContent = "⏱ Time up — 0 points";
  $("answerFeedback").className = "feedback bad";
  $("questionStatus").textContent = "TIME UP — GET READY FOR THE NEXT ONE";
});

socket.on("race:finished", data => {
  clearInterval(questionTimer);
  clearTimeout(revealTimer);
  show("resultView");
  $("finishAnimation").classList.remove("hidden");
  $("leaderboardContent").classList.add("hidden");
  runFinishAnimation(() => showLeaderboard(data));
});

function runFinishAnimation(done) {
  const cars = document.querySelectorAll(".finish-car");
  cars.forEach(car => car.classList.remove("crossed"));
  void $("finishAnimation").offsetWidth;
  cars.forEach((car, i) => {
    setTimeout(() => car.classList.add("crossed"), i * 380);
  });
  setTimeout(done, 3200);
}

function showLeaderboard(data) {
  $("finishAnimation").classList.add("hidden");
  $("leaderboardContent").classList.remove("hidden");
  const myName = $("playerName").value.trim().toLowerCase();
  const me = data.leaderboard.find(x => x.name.toLowerCase() === myName);
  $("myResult").innerHTML = me
    ? `Your position: <strong>#${me.rank}</strong> &nbsp; Score: <strong>${me.score}</strong>`
    : "";
  $("leaderboard").innerHTML = data.leaderboard.slice(0, 10).map(x =>
    `<div class="leader-row ${x.rank <= 3 ? "podium" : ""}">
      <span>#${x.rank}</span><strong>${escapeHtml(x.name)}</strong><span>${x.score} pts</span>
    </div>`
  ).join("");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}
