let editor;
let socket;
let sessionId;
let currentLanguage = 'javascript';
let isUpdating = false;

// Get session ID from URL or generate new one
sessionId = window.location.pathname.split('/').pop();
if (sessionId === 'new-session') {
    sessionId = generateSessionId();
    window.history.replaceState({}, document.title, `/pair/${sessionId}`);
}

document.getElementById('sessionId').textContent = sessionId;

// Initialize Socket.io
socket = io();

// Initialize Monaco Editor
require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.1/min/vs' } });
require(['vs/editor/editor.main'], function () {
    editor = monaco.editor.create(document.getElementById('editor'), {
        value: '// Connecting to pair programming session...',
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
            socket.emit('code-change', {
                sessionId: sessionId,
                code: code,
                language: currentLanguage
            });
        }
    });

    // Join pair session
    socket.emit('join-pair-session', sessionId);
});

// Socket event handlers
socket.on('connect', () => {
    updateConnectionStatus('Connected', true);
});

socket.on('disconnect', () => {
    updateConnectionStatus('Disconnected', false);
});

socket.on('session-state', (data) => {
    isUpdating = true;
    editor.setValue(data.code);
    if (data.language) {
        currentLanguage = data.language;
        document.getElementById('languageSelector').value = data.language;
        monaco.editor.setModelLanguage(editor.getModel(), data.language);
    }
    isUpdating = false;
});

socket.on('code-update', (data) => {
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

socket.on('user-joined', (userId) => {
    addUserToList(userId);
    showNotification('A user joined the session');
});

socket.on('user-left', (userId) => {
    removeUserFromList(userId);
    showNotification('A user left the session');
});

// Language selector change
document.getElementById('languageSelector').addEventListener('change', function(e) {
    currentLanguage = e.target.value;
    monaco.editor.setModelLanguage(editor.getModel(), currentLanguage);
    
    socket.emit('code-change', {
        sessionId: sessionId,
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

// Copy session URL
document.getElementById('copySessionUrl').addEventListener('click', function() {
    const sessionUrl = window.location.href;
    navigator.clipboard.writeText(sessionUrl).then(() => {
        showNotification('Session URL copied to clipboard!');
    });
});

// Clear output button
document.getElementById('clearOutput').addEventListener('click', function() {
    document.getElementById('output').textContent = '';
});

// Utility functions
function generateSessionId() {
    return Math.random().toString(36).substr(2, 9);
}

function updateConnectionStatus(status, isConnected) {
    const statusEl = document.getElementById('connectionStatus');
    statusEl.textContent = status;
    statusEl.className = `status-indicator ${isConnected ? 'connected' : 'disconnected'}`;
}

function addUserToList(userId) {
    const usersList = document.querySelector('.users-list');
    const userEl = document.createElement('div');
    userEl.className = 'user-avatar';
    userEl.textContent = userId.substr(-2).toUpperCase();
    userEl.id = `user-${userId}`;
    usersList.appendChild(userEl);
}

function removeUserFromList(userId) {
    const userEl = document.getElementById(`user-${userId}`);
    if (userEl) {
        userEl.remove();
    }
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