// DOM Elements
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const usernameInput = document.getElementById('username-input');
const sendButton = document.getElementById('send-button');
const charCount = document.getElementById('char-count');
const notification = document.getElementById('notification');
const notificationMessage = document.getElementById('notification-message');
const closeNotification = document.getElementById('close-notification');
const soundToggle = document.getElementById('sound-toggle');
const timestampToggle = document.getElementById('timestamp-toggle');
const typingIndicator = document.getElementById('typing-indicator');
const userList = document.getElementById('user-list');
const onlineCount = document.getElementById('online-count');

let typingTimer;

// Initialize
updateCharCount();

// Event Listeners
sendButton.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault;
        sendMessage(message, username);
    }
});

messageInput.addEventListener('input', function() {
    updateCharCount();
    // Show typing indicator
    clearTimeout(window.typingTimer);
    typingIndicator.classList.remove('hidden');

    window.typingTimer = setTimeout(() => {
        // TODO : send typing event to the server
        typingIndicator.classList.add('hidden');
    }, 2000);
});

closeNotification.addEventListener('click', hideNotification);

themeToggle.addEventListener('click', toggleTheme);

// Character count update
function updateCharCount() {
    charCount.textContent = messageInput.value.length;
}

// Enhanced addMessage function with pending state
function addMessage(username, text, isOwnMessage = false, isPending = false) {
    const messageElement = document.createElement('div');
    messageElement.className = `message-enter flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`;

    if (isPending) {
        messageElement.classList.add('opacity-60');
    }

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userInitial = username.charAt(0).toUpperCase();

    messageElement.innerHTML = `
      <div class="flex items-start space-x-2 max-w-xs md:max-w-md ${isOwnMessage ? 'flex-row-reverse' : ''}">
      <div class="w-8 h-8 rounded-full ${isOwnMessage ? 'bg-indigo-500' : 'bg-purple-500'} flex items-center justify-center text-white text-sm font-semibold">
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
                messageElement.classList.remove('opacity-60');
                const pendingBadge = messageElement.querySelector('.absolute.-bottom-2');
                if (pendingBadge) {
                    pendingBadge.textContent = 'Failed';
                    pendingBadge.classList.remove('text-yellow-500');
                    pendingBadge.classList.add('text-red-500');
                }
            }
        }, 5000);
    }
}

// Simulate initial notification
setTimeout(() => {
    showNotification('Welcome to the chat! Start connecting with others.');
}, 1000);
