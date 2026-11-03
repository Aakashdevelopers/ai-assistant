/* Master Application Coordinator */

document.addEventListener('DOMContentLoaded', async () => {
    console.log('FitUp AI Assistant starting up...');

    // Mobile Sidebar Drawer Toggle
    const mobileToggleBtn = document.getElementById('mobile-toggle-btn');
    const sidebar = document.getElementById('sidebar');

    mobileToggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    // Close mobile drawer when clicking outside
    document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !mobileToggleBtn.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });

    // Theme Toggle Button
    const themeBtn = document.getElementById('btn-toggle-theme');
    themeBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        themeBtn.querySelector('i').className = newTheme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    });

    // About Creator Modal Handlers
    const aboutBtn = document.getElementById('btn-open-about');
    const aboutModal = document.getElementById('about-modal');
    const closeAboutBtn = document.getElementById('close-about-modal');

    if (aboutBtn && aboutModal && closeAboutBtn) {
        aboutBtn.addEventListener('click', () => {
            aboutModal.classList.add('active');
        });
        closeAboutBtn.addEventListener('click', () => {
            aboutModal.classList.remove('active');
        });
        aboutModal.addEventListener('click', (e) => {
            if (e.target === aboutModal) {
                aboutModal.classList.remove('active');
            }
        });
    }

    // Initialize modules
    await SettingsModule.init();
    await ModelsModule.init();
    ChatModule.init();
    ProjectsModule.init();
    AssistantsModule.init();

    console.log('FitUp AI Assistant ready.');
});
