// Initialize polling when page loads
let lastPolledMessage = '';
let users = []; // Track active users

setTimeout(() => {
    pollForMessages();
}, 1000);

// Update initial user list
updateUserList();

// Send message function
async function sendMessage() {
    const message = messageInput.value.trim();
    const username = usernameInput.value.trim() || 'Anonymous';

    if (message) {
        try {
            // Send message to backend
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

            if (response.ok) {
                // Add message to UI immediately for better UX
                addMessage(username, message, true);

                // Clear input
                messageInput.value = '';
                updateCharCount();

                // Hide typing indicator
                typingIndicator.classList.add('hidden');

                // Scroll to bottom
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } else {
                const errorData = await response.json();
                showNotification(`Failed to send message: ${errorData.error || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            showNotification('Failed to send message. Please try again.', 'error');

            // Still add message to UI but mark it as pending
            addMessage(username, message, true, true);
        }
    }
}


// Poll for new messages from backend
async function pollForMessages() {
    try {
        const response = await fetch('/poll');
        if (response.ok) {
            const data = await response.json();

            // Check if we have a new message
            if (data.text && data.text !== lastPolledMessage) {
                lastPolledMessage = data.text;

                // Parse the message to extract username and content
                const messageMatch = data.text.match(/(\d{2}:\d{2}:\d{2})?\s*([^:]+):\s*(.+)/);

                if (messageMatch) {
                    const timestamp = messageMatch[1];
                    const username = messageMatch[2].trim();
                    const messageContent = messageMatch[3].trim();

                    // Check if this is a system message (user joined/left)
                    if (data.text.includes('joined') || data.text.includes('left')) {
                        showNotification(data.text.replace(/^\d{2}:\d{2}:\d{2}\s*/, ''));

                        // Update user list for join/leave events
                        if (data.text.includes('joined')) {
                            const newUser = data.text.match(/(.+)\s+joined/)[1].trim();
                            if (!users.includes(newUser) && newUser !== usernameInput.value.trim()) {
                                users.push(newUser);
                                updateUserList();
                            }
                        } else if (data.text.includes('left')) {
                            const leftUser = data.text.match(/(.+)\s+left/)[1].trim();
                            const userIndex = users.indexOf(leftUser);
                            if (userIndex > -1) {
                                users.splice(userIndex, 1);
                                updateUserList();
                            }
                        }
                    } else {
                        // Regular chat message
                        const isOwnMessage = username === usernameInput.value.trim();
                        addMessage(username, messageContent, isOwnMessage);

                        // Scroll to bottom if it's a new message
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;

                        // Play notification sound for new messages from others
                        if (!isOwnMessage && soundToggle.checked) {
                            playNotificationSound();
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error polling messages:', error);
        // Don't show error notification for polling failures to avoid spam
    }

    // Continue polling
    setTimeout(pollForMessages, 2000); // Poll every 2 seconds
}


// Update user list function
function updateUserList() {
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

    onlineCount.textContent = users.length + 1; // +1 for current user
}


/*
// Handle Enter key more robustly
messageInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
*/

// Add connection status indicator
function updateConnectionStatus(connected) {
    const statusIndicator = document.getElementById('connection-status') || createConnectionStatusIndicator();
    statusIndicator.className = `w-3 h-3 rounded-full mr-2 ${connected ? 'bg-green-500' : 'bg-red-500'}`;
}

function createConnectionStatusIndicator() {
    const header = document.querySelector('header');
    const statusElement = document.createElement('div');
    statusElement.id = 'connection-status';
    statusElement.className = 'w-3 h-3 rounded-full mr-2 bg-green-500';
    statusElement.title = 'Connected';

    const onlineDiv = document.querySelector('.flex.items-center.space-x-2.text-gray-600');
    onlineDiv.insertBefore(statusElement, onlineDiv.firstChild);

    return statusElement;
}
