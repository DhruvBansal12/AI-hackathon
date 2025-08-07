let editor;
let currentLanguage = 'javascript';

// Initialize Monaco Editor
require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.1/min/vs' } });
require(['vs/editor/editor.main'], function () {
    // Get URL parameters for forked code
    const urlParams = new URLSearchParams(window.location.search);
    const forkedCode = urlParams.get('code');
    const forkedLanguage = urlParams.get('language');

    // Default code templates
    const defaultCode = {
        javascript: `// Welcome to Smart Coding Environment!
// Write your JavaScript code here

console.log("Hello, World!");

function fibonacci(n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log("Fibonacci sequence:");
for (let i = 0; i < 10; i++) {
    console.log(\`fibonacci(\${i}) = \${fibonacci(i)}\`);
}`,
        
        python: `# Welcome to Smart Coding Environment!
# Write your Python code here

print("Hello, World!")

def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

print("Fibonacci sequence:")
for i in range(10):
    print(f"fibonacci({i}) = {fibonacci(i)}")`,
    
        java: `// Welcome to Smart Coding Environment!
// Write your Java code here

public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
        
        System.out.println("Fibonacci sequence:");
        for (int i = 0; i < 10; i++) {
            System.out.println("fibonacci(" + i + ") = " + fibonacci(i));
        }
    }
    
    public static int fibonacci(int n) {
        if (n <= 1) return n;
        return fibonacci(n - 1) + fibonacci(n - 2);
    }
}`,
        
        cpp: `// Welcome to Smart Coding Environment!
// Write your C++ code here

#include <iostream>
using namespace std;

int fibonacci(int n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

int main() {
    cout << "Hello, World!" << endl;
    
    cout << "Fibonacci sequence:" << endl;
    for (int i = 0; i < 10; i++) {
        cout << "fibonacci(" << i << ") = " << fibonacci(i) << endl;
    }
    
    return 0;
}`
    };

    const initialLanguage = forkedLanguage || currentLanguage;
    const initialCode = forkedCode ? decodeURIComponent(forkedCode) : defaultCode[initialLanguage];

    editor = monaco.editor.create(document.getElementById('editor'), {
        value: initialCode,
        language: initialLanguage,
        theme: 'vs-dark',
        fontSize: 14,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        automaticLayout: true
    });

    // Update language selector if forked
    if (forkedLanguage) {
        document.getElementById('languageSelector').value = forkedLanguage;
        currentLanguage = forkedLanguage;
    }

    // Clear URL parameters after loading
    if (forkedCode || forkedLanguage) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});

// Language selector change
document.getElementById('languageSelector').addEventListener('change', function(e) {
    currentLanguage = e.target.value;
    monaco.editor.setModelLanguage(editor.getModel(), currentLanguage);
});

// Run code button
document.getElementById('runBtn').addEventListener('click', async function() {
    const code = editor.getValue();
    if (!code.trim()) {
        showOutput('No code to run!', 'error');
        return;
    }

    const outputDiv = document.getElementById('output');
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

// Copy code button
document.getElementById('copyBtn').addEventListener('click', function() {
    const code = editor.getValue();
    navigator.clipboard.writeText(code).then(() => {
        showNotification('Code copied to clipboard!');
    });
});

// Download code button
document.getElementById('downloadBtn').addEventListener('click', function() {
    const code = editor.getValue();
    const extensions = {
        javascript: '.js',
        python: '.py',
        java: '.java',
        cpp: '.cpp'
    };
    
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code${extensions[currentLanguage] || '.txt'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Code downloaded!');
});

// Share code button
document.getElementById('shareBtn').addEventListener('click', function() {
    document.getElementById('shareModal').classList.add('active');
});

// Close modal
document.getElementById('closeModal').addEventListener('click', function() {
    document.getElementById('shareModal').classList.remove('active');
});

// Share modal submit
document.getElementById('shareTitle').addEventListener('keypress', async function(e) {
    if (e.key === 'Enter') {
        await shareCode();
    }
});

// Add event listener to share button in modal
document.querySelector('#shareModal .modal-body').addEventListener('click', async function(e) {
    if (e.target.closest('#copyShareUrl')) {
        const shareUrl = document.getElementById('shareUrl').value;
        navigator.clipboard.writeText(shareUrl).then(() => {
            showNotification('Share URL copied to clipboard!');
        });
    }
});

// Auto-share when modal opens
document.getElementById('shareBtn').addEventListener('click', async function() {
    document.getElementById('shareModal').classList.add('active');
    await shareCode();
});

async function shareCode() {
    const code = editor.getValue();
    const title = document.getElementById('shareTitle').value || 'Untitled';
    
    try {
        const response = await fetch('/api/share', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                code: code,
                language: currentLanguage,
                title: title
            })
        });

        const result = await response.json();
        const fullUrl = window.location.origin + result.shareUrl;
        document.getElementById('shareUrl').value = fullUrl;
    } catch (error) {
        showNotification('Error creating share link: ' + error.message, 'error');
    }
}

