import { isLoggedIn, getProfile } from '/js/auth.js';
import { supabase } from "/supabase/config.js";

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
const startBtn = document.getElementById("startMockTestBtn");

startBtn.addEventListener("click", async () => {
    startBtn.disabled = true;
    startBtn.textContent = "Checking...";

    const { data: { session } } = await supabase.auth.getSession();

    // Not logged in
    if (!session) {
        window.location.href = "pages/login.html";
        return;
    }

    const user = session.user;

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("paid")
        .eq("id", user.id)
        .single();

    if (error) {
        console.error(error);
        alert("Unable to load profile.");
        startBtn.disabled = false;
        startBtn.textContent = "Start Mock Test";
        return;
    }

    if (profile.paid) {
        window.location.href = "pages/exam.html";
    } else {
        window.location.href = "pages/payment.html";
    }
    });
}

// Execute logic when the script loads
initMockTestGateway();

});