const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// In-memory room store
const rooms = {};

app.get('/', (req, res) => {
    res.send('Gamer Field Backend is Live!');
});

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // CREATE ROOM
    socket.on('create_room', (data) => {
        const username = data.username || "Player";
        const roomCode = data.roomCode ? data.roomCode.toUpperCase() : Math.random().toString(36).substring(2, 8).toUpperCase();

        rooms[roomCode] = {
            code: roomCode,
            host: socket.id,
            players: [{ id: socket.id, username: username, ready: false }]
        };

        socket.join(roomCode);
        console.log(`Room created: ${roomCode} by ${username}`);

        socket.emit('room_created', { roomCode: roomCode, players: rooms[roomCode].players });
        io.to(roomCode).emit('lobby_updated', rooms[roomCode]);
    });

    // JOIN ROOM
    socket.on('join_room', (data) => {
        const username = data.username || "Player";
        const roomCode = data.roomCode ? data.roomCode.toUpperCase().trim() : "";

        console.log(`Attempting to join room: ${roomCode} by ${username}`);

        if (rooms[roomCode]) {
            socket.join(roomCode);
            
            const existingPlayer = rooms[roomCode].players.find(p => p.id === socket.id);
            if (!existingPlayer) {
                rooms[roomCode].players.push({ id: socket.id, username: username, ready: false });
            }

            console.log(`${username} joined room ${roomCode}`);
            io.to(roomCode).emit('lobby_updated', rooms[roomCode]);
        } else {
            console.log(`Room ${roomCode} not found in memory`);
            socket.emit('error_msg', 'Lobby not found. Please double-check the room code!');
        }
    });

    // DISCONNECT
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        for (const roomCode in rooms) {
            const room = rooms[roomCode];
            room.players = room.players.filter(p => p.id !== socket.id);
            if (room.players.length === 0) {
                delete rooms[roomCode];
                console.log(`Room ${roomCode} deleted (empty)`);
            } else {
                io.to(roomCode).emit('lobby_updated', room);
            }
        }
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
