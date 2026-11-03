/* Projects Workspace Module (Pure Client-Side) */

const ProjectsModule = {
    projects: [],

    init() {
        this.bindEvents();
        this.loadProjects();
    },

    bindEvents() {
        const btn = document.getElementById('btn-open-projects');
        btn.addEventListener('click', () => {
            alert('Projects Workspace: Organize your chats into distinct project spaces with project-level prompts and file context.');
        });
    },

    loadProjects() {
        this.projects = JSON.parse(localStorage.getItem('projects') || '[]');
    }
};
