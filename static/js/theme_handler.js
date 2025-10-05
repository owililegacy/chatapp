const themeToggle = document.getElementById('theme-toggle');

// State
let isDarkMode = false;

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

themeToggle.addEventListener('click', toggleTheme);

//Initialize theme handler
toggleTheme()
