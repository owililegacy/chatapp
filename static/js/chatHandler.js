document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const messagesContainer = document.getElementById('messages-container');
    const messageInput = document.getElementById('message-input');
    const usernameInput = document.getElementById('username-input');
    const sendButton = document.getElementById('send-button');
    const charCount = document.getElementById('char-count');
    const notification = document.getElementById('notification');
    const notificationMessage = document.getElementById('notification-message');
    const closeNotification = document.getElementById('close-notification');
    const themeToggle = document.getElementById('theme-toggle');
    const soundToggle = document.getElementById('sound-toggle');
    const timestampToggle = document.getElementById('timestamp-toggle');
    const typingIndicator = document.getElementById('typing-indicator');
    const userList = document.getElementById('user-list');
    const onlineCount = document.getElementById('online-count');

    // State
    let isDarkMode = false;
    let users = [];
    let typingTimer;

    // Initialize
    updateCharCount();

    // Event Listeners
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    messageInput.addEventListener('input', function() {
        updateCharCount();
        // Simulate typing indicator
        clearTimeout(typingTimer);
        typingIndicator.classList.remove('hidden');

        typingTimer = setTimeout(() => {
            typingIndicator.classList.add('hidden');
        }, 2000);
    });

    closeNotification.addEventListener('click', hideNotification);

    themeToggle.addEventListener('click', toggleTheme);

    // Character count update
    function updateCharCount() {
        charCount.textContent = messageInput.value.length;
    }

    // Send message function
    function sendMessage() {
        const message = messageInput.value.trim();
        const username = usernameInput.value.trim() || 'Anonymous';

        if (message) {
            // In a real app, you would send this to your backend
            // For now, we'll just display it
            addMessage(username, message, true);

            // Clear input
            messageInput.value = '';
            updateCharCount();

            // Hide typing indicator
            typingIndicator.classList.add('hidden');

            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    // Add message to chat
    function addMessage(username, text, isOwnMessage = false) {
        const messageElement = document.createElement('div');
        messageElement.className = `message-enter flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`;

        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        messageElement.innerHTML = `
          <div class="flex items-start space-x-2 max-w-xs md:max-w-md ${isOwnMessage ? 'flex-row-reverse' : ''}">
            <div class="w-8 h-8 rounded-full ${isOwnMessage ? 'bg-indigo-500' : 'bg-purple-500'} flex items-center justify-center text-white text-sm font-semibold">${username.charAt(0).toUpperCase()}</div>
            <div>
              <div class="${isOwnMessage ? 'bg-indigo-500 text-white rounded-2xl rounded-tr-none' : 'bg-white rounded-2xl rounded-tl-none shadow-sm'} px-4 py-3">
                <p>${text}</p>
              </div>
              ${timestampToggle.checked ? `
                <div class="flex items-center space-x-1 mt-1 text-xs text-gray-500 ${isOwnMessage ? 'justify-end' : ''}">
                  <span>${isOwnMessage ? 'You' : username}</span>
                  <span>•</span>
                  <span>${time}</span>
                </div>
              ` : ''}
            </div>
          </div>
        `;

        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Show notification
    function showNotification(message) {
        notificationMessage.textContent = message;
        notification.classList.remove('hidden');
        notification.classList.add('notification-enter');

        // Auto hide after 3 seconds
        setTimeout(() => {
            hideNotification();
        }, 3000);

        // Play sound if enabled
        if (soundToggle.checked) {
            // In a real app, you would play a notification sound
            console.log('Notification sound played');
        }
    }

    // Hide notification
    function hideNotification() {
        notification.classList.remove('notification-enter');
        notification.classList.add('notification-exit');

        setTimeout(() => {
            notification.classList.add('hidden');
            notification.classList.remove('notification-exit');
        }, 500);
    }

    // Toggle theme
    function toggleTheme() {
        isDarkMode = !isDarkMode;
        const icon = themeToggle.querySelector('i');

        if (isDarkMode) {
            document.body.classList.add('dark');
            document.body.classList.remove('bg-gradient-to-br', 'from-blue-50', 'to-indigo-100');
            document.body.classList.add('bg-gradient-to-br', 'from-gray-800', 'to-gray-900');
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            document.body.classList.remove('dark');
            document.body.classList.remove('bg-gradient-to-br', 'from-gray-800', 'to-gray-900');
            document.body.classList.add('bg-gradient-to-br', 'from-blue-50', 'to-indigo-100');
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    }

    // Simulate receiving messages (in a real app, this would come from your backend)
    setInterval(() => {
        // Randomly simulate receiving a message
        if (Math.random() > 0.9) {
            const users = ['Alex', 'Taylor', 'Jordan', 'Casey'];
            const messages = [
                'Hello everyone!',
                'How is your day going?',
                'Has anyone tried the new feature?',
                'I think we should discuss the upcoming project.',
                'Can someone help me with this issue?'
            ];

            const randomUser = users[Math.floor(Math.random() * users.length)];
            const randomMessage = messages[Math.floor(Math.random() * messages.length)];

            addMessage(randomUser, randomMessage);

            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        // Randomly simulate user joining
        if (Math.random() > 0.95) {
            const newUsers = ['Riley', 'Morgan', 'Avery', 'Quinn'];
            const newUser = newUsers[Math.floor(Math.random() * newUsers.length)];

            if (!users.includes(newUser)) {
                users.push(newUser);
                updateUserList();
                showNotification(`${newUser} joined the chat`);
            }
        }
    }, 10000);

    // Update user list
    function updateUserList() {
        userList.innerHTML = `
          <div class="flex items-center space-x-2 p-2 rounded-lg bg-blue-50">
            <div class="w-2 h-2 rounded-full bg-green-500"></div>
            <span class="font-medium">You</span>
          </div>
        `;

        users.forEach(user => {
            const userElement = document.createElement('div');
            userElement.className = 'flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-50';
            userElement.innerHTML = `
            <div class="w-2 h-2 rounded-full bg-green-500"></div>
            <span>${user}</span>
          `;
            userList.appendChild(userElement);
        });

        onlineCount.textContent = users.length + 1;
    }

    // Initial users
    users = ['Alex', 'Taylor', 'Jordan'];
    updateUserList();

    // Simulate initial notification
    setTimeout(() => {
        showNotification('Welcome to the chat! Start connecting with others.');
    }, 1000);
});
