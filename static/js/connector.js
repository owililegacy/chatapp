import { io } from "socket.io-client";

// Initialize polling when page loads
let lastPolledMessage = '';
let users = []; // Track active users
const userList = document.getElementById('user-list');
const onlineCount = document.getElementById('online-count');
const usernameInput = document.getElementById('username-input');

// Debug mode
const DEBUG = true;

function debugLog(...args) {
    if (DEBUG) {
        console.log('[WebSocket]', ...args);
    }
}
// Update initial user list
updateUserList();

// WebSocket implementation
class ChatWebSocket {
    constructor() {
        this.socket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.isConnected = false;
        this.pendingMessages = new Set(); // Track messages being sent
    }

    connect() {
        try {
            debugLog('Attempting to connect to WebSocket...');

            // Explicitly specify the WebSocket URL
            this.socket = io('http://localhost:8080', {
                transports: ['websocket', 'polling'], // Try both transports
                timeout: 5000
            });
            this.socket.on('connect', () => {
                debugLog('✅ WebSocket CONNECTED successfully');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                updateConnectionStatus(true);

                // Register user with the server
                const username = usernameInput.value.trim() || 'Anonymous';
                this.socket.emit('user_join', { username: username });

                // Start polling as fallback
                this.startPollingFallback();
            });

            this.socket.on('disconnect', (reason) => {
                debugLog('❌ WebSocket DISCONNECTED:', reason);
                this.isConnected = false;
                updateConnectionStatus(false);

                if (reason === 'io server disconnect') {
                    // Server initiated disconnect, don't auto-reconnect
                    showNotification('Disconnected by server', 'error');
                } else {
                    this.attemptReconnect();
                }
            });

            this.socket.on('connect_error', (error) => {
                debugLog('💥 WebSocket CONNECTION ERROR:', error);
                this.isConnected = false;
                updateConnectionStatus(false);
            });

            this.socket.on('connected', (data) => {
                debugLog('📨 Received connected event:', data);
                showNotification(data.message, 'success');
            });

            this.socket.on('new_message', (data) => {
                debugLog('📨 Received new message:', data);
                this.handleNewMessage(data);
            });

            this.socket.on('user_list_update', (data) => {
                debugLog('📨 Received user list update:', data);
                this.handleUserListUpdate(data);
            });

            this.socket.on('user_joined', (data) => {
                debugLog('📨 Received user joined confirmation:', data);
                this.handleUserJoined(data);
            });

            this.socket.on('system_message', (data) => {
                this.handleSystemMessage(data);
            });

        } catch (error) {
            debugLog('💥 WebSocket connection failed:', error);
            console.error('WebSocket connection failed:', error);
            this.attemptReconnect();
        }
    }

    handleNewMessage(data) {
        const isOwnMessage = data.username === usernameInput.value.trim();

        // Don't show own messages twice (they're already shown optimistically)
        if (!isOwnMessage || !this.pendingMessages.has(data.text)) {
            addMessage(data.username, data.text, isOwnMessage);

            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;

            // Play notification sound for others' messages
            if (!isOwnMessage && soundToggle.checked) {
                playNotificationSound();
            }
        }

        // Remove from pending if it was there
        this.pendingMessages.delete(data.text);
    }

    handleUserListUpdate(data) {
        users = data.users.filter(user => user !== usernameInput.value.trim());
        updateUserList();
    }

    handleUserJoined(data) {
        showNotification(`${data.username} joined the chat`);
    }

    handleSystemMessage(data) {
        showNotification(data.message, 'info');
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * this.reconnectAttempts;
            debugLog(`🔄 Attempting to reconnect in ${delay}ms... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            console.log(`Attempting to reconnect in ${delay}ms... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

            setTimeout(() => {
                this.connect();
            }, delay);
        } else {
            console.error('Max reconnection attempts reached');
            showNotification('Connection lost. Please refresh the page.', 'error');
        }
    }

    startPollingFallback() {
        // Only start polling if WebSocket is not connected after a delay
        setTimeout(() => {
            if (!this.isConnected) {
                console.log('Starting polling fallback');
                pollForMessages();
            }
        }, 5000);
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.isConnected = false;
        this.pendingMessages.clear();
    }
}

// Initialize WebSocket when page loads
const chatSocket = new ChatWebSocket();

debugLog('DOM loaded, starting WebSocket connection...');
chatSocket.connect();

// Add connection button for manual testing
addConnectionControls();

let connectionStDisplay

