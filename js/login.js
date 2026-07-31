document.addEventListener('DOMContentLoaded', () => {
    // 1. Theme Initialization
    (function loadTheme() {
        const savedTheme = localStorage.getItem('sankalpa-theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = savedTheme || (prefersDark ? 'dark' : 'light');
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    })();

    // 2. Strict Target Date: August 1, 2026 @ 1:00 PM NPT (+05:45)
    const targetDate = new Date('2026-08-01T13:00:00+05:45').getTime();

    // 3. DOM Elements
    const elements = {
        hours: document.getElementById('hours'),
        minutes: document.getElementById('minutes'),
        seconds: document.getElementById('seconds'),
        statusTitle: document.getElementById('statusTitle'),
        countdownWrapper: document.getElementById('countdown'),
        refreshBtn: document.getElementById('refreshBtn'),
        statusBadge: document.querySelector('.status-badge span:last-child'),
        pulseDot: document.querySelector('.pulse-dot')
    };

    // Store previous values for animation logic
    let prevValues = { hours: -1, minutes: -1, seconds: -1 };

    // 4. Update Function
    function updateTimer() {
        const now = new Date().getTime();
        const distance = targetDate - now;

        // Exam Started State
        if (distance <= 0) {
            clearInterval(timerInterval);
            
            elements.statusTitle.textContent = "The Mock Test is Now Open";
            elements.statusTitle.style.color = "var(--success-color)";
            elements.statusBadge.textContent = "Live Now";
            elements.pulseDot.style.backgroundColor = "var(--success-color)";
            elements.pulseDot.style.boxShadow = "0 0 0 0 rgba(22, 163, 74, 0.7)";
            
            elements.countdownWrapper.classList.add('hidden');
            elements.refreshBtn.classList.remove('hidden');
            return;
        }

        // Calculations
        const hours = Math.floor(distance / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        // Update DOM with leading zeros & slight pop animation on change
        updateElement(elements.hours, hours, 'hours');
        updateElement(elements.minutes, minutes, 'minutes');
        updateElement(elements.seconds, seconds, 'seconds');
    }

    // Helper to update text and animate only if changed
    function updateElement(el, value, key) {
        if (prevValues[key] !== value) {
            el.textContent = String(value).padStart(2, '0');
            
            // Add a quick CSS scale effect
            el.style.transform = 'scale(1.05)';
            el.style.transition = 'transform 0.1s ease';
            setTimeout(() => {
                el.style.transform = 'scale(1)';
            }, 100);

            prevValues[key] = value;
        }
    }

    // Run immediately, then every second
    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);
});