/* Settings Module (Pure Client-Side) */

const SettingsModule = {
    init() {
        this.bindEvents();
        this.loadSettings();
    },

    bindEvents() {
        const modal = document.getElementById('settings-modal');
        const openBtn = document.getElementById('btn-open-settings');
        const closeBtn = document.getElementById('close-settings-modal');
        const saveKeyBtn = document.getElementById('btn-save-api-key');
        const testKeyBtn = document.getElementById('btn-test-api-key');
        const themeSelect = document.getElementById('setting-theme');

        openBtn.addEventListener('click', () => {
            modal.classList.add('active');
        });

        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            this.saveUserSettings();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                this.saveUserSettings();
            }
        });

        // Settings Tabs
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');

                tab.classList.add('active');
                const targetId = tab.getAttribute('data-tab');
                document.getElementById(targetId).style.display = 'block';
            });
        });

        saveKeyBtn.addEventListener('click', () => this.saveApiKey());
        testKeyBtn.addEventListener('click', () => this.testApiKey());

        themeSelect.addEventListener('change', (e) => {
            document.documentElement.setAttribute('data-theme', e.target.value);
            localStorage.setItem('theme', e.target.value);
        });
    },

    loadSettings() {
        const apiKey = API.getApiKey();
        if (apiKey) {
            document.getElementById('setting-api-key').placeholder = this.maskApiKey(apiKey);
        }

        const theme = localStorage.getItem('theme') || 'dark';
        document.getElementById('setting-theme').value = theme;
        document.documentElement.setAttribute('data-theme', theme);

        document.getElementById('setting-enter-send').value = (localStorage.getItem('enter_to_send') !== 'false') ? 'true' : 'false';
        document.getElementById('setting-temperature').value = localStorage.getItem('temperature') || '0.7';
        document.getElementById('setting-max-tokens').value = localStorage.getItem('max_tokens') || '4096';
        document.getElementById('setting-custom-instructions').value = localStorage.getItem('custom_instructions') || '';
    },

    async saveApiKey() {
        const input = document.getElementById('setting-api-key');
        const statusMsg = document.getElementById('api-key-status-msg');
        const apiKey = input.value.trim();

        if (!apiKey) {
            statusMsg.innerHTML = '<span style="color: var(--danger-color);">Please enter an API Key</span>';
            return;
        }

        statusMsg.innerHTML = '<span style="color: var(--accent-color);"><i class="fa-solid fa-spinner fa-spin"></i> Validating Key...</span>';

        const testRes = await API.testApiKey(apiKey);
        if (testRes.valid) {
            API.setApiKey(apiKey);
            statusMsg.innerHTML = `<span style="color: var(--accent-color);"><i class="fa-solid fa-check"></i> API Key validated and saved!</span>`;
            input.value = '';
            input.placeholder = this.maskApiKey(apiKey);
            // Refresh models with new key
            if (window.ModelsModule) {
                ModelsModule.loadModels();
            }
        } else {
            statusMsg.innerHTML = `<span style="color: var(--danger-color);"><i class="fa-solid fa-circle-exclamation"></i> ${testRes.message}</span>`;
        }
    },

    async testApiKey() {
        const statusMsg = document.getElementById('api-key-status-msg');
        const input = document.getElementById('setting-api-key');
        const apiKey = input.value.trim() || API.getApiKey();

        statusMsg.innerHTML = '<span style="color: var(--accent-color);"><i class="fa-solid fa-spinner fa-spin"></i> Testing Connection...</span>';

        const res = await API.testApiKey(apiKey);
        if (res.valid) {
            statusMsg.innerHTML = `<span style="color: var(--accent-color);"><i class="fa-solid fa-check"></i> Connection Successful! (${res.message || 'Key valid'})</span>`;
        } else {
            statusMsg.innerHTML = `<span style="color: var(--danger-color);"><i class="fa-solid fa-xmark"></i> Connection Failed: ${res.message}</span>`;
        }
    },

    saveUserSettings() {
        localStorage.setItem('theme', document.getElementById('setting-theme').value);
        localStorage.setItem('enter_to_send', document.getElementById('setting-enter-send').value);
        localStorage.setItem('temperature', document.getElementById('setting-temperature').value);
        localStorage.setItem('max_tokens', document.getElementById('setting-max-tokens').value);
        localStorage.setItem('custom_instructions', document.getElementById('setting-custom-instructions').value);
    },

    maskApiKey(key) {
        if (!key || key.length < 8) return '********';
        return `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
    }
};
