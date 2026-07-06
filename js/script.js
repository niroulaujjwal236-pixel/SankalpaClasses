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
