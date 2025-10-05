// Utility function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Play notification sound
function playNotificationSound() {
    // Create a simple notification sound using Web Audio API
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.15);
    } catch (error) {
        console.log('Web Audio API not supported');
    }
}

// Enhanced notification system with types
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const notificationMessage = document.getElementById('notification-message');

    // Set notification type styling
    notification.className = 'fixed top-4 right-4 bg-white rounded-xl shadow-lg p-4 max-w-sm z-50 border-l-4 ';

    switch (type) {
        case 'error':
            notification.classList.add('border-red-500');
            break;
        case 'success':
            notification.classList.add('border-green-500');
            break;
        case 'warning':
            notification.classList.add('border-yellow-500');
            break;
        default:
            notification.classList.add('border-blue-500');
    }

    notificationMessage.textContent = message;
    notification.classList.remove('hidden');
    notification.classList.add('notification-enter');

    // Auto hide after appropriate time
    const hideTime = type === 'error' ? 5000 : 3000;
    setTimeout(() => {
        hideNotification();
    }, hideTime);
}

// Hide notification
function hideNotification() {
    const notification = document.getElementById('notification');

    notification.classList.remove('notification-enter');
    notification.classList.add('notification-exit');

    setTimeout(() => {
        notification.classList.add('hidden');
        notification.classList.remove('notification-exit');
    }, 500);
}
