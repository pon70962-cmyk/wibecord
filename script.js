document.addEventListener('DOMContentLoaded', () => {
    // ===== DOM =====
    const authContainer = document.getElementById('auth-container');
    const mainApp = document.getElementById('main-app');
    const authSubtitle = document.getElementById('auth-subtitle');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');
    const authTabs = document.querySelectorAll('.tab');
    const switchToLogin = document.querySelector('.switch-to-login');
    const switchToRegister = document.querySelector('.switch-to-register');

    const homeBtn = document.getElementById('home-btn');
    const serverListEl = document.getElementById('server-list');
    const serverAddBtn = document.getElementById('server-add-btn');
    const dmPanel = document.getElementById('dm-panel');
    const serverPanel = document.getElementById('server-panel');
    const dmListEl = document.getElementById('dm-list');
    const dmSearch = document.getElementById('dm-search');
    const serverNameEl = document.getElementById('server-name');
    const serverSettingsBtn = document.getElementById('server-settings-btn');
    const channelListEl = document.getElementById('channel-list');
    const voiceListEl = document.getElementById('voice-list');
    const channelAddBtn = document.getElementById('channel-add-btn');
    const voiceAddBtn = document.getElementById('voice-add-btn');
    const channelNameEl = document.getElementById('channel-name');
    const chatHeaderIcon = document.getElementById('chat-header-icon');
    const dmStatusLabel = document.getElementById('dm-status-label');
    const chatMessages = document.getElementById('chat-messages');
    const welcomeMessage = document.getElementById('welcome-message');
    const welcomeIcon = document.getElementById('welcome-icon');
    const welcomeTitle = document.getElementById('welcome-title');
    const welcomeDesc = document.getElementById('welcome-desc');
    const welcomeChannel = document.getElementById('welcome-channel');
    const welcomeChannel2 = document.getElementById('welcome-channel-2');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const messageSearch = document.getElementById('message-search');
    const attachBtn = document.getElementById('attach-btn');
    const userAvatar = document.getElementById('user-avatar');
    const usernameDisplay = document.getElementById('username-display');
    const userTag = document.getElementById('user-tag');
    const userStatusDot = document.getElementById('user-status-dot');
    const userStatusBtn = document.getElementById('user-status-btn');
    const userSettingsBtn = document.getElementById('user-settings-btn');
    const userPanelInfo = document.getElementById('user-panel-info');
    const logoutBtn = document.getElementById('logout-btn');
    const userListEl = document.getElementById('user-list');
    const memberCountEl = document.getElementById('member-count');
    const membersToggle = document.getElementById('members-toggle');
    const membersPanel = document.getElementById('members-panel');
    const pinBtn = document.getElementById('pin-btn');

    const modalOverlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalCancel = document.getElementById('modal-cancel');
    const modalConfirm = document.getElementById('modal-confirm');

    const settingsOverlay = document.getElementById('settings-overlay');
    const settingsContent = document.getElementById('settings-content');
    const settingsClose = document.getElementById('settings-close');
    const settingsNavItems = document.querySelectorAll('.settings-nav-item');
    const settingsServerNav = document.getElementById('settings-server-nav');

    const friendsTabsContainer = document.getElementById('friends-tabs');
    const friendsView = document.getElementById('friends-view');
    const dmSearchWrap = document.getElementById('dm-search-wrap');
    const callOverlay = document.getElementById('call-overlay');
    const callBtn = document.getElementById('call-btn');
    const callAvatar = document.getElementById('call-avatar');
    const callUsername = document.getElementById('call-username');
    const callStatusText = document.getElementById('call-status-text');
    const callDuration = document.getElementById('call-duration');
    const callEndBtn = document.getElementById('call-end-btn');
    const callMuteBtn = document.getElementById('call-mute-btn');
    const callSpeakerBtn = document.getElementById('call-speaker-btn');

    // ===== STATE =====
    let users = JSON.parse(localStorage.getItem('wb-users') || '{}');
    // migrate old users to have friends field
    Object.values(users).forEach(u => {
        if (!u.friends) u.friends = [];
        if (!u.friendRequests) u.friendRequests = { incoming: [], outgoing: [] };
    });
    let currentUser = null;
    let currentUsername = null;
    let servers = JSON.parse(localStorage.getItem('wb-servers') || '[]');
    let dmConversations = JSON.parse(localStorage.getItem('wb-dms') || '[]');
    let viewMode = 'dm';
    let currentServerId = null;
    let currentChannelId = null;
    let currentDmUserId = null;
    let currentUserStatus = 'online';
    let settingsSection = 'profile';
    let appSettings = JSON.parse(localStorage.getItem('wb-app-settings') || '{}');
    let friendsTab = 'online';
    let callActive = false;
    let callTimer = null;
    let callSeconds = 0;
    let callMuted = false;
    let callSpeaker = false;

    let ws = null;
    let serverConnected = false;
    const SERVER_URL = window.location.hostname === 'localhost' ? 'ws://localhost:3001' : 'wss://wibecord-api.onrender.com';
    const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3001' : 'https://wibecord-api.onrender.com';

    const statuses = ['online', 'idle', 'dnd', 'offline'];
    const statusLabels = { online: 'В сети', idle: 'Не активен', dnd: 'Не беспокоить', offline: 'Не в сети' };

    // ===== INIT ICONS =====
    function setIcon(el, name, size) {
        el.innerHTML = '';
        el.appendChild(icon(name, size));
    }

    setIcon(serverSettingsBtn, 'settings', 18);
    setIcon(channelAddBtn, 'plus', 16);
    setIcon(voiceAddBtn, 'plus', 16);
    setIcon(userStatusBtn, 'mic', 18);
    setIcon(userSettingsBtn, 'settings', 18);
    setIcon(logoutBtn, 'logout', 18);
    setIcon(pinBtn, 'pin', 20);
    setIcon(membersToggle, 'members', 20);
    setIcon(callBtn, 'phone', 20);
    setIcon(attachBtn, 'attach', 20);
    setIcon(document.querySelector('.send-btn'), 'send', 20);
    setIcon(settingsClose, 'close', 18);
    setIcon(welcomeIcon, 'hash', 36);

    setIcon(document.querySelector('.dm-search-wrap .search-icon'), 'search', 16);

    document.querySelectorAll('.settings-nav-item').forEach(item => {
        const section = item.dataset.section;
        const iconMap = { profile: 'user', appearance: 'palette', privacy: 'shield', notifications: 'bell', server: 'settings', logout: 'logout' };
        if (iconMap[section]) {
            item.querySelector('.nav-icon').appendChild(icon(iconMap[section], 18));
        }
    });

    // ===== UTILS =====
    function hash(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) {
            h = ((h << 5) - h) + str.charCodeAt(i);
            h |= 0;
        }
        return String(h);
    }

    function generateTag() {
        return String(Math.floor(Math.random() * 9000) + 1000);
    }

    function avatarUrl(name, seed) {
        const colors = ['5865f2', '57f287', 'fee75c', 'eb459e', 'ed4245', 'faa61a'];
        const color = colors[(seed || name.charCodeAt(0)) % colors.length];
        const letter = (name[0] || '?').toUpperCase();
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(letter)}&background=${color}&color=fff&size=128&bold=true`;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function getUserById(id) {
        return Object.values(users).find(u => u.id === id);
    }

    function getUserByUsername(name) {
        return users[name];
    }

    function dmKey(id1, id2) {
        return [id1, id2].sort().join('-');
    }

    function saveUsers() { localStorage.setItem('wb-users', JSON.stringify(users)); }
    function saveServers() { localStorage.setItem('wb-servers', JSON.stringify(servers)); }
    function saveDms() { localStorage.setItem('wb-dms', JSON.stringify(dmConversations)); }
    function saveAppSettings() { localStorage.setItem('wb-app-settings', JSON.stringify(appSettings)); }

    function saveSession() {
        if (currentUsername) {
            localStorage.setItem('wb-session', JSON.stringify({ username: currentUsername }));
        } else {
            localStorage.removeItem('wb-session');
        }
    }

    function saveUIState() {
        localStorage.setItem('wb-ui-state', JSON.stringify({
            viewMode,
            serverId: currentServerId,
            channelId: currentChannelId,
            dmUserId: currentDmUserId
        }));
    }

    function showError(el, msg) { el.textContent = msg; }
    function clearErrors() { loginError.textContent = ''; registerError.textContent = ''; }
    function resetForm(form) { form.reset(); }

    // ===== AUTH =====
    function showTab(tab) {
        authTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        loginForm.classList.toggle('hidden', tab !== 'login');
        registerForm.classList.toggle('hidden', tab !== 'register');
        authSubtitle.textContent = tab === 'login' ? 'Рады видеть снова!' : 'Создайте аккаунт';
        clearErrors();
    }

    authTabs.forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
    switchToLogin.addEventListener('click', () => showTab('login'));
    switchToRegister.addEventListener('click', () => showTab('register'));

    registerForm.addEventListener('submit', async e => {
        e.preventDefault();
        clearErrors();

        const email = document.getElementById('reg-email').value.trim();
        const username = document.getElementById('reg-username').value.trim();
        const password = document.getElementById('reg-password').value;
        const confirm = document.getElementById('reg-password-confirm').value;

        if (username.length < 2) { showError(registerError, 'Имя пользователя должно быть не короче 2 символов'); return; }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) { showError(registerError, 'Имя может содержать только буквы, цифры и _'); return; }
        if (password.length < 4) { showError(registerError, 'Пароль должен быть не короче 4 символов'); return; }
        if (password !== confirm) { showError(registerError, 'Пароли не совпадают'); return; }

        try {
            const res = await fetch(API_URL + '/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, email }) });
            const data = await res.json();
            if (data.ok) {
                users[username] = { ...data.user, passwordHash: hash(password) };
                saveUsers();
                showTab('login');
                resetForm(registerForm);
                document.getElementById('login-username').value = username;
                authSubtitle.textContent = 'Аккаунт создан! Теперь войдите.';
            } else {
                if (data.error === 'username taken') { showError(registerError, 'Это имя пользователя уже занято'); return; }
                showError(registerError, data.error || 'Ошибка регистрации');
            }
        } catch (e) {
            if (users[username]) { showError(registerError, 'Это имя пользователя уже занято'); return; }
            users[username] = {
                id: 'u-' + Date.now(),
                username,
                email: email || '',
                passwordHash: hash(password),
                tag: generateTag(),
                avatar: avatarUrl(username),
                bio: '',
                status: 'online',
                friends: [],
                friendRequests: { incoming: [], outgoing: [] },
                createdAt: Date.now()
            };
            saveUsers();
            showTab('login');
            resetForm(registerForm);
            document.getElementById('login-username').value = username;
            authSubtitle.textContent = 'Аккаунт создан! Теперь войдите.';
        }
    });

    loginForm.addEventListener('submit', async e => {
        e.preventDefault();
        clearErrors();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        try {
            const res = await fetch(API_URL + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
            const data = await res.json();
            if (data.ok) {
                const su = data.user;
                if (!users[username]) {
                    users[username] = { ...su, passwordHash: hash(password), friends: [], friendRequests: { incoming: [], outgoing: [] } };
                    saveUsers();
                }
                login(username);
                return;
            }
        } catch (e) {}

        const user = users[username];
        if (!user || user.passwordHash !== hash(password)) {
            showError(loginError, 'Неверное имя пользователя или пароль');
            return;
        }
        fetch(API_URL + '/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user.username, password: 'local-' + user.id, email: user.email || '' }) }).catch(() => {});
        login(username);
    });

    function login(username) {
        currentUsername = username;
        currentUser = users[username];
        if (!currentUser) { localStorage.removeItem('wb-session'); return; }
        currentUserStatus = currentUser.status || 'online';
        saveSession();

        fetch(API_URL + '/api/users').then(r => r.json()).then(serverUsers => {
            if (serverUsers) {
                Object.entries(serverUsers).forEach(([name, su]) => {
                    if (!users[name]) {
                        users[name] = { ...su, passwordHash: '' };
                    } else {
                        users[name].id = su.id;
                        users[name].avatar = su.avatar;
                        users[name].tag = su.tag;
                        if (su.friends) users[name].friends = su.friends;
                        if (su.friendRequests) users[name].friendRequests = su.friendRequests;
                    }
                });
                saveUsers();
                currentUser = users[username];
                if (currentUser) {
                    currentUserStatus = currentUser.status || 'online';
                    updateUserPanel();
                    if (viewMode === 'dm') { renderFriendsView(friendsTab); renderDmList(); }
                }
            }
        }).catch(() => {});

        if (servers.length === 0) createDefaultServer();

        const uiState = JSON.parse(localStorage.getItem('wb-ui-state') || '{}');
        viewMode = uiState.viewMode || 'dm';
        currentServerId = uiState.serverId || servers[0]?.id;
        currentDmUserId = uiState.dmUserId || null;

        if (viewMode === 'server') {
            const server = servers.find(s => s.id === currentServerId) || servers[0];
            if (server) {
                currentServerId = server.id;
                const textChan = server.channels.find(c => c.type === 'text');
                currentChannelId = uiState.channelId || textChan?.id || server.channels[0]?.id;
            }
        }

        authContainer.classList.add('hidden');
        mainApp.classList.remove('hidden');
        applyAppSettings();
        updateUserPanel();
        if (viewMode === 'dm') selectDmView();
        else selectServer(currentServerId);
        connectServer();
    }

    function logout() {
        disconnectServer();
        currentUser = null;
        currentUsername = null;
        saveSession();
        closeSettings();
        authContainer.classList.remove('hidden');
        mainApp.classList.add('hidden');
        showTab('login');
    }

    logoutBtn.addEventListener('click', logout);

    // ===== SERVER CONNECTION =====
    function connectServer() {
        if (!currentUser) return;
        try {
            ws = new WebSocket(SERVER_URL);
            ws.onopen = () => {
                serverConnected = true;
                ws.send(JSON.stringify({ type: 'auth', payload: { userId: currentUser.id, username: currentUsername } }));
                ws.send(JSON.stringify({ type: 'get-full-data', payload: { userId: currentUser.id } }));
            };
            ws.onmessage = (e) => {
                try {
                    const msg = JSON.parse(e.data);
                    handleServerMessage(msg);
                } catch (err) {}
            };
            ws.onclose = () => { serverConnected = false; };
            ws.onerror = () => { serverConnected = false; };
        } catch (e) { serverConnected = false; }
    }

    function disconnectServer() {
        if (ws) { ws.close(); ws = null; }
        serverConnected = false;
    }

    function handleServerMessage(msg) {
        const { type, payload } = msg;
        if (type === 'full-data') {
            const { friends, incoming, outgoing, users: serverUsers } = payload;
            users = serverUsers || users;
            if (currentUser) {
                currentUser.friends = friends.map(f => f.id);
                currentUser.friendRequests = { incoming: incoming.map(r => ({ fromUserId: r.user.id, timestamp: r.timestamp })), outgoing: outgoing.map(r => ({ toUserId: r.user.id, timestamp: r.timestamp })) };
                users[currentUsername] = { ...currentUser };
                localStorage.setItem('wb-users', JSON.stringify(users));
                renderFriendsView(friendsTab);
                renderDmList();
            }
        }
        if (type === 'friend-request-received') {
            const u = Object.values(users).find(x => x.id === payload.fromUserId);
            if (!u) return;
            currentUser.friendRequests.incoming.push({ fromUserId: payload.fromUserId, timestamp: Date.now() });
            users[currentUsername] = { ...currentUser };
            localStorage.setItem('wb-users', JSON.stringify(users));
            if (friendsTab === 'pending') renderFriendsView('pending');
        }
        if (type === 'friend-request-sent') {
            renderFriendsView(friendsTab);
        }
        if (type === 'friend-accepted') {
            if (!currentUser.friends.includes(payload.userId)) currentUser.friends.push(payload.userId);
            currentUser.friendRequests.outgoing = currentUser.friendRequests.outgoing.filter(r => r.toUserId !== payload.userId);
            users[currentUsername] = { ...currentUser };
            localStorage.setItem('wb-users', JSON.stringify(users));
            ensureDmConversation(payload.userId);
            renderFriendsView(friendsTab);
            renderDmList();
        }
        if (type === 'friend-accepted-done') {
            if (!currentUser.friends.includes(payload.userId)) currentUser.friends.push(payload.userId);
            currentUser.friendRequests.incoming = currentUser.friendRequests.incoming.filter(r => r.fromUserId !== payload.userId);
            users[currentUsername] = { ...currentUser };
            localStorage.setItem('wb-users', JSON.stringify(users));
            ensureDmConversation(payload.userId);
            renderFriendsView(friendsTab);
            renderDmList();
        }
        if (type === 'friend-declined-done') {
            currentUser.friendRequests.incoming = currentUser.friendRequests.incoming.filter(r => r.fromUserId !== payload.userId);
            users[currentUsername] = { ...currentUser };
            localStorage.setItem('wb-users', JSON.stringify(users));
            renderFriendsView(friendsTab);
        }
        if (type === 'friend-removed') {
            currentUser.friends = currentUser.friends.filter(id => id !== payload.userId);
            users[currentUsername] = { ...currentUser };
            localStorage.setItem('wb-users', JSON.stringify(users));
            renderFriendsView(friendsTab);
            renderDmList();
        }
        if (type === 'friend-removed-done') {
            currentUser.friends = currentUser.friends.filter(id => id !== payload.userId);
            users[currentUsername] = { ...currentUser };
            localStorage.setItem('wb-users', JSON.stringify(users));
            renderFriendsView(friendsTab);
            renderDmList();
        }
        if (type === 'new-message') {
            const { key, message } = payload;
            const msgs = JSON.parse(localStorage.getItem(key) || '[]');
            msgs.push(message);
            localStorage.setItem(key, JSON.stringify(msgs));
            if (viewMode === 'dm') {
                const k = `dm-${dmKey(currentUser.id, currentDmUserId)}`;
                if (key === k) renderMessages();
            }
        }
        if (type === 'messages') {
            const { key, messages } = payload;
            if (messages && messages.length > 0) {
                localStorage.setItem(key, JSON.stringify(messages));
                if (viewMode === 'dm') {
                    const k = `dm-${dmKey(currentUser.id, currentDmUserId)}`;
                    if (key === k) renderMessages();
                }
            }
        }
        if (type === 'incoming-call') {
            if (confirm('Входящий звонок от ' + payload.fromUsername + '. Ответить?')) {
                ws.send(JSON.stringify({ type: 'call-accept', payload: { toUserId: payload.fromUserId } }));
                startCall(payload.fromUserId);
            }
        }
        if (type === 'call-ended') {
            if (callActive) { endCall(); alert('Звонок завершён'); }
        }
        if (type === 'call-accepted') {
            if (callActive) { callStatusText.textContent = 'Идёт звонок'; }
        }
    }

    // ===== FRIENDS SYSTEM =====
    function getFriends() {
        if (!currentUser) return [];
        return currentUser.friends.map(id => getUserById(id)).filter(Boolean);
    }

    function getPendingIncoming() {
        if (!currentUser) return [];
        return currentUser.friendRequests.incoming.map(r => {
            const u = getUserById(r.fromUserId);
            return u ? { user: u, timestamp: r.timestamp } : null;
        }).filter(Boolean);
    }

    function getPendingOutgoing() {
        if (!currentUser) return [];
        return currentUser.friendRequests.outgoing.map(r => {
            const u = getUserById(r.toUserId);
            return u ? { user: u, timestamp: r.timestamp } : null;
        }).filter(Boolean);
    }

    async function sendFriendRequest(username) {
        let target = Object.values(users).find(u => u.username.toLowerCase() === username.toLowerCase());

        if (!target) {
            try {
                const res = await fetch(API_URL + '/api/user-by-name/' + encodeURIComponent(username));
                const data = await res.json();
                if (data.ok && data.user) {
                    const u = data.user;
                    if (!users[u.username]) {
                        users[u.username] = { ...u, passwordHash: '', friends: u.friends || [], friendRequests: u.friendRequests || { incoming: [], outgoing: [] } };
                        saveUsers();
                    }
                    target = users[u.username];
                }
            } catch (e) {}
        }

        if (!target) { showModal('Ошибка', '<p style="color:var(--text-muted)">Пользователь не найден</p>', null, 'OK'); return false; }
        if (target.id === currentUser.id) { showModal('Ошибка', '<p style="color:var(--text-muted)">Нельзя добавить самого себя</p>', null, 'OK'); return false; }
        if (currentUser.friends.includes(target.id)) { showModal('Ошибка', '<p style="color:var(--text-muted)">Уже в друзьях</p>', null, 'OK'); return false; }
        if (currentUser.friendRequests.outgoing.some(r => r.toUserId === target.id)) { showModal('Ошибка', '<p style="color:var(--text-muted)">Заявка уже отправлена</p>', null, 'OK'); return false; }

        if (serverConnected && ws && ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'friend-request', payload: { fromUserId: currentUser.id, toUserId: target.id, fromUsername: currentUsername } }));
            currentUser.friendRequests.outgoing.push({ toUserId: target.id, timestamp: Date.now() });
            target.friendRequests.incoming.push({ fromUserId: currentUser.id, timestamp: Date.now() });
            users[currentUsername] = { ...currentUser };
            users[target.username] = { ...target };
            saveUsers();
            renderFriendsView(friendsTab);
            return true;
        }

        currentUser.friendRequests.outgoing.push({ toUserId: target.id, timestamp: Date.now() });
        target.friendRequests.incoming.push({ fromUserId: currentUser.id, timestamp: Date.now() });
        users[currentUsername] = { ...currentUser };
        users[target.username] = { ...target };
        saveUsers();
        renderFriendsView(friendsTab);
        return true;
    }

    function acceptFriendRequest(userId) {
        const req = currentUser.friendRequests.incoming.find(r => r.fromUserId === userId);
        if (!req) return;
        const sender = getUserById(userId);
        if (!sender) return;

        if (serverConnected && ws && ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'accept-friend', payload: { userId: currentUser.id, senderId: userId } }));
            currentUser.friendRequests.incoming = currentUser.friendRequests.incoming.filter(r => r.fromUserId !== userId);
            sender.friendRequests.outgoing = sender.friendRequests.outgoing.filter(r => r.toUserId !== currentUser.id);
            if (!currentUser.friends.includes(userId)) currentUser.friends.push(userId);
            if (!sender.friends.includes(currentUser.id)) sender.friends.push(currentUser.id);
            users[currentUsername] = { ...currentUser };
            users[sender.username] = { ...sender };
            saveUsers();
            ensureDmConversation(userId);
            renderDmList();
            renderFriendsView(friendsTab);
            return;
        }

        currentUser.friendRequests.incoming = currentUser.friendRequests.incoming.filter(r => r.fromUserId !== userId);
        sender.friendRequests.outgoing = sender.friendRequests.outgoing.filter(r => r.toUserId !== currentUser.id);

        if (!currentUser.friends.includes(userId)) currentUser.friends.push(userId);
        if (!sender.friends.includes(currentUser.id)) sender.friends.push(currentUser.id);

        users[currentUsername] = { ...currentUser };
        users[sender.username] = { ...sender };
        saveUsers();

        ensureDmConversation(userId);
        renderDmList();
        renderFriendsView(friendsTab);
    }

    function declineFriendRequest(userId) {
        if (serverConnected && ws && ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'decline-friend', payload: { userId: currentUser.id, senderId: userId } }));
        }
        currentUser.friendRequests.incoming = currentUser.friendRequests.incoming.filter(r => r.fromUserId !== userId);
        const sender = getUserById(userId);
        if (sender) {
            sender.friendRequests.outgoing = sender.friendRequests.outgoing.filter(r => r.toUserId !== currentUser.id);
            users[sender.username] = { ...sender };
        }
        users[currentUsername] = { ...currentUser };
        saveUsers();
        renderFriendsView(friendsTab);
    }

    function removeFriend(userId) {
        if (serverConnected && ws && ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'remove-friend', payload: { userId: currentUser.id, friendId: userId } }));
        }
        currentUser.friends = currentUser.friends.filter(id => id !== userId);
        const target = getUserById(userId);
        if (target) {
            target.friends = target.friends.filter(id => id !== currentUser.id);
            users[target.username] = { ...target };
        }
        users[currentUsername] = { ...currentUser };
        saveUsers();
        renderFriendsView(friendsTab);
        renderDmList();
    }

    function renderFriendsView(tab) {
        friendsTab = tab;
        friendsView.innerHTML = '';

        document.querySelectorAll('.friends-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.friendsTab === tab);
        });

        dmSearchWrap.classList.toggle('hidden', tab !== 'all');
        document.getElementById('dm-list').classList.toggle('hidden', tab !== 'all');

        if (tab === 'add') {
            dmSearchWrap.classList.add('hidden');
            document.getElementById('dm-list').classList.add('hidden');
            friendsView.innerHTML = `
                <div class="friends-empty">
                    <div class="empty-icon">${iconHtml('user', 40)}</div>
                    <h3>Добавить друга</h3>
                    <p style="margin-bottom:16px">Введите имя пользователя (username) чтобы отправить заявку</p>
                    <div class="add-friend-input-wrap">
                        <input class="add-friend-input" id="add-friend-input" placeholder="username" autofocus>
                        <button class="add-friend-btn" id="add-friend-submit">Отправить заявку</button>
                    </div>
                    <div id="add-friend-result" style="margin-top:8px;font-size:13px"></div>
                </div>
            `;
            const input = document.getElementById('add-friend-input');
            const submitBtn = document.getElementById('add-friend-submit');
            const result = document.getElementById('add-friend-result');
            async function doSend() {
                const val = input.value.trim();
                if (!val) return;
                if (await sendFriendRequest(val)) {
                    result.style.color = 'var(--green)';
                    result.textContent = 'Заявка отправлена!';
                    input.value = '';
                }
            }
            submitBtn.addEventListener('click', doSend);
            input.addEventListener('keydown', e => { if (e.key === 'Enter') doSend(); });
            setTimeout(() => input.focus(), 100);
            return;
        }

        let items = [];
        if (tab === 'online') {
            items = getFriends().filter(u => (u.id === currentUser.id ? currentUserStatus : (u.status || 'online')) !== 'offline');
        } else if (tab === 'pending') {
            const incoming = getPendingIncoming();
            const outgoing = getPendingOutgoing();
            if (incoming.length === 0 && outgoing.length === 0) {
                friendsView.innerHTML = `<div class="friends-empty"><div class="empty-icon">${iconHtml('user', 40)}</div><h3>Нет заявок</h3><p style="color:var(--text-muted)">У вас нет ожидающих заявок в друзья.</p></div>`;
                return;
            }
            if (incoming.length > 0) {
                const title = document.createElement('div');
                title.style.cssText = 'font-size:12px;color:var(--text-muted);font-weight:600;padding:8px 4px;text-transform:uppercase;letter-spacing:0.02em';
                title.textContent = 'Входящие заявки';
                friendsView.appendChild(title);
                incoming.forEach(r => {
                    const el = document.createElement('div');
                    el.className = 'friend-item';
                    el.style.cursor = 'default';
                    el.innerHTML = `
                        <img src="${r.user.avatar}">
                        <div class="friend-item-info">
                            <div class="friend-item-name">${escapeHtml(r.user.username)}</div>
                            <div class="friend-item-status">Хочет добавить вас в друзья</div>
                        </div>
                        <div class="friend-item-actions">
                            <button class="friend-action-btn accept" title="Принять"><span style="font-size:18px;font-weight:700;line-height:1">✓</span></button>
                            <button class="friend-action-btn decline" title="Отклонить"><span style="font-size:18px;font-weight:700;line-height:1">✕</span></button>
                        </div>
                    `;
                    el.querySelector('.accept').addEventListener('click', () => acceptFriendRequest(r.user.id));
                    el.querySelector('.decline').addEventListener('click', () => declineFriendRequest(r.user.id));
                    friendsView.appendChild(el);
                });
            }
            if (outgoing.length > 0) {
                const title = document.createElement('div');
                title.style.cssText = 'font-size:12px;color:var(--text-muted);font-weight:600;padding:8px 4px;text-transform:uppercase;letter-spacing:0.02em';
                title.textContent = 'Исходящие заявки';
                friendsView.appendChild(title);
                outgoing.forEach(r => {
                    const el = document.createElement('div');
                    el.className = 'friend-item';
                    el.style.cursor = 'default';
                    el.innerHTML = `
                        <img src="${r.user.avatar}">
                        <div class="friend-item-info">
                            <div class="friend-item-name">${escapeHtml(r.user.username)}</div>
                            <div class="friend-item-status">Ожидание ответа</div>
                        </div>
                    `;
                    friendsView.appendChild(el);
                });
            }
            return;
        } else {
            items = getFriends();
        }

        if (items.length === 0) {
            const label = tab === 'online' ? 'никого нет онлайн' : 'список друзей пуст';
            friendsView.innerHTML = `<div class="friends-empty"><div class="empty-icon">${iconHtml('user', 40)}</div><h3>${tab === 'online' ? 'Нет друзей онлайн' : 'Список друзей пуст'}</h3><p style="color:var(--text-muted)">Перейдите на вкладку "Добавить", чтобы найти друзей.</p></div>`;
            return;
        }

        items.forEach(u => {
            const status = u.id === currentUser.id ? currentUserStatus : (u.status || 'online');
            const el = document.createElement('div');
            el.className = 'friend-item';
            el.innerHTML = `
                <img src="${u.avatar}">
                <div class="friend-item-info">
                    <div class="friend-item-name">${escapeHtml(u.username)}</div>
                    <div class="friend-item-status">
                        <span class="status-dot-inline ${status}"></span>
                        ${statusLabels[status] || 'В сети'}
                    </div>
                </div>
                <div class="friend-item-actions">
                    <button class="friend-action-btn" title="Написать"><span style="font-size:16px;font-weight:600;line-height:1">✉</span></button>
                    <button class="friend-action-btn remove-friend" title="Удалить из друзей"><span style="font-size:16px;font-weight:600;line-height:1">✕</span></button>
                </div>
            `;
            el.querySelector('.friend-item-actions .friend-action-btn:first-child').addEventListener('click', e => {
                e.stopPropagation();
                selectDmView();
                openDm(u.id);
            });
            el.querySelector('.friend-item-actions .remove-friend').addEventListener('click', e => {
                e.stopPropagation();
                removeFriend(u.id);
            });
            el.addEventListener('click', () => {
                selectDmView();
                openDm(u.id);
            });
            friendsView.appendChild(el);
        });
    }

    friendsTabsContainer.addEventListener('click', e => {
        const tab = e.target.closest('.friends-tab');
        if (tab) renderFriendsView(tab.dataset.friendsTab);
    });

    // ===== CALL =====
    function startCall(userId) {
        const partner = getUserById(userId);
        if (!partner) return;
        callActive = true;
        callSeconds = 0;
        callMuted = false;
        callSpeaker = false;
        callOverlay.classList.remove('hidden');
        callAvatar.src = partner.avatar;
        callUsername.textContent = partner.username;
        callStatusText.textContent = 'Звонок...';
        callDuration.textContent = '00:00';
        updateCallButtons();

        if (serverConnected && ws && ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'call', payload: { toUserId: userId, fromUserId: currentUser.id, fromUsername: currentUser.username, fromAvatar: currentUser.avatar, callType: 'audio' } }));
        }

        if (callTimer) clearInterval(callTimer);
        callTimer = setInterval(() => {
            callSeconds++;
            const m = String(Math.floor(callSeconds / 60)).padStart(2, '0');
            const s = String(callSeconds % 60).padStart(2, '0');
            callDuration.textContent = m + ':' + s;
            if (callSeconds === 2) callStatusText.textContent = 'Идёт звонок';
        }, 1000);
    }

    function endCall() {
        if (callActive && serverConnected && ws && ws.readyState === 1 && currentDmUserId) {
            ws.send(JSON.stringify({ type: 'call-end', payload: { toUserId: currentDmUserId } }));
        }
        callActive = false;
        if (callTimer) { clearInterval(callTimer); callTimer = null; }
        callOverlay.classList.add('hidden');
    }

    function updateCallButtons() {
        callMuteBtn.innerHTML = iconHtml(callMuted ? 'mic-off' : 'mic', 22);
        callSpeakerBtn.innerHTML = iconHtml(callSpeaker ? 'speaker' : 'phone', 22);
    }

    callEndBtn.addEventListener('click', endCall);
    callMuteBtn.addEventListener('click', () => { callMuted = !callMuted; updateCallButtons(); });
    callSpeakerBtn.addEventListener('click', () => { callSpeaker = !callSpeaker; updateCallButtons(); });

    callBtn.addEventListener('click', () => {
        if (viewMode === 'dm' && currentDmUserId) startCall(currentDmUserId);
    });

    // ===== DEFAULT SERVER =====
    function createDefaultServer() {
        const server = {
            id: 'srv-' + Date.now(),
            name: 'Wibecord HQ',
            icon: '',
            ownerId: currentUser.id,
            channels: [
                { id: 'c-' + Date.now(), name: 'general', type: 'text' },
                { id: 'c-' + (Date.now() + 1), name: 'random', type: 'text' },
                { id: 'c-' + (Date.now() + 2), name: 'Общий', type: 'voice' }
            ],
            members: Object.values(users).map(u => u.id)
        };
        servers.push(server);
        saveServers();
        localStorage.setItem(`msgs-${server.id}-${server.channels[0].id}`, JSON.stringify([{
            id: 'msg-welcome',
            content: `Добро пожаловать на ${server.name}! Это ваш новый сервер.`,
            timestamp: Date.now(),
            userId: 'system',
            username: 'Wibecord',
            avatar: avatarUrl('W'),
            type: 'system'
        }]));
    }

    // ===== VIEW MODES =====
    function selectDmView() {
        viewMode = 'dm';
        currentServerId = null;
        currentChannelId = null;
        homeBtn.classList.add('active');
        serverListEl.querySelectorAll('.server-icon').forEach(el => el.classList.remove('active'));
        dmPanel.classList.remove('hidden');
        serverPanel.classList.add('hidden');
        membersPanel.classList.add('hidden');
        membersToggle.classList.add('hidden');
        pinBtn.classList.add('hidden');
        callBtn.classList.add('hidden');
        saveUIState();
        renderFriendsView(friendsTab);
        renderDmList();
        if (!currentDmUserId && dmConversations.length > 0) {
            currentDmUserId = dmConversations[0].partnerId;
        }
        if (currentDmUserId) openDm(currentDmUserId);
        else showDmEmpty();
    }

    function showDmEmpty() {
        chatHeaderIcon.innerHTML = iconHtml('dm', 24);
        channelNameEl.textContent = 'Личные сообщения';
        dmStatusLabel.classList.add('hidden');
        messageInput.placeholder = 'Выберите беседу или начните новую';
        messageInput.disabled = true;
        callBtn.classList.add('hidden');
        welcomeTitle.textContent = 'Личные сообщения';
        welcomeDesc.innerHTML = 'Выберите друга из списка слева или нажмите <strong>+</strong>, чтобы написать кому-нибудь.';
        setIcon(welcomeIcon, 'dm', 36);
        welcomeMessage.style.display = 'block';
        chatMessages.innerHTML = '';
        chatMessages.appendChild(welcomeMessage);
    }

    function selectServer(id) {
        viewMode = 'server';
        currentServerId = id;
        currentDmUserId = null;
        homeBtn.classList.remove('active');
        dmPanel.classList.add('hidden');
        serverPanel.classList.remove('hidden');
        membersPanel.classList.remove('hidden');
        membersToggle.classList.remove('hidden');
        pinBtn.classList.remove('hidden');
        callBtn.classList.add('hidden');
        messageInput.disabled = false;

        const server = servers.find(s => s.id === id);
        const textChan = server.channels.find(c => c.type === 'text');
        if (!currentChannelId || !server.channels.find(c => c.id === currentChannelId)) {
            currentChannelId = textChan?.id || server.channels[0]?.id;
        }
        saveUIState();
        renderServers();
        renderChannels();
        renderMessages();
        renderMembers();
    }

    homeBtn.addEventListener('click', selectDmView);

    // ===== USER PANEL =====
    function updateUserPanel() {
        if (!currentUser) return;
        usernameDisplay.textContent = currentUser.username;
        userTag.textContent = '#' + currentUser.tag;
        userAvatar.src = currentUser.avatar;
        userStatusDot.className = 'status-dot ' + currentUserStatus;
    }

    userStatusBtn.addEventListener('click', () => openSettings('profile'));
    userSettingsBtn.addEventListener('click', () => openSettings('profile'));
    userPanelInfo.addEventListener('click', () => openSettings('profile'));

    // ===== DM =====
    function ensureDmConversation(partnerId) {
        if (!dmConversations.find(d => d.partnerId === partnerId)) {
            dmConversations.unshift({ partnerId, lastMessage: '', lastTime: Date.now() });
            saveDms();
        }
    }

    function openDm(partnerId) {
        currentDmUserId = partnerId;
        messageInput.disabled = false;
        ensureDmConversation(partnerId);
        saveUIState();

        const partner = getUserById(partnerId);
        if (!partner) return;

        callBtn.classList.remove('hidden');

        chatHeaderIcon.innerHTML = `<img src="${partner.avatar}" alt="" class="dm-header-avatar">`;
        channelNameEl.textContent = partner.username;
        const status = partner.id === currentUser.id ? currentUserStatus : (partner.status || 'online');
        dmStatusLabel.textContent = statusLabels[status];
        dmStatusLabel.classList.remove('hidden');
        messageInput.placeholder = `Написать @${partner.username}`;

        welcomeTitle.textContent = `Это начало вашей переписки с ${partner.username}`;
        welcomeDesc.innerHTML = `Отправьте первое сообщение пользователю <strong>${partner.username}</strong>.`;
        setIcon(welcomeIcon, 'dm', 36);

        renderDmList();
        renderMessages();
    }

    function renderDmList() {
        dmListEl.innerHTML = '';
        const term = dmSearch.value.toLowerCase();

        const sorted = [...dmConversations].sort((a, b) => b.lastTime - a.lastTime);

        sorted.forEach(conv => {
            const partner = getUserById(conv.partnerId);
            if (!partner || partner.id === currentUser.id) return;
            if (term && !partner.username.toLowerCase().includes(term)) return;

            const div = document.createElement('div');
            div.className = 'dm-item' + (conv.partnerId === currentDmUserId ? ' active' : '');
            div.innerHTML = `
                <img src="${partner.avatar}" alt="">
                <div class="dm-item-info">
                    <div class="dm-item-name">${escapeHtml(partner.username)}</div>
                    <div class="dm-item-preview">${conv.lastMessage ? escapeHtml(conv.lastMessage) : 'Нет сообщений'}</div>
                </div>
            `;
            div.addEventListener('click', () => openDm(conv.partnerId));
            dmListEl.appendChild(div);
        });

        if (dmListEl.children.length === 0) {
            dmListEl.innerHTML = '<p style="padding:16px;color:var(--text-muted);font-size:14px;text-align:center">Нет бесед. Нажмите + чтобы написать.</p>';
        }
    }

    dmSearch.addEventListener('input', renderDmList);



    // ===== SERVERS =====
    function renderServers() {
        serverListEl.innerHTML = '';
        servers.forEach(srv => {
            const btn = document.createElement('button');
            btn.className = 'server-icon' + (viewMode === 'server' && srv.id === currentServerId ? ' active' : '');
            btn.title = srv.name;
            btn.dataset.id = srv.id;

            const pill = document.createElement('span');
            pill.className = 'server-pill';
            btn.appendChild(pill);

            if (srv.icon) {
                const img = document.createElement('img');
                img.src = srv.icon;
                img.alt = srv.name;
                btn.appendChild(img);
            } else {
                const abbr = document.createElement('span');
                abbr.className = 'server-abbr';
                abbr.textContent = srv.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                btn.appendChild(abbr);
            }

            btn.addEventListener('click', () => selectServer(srv.id));
            serverListEl.appendChild(btn);
        });
    }

    serverAddBtn.addEventListener('click', () => {
        showModal('Создать сервер', `
            <label style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:8px;">НАЗВАНИЕ СЕРВЕРА</label>
            <input id="modal-server-name" placeholder="Мой крутой сервер" autofocus>
        `, () => {
            const name = document.getElementById('modal-server-name').value.trim();
            if (!name) return;
            const server = {
                id: 'srv-' + Date.now(),
                name,
                icon: '',
                ownerId: currentUser.id,
                channels: [
                    { id: 'c-' + Date.now(), name: 'general', type: 'text' },
                    { id: 'c-' + (Date.now() + 1), name: 'Общий', type: 'voice' }
                ],
                members: Object.values(users).map(u => u.id)
            };
            servers.push(server);
            saveServers();
            selectServer(server.id);
        });
    });

    serverSettingsBtn.addEventListener('click', () => openSettings('server'));

    // ===== CHANNELS =====
    function renderChannels() {
        const server = servers.find(s => s.id === currentServerId);
        if (!server) return;

        serverNameEl.textContent = server.name;
        channelListEl.innerHTML = '';
        voiceListEl.innerHTML = '';

        server.channels.filter(c => c.type === 'text').forEach(chan => {
            channelListEl.appendChild(createChannelEl(chan));
        });
        server.channels.filter(c => c.type === 'voice').forEach(chan => {
            voiceListEl.appendChild(createChannelEl(chan));
        });

        const active = server.channels.find(c => c.id === currentChannelId);
        if (active) {
            channelNameEl.textContent = active.name;
            setIcon(chatHeaderIcon, 'hash', 24);
            dmStatusLabel.classList.add('hidden');
            welcomeChannel.textContent = active.name;
            welcomeChannel2.textContent = '#' + active.name;
            welcomeTitle.innerHTML = `Добро пожаловать в <span id="welcome-channel">${active.name}</span>!`;
            welcomeDesc.innerHTML = `Это начало канала <strong>#${active.name}</strong>.`;
            setIcon(welcomeIcon, 'hash', 36);
            messageInput.placeholder = `Написать в #${active.name}`;
        }
    }

    function createChannelEl(chan) {
        const div = document.createElement('div');
        div.className = 'channel-item' +
            (chan.id === currentChannelId ? ' active' : '') +
            (chan.type === 'voice' ? ' voice' : '');

        const iconEl = document.createElement('span');
        iconEl.className = 'channel-icon';
        iconEl.appendChild(icon(chan.type === 'voice' ? 'voice' : 'hash', 18));

        const nameEl = document.createElement('span');
        nameEl.textContent = chan.name;

        div.appendChild(iconEl);
        div.appendChild(nameEl);

        div.addEventListener('click', () => {
            if (chan.type === 'voice') {
                showModal('Голосовой канал', `<p style="color:var(--text-muted)">Голосовой канал <strong>${escapeHtml(chan.name)}</strong> — демо-версия.</p>`, null, 'Понятно');
                return;
            }
            currentChannelId = chan.id;
            saveUIState();
            renderChannels();
            renderMessages();
        });
        return div;
    }

    function addChannel(type) {
        const label = type === 'text' ? 'текстового канала' : 'голосового канала';
        showModal('Создать ' + label, `
            <label style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:8px;">ИМЯ КАНАЛА</label>
            <input id="modal-channel-name" placeholder="${type === 'text' ? 'новый-канал' : 'Голосовой'}" autofocus>
        `, () => {
            const name = document.getElementById('modal-channel-name').value.trim();
            if (!name) return;
            const server = servers.find(s => s.id === currentServerId);
            server.channels.push({ id: 'c-' + Date.now(), name, type });
            saveServers();
            if (type === 'text') { currentChannelId = server.channels[server.channels.length - 1].id; saveUIState(); }
            renderChannels();
            if (type === 'text') renderMessages();
        });
    }

    channelAddBtn.addEventListener('click', () => addChannel('text'));
    voiceAddBtn.addEventListener('click', () => addChannel('voice'));

    // ===== MESSAGES =====
    function getMessagesKey() {
        if (viewMode === 'dm') return `dm-${dmKey(currentUser.id, currentDmUserId)}`;
        return `msgs-${currentServerId}-${currentChannelId}`;
    }

    function loadMessages() {
        const key = getMessagesKey();
        if (viewMode === 'dm' && serverConnected && ws && ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'get-messages', payload: { key } }));
        }
        return JSON.parse(localStorage.getItem(key) || '[]');
    }

    function saveMessages(msgs) {
        localStorage.setItem(getMessagesKey(), JSON.stringify(msgs));
    }

    function renderMessages() {
        if (viewMode === 'dm' && !currentDmUserId) { showDmEmpty(); return; }

        const msgs = loadMessages();
        chatMessages.innerHTML = '';
        chatMessages.appendChild(welcomeMessage);
        welcomeMessage.style.display = msgs.length === 0 ? 'block' : 'none';

        let lastUserId = null;
        let lastTime = 0;

        msgs.forEach(msg => {
            if (msg.type === 'system') {
                const div = document.createElement('div');
                div.className = 'system-message';
                div.textContent = msg.content;
                chatMessages.appendChild(div);
                lastUserId = null;
                return;
            }

            const compact = msg.userId === lastUserId && (msg.timestamp - lastTime) < 300000;
            const group = document.createElement('div');
            group.className = 'message-group' + (compact ? ' compact' : '');
            group.dataset.id = msg.id;

            const isMe = msg.userId === currentUser.id;
            const time = new Date(msg.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

            group.innerHTML = `
                <img class="msg-avatar" src="${msg.avatar}" alt="">
                <div class="msg-body">
                    <div class="msg-header">
                        <span class="msg-username" style="color:${isMe ? 'var(--blurple)' : 'inherit'}">${escapeHtml(msg.username)}</span>
                        <span class="msg-time">${time}</span>
                    </div>
                    <div class="msg-content">${escapeHtml(msg.content)}${msg.edited ? ' <span class="edited">(изменено)</span>' : ''}</div>
                </div>
                <div class="msg-actions">
                    ${isMe ? `
                        <button class="msg-action-btn edit-btn" title="Изменить">${iconHtml('edit', 16)}</button>
                        <button class="msg-action-btn delete-btn" title="Удалить">${iconHtml('trash', 16)}</button>
                    ` : `
                        <button class="msg-action-btn dm-btn" title="Написать">${iconHtml('dm', 16)}</button>
                    `}
                </div>
            `;

            if (isMe) {
                group.querySelector('.edit-btn').addEventListener('click', () => editMessage(msg.id));
                group.querySelector('.delete-btn').addEventListener('click', () => deleteMessage(msg.id));
            } else if (viewMode === 'server') {
                group.querySelector('.dm-btn')?.addEventListener('click', () => {
                    selectDmView();
                    openDm(msg.userId);
                });
            }

            chatMessages.appendChild(group);
            lastUserId = msg.userId;
            lastTime = msg.timestamp;
        });

        scrollToBottom();
        filterMessages();
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function addMessage(content) {
        if (!content.trim()) return;
        if (viewMode === 'dm' && !currentDmUserId) return;
        if (viewMode === 'server' && (!currentServerId || !currentChannelId)) return;

        const msgObj = {
            id: 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            content: content.trim(),
            timestamp: Date.now(),
            userId: currentUser.id,
            username: currentUser.username,
            avatar: currentUser.avatar
        };

        if (viewMode === 'dm' && serverConnected && ws && ws.readyState === 1) {
            const key = getMessagesKey();
            ws.send(JSON.stringify({ type: 'message', payload: { fromUserId: currentUser.id, toUserId: currentDmUserId, content: content.trim(), key, fromUsername: currentUser.username, fromAvatar: currentUser.avatar } }));
            const msgs = loadMessages();
            msgs.push(msgObj);
            saveMessages(msgs);
            if (viewMode === 'dm') {
                const conv = dmConversations.find(d => d.partnerId === currentDmUserId);
                if (conv) {
                    conv.lastMessage = content.trim().slice(0, 50);
                    conv.lastTime = Date.now();
                    saveDms();
                    renderDmList();
                }
            }
            renderMessages();
            return;
        }

        const msgs = loadMessages();
        msgs.push(msgObj);
        saveMessages(msgs);

        if (viewMode === 'dm') {
            const conv = dmConversations.find(d => d.partnerId === currentDmUserId);
            if (conv) {
                conv.lastMessage = content.trim().slice(0, 50);
                conv.lastTime = Date.now();
                saveDms();
                renderDmList();
            }
        }

        renderMessages();
    }

    function editMessage(msgId) {
        const msgs = loadMessages();
        const msg = msgs.find(m => m.id === msgId);
        if (!msg) return;
        showModal('Изменить сообщение', `
            <textarea id="modal-edit-msg" style="width:100%;min-height:80px;background:var(--input-bg);border:none;border-radius:4px;color:var(--text-normal);padding:10px;font-size:16px;font-family:inherit;resize:vertical;"></textarea>
        `, () => {
            const val = document.getElementById('modal-edit-msg').value.trim();
            if (val) {
                msg.content = val;
                msg.edited = true;
                saveMessages(msgs);
                renderMessages();
            }
        });
        document.getElementById('modal-edit-msg').value = msg.content;
    }

    function deleteMessage(msgId) {
        showModal('Удалить сообщение', '<p style="color:var(--text-muted)">Вы уверены, что хотите удалить это сообщение?</p>', () => {
            saveMessages(loadMessages().filter(m => m.id !== msgId));
            renderMessages();
        }, 'Удалить');
    }

    messageForm.addEventListener('submit', e => {
        e.preventDefault();
        const text = messageInput.value.trim();
        if (text) {
            addMessage(text);
            messageInput.value = '';
            messageInput.style.height = 'auto';
        }
    });

    messageInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            messageForm.dispatchEvent(new Event('submit'));
        }
    });

    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + 'px';
    });

    messageSearch.addEventListener('input', filterMessages);

    function filterMessages() {
        const term = messageSearch.value.toLowerCase();
        chatMessages.querySelectorAll('.message-group').forEach(el => {
            el.style.display = !term || el.textContent.toLowerCase().includes(term) ? '' : 'none';
        });
    }

    pinBtn.addEventListener('click', () => {
        const pinned = loadMessages().filter(m => m.pinned);
        showModal('Закреплённые', pinned.length === 0
            ? '<p style="color:var(--text-muted)">Нет закреплённых сообщений</p>'
            : pinned.map(m => `<p><strong>${escapeHtml(m.username)}:</strong> ${escapeHtml(m.content)}</p>`).join(''), null, 'OK');
    });

    attachBtn.addEventListener('click', () => {
        showModal('Прикрепить файл', '<p style="color:var(--text-muted)">Загрузка файлов доступна в полной версии с сервером.</p>', null, 'OK');
    });

    // ===== MEMBERS =====
    function renderMembers() {
        const server = servers.find(s => s.id === currentServerId);
        if (!server) return;

        const members = Object.values(users).filter(u => server.members.includes(u.id));
        memberCountEl.textContent = members.length;
        userListEl.innerHTML = '';

        members.forEach(u => {
            const li = document.createElement('li');
            li.className = 'user-item';
            const status = u.id === currentUser.id ? currentUserStatus : (u.status || 'online');
            li.innerHTML = `
                <div class="avatar-wrap">
                    <img src="${u.avatar}" alt="">
                    <span class="status-dot ${status}"></span>
                </div>
                <span class="user-item-name">${escapeHtml(u.username)}</span>
            `;
            if (u.id !== currentUser.id) {
                li.addEventListener('click', () => { selectDmView(); openDm(u.id); });
            }
            userListEl.appendChild(li);
        });
    }

    membersToggle.addEventListener('click', () => membersPanel.classList.toggle('hidden'));

    // ===== SETTINGS =====
    function openSettings(section) {
        settingsSection = section;
        settingsOverlay.classList.remove('hidden');
        settingsNavItems.forEach(item => {
            item.classList.toggle('active', item.dataset.section === section);
        });
        renderSettingsSection(section);
    }

    function closeSettings() {
        settingsOverlay.classList.add('hidden');
    }

    settingsClose.addEventListener('click', closeSettings);
    settingsOverlay.addEventListener('click', e => {
        if (e.target === settingsOverlay) closeSettings();
    });

    settingsNavItems.forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            if (section === 'logout') { logout(); return; }
            settingsSection = section;
            settingsNavItems.forEach(i => i.classList.toggle('active', i.dataset.section === section));
            renderSettingsSection(section);
        });
    });

    function renderSettingsSection(section) {
        if (section === 'profile') {
            settingsContent.innerHTML = `
                <div class="settings-section">
                    <h1>Мой профиль</h1>
                    <div class="settings-profile-header">
                        <img class="settings-avatar" id="settings-avatar-preview" src="${currentUser.avatar}" alt="">
                        <div class="settings-profile-info">
                            <h2>${escapeHtml(currentUser.username)}</h2>
                            <p>${escapeHtml(currentUser.username)}#${currentUser.tag}</p>
                        </div>
                    </div>
                    <div class="settings-group">
                        <h3>Информация профиля</h3>
                        <div class="settings-field">
                            <label>Имя пользователя</label>
                            <input id="set-username" value="${escapeHtml(currentUser.username)}" disabled>
                            <p class="hint">Имя пользователя нельзя изменить</p>
                        </div>
                        <div class="settings-field">
                            <label>Email</label>
                            <input id="set-email" type="email" value="${escapeHtml(currentUser.email || '')}" placeholder="email@example.com">
                        </div>
                        <div class="settings-field">
                            <label>URL аватара</label>
                            <input id="set-avatar" value="${escapeHtml(currentUser.avatar)}" placeholder="https://...">
                            <p class="hint">Ссылка на изображение для аватара</p>
                        </div>
                        <div class="settings-field">
                            <label>О себе</label>
                            <textarea id="set-bio" placeholder="Расскажите о себе...">${escapeHtml(currentUser.bio || '')}</textarea>
                        </div>
                    </div>
                    <div class="settings-group">
                        <h3>Статус</h3>
                        <div class="status-options" id="status-options">
                            ${statuses.map(s => `
                                <div class="status-option ${currentUserStatus === s ? 'selected' : ''}" data-status="${s}">
                                    <span class="status-dot ${s}"></span>
                                    <span>${statusLabels[s]}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="settings-save-bar">
                        <button class="btn-primary" id="save-profile-btn">Сохранить изменения</button>
                    </div>
                </div>
            `;

            document.querySelectorAll('.status-option').forEach(opt => {
                opt.addEventListener('click', () => {
                    document.querySelectorAll('.status-option').forEach(o => o.classList.remove('selected'));
                    opt.classList.add('selected');
                });
            });

            document.getElementById('set-avatar').addEventListener('input', e => {
                document.getElementById('settings-avatar-preview').src = e.target.value || currentUser.avatar;
            });

            document.getElementById('save-profile-btn').addEventListener('click', () => {
                currentUser.email = document.getElementById('set-email').value.trim();
                currentUser.avatar = document.getElementById('set-avatar').value.trim() || avatarUrl(currentUser.username);
                currentUser.bio = document.getElementById('set-bio').value.trim();
                currentUserStatus = document.querySelector('.status-option.selected')?.dataset.status || currentUserStatus;
                currentUser.status = currentUserStatus;
                users[currentUsername] = { ...currentUser };
                saveUsers();
                updateUserPanel();
                renderMembers();
                renderDmList();
                renderMessages();
                closeSettings();
            });
        }

        if (section === 'appearance') {
            const compact = appSettings.compactMode || false;
            const fontSize = appSettings.fontSize || 'normal';
            settingsContent.innerHTML = `
                <div class="settings-section">
                    <h1>Внешний вид</h1>
                    <div class="settings-group">
                        <h3>Отображение</h3>
                        <div class="settings-toggle">
                            <label>Компактный режим сообщений</label>
                            <div class="toggle-switch ${compact ? 'on' : ''}" id="toggle-compact"></div>
                        </div>
                        <div class="settings-field" style="margin-top:20px">
                            <label>Размер шрифта</label>
                            <select id="set-font-size">
                                <option value="small" ${fontSize === 'small' ? 'selected' : ''}>Маленький (14px)</option>
                                <option value="normal" ${fontSize === 'normal' ? 'selected' : ''}>Средний (16px)</option>
                                <option value="large" ${fontSize === 'large' ? 'selected' : ''}>Большой (18px)</option>
                            </select>
                        </div>
                    </div>
                    <div class="settings-save-bar">
                        <button class="btn-primary" id="save-appearance-btn">Сохранить</button>
                    </div>
                </div>
            `;

            document.getElementById('toggle-compact').addEventListener('click', function() {
                this.classList.toggle('on');
            });

            document.getElementById('save-appearance-btn').addEventListener('click', () => {
                appSettings.compactMode = document.getElementById('toggle-compact').classList.contains('on');
                appSettings.fontSize = document.getElementById('set-font-size').value;
                saveAppSettings();
                applyAppSettings();
                closeSettings();
            });
        }

        if (section === 'privacy') {
            const allowDms = appSettings.allowDms !== false;
            const showStatus = appSettings.showStatus !== false;
            settingsContent.innerHTML = `
                <div class="settings-section">
                    <h1>Конфиденциальность</h1>
                    <div class="settings-group">
                        <h3>Личные сообщения</h3>
                        <div class="settings-toggle">
                            <label>Разрешить личные сообщения от участников сервера</label>
                            <div class="toggle-switch ${allowDms ? 'on' : ''}" id="toggle-dms"></div>
                        </div>
                        <div class="settings-toggle">
                            <label>Показывать статус онлайн</label>
                            <div class="toggle-switch ${showStatus ? 'on' : ''}" id="toggle-status"></div>
                        </div>
                    </div>
                    <div class="settings-save-bar">
                        <button class="btn-primary" id="save-privacy-btn">Сохранить</button>
                    </div>
                </div>
            `;

            document.getElementById('toggle-dms').addEventListener('click', function() { this.classList.toggle('on'); });
            document.getElementById('toggle-status').addEventListener('click', function() { this.classList.toggle('on'); });

            document.getElementById('save-privacy-btn').addEventListener('click', () => {
                appSettings.allowDms = document.getElementById('toggle-dms').classList.contains('on');
                appSettings.showStatus = document.getElementById('toggle-status').classList.contains('on');
                saveAppSettings();
                closeSettings();
            });
        }

        if (section === 'notifications') {
            const sound = appSettings.notifSound !== false;
            const desktop = appSettings.notifDesktop || false;
            settingsContent.innerHTML = `
                <div class="settings-section">
                    <h1>Уведомления</h1>
                    <div class="settings-group">
                        <h3>Общие</h3>
                        <div class="settings-toggle">
                            <label>Звук уведомлений</label>
                            <div class="toggle-switch ${sound ? 'on' : ''}" id="toggle-sound"></div>
                        </div>
                        <div class="settings-toggle">
                            <label>Уведомления на рабочем столе</label>
                            <div class="toggle-switch ${desktop ? 'on' : ''}" id="toggle-desktop"></div>
                        </div>
                        <p class="hint" style="margin-top:12px">Уведомления на рабочем столе требуют разрешения браузера.</p>
                    </div>
                    <div class="settings-save-bar">
                        <button class="btn-primary" id="save-notif-btn">Сохранить</button>
                    </div>
                </div>
            `;

            document.getElementById('toggle-sound').addEventListener('click', function() { this.classList.toggle('on'); });
            document.getElementById('toggle-desktop').addEventListener('click', function() { this.classList.toggle('on'); });

            document.getElementById('save-notif-btn').addEventListener('click', () => {
                appSettings.notifSound = document.getElementById('toggle-sound').classList.contains('on');
                appSettings.notifDesktop = document.getElementById('toggle-desktop').classList.contains('on');
                saveAppSettings();
                closeSettings();
            });
        }

        if (section === 'server') {
            const server = servers.find(s => s.id === currentServerId);
            if (!server) {
                settingsContent.innerHTML = '<div class="settings-section"><h1>Настройки сервера</h1><p style="color:var(--text-muted)">Выберите сервер для настройки.</p></div>';
                return;
            }
            settingsContent.innerHTML = `
                <div class="settings-section">
                    <h1>Настройки сервера</h1>
                    <div class="settings-group">
                        <h3>Обзор</h3>
                        <div class="settings-field">
                            <label>Название сервера</label>
                            <input id="set-server-name" value="${escapeHtml(server.name)}">
                        </div>
                        <div class="settings-field">
                            <label>URL иконки сервера</label>
                            <input id="set-server-icon" value="${escapeHtml(server.icon || '')}" placeholder="https://...">
                        </div>
                        <div class="settings-field">
                            <label>Участников</label>
                            <input value="${server.members.length}" disabled>
                        </div>
                    </div>
                    <div class="settings-group">
                        <h3>Каналы</h3>
                        <p class="hint">Текстовых: ${server.channels.filter(c => c.type === 'text').length}, голосовых: ${server.channels.filter(c => c.type === 'voice').length}</p>
                    </div>
                    <div class="settings-save-bar">
                        <button class="btn-primary" id="save-server-btn">Сохранить</button>
                    </div>
                </div>
            `;

            document.getElementById('save-server-btn').addEventListener('click', () => {
                server.name = document.getElementById('set-server-name').value.trim() || server.name;
                server.icon = document.getElementById('set-server-icon').value.trim();
                saveServers();
                renderServers();
                renderChannels();
                closeSettings();
            });
        }
    }

    function applyAppSettings() {
        const sizes = { small: '14px', normal: '16px', large: '18px' };
        document.documentElement.style.setProperty('--msg-font-size', sizes[appSettings.fontSize || 'normal']);
        document.body.classList.toggle('compact-mode', !!appSettings.compactMode);
    }

    // ===== MODAL =====
    let modalCallback = null;

    function showModal(title, bodyHtml, onConfirm, confirmText = 'Сохранить') {
        modalTitle.textContent = title;
        modalBody.innerHTML = bodyHtml;
        modalConfirm.textContent = confirmText;
        modalCallback = onConfirm;
        modalOverlay.classList.remove('hidden');
        const firstInput = modalBody.querySelector('input, textarea');
        if (firstInput) setTimeout(() => firstInput.focus(), 100);
    }

    function hideModal() {
        modalOverlay.classList.add('hidden');
        modalCallback = null;
        modalConfirm.style.display = '';
    }

    modalCancel.addEventListener('click', hideModal);
    modalConfirm.addEventListener('click', () => {
        if (modalCallback) modalCallback();
        hideModal();
    });
    modalOverlay.addEventListener('click', e => {
        if (e.target === modalOverlay) hideModal();
    });

    // ===== SESSION RESTORE =====
    const session = JSON.parse(localStorage.getItem('wb-session') || 'null');
    if (session?.username && users[session.username]) {
        login(session.username);
    }
});
