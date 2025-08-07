let editor;
let socket;
let groupId;
let currentLanguage = 'javascript';
let isUpdating = false;
let username = 'User' + Math.floor(Math.random() * 1000);

// Get group ID from URL or generate new one
groupId = window.location.pathname.split('/').pop();
if (groupId === 'new-group') {
    // Redirect to groups page for group selection
    window.location.href = '/groups';
}

// Initialize Socket.io
socket = io();

// Initialize Monaco Editor
require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.1/min/vs' } });
require(['vs/editor/editor.main'], function () {
    editor = monaco.editor.create(document.getElementById('editor'), {
        value: '// Connecting to study group...',
        language: 'javascript',
        theme: 'vs-dark',
        fontSize: 14,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        automaticLayout: true
    });

    // Listen for editor changes
    editor.onDidChangeModelContent(() => {
        if (!isUpdating) {
            const code = editor.getValue();
            socket.emit('group-code-change', {
                groupId: groupId,
                code: code,
                language: currentLanguage
            });
        }
    });

    // Join study group
    socket.emit('join-study-group', groupId);
});

// Socket event handlers
socket.on('connect', () => {
    updateConnectionStatus('Connected', true);
});

socket.on('disconnect', () => {
    updateConnectionStatus('Disconnected', false);
});

socket.on('group-state', (data) => {
    isUpdating = true;
    editor.setValue(data.code);
    if (data.language) {
        currentLanguage = data.language;
        document.getElementById('languageSelector').value = data.language;
        monaco.editor.setModelLanguage(editor.getModel(), data.language);
    }
    
    // Update group info display
    if (data.groupName) {
        document.getElementById('groupName').textContent = data.groupName;
        document.getElementById('groupId').textContent = `ID: ${groupId}`;
    }
    
    // Load messages
    data.messages.forEach(msg => addMessageToChat(msg));
    
    // Load questions
    data.questions.forEach(question => addQuestionToList(question));
    
    // Load users
    updateUsersList(data.users);
    
    isUpdating = false;
});

socket.on('group-code-update', (data) => {
    isUpdating = true;
    const position = editor.getPosition();
    editor.setValue(data.code);
    editor.setPosition(position);
    if (data.language && data.language !== currentLanguage) {
        currentLanguage = data.language;
        document.getElementById('languageSelector').value = data.language;
        monaco.editor.setModelLanguage(editor.getModel(), data.language);
    }
    isUpdating = false;
});

socket.on('user-joined-group', (user) => {
    showNotification(`${user.name} joined the study group`);
});

socket.on('user-left-group', (user) => {
    showNotification(`${user.name} left the study group`);
});

socket.on('new-message', (message) => {
    addMessageToChat(message);
});

socket.on('new-question', (question) => {
    addQuestionToList(question);
    showNotification('New question added!');
});

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    });
});

// Language selector change
document.getElementById('languageSelector').addEventListener('change', function(e) {
    currentLanguage = e.target.value;
    monaco.editor.setModelLanguage(editor.getModel(), currentLanguage);
    
    socket.emit('group-code-change', {
        groupId: groupId,
        code: editor.getValue(),
        language: currentLanguage
    });
});

// Run code button
document.getElementById('runBtn').addEventListener('click', async function() {
    const code = editor.getValue();
    if (!code.trim()) {
        showOutput('No code to run!', 'error');
        return;
    }

    showOutput('Running code...', 'loading');
    
    try {
        const response = await fetch('/api/run', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                code: code,
                language: currentLanguage
            })
        });

        const result = await response.json();
        
        if (result.success) {
            showOutput(result.output, 'success');
        } else {
            showOutput(result.output, 'error');
        }
    } catch (error) {
        showOutput('Error: ' + error.message, 'error');
    }
});

// Chat functionality
document.getElementById('chatInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

document.getElementById('sendMessage').addEventListener('click', sendMessage);

function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (message) {
        socket.emit('send-message', {
            groupId: groupId,
            message: message,
            username: username
        });
        input.value = '';
    }
}

// Questions functionality
document.getElementById('addQuestion').addEventListener('click', function() {
    const input = document.getElementById('questionInput');
    const question = input.value.trim();
    
    if (question) {
        socket.emit('add-question', {
            groupId: groupId,
            question: question,
            username: username
        });
        input.value = '';
    }
});

document.getElementById('questionInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        document.getElementById('addQuestion').click();
    }
});

// Clear output button
document.getElementById('clearOutput').addEventListener('click', function() {
    document.getElementById('output').textContent = '';
});

// Utility functions
function generateGroupId() {
    return Math.random().toString(36).substr(2, 9);
}

function updateConnectionStatus(status, isConnected) {
    const statusEl = document.getElementById('connectionStatus');
    statusEl.textContent = status;
    statusEl.className = `status-indicator ${isConnected ? 'connected' : 'disconnected'}`;
}

function updateUsersList(users) {
    const usersList = document.querySelector('.users-list');
    usersList.innerHTML = '';
    
    users.forEach(user => {
        const userEl = document.createElement('div');
        userEl.className = 'user-avatar';
        userEl.textContent = user.name.substr(0, 2).toUpperCase();
        userEl.title = user.name;
        usersList.appendChild(userEl);
    });
}

function addMessageToChat(message) {
    const chatMessages = document.getElementById('chatMessages');
    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${message.username === username ? 'own' : ''}`;
    
    messageEl.innerHTML = `
        <div class="message-header">
            <span class="message-username">${message.username}</span>
            <span class="message-time">${formatTime(message.timestamp)}</span>
        </div>
        <div class="message-text">${escapeHtml(message.text)}</div>
    `;
    
    chatMessages.appendChild(messageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addQuestionToList(question) {
    const questionsList = document.getElementById('questionsList');
    const questionEl = document.createElement('div');
    questionEl.className = 'question-item';
    
    questionEl.innerHTML = `
        <div class="question-header">
            <span class="question-username">${question.username}</span>
            <span class="question-time">${formatTime(question.timestamp)}</span>
        </div>
        <div class="question-text">${escapeHtml(question.text)}</div>
    `;
    
    questionsList.appendChild(questionEl);
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showOutput(text, type = 'success') {
    const outputDiv = document.getElementById('output');
    outputDiv.textContent = text;
    outputDiv.className = `output ${type}`;
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Initialize connection status
updateConnectionStatus('Connecting...', false);

// Prompt for username
const savedUsername = localStorage.getItem('study-username');
if (savedUsername) {
    username = savedUsername;
} else {
    const inputUsername = prompt('Enter your name for the study group:', username);
    if (inputUsername && inputUsername.trim()) {
        username = inputUsername.trim();
        localStorage.setItem('study-username', username);
    }
}