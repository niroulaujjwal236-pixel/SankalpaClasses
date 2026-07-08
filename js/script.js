import { isLoggedIn, getProfile } from './auth.js';

document.addEventListener("DOMContentLoaded", () => {
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebar = document.getElementById('sidebar');
const sidebarClose = document.getElementById('sidebarClose');
const overlay = document.getElementById('overlay');
const themeToggle = document.getElementById('themeToggle');
const root = document.documentElement;

function openSidebar() {
    sidebar.classList.add('active');
    overlay.classList.add('active');
    sidebarToggle.setAttribute('aria-expanded', 'true');
    sidebar.setAttribute('aria-hidden', 'false');
}

function closeSidebar() {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
    sidebarToggle.setAttribute('aria-expanded', 'false');
    sidebar.setAttribute('aria-hidden', 'true');
}

sidebarToggle.addEventListener('click', () => {
    if (sidebar.classList.contains('active')) {
        closeSidebar();
    } else {
        openSidebar();
    }
});

sidebarClose.addEventListener('click', closeSidebar);
overlay.addEventListener('click', closeSidebar);

const accordionButtons = document.querySelectorAll('.accordion-button');
accordionButtons.forEach((button) => {
    button.addEventListener('click', () => {
        const item = button.closest('.accordion-item');
        item.classList.toggle('open');
    });
});

function loadTheme() {
    const savedTheme = localStorage.getItem('sankalpa-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    if (theme === 'dark') {
        root.setAttribute('data-theme', 'dark');
        themeToggle.checked = true;
    } else {
        root.setAttribute('data-theme', 'light');
        themeToggle.checked = false;
    }
}

themeToggle.addEventListener('change', () => {
    const mode = themeToggle.checked ? 'dark' : 'light';
    root.setAttribute('data-theme', mode);
    localStorage.setItem('sankalpa-theme', mode);
});

loadTheme();



// =========================================================================
// AUTHENTICATION & MOCK TEST ROUTING LOGIC
// =========================================================================
/*
 * Initializes the authentication gateway for the mock test.
 */
function initMockTestGateway() {
    const startBtn = document.getElementById('startMockTestBtn');
    
    if (!startBtn) return;

    startBtn.addEventListener('click', async () => {
        // Cache original button state
        const originalText = startBtn.textContent;
        
        // Step 5: Disable button and update UI state during verification
        startBtn.disabled = true;
        startBtn.textContent = 'Checking...';

        try {
            // Step 1: Check authentication status
            const authenticated = await isLoggedIn();
            
            if (!authenticated) {
                window.location.href = 'pages/login.html';
                return; // Immediately stop execution
            }

            // Step 2: Fetch the user profile from Supabase
            const profile = await getProfile();

            // Step 3: Route based on payment status
            if (profile && profile.paid === true) {
                window.location.href = 'pages/exam.html';
            } else {
                window.location.href = 'pages/payment.html';
            }

        } catch (error) {
            // Step 6: Gracefully handle Supabase or network exceptions
            console.error('Authentication routing error:', error);
            alert('Unable to verify your login. Please try again.');
            
            // Restore button UI state so user can retry
            startBtn.disabled = false;
            startBtn.textContent = originalText;
        }
    });
}

// Execute logic when the script loads
initMockTestGateway();

});