const express = require('express');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

const db = new Database(path.join(__dirname, 'data.db'));
db.pragma('journal_mode = WAL');

db.exec(`CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    id TEXT UNIQUE,
    email TEXT DEFAULT '',
    passwordHash TEXT,
    tag TEXT,
    avatar TEXT,
    bio TEXT DEFAULT '',
    status TEXT DEFAULT 'online',
    friends TEXT DEFAULT '[]',
    friend_requests_incoming TEXT DEFAULT '[]',
    friend_requests_outgoing TEXT DEFAULT '[]',
    createdAt INTEGER
)`);

db.exec(`CREATE TABLE IF NOT EXISTS messages (
    key TEXT,
    id TEXT,
    content TEXT,
    timestamp INTEGER,
    userId TEXT,
    username TEXT,
    avatar TEXT,
    PRIMARY KEY (key, id)
)`);

function getUser(username) {
    const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!row) return null;
    return {
        ...row,
        friends: JSON.parse(row.friends || '[]'),
        friendRequests: {
            incoming: JSON.parse(row.friend_requests_incoming || '[]'),
            outgoing: JSON.parse(row.friend_requests_outgoing || '[]')
        }
    };
}

function getUserById(id) {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!row) return null;
    return {
        ...row,
        friends: JSON.parse(row.friends || '[]'),
        friendRequests: {
            incoming: JSON.parse(row.friend_requests_incoming || '[]'),
            outgoing: JSON.parse(row.friend_requests_outgoing || '[]')
        }
    };
}

