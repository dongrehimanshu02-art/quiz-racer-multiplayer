const socket = io();
const $ = id => document.getElementById(id);
let roomCode = "";
let hostSecret = "";

const sampleQuestions = [
  ["Which language is used to style web pages?", ["HTML","CSS","Python","SQL"], 1],
  ["What does CPU stand for?", ["Central Processing Unit","Computer Personal Unit","Control Program Utility","Core Processing User"], 0],
  ["Which planet is known as the Red Planet?", ["Venus","Mars","Jupiter","Mercury"], 1],
  ["Which data structure uses FIFO?", ["Stack","Queue","Tree","Graph"], 1],
  ["What does HTTP stand for?", ["HyperText Transfer Protocol","High Transfer Text Process","Hyperlink Tool Transfer Protocol","Host Transfer Text Program"], 0],
  ["Which is a JavaScript framework/library?", ["React","Django","Laravel","Flask"], 0],
  ["What is the binary representation of decimal 2?", ["10","11","01","100"], 0],
  ["Which database is document-oriented?", ["MySQL","MongoDB","PostgreSQL","SQLite"], 1],
  ["Which HTML tag creates a hyperlink?", ["<link>","<a>","<href>","<url>"], 1],
  ["What does API commonly mean?", ["Application Programming Interface","Applied Program Internet","Application Process Input","Advanced Protocol Integration"], 0]
];

function addQuestion(q = ["", ["","","",""], 0]) {
  const index = document.querySelectorAll(".question-editor").length + 1;
  const wrap = document.createElement("div");
  wrap.className = "question-editor";
  wrap.innerHTML = `
    <div class="question-title">Question ${index}</div>
    <input class="q-text" placeholder="Question text" value="${escapeAttr(q[0])}">
    <div class="option-grid">
      ${q[1].map((x,i)=>`<input class="q-option" placeholder="Option ${String.fromCharCode(65+i)}" value="${escapeAttr(x)}">`).join("")}
    </div>
    <label>Correct option:
      <select class="q-correct">
        <option value="0" ${q[2]===0?"selected":""}>A</option>
        <option value="1" ${q[2]===1?"selected":""}>B</option>
        <option value="2" ${q[2]===2?"selected":""}>C</option>
        <option value="3" ${q[2]===3?"selected":""}>D</option>
      </select>
      <input class="q-time" type="number" min="5" max="20" value="10"> sec
    </label>
  `;
  $("questionEditor").appendChild(wrap);
}

sampleQuestions.forEach(addQuestion);
$("addQuestion").onclick = () => {
  if (document.querySelectorAll(".question-editor").length >= 15) return;
  addQuestion();
};

$("createRoom").onclick = async () => {
  hostSecret = $("hostSecret").value.trim();
  $("hostError").textContent = "";
  const editors = [...document.querySelectorAll(".question-editor")];
  if (editors.length < 10 || editors.length > 15) {
    $("hostError").textContent = "Use between 10 and 15 questions.";
    return;
  }

  const questions = editors.map(el => ({
    text: el.querySelector(".q-text").value,
    options: [...el.querySelectorAll(".q-option")].map(x => x.value),
    correct: Number(el.querySelector(".q-correct").value),
    timeLimit: Number(el.querySelector(".q-time").value)
  }));

  try {
    const response = await fetch("/api/rooms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-host-secret": hostSecret
      },
      body: JSON.stringify({
        title: $("levelTitle").value || "Quiz Racer",
        questions
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not create room.");

    roomCode = data.code;
    $("setup").classList.add("hidden");
    $("roomPanel").classList.remove("hidden");
    $("roomTitle").textContent = data.title;
    $("roomCode").textContent = data.code;
    $("qr").src = data.qrDataUrl;
    $("joinLink").href = data.joinUrl;
    $("joinLink").textContent = data.joinUrl;
    $("roomMessage").textContent = "Show this QR code to players.";
    socket.emit("host:watch", { code: roomCode, secret: hostSecret });
  } catch (err) {
    $("hostError").textContent = err.message;
  }
};

$("startRace").onclick = () => {
  socket.emit("host:start", { code: roomCode, secret: hostSecret });
};

$("finishRace").onclick = () => {
  socket.emit("host:finish", { code: roomCode, secret: hostSecret });
};

socket.on("host:error", msg => $("roomMessage").textContent = msg);

socket.on("players:update", data => {
  $("hostPlayerCount").textContent = data.count;
  $("hostPlayers").innerHTML = data.players.map(p =>
    `<span class="player-pill">${escapeHtml(p.name)} <b>${p.score}</b></span>`
  ).join("");
  $("liveScores").innerHTML = data.players.slice(0, 15).map(p =>
    `<div class="score-line"><span>${escapeHtml(p.name)}</span><strong>${p.score}</strong></div>`
  ).join("");
});

socket.on("race:countdown", data => {
  $("displayQuestion").textContent = `Race starts in ${data.seconds}...`;
});

socket.on("race:start", () => {
  $("displayQuestion").textContent = "🏁 GO!";
});

socket.on("question:start", data => {
  $("displayQuestion").textContent = data.question.text;
  $("displayAnswers").innerHTML = data.question.options.map((x,i) =>
    `<div>${String.fromCharCode(65+i)}. ${escapeHtml(x)}</div>`
  ).join("");
});

socket.on("question:timeout", () => {
  $("displayQuestion").textContent = "⏱ Time up!";
});

socket.on("race:finished", data => {
  $("displayQuestion").textContent = "🏆 RACE FINISHED";
  $("displayAnswers").innerHTML = data.leaderboard.slice(0,10).map(x =>
    `<div><strong>#${x.rank}</strong> ${escapeHtml(x.name)} — ${x.score} pts</div>`
  ).join("");
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[c]));
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/`/g, "&#096;");
}
