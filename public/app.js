const socket = io();
const $ = id => document.getElementById(id);

const views = ["homeView", "joinView", "lobbyView", "gameView", "resultView"];
function show(view) {
  views.forEach(v => $(v).classList.toggle("hidden", v !== view));
}

let selectedCar = 0;
let roomCode = new URLSearchParams(location.search).get("room") || "";
let myScore = 0;
let countdownTimer = null;
let questionTimer = null;
let currentQuestion = null;

$("joinBtn").onclick = () => {
  show("joinView");
  if (roomCode) $("roomCode").value = roomCode;
};

document.querySelectorAll("[data-home]").forEach(b => b.onclick = () => show("homeView"));

document.querySelectorAll(".car").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".car").forEach(x => x.classList.remove("selected"));
    btn.classList.add("selected");
    selectedCar = Number(btn.dataset.car);
  };
});

$("roomCode").addEventListener("input", async e => {
  e.target.value = e.target.value.toUpperCase();
});

$("joinRace").onclick = () => {
  const code = $("roomCode").value.trim().toUpperCase();
  const name = $("playerName").value.trim();
  $("joinError").textContent = "";
  if (!code || !name) {
    $("joinError").textContent = "Enter room code and your name.";
    return;
  }
  roomCode = code;
  socket.emit("player:join", { code, name, car: selectedCar });
};

socket.on("join:error", msg => $("joinError").textContent = msg);

socket.on("join:success", data => {
  $("lobbyTitle").textContent = data.title;
  $("lobbyCode").textContent = data.code;
  show("lobbyView");
});

socket.on("players:update", data => {
  $("playerCount").textContent = data.count;
  const grid = $("playerGrid");
  grid.innerHTML = data.players.map(p =>
    `<span class="player-pill">${escapeHtml(p.name)} <b>${p.score}</b></span>`
  ).join("");

  if (data.players.some(p => p.id === socket.id)) {
    const me = data.players.find(p => p.id === socket.id);
    myScore = me.score;
    $("myScore").textContent = myScore;
  }
});

socket.on("race:countdown", data => {
  show("gameView");
  let n = data.seconds;
  $("questionText").textContent = n;
  countdownTimer = setInterval(() => {
    n--;
    $("questionText").textContent = n > 0 ? n : "GO!";
    if (n <= 0) clearInterval(countdownTimer);
  }, 1000);
});

socket.on("race:start", data => {
  show("gameView");
  $("gameTitle").textContent = "QUIZ RACER";
});

socket.on("question:start", data => {
  currentQuestion = data.question;
  $("questionNumber").textContent = `Question ${data.number} / ${data.total}`;
  $("questionText").textContent = data.question.text;
  $("answerFeedback").textContent = "";
  $("answerFeedback").className = "feedback";
  $("answers").innerHTML = data.question.options.map((opt, i) =>
    `<button class="answer" data-answer="${i}">${String.fromCharCode(65+i)}. ${escapeHtml(opt)}</button>`
  ).join("");

  document.querySelectorAll(".answer").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".answer").forEach(x => x.disabled = true);
      socket.emit("player:answer", { answer: Number(btn.dataset.answer) });
    };
  });

  startTimer(data.question.timeLimit);
  animateCar(data.number, data.total);
});

function startTimer(seconds) {
  clearInterval(questionTimer);
  let left = seconds;
  $("timer").textContent = left;
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
    ? `✓ Correct! +${data.points} points`
    : "✗ Wrong answer — 0 points";
  $("answerFeedback").className = data.correct ? "feedback good" : "feedback bad";
});

socket.on("question:timeout", () => {
  document.querySelectorAll(".answer").forEach(x => x.disabled = true);
  $("answerFeedback").textContent = "⏱ Time up — 0 points";
  $("answerFeedback").className = "feedback bad";
});

socket.on("race:finished", data => {
  clearInterval(questionTimer);
  show("resultView");
  const me = data.leaderboard.find(x => x.name === $("playerName").value.trim());
  $("myResult").innerHTML = me
    ? `Your position: <strong>#${me.rank}</strong> &nbsp; Score: <strong>${me.score}</strong>`
    : "";
  $("leaderboard").innerHTML = data.leaderboard.slice(0, 10).map(x =>
    `<div class="leader-row ${x.rank <= 3 ? "podium" : ""}">
      <span>#${x.rank}</span><strong>${escapeHtml(x.name)}</strong><span>${x.score} pts</span>
    </div>`
  ).join("");
});

function animateCar(number, total) {
  const percent = Math.min(92, 8 + (number / total) * 84);
  $("myCar").style.left = percent + "%";
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[c]));
}