// Analyze Code button
const analyzeBtn = document.getElementById('analyzeBtn');
const analysisContainer = document.getElementById('analysisContainer');
const analysisOutput = document.getElementById('analysisOutput');
const clearAnalysis = document.getElementById('clearAnalysis');

if (analyzeBtn) {
    analyzeBtn.addEventListener('click', async function() {
        const code = editor.getValue();
        if (!code.trim()) {
            showAnalysis('No code to analyze!', 'error');
            return;
        }
        analysisContainer.style.display = '';
        showAnalysis('Analyzing code...', 'loading');
        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, language: currentLanguage })
            });
            const result = await response.json();
            if (result.success) {
                showAnalysis(formatAnalysis(result.output), 'success');
            } else {
                showAnalysis(result.output, 'error');
            }
        } catch (error) {
            showAnalysis('Error: ' + error.message, 'error');
        }
    });
}
if (clearAnalysis) {
    clearAnalysis.addEventListener('click', function() {
        analysisContainer.style.display = 'none';
        analysisOutput.textContent = '';
    });
}
function showAnalysis(text, type = 'success') {
    analysisOutput.textContent = '';
    analysisOutput.className = `output ${type}`;
    if (typeof text === 'string') {
        analysisOutput.textContent = text;
    } else if (Array.isArray(text)) {
        analysisOutput.textContent = text.map(e => JSON.stringify(e, null, 2)).join('\n\n');
    } else {
        analysisOutput.textContent = JSON.stringify(text, null, 2);
    }
}
function formatAnalysis(output) {
    if (Array.isArray(output)) {
        // ESLint or pylint JSON output
        if (output.length === 0) return 'No issues found!';
        return output.map(e => {
            if (e.messages) {
                // ESLint
                return e.messages.map(m => `${m.severity === 2 ? 'Error' : 'Warning'}: ${m.message} (line ${m.line})`).join('\n');
            } else if (e.type && e.message) {
                // pylint
                return `${e.type}: ${e.message} (line ${e.line})`;
            } else {
                return JSON.stringify(e, null, 2);
            }
        }).join('\n\n');
    }
    return typeof output === 'string' ? output : JSON.stringify(output, null, 2);
}

// Clear output button
document.getElementById('clearOutput').addEventListener('click', function() {
    document.getElementById('output').textContent = '';
});

// Modal close on outside click
document.getElementById('shareModal').addEventListener('click', function(e) {
    if (e.target === this) {
        this.classList.remove('active');
    }
});

// Utility functions
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

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + Enter to run code
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('runBtn').click();
    }
    
    // Ctrl/Cmd + S to download
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        document.getElementById('downloadBtn').click();
    }
    
    // Ctrl/Cmd + Shift + C to copy
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        document.getElementById('copyBtn').click();
    }
});