function addConnectionControls() {
    if (!connectionStDisplay) {
        const controls = document.createElement('div');
        controls.innerHTML = `
    <div id="connection-status" class="block fixed top-2 right-3 bg-white p-4 border border-[#ccc] z-[50] rounded-lg">
    <div>WebSocket Status: <span id="debug-status" class="font-semibold text-red-500">Disconnected</span></div>
    <button class="rounded-md border shadow-lg p-1" onclick="chatSocket.connect()">Connect</button>
    <button class="rounded-md border shadow-lg p-1" onclick="chatSocket.disconnect()">Disconnect</button>
    <button class="rounded-md border shadow-lg p-1" onclick="testConnection()">Test</button>
    </div>
    `;
        document.body.appendChild(controls);
        connectionStDisplay = controls
    } else {
        connectionStDisplay.classList.remove('hidden')
    }
    setTimeout(() => {
        connectionStDisplay.classList.add('hidden')
    }, 3000)
}

function testConnection() {
    debugLog('Testing connection...');
    if (chatSocket.isConnected) {
        debugLog('✅ WebSocket is connected');
        chatSocket.socket.emit('user_join', { username: 'TestUser' });
    } else {
        debugLog('❌ WebSocket is not connected');
    }
}


// Update username when it changes
usernameInput.addEventListener('change', function() {
    if (chatSocket.isConnected && chatSocket.socket) {
        const username = usernameInput.value.trim() || 'Anonymous';
        chatSocket.socket.emit('user_join', { username: username });
    }
});

// Refined sendMessage function
async function sendMessage() {
    const message = messageInput.value.trim();
    const username = usernameInput.value.trim() || 'Anonymous';

    if (!message) {
        return; // Don't send empty messages
    }

    // Clear input immediately for better UX
    messageInput.value = '';
    updateCharCount();
    typingIndicator.classList.add('hidden');

    // Add message to UI optimistically
    const messageId = Date.now().toString();
    addMessage(username, message, true, false, messageId);

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
        if (chatSocket.isConnected && chatSocket.socket) {
            // Mark as pending for WebSocket
            chatSocket.pendingMessages.add(message);

            const response = await fetch('/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username,
                    text: message
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to send message');
            }

            console.log('Message sent successfully via WebSocket');

        } else {
            // WebSocket not connected, use polling method
            console.log('WebSocket not connected, using polling fallback');
            await sendMessagePolling(username, message, messageId);
        }

    } catch (error) {
        console.error('Error sending message:', error);

        // Mark message as failed
        markMessageAsFailed(messageId);

        showNotification(
            error.message || 'Failed to send message. Please try again.',
            'error'
        );
    }
}

// Fallback method for when WebSocket is not available
async function sendMessagePolling(username, message, messageId) {
    try {
        const response = await fetch('/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: username,
                text: message
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to send message');
        }

        console.log('Message sent successfully via polling');

    } catch (error) {
        console.error('Error sending message via polling:', error);
        throw error; // Re-throw to be handled by main function
    }
}

// Enhanced addMessage function with message IDs
function addMessage(username, text, isOwnMessage = false, isPending = false, messageId = null) {
    const messageElement = document.createElement('div');
    messageElement.className = `message-enter flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`;

    if (messageId) {
        messageElement.setAttribute('data-message-id', messageId);
    }

    if (isPending) {
        messageElement.classList.add('opacity-60');
    }

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userInitial = username.charAt(0).toUpperCase();

    messageElement.innerHTML = `
    <div class="flex items-start space-x-2 max-w-xs md:max-w-md ${isOwnMessage ? 'flex-row-reverse' : ''}">
    <div class="w-8 h-8 rounded-full ${isOwnMessage ? 'bg-indigo-500' : 'bg-purple-500'} flex items-center justify-center text-white text-sm font-semibold relative">
    ${userInitial}
    ${isPending ? '<div class="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>' : ''}
    </div>
    <div>
    <div class="${isOwnMessage ? 'bg-indigo-500 text-white rounded-2xl rounded-tr-none' : 'bg-white rounded-2xl rounded-tl-none shadow-sm'} px-4 py-3 relative ${isPending ? 'border-2 border-yellow-400 border-dashed' : ''}">
    <p>${escapeHtml(text)}</p>
    ${isPending ? '<div class="absolute -bottom-2 right-2 text-yellow-500 text-xs">Sending...</div>' : ''}
    </div>
    ${timestampToggle.checked ? `
        <div class="flex items-center space-x-1 mt-1 text-xs text-gray-500 ${isOwnMessage ? 'justify-end' : ''}">
        <span>${isOwnMessage ? 'You' : escapeHtml(username)}</span>
        <span>•</span>
        <span>${time}</span>
        </div>
        ` : ''}
        </div>
        </div>
        `;

    messagesContainer.appendChild(messageElement);

    // Remove pending state after a while if still pending
    if (isPending) {
        setTimeout(() => {
            if (messageElement.classList.contains('opacity-60')) {
                markMessageAsFailed(messageId);
            }
        }, 10000); // 10 second timeout
    }
}

