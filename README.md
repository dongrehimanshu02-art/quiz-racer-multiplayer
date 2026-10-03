# 🏁 Quiz Racer — 50–70 Player Event MVP

A browser-based real-time quiz racing game designed for college events.

Players scan a QR code, join a room, answer 10–15 timed questions and compete on a live score-based race. The server calculates scores so the browser cannot simply award itself points.

## 1. Requirements

Install these on the host/development laptop:

- Node.js LTS
- VS Code
- MongoDB Atlas account OR local MongoDB

Check Node:

```bash
node -v
npm -v
```

## 2. Install

Open this project folder in VS Code terminal:

```bash
npm install
```

Create `.env` by copying `.env.example`.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Or manually create a file named `.env`.

For the easiest first test, use:

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/quiz_racer
PUBLIC_URL=http://localhost:3000
HOST_SECRET=my-event-secret-123
```

If you do not have MongoDB installed/running, the game still works in memory. MongoDB is used for persistence.

## 3. Start

```bash
npm start
```

Open:

- Player: http://localhost:3000
- Host: http://localhost:3000/host.html
- Health check: http://localhost:3000/api/health

## 4. Create a race

1. Open `/host.html`.
2. Enter the same `HOST_SECRET` from `.env`.
3. Use the included 10 sample questions or add more.
4. Click CREATE RACE ROOM.
5. The page generates a 5-character room code and QR code.
6. Players scan the QR code.
7. Watch the player count increase.
8. Click START RACE.

## 5. IMPORTANT: QR code on phones during a local event

`localhost` only works on the host's own computer.

For phones on the same Wi-Fi/LAN, set `PUBLIC_URL` to the host computer's LAN IP, for example:

```env
PUBLIC_URL=http://192.168.1.25:3000
```

Find the host laptop's IPv4 address:

Windows:

```powershell
ipconfig
```

Look for `IPv4 Address`.

Then restart:

```bash
npm start
```

Open the host page on the laptop using:

```text
http://192.168.1.25:3000/host.html
```

The generated QR code will now point phones to:

```text
http://192.168.1.25:3000/?room=ABCDE
```

### Windows Firewall

If phones cannot open the page, Windows Firewall may be blocking Node.js.

Allow Node.js through Private networks when Windows asks. For an event, test this BEFORE event day.

## 6. MongoDB Atlas setup

MongoDB Atlas can be used instead of local MongoDB.

General steps:

1. Create a MongoDB Atlas account.
2. Create a free database cluster.
3. Create a database user.
4. Add your development/event IP address to the network access list.
5. Copy the application's connection string.
6. Put it in `.env`:

```env
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@YOUR-CLUSTER.mongodb.net/quiz_racer?retryWrites=true&w=majority
```

Do not put the URI in frontend JavaScript.

Restart the server.

Check:

```text
http://localhost:3000/api/health
```

You want:

```json
{
  "ok": true,
  "mongodb": "connected"
}
```

## 7. How the scoring works

Correct answers get up to 100 points.

The faster the correct answer, the higher the score.

At the time limit, a correct answer gets 20 points.

Wrong answer = 0.

No answer = 0.

The server calculates this using the time received from the server-side question start.

## 8. 50–70 player event testing

First test with 2–5 phones.

Then test with:

- 10
- 20
- 30
- 50
- 60
- 70

Use real devices where possible.

Do not make your first test on event day.

## 9. Recommended event setup

Host laptop:
- Ethernet if possible
- Charger connected
- Browser open to host page
- Stable internet/LAN

Projector:
- Host's event display

Players:
- Phone browser
- Same Wi-Fi/LAN for a local deployment

## 10. Important architecture note

Active game state is intentionally kept in server memory for speed. MongoDB stores race definitions and final results.

For a single college event, this is simpler and faster than writing every answer to MongoDB.

If the Node.js server restarts during a race, the active room is lost. For production, add Redis or another shared state layer.

## 11. Online deployment later

For a public event over the internet:

1. Deploy this Node.js application to a host that supports long-lived WebSocket connections.
2. Use MongoDB Atlas.
3. Set `PUBLIC_URL` to the deployed HTTPS URL.
4. Set a strong `HOST_SECRET`.
5. Test 50–70 concurrent connections before the event.

Do not use a static-only hosting service for the Socket.IO backend.

## 12. Security for a real event

Before deployment:

- Change `HOST_SECRET`.
- Keep `.env` out of GitHub.
- Never expose `MONGODB_URI` to the browser.
- Add rate limiting before public internet deployment.
- Add host authentication instead of relying only on a shared secret.
- Consider disabling room creation after the event starts.

## 13. Next improvements

This MVP can later add:

- Animated multi-car race
- Proper Phaser game scene
- Music and sound effects
- Team mode
- Categories/difficulty
- Random question sets
- Admin login
- Multiple simultaneous rooms
- CSV/Excel question import
- Player reconnection
- Persistent historical leaderboards
- Anti-cheat improvements
- Event branding/logo
