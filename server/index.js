const express = require('express');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', '*');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

const DATA_FILE = path.join(__dirname, 'data.json');

let data = { users: {}, conversations: {}, messages: {} };

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (e) { console.error('load error', e); }
}

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (e) { console.error('save error', e); }
}

loadData();

function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
    }
    return String(h);
}

// Auth
app.post('/api/register', (req, res) => {
    const { username, password, email } = req.body;
    if (!username || username.length < 2) return res.json({ ok: false, error: 'username too short' });
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.json({ ok: false, error: 'invalid chars' });
    if (!password || password.length < 4) return res.json({ ok: false, error: 'password too short' });
    if (data.users[username]) return res.json({ ok: false, error: 'username taken' });
    const colors = ['5865f2', '57f287', 'fee75c', 'eb459e', 'ed4245', 'faa61a'];
    const color = colors[username.charCodeAt(0) % colors.length];
    const letter = (username[0] || '?').toUpperCase();
    const user = {
        id: 'u-' + uuidv4().slice(0, 8),
        username,
        email: email || '',
        passwordHash: hash(password),
        tag: String(Math.floor(Math.random() * 9000) + 1000),
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(letter)}&background=${color}&color=fff&size=128&bold=true`,
        bio: '',
        status: 'online',
        friends: [],
        friendRequests: { incoming: [], outgoing: [] },
        createdAt: Date.now()
    };
    data.users[username] = user;
    saveData();
    res.json({ ok: true, user: { ...user, passwordHash: undefined } });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = data.users[username];
    if (!user || user.passwordHash !== hash(password)) {
        return res.json({ ok: false, error: 'invalid credentials' });
    }
    res.json({ ok: true, user: { ...user, passwordHash: undefined } });
});

app.get('/api/users', (req, res) => {
    const list = {};
    Object.entries(data.users).forEach(([name, u]) => {
        list[name] = { ...u, passwordHash: undefined };
    });
    res.json(list);
});

app.get('/api/user-by-name/:username', (req, res) => {
    const u = data.users[req.params.username];
    if (!u) return res.json({ ok: false });
    res.json({ ok: true, user: { ...u, passwordHash: undefined } });
});

app.get('/api/users/:id', (req, res) => {
    const u = Object.values(data.users).find(x => x.id === req.params.id);
    if (!u) return res.json({ ok: false });
    res.json({ ok: true, user: { ...u, passwordHash: undefined } });
});

// WebSocket
const clients = new Map(); // userId -> ws

wss.on('connection', (ws, req) => {
    let userId = null;
    let username = null;

    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(raw.toString());
            const { type, payload } = msg;

            if (type === 'auth') {
                userId = payload.userId;
                username = payload.username;
                clients.set(userId, ws);
                broadcast({ type: 'user-status', payload: { userId, status: 'online' } }, userId);
                return;
            }

            if (type === 'friend-request') {
                const { fromUserId, toUserId, fromUsername } = payload;
                const target = Object.values(data.users).find(u => u.id === toUserId);
                const sender = Object.values(data.users).find(u => u.id === fromUserId);
                if (!target || !sender) return;
                target.friendRequests.incoming.push({ fromUserId, timestamp: Date.now() });
                sender.friendRequests.outgoing.push({ toUserId, timestamp: Date.now() });
                saveData();
                const targetClient = clients.get(toUserId);
                if (targetClient && targetClient.readyState === 1) {
                    targetClient.send(JSON.stringify({ type: 'friend-request-received', payload: { fromUserId, fromUsername, fromAvatar: sender.avatar } }));
                }
                if (ws.readyState === 1) {
                    ws.send(JSON.stringify({ type: 'friend-request-sent', payload: { toUserId } }));
                }
                return;
            }

            if (type === 'accept-friend') {
                const { userId: currentUserId, senderId } = payload;
                const current = Object.values(data.users).find(u => u.id === currentUserId);
                const sender = Object.values(data.users).find(u => u.id === senderId);
                if (!current || !sender) return;
                current.friendRequests.incoming = current.friendRequests.incoming.filter(r => r.fromUserId !== senderId);
                sender.friendRequests.outgoing = sender.friendRequests.outgoing.filter(r => r.toUserId !== currentUserId);
                if (!current.friends.includes(senderId)) current.friends.push(senderId);
                if (!sender.friends.includes(currentUserId)) sender.friends.push(currentUserId);
                saveData();
                const senderClient = clients.get(senderId);
                if (senderClient && senderClient.readyState === 1) {
                    senderClient.send(JSON.stringify({ type: 'friend-accepted', payload: { userId: currentUserId, username: current.username, avatar: current.avatar } }));
                }
                if (ws.readyState === 1) {
                    ws.send(JSON.stringify({ type: 'friend-accepted-done', payload: { userId: senderId, username: sender.username, avatar: sender.avatar } }));
                }
                return;
            }

            if (type === 'decline-friend') {
                const { userId: currentUserId, senderId } = payload;
                const current = Object.values(data.users).find(u => u.id === currentUserId);
                const sender = Object.values(data.users).find(u => u.id === senderId);
                if (!current || !sender) return;
                current.friendRequests.incoming = current.friendRequests.incoming.filter(r => r.fromUserId !== senderId);
                sender.friendRequests.outgoing = sender.friendRequests.outgoing.filter(r => r.toUserId !== currentUserId);
                saveData();
                if (ws.readyState === 1) {
                    ws.send(JSON.stringify({ type: 'friend-declined-done', payload: { userId: senderId } }));
                }
                return;
            }

            if (type === 'remove-friend') {
                const { userId: currentUserId, friendId } = payload;
                const current = Object.values(data.users).find(u => u.id === currentUserId);
                const target = Object.values(data.users).find(u => u.id === friendId);
                if (!current || !target) return;
                current.friends = current.friends.filter(id => id !== friendId);
                target.friends = target.friends.filter(id => id !== currentUserId);
                saveData();
                const targetClient = clients.get(friendId);
                if (targetClient && targetClient.readyState === 1) {
                    targetClient.send(JSON.stringify({ type: 'friend-removed', payload: { userId: currentUserId } }));
                }
                if (ws.readyState === 1) {
                    ws.send(JSON.stringify({ type: 'friend-removed-done', payload: { userId: friendId } }));
                }
                return;
            }

            if (type === 'message') {
                const { fromUserId, toUserId, content, key } = payload;
                if (!data.messages[key]) data.messages[key] = [];
                const msgObj = {
                    id: 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
                    content,
                    timestamp: Date.now(),
                    userId: fromUserId,
                    username: payload.fromUsername,
                    avatar: payload.fromAvatar
                };
                data.messages[key].push(msgObj);
                saveData();
                const targetClient = clients.get(toUserId);
                if (targetClient && targetClient.readyState === 1) {
                    targetClient.send(JSON.stringify({ type: 'new-message', payload: { key, message: msgObj } }));
                }
                if (ws.readyState === 1) {
                    ws.send(JSON.stringify({ type: 'message-sent', payload: { key, message: msgObj } }));
                }
                return;
            }

            if (type === 'get-messages') {
                const { key } = payload;
                const msgs = data.messages[key] || [];
                if (ws.readyState === 1) {
                    ws.send(JSON.stringify({ type: 'messages', payload: { key, messages: msgs } }));
                }
                return;
            }

            if (type === 'get-full-data') {
                const user = Object.values(data.users).find(u => u.id === userId);
                if (!user) return;
                const friends = user.friends.map(id => {
                    const f = Object.values(data.users).find(u => u.id === id);
                    return f ? { ...f, passwordHash: undefined } : null;
                }).filter(Boolean);
                const incoming = user.friendRequests.incoming.map(r => {
                    const u = Object.values(data.users).find(x => x.id === r.fromUserId);
                    return u ? { user: { ...u, passwordHash: undefined }, timestamp: r.timestamp } : null;
                }).filter(Boolean);
                const outgoing = user.friendRequests.outgoing.map(r => {
                    const u = Object.values(data.users).find(x => x.id === r.toUserId);
                    return u ? { user: { ...u, passwordHash: undefined }, timestamp: r.timestamp } : null;
                }).filter(Boolean);
                if (ws.readyState === 1) {
                    ws.send(JSON.stringify({ type: 'full-data', payload: { friends, incoming, outgoing, users: Object.fromEntries(Object.entries(data.users).map(([k, v]) => [k, { ...v, passwordHash: undefined }])) } }));
                }
                return;
            }

            if (type === 'call') {
                const { toUserId, fromUserId, fromUsername, fromAvatar, callType } = payload;
                const targetClient = clients.get(toUserId);
                if (targetClient && targetClient.readyState === 1) {
                    targetClient.send(JSON.stringify({ type: 'incoming-call', payload: { fromUserId, fromUsername, fromAvatar, callType } }));
                }
                return;
            }

            if (type === 'call-end') {
                const { toUserId } = payload;
                const targetClient = clients.get(toUserId);
                if (targetClient && targetClient.readyState === 1) {
                    targetClient.send(JSON.stringify({ type: 'call-ended', payload: {} }));
                }
                return;
            }

            if (type === 'call-accept') {
                const { toUserId } = payload;
                const targetClient = clients.get(toUserId);
                if (targetClient && targetClient.readyState === 1) {
                    targetClient.send(JSON.stringify({ type: 'call-accepted', payload: {} }));
                }
                return;
            }
        } catch (e) { console.error('ws msg error', e); }
    });

    ws.on('close', () => {
        if (userId) {
            clients.delete(userId);
            broadcast({ type: 'user-status', payload: { userId, status: 'offline' } }, userId);
        }
    });

    function broadcast(msg, excludeId) {
        clients.forEach((client, id) => {
            if (id !== excludeId && client.readyState === 1) {
                client.send(JSON.stringify(msg));
            }
        });
    }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log('Wibecord server running on port ' + PORT);
});
