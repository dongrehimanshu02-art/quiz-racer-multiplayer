require("dotenv").config();

const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const QRCode = require("qrcode");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  maxHttpBufferSize: 1e6
});

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
const HOST_SECRET = process.env.HOST_SECRET || "dev-secret-change-me";

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const QuestionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  options: { type: [String], required: true },
  correct: { type: Number, required: true, min: 0, max: 3 },
  timeLimit: { type: Number, default: 10 }
}, { _id: false });

const ResultSchema = new mongoose.Schema({
  name: String,
  score: Number,
  correct: Number,
  answered: Number
}, { _id: false });

const RaceSchema = new mongoose.Schema({
  roomCode: { type: String, unique: true },
  title: String,
  questions: [QuestionSchema],
  results: [ResultSchema],
  createdAt: { type: Date, default: Date.now },
  finishedAt: Date
});

const Race = mongoose.model("Race", RaceSchema);

// Active races live in memory for fast real-time gameplay.
// MongoDB stores created races/results for persistence.
const rooms = new Map();

function cleanText(value, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from({ length: 5 }, () => chars[crypto.randomInt(chars.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function publicPlayers(room) {
  return [...room.players.values()]
    .map(p => ({
      id: p.id,
      name: p.name,
      car: p.car,
      score: p.score,
      correct: p.correct,
      answered: p.answered,
      connected: p.connected
    }))
    .sort((a, b) => b.score - a.score);
}

function safeQuestions(room) {
  return room.questions.map((q, index) => ({
    index,
    text: q.text,
    options: q.options,
    timeLimit: q.timeLimit
    // Correct answer is intentionally never sent to players.
  }));
}

function emitPlayers(room) {
  io.to(room.code).emit("players:update", {
    count: room.players.size,
    maxPlayers: room.maxPlayers,
    players: publicPlayers(room)
  });
}

function buildLeaderboard(room) {
  return publicPlayers(room).map((p, i) => ({
    rank: i + 1,
    name: p.name,
    score: p.score,
    correct: p.correct,
    answered: p.answered
  }));
}

async function saveResults(room) {
  try {
    await Race.updateOne(
      { roomCode: room.code },
      {
        $set: {
          results: buildLeaderboard(room).map(x => ({
            name: x.name,
            score: x.score,
            correct: x.correct,
            answered: x.answered
          })),
          finishedAt: new Date()
        }
      }
    );
  } catch (err) {
    console.error("Could not save results:", err.message);
  }
}

async function finishRace(room) {
  if (!rooms.has(room.code) || room.phase === "finished") return;
  room.phase = "finished";
  if (room.timer) clearTimeout(room.timer);
  const leaderboard = buildLeaderboard(room);
  io.to(room.code).emit("race:finished", { leaderboard });
  await saveResults(room);
}

function startNextQuestion(room) {
  if (room.questionIndex >= room.questions.length) {
    return finishRace(room);
  }

  room.questionIndex += 1;
  room.questionStartedAt = Date.now();
  room.answersThisQuestion = new Set();

  // Reset per-question state.
  for (const p of room.players.values()) p.answeredCurrent = false;

  const q = room.questions[room.questionIndex - 1];
  io.to(room.code).emit("question:start", {
    number: room.questionIndex,
    total: room.questions.length,
    question: {
      text: q.text,
      options: q.options,
      timeLimit: q.timeLimit
    }
  });

  if (room.timer) clearTimeout(room.timer);
  room.timer = setTimeout(() => {
    io.to(room.code).emit("question:timeout", {
      number: room.questionIndex
    });
    setTimeout(() => startNextQuestion(room), 1200);
  }, q.timeLimit * 1000);
}

function scoreFor(q, elapsedMs) {
  const limit = q.timeLimit * 1000;
  const ratio = Math.max(0, Math.min(1, elapsedMs / limit));
  // Correct answer: 100 at instant response, 20 at time limit.
  return Math.max(20, Math.round(100 - 80 * ratio));
}

function normalizeQuestions(input) {
  if (!Array.isArray(input) || input.length < 10 || input.length > 15) {
    throw new Error("A level must contain 10 to 15 questions.");
  }

  return input.map((q, i) => {
    const text = cleanText(q.text, 300);
    const options = Array.isArray(q.options)
      ? q.options.map(x => cleanText(x, 120)).slice(0, 4)
      : [];
    const correct = Number(q.correct);
    const timeLimit = Math.max(5, Math.min(20, Number(q.timeLimit) || 10));

    if (!text || options.length !== 4 || options.some(x => !x) ||
        !Number.isInteger(correct) || correct < 0 || correct > 3) {
      throw new Error(`Invalid question ${i + 1}. Every question needs 4 options and a correct option.`);
    }

    return { text, options, correct, timeLimit };
  });
}

app.get("/api/health", async (req, res) => {
  res.json({
    ok: true,
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "not-connected",
    activeRooms: rooms.size
  });
});

app.post("/api/rooms", async (req, res) => {
  try {
    if (req.headers["x-host-secret"] !== HOST_SECRET) {
      return res.status(401).json({ error: "Invalid host secret." });
    }

    const title = cleanText(req.body.title || "Quiz Racer", 100);
    const questions = normalizeQuestions(req.body.questions);
    const code = makeRoomCode();

    const room = {
      code,
      title,
      questions,
      maxPlayers: 70,
      players: new Map(),
      phase: "lobby",
      questionIndex: 0,
      questionStartedAt: 0,
      answersThisQuestion: new Set(),
      timer: null
    };

    rooms.set(code, room);

    try {
      await Race.create({
        roomCode: code,
        title,
        questions
      });
    } catch (dbErr) {
      console.error("MongoDB save warning:", dbErr.message);
    }

    const baseUrl = (PUBLIC_URL && !PUBLIC_URL.includes("localhost")) ? PUBLIC_URL : `${req.protocol}://${req.get("host")}`;
    const joinUrl = `${baseUrl}/?room=${code}`;
    const qrDataUrl = await QRCode.toDataURL(joinUrl, {
      width: 420,
      margin: 2
    });

    res.json({ code, title, joinUrl, qrDataUrl, questions: safeQuestions(room) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/rooms/:code", (req, res) => {
  const code = cleanText(req.params.code, 10).toUpperCase();
  const room = rooms.get(code);
  if (!room) return res.status(404).json({ error: "Room not found or server restarted." });

  res.json({
    code: room.code,
    title: room.title,
    phase: room.phase,
    playerCount: room.players.size,
    maxPlayers: room.maxPlayers,
    questionCount: room.questions.length
  });
});

io.on("connection", socket => {
  socket.on("player:join", ({ code, name, car }) => {
    code = cleanText(code, 10).toUpperCase();
    name = cleanText(name, 24);
    car = ["red", "blue", "green", "yellow", "purple", "orange"][car] ? car : "blue";

    const room = rooms.get(code);
    if (!room) return socket.emit("join:error", "Room not found. Ask the host to create a new race.");
    if (room.phase !== "lobby") return socket.emit("join:error", "This race has already started.");
    if (room.players.size >= room.maxPlayers) return socket.emit("join:error", "Room is full (70 players).");
    if (!name) return socket.emit("join:error", "Please enter your name.");

    const duplicate = [...room.players.values()].some(p => p.name.toLowerCase() === name.toLowerCase());
    if (duplicate) return socket.emit("join:error", "That name is already taken.");

    room.players.set(socket.id, {
      id: socket.id,
      name,
      car,
      score: 0,
      correct: 0,
      answered: 0,
      answeredCurrent: false,
      connected: true
    });

    socket.join(code);
    socket.data.roomCode = code;
    socket.emit("join:success", {
      code,
      title: room.title,
      player: room.players.get(socket.id),
      phase: room.phase
    });
    emitPlayers(room);
  });

  socket.on("host:watch", ({ code, secret }) => {
    code = cleanText(code, 10).toUpperCase();
    const room = rooms.get(code);
    if (!room || secret !== HOST_SECRET) return socket.emit("host:error", "Invalid host credentials.");
    socket.join(code);
    emitPlayers(room);
  });

  socket.on("host:start", ({ code, secret }) => {
    code = cleanText(code, 10).toUpperCase();
    const room = rooms.get(code);
    if (!room) return socket.emit("host:error", "Room not found.");
    if (secret !== HOST_SECRET) return socket.emit("host:error", "Invalid host secret.");
    if (room.phase !== "lobby") return socket.emit("host:error", "Race has already started.");
    socket.join(code);
    if (room.players.size < 1) return socket.emit("host:error", "At least one player must join.");

    room.phase = "countdown";
    io.to(code).emit("race:countdown", { seconds: 3 });
    setTimeout(() => {
      if (!rooms.has(code)) return;
      room.phase = "running";
      io.to(code).emit("race:start", { total: room.questions.length });
      setTimeout(() => startNextQuestion(room), 800);
    }, 3200);
  });

  socket.on("player:answer", ({ answer }) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    const player = room?.players.get(socket.id);

    if (!room || !player || room.phase !== "running") return;
    if (player.answeredCurrent) return;
    if (room.questionIndex < 1) return;

    const q = room.questions[room.questionIndex - 1];
    const selected = Number(answer);
    if (!Number.isInteger(selected) || selected < 0 || selected > 3) return;

    player.answeredCurrent = true;
    player.answered += 1;
    room.answersThisQuestion.add(socket.id);

    const elapsed = Date.now() - room.questionStartedAt;
    const correct = selected === q.correct;
    const points = correct ? scoreFor(q, elapsed) : 0;

    if (correct) player.correct += 1;
    player.score += points;

    socket.emit("answer:result", {
      correct,
      points,
      totalScore: player.score
    });

    emitPlayers(room);

    if (room.answersThisQuestion.size >= room.players.size) {
      if (room.timer) clearTimeout(room.timer);
      setTimeout(() => startNextQuestion(room), 800);
    }
  });

  socket.on("host:finish", async ({ code, secret }) => {
    code = cleanText(code, 10).toUpperCase();
    const room = rooms.get(code);
    if (!room || secret !== HOST_SECRET) return;
    await finishRace(room);
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (player) {
      player.connected = false;
      // Keep the player in the room so a temporary phone reconnect doesn't erase score.
      emitPlayers(room);
    }
  });
});

async function boot() {
  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000
      });
      console.log("MongoDB connected.");
    } catch (err) {
      console.warn("MongoDB unavailable. Game will still run in memory.");
      console.warn(err.message);
    }
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Quiz Racer running on http://localhost:${PORT}`);
    console.log(`Public URL setting: ${PUBLIC_URL}`);
  });
}

boot();
