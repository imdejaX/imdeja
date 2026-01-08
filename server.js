const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static(__dirname)); // Serve current directory files

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for simplicity in development
        methods: ["GET", "POST"]
    }
});

// Game State Storage
const rooms = {}; // { roomId: { players: [], gameState: {}, ... } }

io.on('connection', (socket) => {
    console.log('Yeni oyuncu bağlandı:', socket.id);

    // 1. Create Room (Host Game)
    socket.on('create_room', ({ playerName, nickname }) => {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();

        rooms[roomId] = {
            id: roomId,
            players: [{
                id: socket.id,
                name: nickname || playerName || 'Oyuncu 1',
                ready: false,
                isHost: true,
                color: '#dc2626' // Red for host
            }],
            status: 'waiting', // waiting, playing
            messages: []
        };

        socket.join(roomId);
        console.log(`Oda oluşturuldu: ${roomId} by ${nickname}`);


        socket.emit('room_created', {
            roomId,
            players: rooms[roomId].players
        });
        broadcastRoomList();
    });

    // 2. Join Room
    socket.on('join_room', ({ roomId, nickname }) => {
        if (!rooms[roomId]) {
            socket.emit('error', { message: 'Oda bulunamadı!' });
            return;
        }

        if (rooms[roomId].players.length >= 4) {
            socket.emit('error', { message: 'Oda dolu!' });
            return;
        }

        if (rooms[roomId].status === 'playing') {
            socket.emit('error', { message: 'Oyun çoktan başladı!' });
            return;
        }

        const newPlayer = {
            id: socket.id,
            name: nickname || `Oyuncu ${rooms[roomId].players.length + 1}`,
            ready: false,
            isHost: false,
            // Assign colors based on order: Red, Blue, Green, Gold
            color: ['#dc2626', '#2563eb', '#059669', '#f59e0b'][rooms[roomId].players.length]
        };

        rooms[roomId].players.push(newPlayer);
        socket.join(roomId);

        console.log(`${nickname} odaya katıldı: ${roomId}`);


        // Notify everyone in the room
        io.to(roomId).emit('room_updated', {
            roomId,
            players: rooms[roomId].players
        });
        broadcastRoomList();
    });

    // 3. Leave Room
    socket.on('leave_room', ({ roomId }) => {
        handleLeave(roomId, socket.id);
    });

    socket.on('disconnect', () => {
        console.log('Oyuncu ayrıldı:', socket.id);
        // Find which room they were in and remove them
        for (const roomId in rooms) {
            const player = rooms[roomId].players.find(p => p.id === socket.id);
            if (player) {
                handleLeave(roomId, socket.id);
                break;
            }
        }
    });

    const handleLeave = (roomId, playerId) => {
        if (!rooms[roomId]) return;

        rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== playerId);

        // If empty, delete room
        if (rooms[roomId].players.length === 0) {
            delete rooms[roomId];
            return;
        }

        // Host Migration (if host left)
        if (!rooms[roomId].players.some(p => p.isHost)) {
            rooms[roomId].players[0].isHost = true;
        }

        // Notify remaining players
        io.to(roomId).emit('room_updated', {
            roomId,
            players: rooms[roomId].players
        });
        broadcastRoomList();
    };

    // 4. Start Game
    socket.on('start_game_request', ({ roomId }) => {
        if (rooms[roomId]) {
            rooms[roomId].status = 'playing';
            io.to(roomId).emit('game_started', {
                players: rooms[roomId].players
            });
        }
    });

    // 5. Game Actions (Relay)
    socket.on('game_action', ({ roomId, action, data }) => {
        // Relay this action to everyone else in the room
        socket.to(roomId).emit('game_action_received', {
            action,
            data,
            actorId: socket.id
        });
    });

    // 6. Get Rooms (Discovery)
    socket.on('get_rooms', () => {
        broadcastRoomList();
    });

    // Helper to broadcast room list update
    const broadcastRoomList = () => {
        const roomList = Object.values(rooms)
            .filter(r => r.status === 'waiting')
            .map(r => ({
                id: r.id,
                hostName: r.players.find(p => p.isHost)?.name || 'Bilinmiyor',
                playerCount: r.players.length
            }));
        io.emit('room_list', roomList);
    };
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Sunucu çalışıyor! Port: ${PORT}`);
    console.log(`Yerel Ağ Bağlantısı için IP adresini kullanın.`);
});
