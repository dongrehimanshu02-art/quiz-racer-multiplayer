# 🏎️ Quiz Racer — Multiplayer Racing Quiz Game

> A real-time browser-based multiplayer racing game where players compete by answering quiz questions quickly and accurately.

![Quiz Racer](https://img.shields.io/badge/Game-Quiz%20Racer-blue)
![Node.js](https://img.shields.io/badge/Node.js-Backend-green)
![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-black)
![MongoDB](https://img.shields.io/badge/MongoDB-Database-brightgreen)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## 🎮 About the Project

**Quiz Racer** is a real-time multiplayer quiz racing platform designed for college events, competitions, workshops, and technical fests.

Players join a race directly from their **mobile phone or laptop browser** using a room code or QR code. Each player controls a virtual racing car, and their position in the race depends on how quickly and correctly they answer quiz questions.

No application installation is required.

The system is designed with an **event-scale multiplayer architecture** and can be configured to support up to **70 players in a room**.

---

## ✨ Key Features

- 🏎️ Real-time multiplayer racing
- 👥 Support for up to **70 players per room**
- 📱 Join using a mobile/laptop browser
- 🔳 QR-code based room joining
- 🔐 Host-controlled game sessions
- 🧠 Multiple-choice quiz questions
- ⚡ Speed-based scoring
- 🏆 Live player leaderboard
- 📊 Top 10 final leaderboard
- ⏱️ Timed questions
- 🔄 Real-time synchronization using Socket.IO
- 💾 MongoDB support for storing races and results
- 🎨 Responsive event-style interface
- 🌐 Can run locally or be deployed online

---

# 🕹️ How the Game Works

### 1️⃣ Host Creates a Race

The event host opens the host dashboard and creates a race.

The host can:

- Create a room
- Add quiz questions
- Generate a room code
- Generate a QR code
- Monitor connected players
- Start the race

---

### 2️⃣ Players Join

Players scan the QR code or open the provided game URL.

They enter:

- Room Code
- Player Name

After joining, they wait in the lobby until the host starts the race.

---

### 3️⃣ Race Begins

All players start racing at the same base speed.

At different points on the track, players encounter quiz questions.

Each question contains **4 options**.

---

### 4️⃣ Answer Questions

Players must select the correct answer as quickly as possible.

The scoring system rewards both:

- ✅ Correctness
- ⚡ Response speed

Example:

| Response | Score |
|---|---:|
| Fast correct answer | High score |
| Slow correct answer | Lower score |
| Wrong answer | 0 |
| No answer | 0 |

The accumulated score determines the player's progress and race position.

---

### 5️⃣ Final Leaderboard

After all questions are completed, the race ends and the final leaderboard is displayed.

The system shows the **Top 10 players** along with their scores and positions.

---

# 🧩 System Architecture

```text
                    ┌──────────────────┐
                    │   Host Dashboard │
                    └────────┬─────────┘
                             │
                             │ Create Race
                             ▼
                    ┌──────────────────┐
                    │   Node.js Server │
                    │   + Express      │
                    │   + Socket.IO    │
                    └────────┬─────────┘
                             │
             ┌───────────────┼───────────────┐
             │               │               │
             ▼               ▼               ▼
        Player 1         Player 2        Player 3
        Browser          Browser         Browser
             │               │               │
             └───────────────┼───────────────┘
                             │
                             ▼
                       MongoDB Database