function saveUser(user) {
    db.prepare(`INSERT OR REPLACE INTO users (username, id, email, passwordHash, tag, avatar, bio, status, friends, friend_requests_incoming, friend_requests_outgoing, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        user.username, user.id, user.email || '', user.passwordHash,
        user.tag, user.avatar, user.bio || '', user.status || 'online',
        JSON.stringify(user.friends || []),
        JSON.stringify(user.friendRequests?.incoming || []),
        JSON.stringify(user.friendRequests?.outgoing || []),
        user.createdAt || Date.now()
    );
}

function getAllUsers() {
    return db.prepare('SELECT * FROM users').all().map(row => ({
        ...row,
        friends: JSON.parse(row.friends || '[]'),
        friendRequests: {
            incoming: JSON.parse(row.friend_requests_incoming || '[]'),
            outgoing: JSON.parse(row.friend_requests_outgoing || '[]')
        }
    }));
}

function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
    }
    return String(h);
}

function stripUser(u) {
    const { passwordHash, ...rest } = u;
    return rest;
}

// Auth
app.post('/api/register', (req, res) => {
    const { username, password, email } = req.body;
    if (!username || username.length < 2) return res.json({ ok: false, error: 'username too short' });
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.json({ ok: false, error: 'invalid chars' });
    if (!password || password.length < 4) return res.json({ ok: false, error: 'password too short' });
    if (getUser(username)) return res.json({ ok: false, error: 'username taken' });
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
    saveUser(user);
    res.json({ ok: true, user: stripUser(user) });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = getUser(username);
    if (!user || user.passwordHash !== hash(password)) {
        return res.json({ ok: false, error: 'invalid credentials' });
    }
    res.json({ ok: true, user: stripUser(user) });
});

app.get('/api/users', (req, res) => {
    const list = {};
    getAllUsers().forEach(u => { list[u.username] = stripUser(u); });
    res.json(list);
});

app.get('/api/user-by-name/:username', (req, res) => {
    const input = req.params.username.toLowerCase();
    const all = getAllUsers();
    const found = all.find(u => u.username.toLowerCase() === input);
    if (!found) return res.json({ ok: false });
    res.json({ ok: true, user: stripUser(found) });
});

app.get('/api/users/:id', (req, res) => {
    const u = getUserById(req.params.id);
    if (!u) return res.json({ ok: false });
    res.json({ ok: true, user: stripUser(u) });
});

// WebSocket
const clients = new Map();

wss.on('connection', (ws) => {
    let userId = null;

    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(raw.toString());
            const { type, payload } = msg;

            if (type === 'auth') {
                userId = payload.userId;
                clients.set(userId, ws);
                broadcast({ type: 'user-status', payload: { userId, status: 'online' } }, userId);
                return;
            }

            if (type === 'friend-request') {
                const { fromUserId, toUserId, fromUsername } = payload;
                const target = getUserById(toUserId);
                const sender = getUserById(fromUserId);
                if (!target || !sender) return;
                target.friendRequests.incoming.push({ fromUserId, timestamp: Date.now() });
                sender.friendRequests.outgoing.push({ toUserId, timestamp: Date.now() });
                saveUser(target);
                saveUser(sender);
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
                const current = getUserById(currentUserId);
                const sender = getUserById(senderId);
                if (!current || !sender) return;
                current.friendRequests.incoming = current.friendRequests.incoming.filter(r => r.fromUserId !== senderId);
                sender.friendRequests.outgoing = sender.friendRequests.outgoing.filter(r => r.toUserId !== currentUserId);
                if (!current.friends.includes(senderId)) current.friends.push(senderId);
                if (!sender.friends.includes(currentUserId)) sender.friends.push(currentUserId);
                saveUser(current);
                saveUser(sender);
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
                const current = getUserById(currentUserId);
                const sender = getUserById(senderId);
                if (!current || !sender) return;
                current.friendRequests.incoming = current.friendRequests.incoming.filter(r => r.fromUserId !== senderId);
                sender.friendRequests.outgoing = sender.friendRequests.outgoing.filter(r => r.toUserId !== currentUserId);
                saveUser(current);
                saveUser(sender);
                if (ws.readyState === 1) {
                    ws.send(JSON.stringify({ type: 'friend-declined-done', payload: { userId: senderId } }));
                }
                return;
            }

            if (type === 'remove-friend') {
                const { userId: currentUserId, friendId } = payload;
                const current = getUserById(currentUserId);
                const target = getUserById(friendId);
                if (!current || !target) return;
                current.friends = current.friends.filter(id => id !== friendId);
                target.friends = target.friends.filter(id => id !== currentUserId);
                saveUser(current);
                saveUser(target);
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
                const { fromUserId, toUserId, content, key, fromUsername, fromAvatar } = payload;
                const msgObj = {
                    id: 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
                    content,
                    timestamp: Date.now(),
                    userId: fromUserId,
                    username: fromUsername,
                    avatar: fromAvatar
                };
                db.prepare('INSERT OR IGNORE INTO messages (key, id, content, timestamp, userId, username, avatar) VALUES (?, ?, ?, ?, ?, ?, ?)').run(key, msgObj.id, msgObj.content, msgObj.timestamp, msgObj.userId, msgObj.username, msgObj.avatar);
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
                const rows = db.prepare('SELECT * FROM messages WHERE key = ? ORDER BY timestamp').all(key);
                if (ws.readyState === 1) {
                    ws.send(JSON.stringify({ type: 'messages', payload: { key, messages: rows } }));
                }
                return;
            }

            if (type === 'get-full-data') {
                const user = getUserById(userId);
                if (!user) return;
                const allUsers = getAllUsers();
                const friends = (user.friends || []).map(id => {
                    const f = allUsers.find(u => u.id === id);
                    return f ? stripUser(f) : null;
                }).filter(Boolean);
                const incoming = (user.friendRequests?.incoming || []).map(r => {
                    const u = allUsers.find(x => x.id === r.fromUserId);
                    return u ? { user: stripUser(u), timestamp: r.timestamp } : null;
                }).filter(Boolean);
                const outgoing = (user.friendRequests?.outgoing || []).map(r => {
                    const u = allUsers.find(x => x.id === r.toUserId);
                    return u ? { user: stripUser(u), timestamp: r.timestamp } : null;
                }).filter(Boolean);
                const usersObj = {};
                allUsers.forEach(u => { usersObj[u.username] = stripUser(u); });
                if (ws.readyState === 1) {
                    ws.send(JSON.stringify({ type: 'full-data', payload: { friends, incoming, outgoing, users: usersObj } }));
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

            if (type === 'signal') {
                const { toUserId, signal } = payload;
                const targetClient = clients.get(toUserId);
                if (targetClient && targetClient.readyState === 1) {
                    targetClient.send(JSON.stringify({ type: 'signal', payload: { fromUserId: userId, signal } }));
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
