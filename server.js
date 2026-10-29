const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const lobbies = {};

app.get('/', (req, res) => {
  res.json({ status: "Server running", activeLobbies: Object.keys(lobbies).length });
});

app.post('/api/lobbies/create', (req, res) => {
  const { hostName } = req.body;
  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  lobbies[roomCode] = { code: roomCode, host: hostName || "Host", players: [] };
  res.json({ success: true, roomCode });
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join_room', ({ roomCode, username }) => {
    if (!lobbies[roomCode]) {
      socket.emit('error_msg', 'Lobby not found!');
      return;
    }
    socket.join(roomCode);
    socket.data = { roomCode, username: username || `Player_${socket.id.substring(0, 4)}` };
    const player = { id: socket.id, username: socket.data.username, isReady: false };
    lobbies[roomCode].players.push(player);
    io.to(roomCode).emit('lobby_updated', lobbies[roomCode]);
  });

  socket.on('toggle_ready', () => {
    const { roomCode } = socket.data || {};
    if (!roomCode || !lobbies[roomCode]) return;
    const player = lobbies[roomCode].players.find(p => p.id === socket.id);
    if (player) {
      player.isReady = !player.isReady;
      io.to(roomCode).emit('lobby_updated', lobbies[roomCode]);
    }
  });

  socket.on('send_message', ({ message }) => {
    const { roomCode, username } = socket.data || {};
    if (!roomCode) return;
    io.to(roomCode).emit('chat_received', {
      sender: username,
      message,
      timestamp: new Date().toLocaleTimeString()
    });
  });

  socket.on('disconnect', () => {
    const { roomCode } = socket.data || {};
    if (roomCode && lobbies[roomCode]) {
      lobbies[roomCode].players = lobbies[roomCode].players.filter(p => p.id !== socket.id);
      if (lobbies[roomCode].players.length === 0) {
        delete lobbies[roomCode];
      } else {
        io.to(roomCode).emit('lobby_updated', lobbies[roomCode]);
      }
    }
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