// Mark message as failed
function markMessageAsFailed(messageId) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
        messageElement.classList.remove('opacity-60');
        const pendingBadge = messageElement.querySelector('.absolute.-bottom-2');
        if (pendingBadge) {
            pendingBadge.textContent = 'Failed';
            pendingBadge.classList.remove('text-yellow-500');
            pendingBadge.classList.add('text-red-500');
        }
    }
}

// Poll for new messages from backend (fallback)
async function pollForMessages() {
    // Don't poll if WebSocket is connected
    if (chatSocket.isConnected) {
        setTimeout(pollForMessages, 30000); // Check again in 30 seconds
        return;
    }

    try {
        const response = await fetch('/poll');
        if (response.ok) {
            const data = await response.json();

            // Check if we have a new message
            if (data.text && data.text !== lastPolledMessage) {
                lastPolledMessage = data.text;
                processPolledMessage(data.text);
            }
        }
    } catch (error) {
        console.error('Error polling messages:', error);
    }

    // Continue polling with reduced frequency when using fallback
    setTimeout(pollForMessages, 5000); // Poll every 5 seconds in fallback mode
}

// Process messages received via polling
function processPolledMessage(messageText) {
    const messageMatch = messageText.match(/(\d{2}:\d{2}:\d{2})?\s*([^:]+):\s*(.+)/);

    if (messageMatch) {
        const username = messageMatch[2].trim();
        const messageContent = messageMatch[3].trim();

        // Check if this is a system message (user joined/left)
        if (messageText.includes('joined') || messageText.includes('left')) {
            showNotification(messageText.replace(/^\d{2}:\d{2}:\d{2}\s*/, ''));

            // Update user list for join/leave events
            if (messageText.includes('joined')) {
                const newUser = messageText.match(/(.+)\s+joined/)[1].trim();
                if (!users.includes(newUser) && newUser !== usernameInput.value.trim()) {
                    users.push(newUser);
                    updateUserList();
                }
            } else if (messageText.includes('left')) {
                const leftUser = messageText.match(/(.+)\s+left/)[1].trim();
                const userIndex = users.indexOf(leftUser);
                if (userIndex > -1) {
                    users.splice(userIndex, 1);
                    updateUserList();
                }
            }
        } else {
            // Regular chat message
            const isOwnMessage = username === usernameInput.value.trim();

            // Don't show own messages that were already shown optimistically
            if (!isOwnMessage || !chatSocket.pendingMessages.has(messageContent)) {
                addMessage(username, messageContent, isOwnMessage);

                // Scroll to bottom
                messagesContainer.scrollTop = messagesContainer.scrollHeight;

                // Play notification sound for new messages from others
                if (!isOwnMessage && soundToggle.checked) {
                    playNotificationSound();
                }
            }

            // Remove from pending if it was there
            chatSocket.pendingMessages.delete(messageContent);
        }
    }
}

// Update user list function
function updateUserList() {
    if (!userList) return;

    userList.innerHTML = `
    <div class="flex items-center space-x-2 p-2 rounded-lg bg-blue-50">
    <div class="w-2 h-2 rounded-full bg-green-500"></div>
    <span class="font-medium">You</span>
    </div>
    `;

    users.forEach(user => {
        const userElement = document.createElement('div');
        userElement.className = 'flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-50 transition-colors';
        userElement.innerHTML = `
        <div class="w-2 h-2 rounded-full bg-green-500"></div>
        <span class="text-sm">${escapeHtml(user)}</span>
        `;
        userList.appendChild(userElement);
    });

    if (window.onlineCount) {
        window.onlineCount.textContent = users.length + 1; // +1 for current user
    }
}

// Add connection status indicator
function updateConnectionStatus(connected) {
    const statusIndicator = document.getElementById('connection-status') || createConnectionStatusIndicator();
    statusIndicator.className = `w-3 h-3 rounded-full mr-2 ${connected ? 'bg-green-500' : 'bg-red-500'}`;
    statusIndicator.title = connected ? 'Connected' : 'Disconnected';
}

function createConnectionStatusIndicator() {
    const onlineDiv = document.querySelector('.flex.items-center.space-x-2.text-gray-600');
    if (!onlineDiv) return null;

    const statusElement = document.createElement('div');
    statusElement.id = 'connection-status';
    statusElement.className = 'w-3 h-3 rounded-full mr-2 bg-green-500';
    statusElement.title = 'Connected';

    onlineDiv.insertBefore(statusElement, onlineDiv.firstChild);
    return statusElement;
}


// Make functions available globally
window.sendMessage = sendMessage;
window.chatSocket = chatSocket;
window.updateUserList = updateUserList;
window.usernameInput = usernameInput;
window.onlineCount = onlineCount
