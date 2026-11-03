/* Models Selector Module (Pure Client-Side) */

const ModelsModule = {
    models: [],
    selectedModel: null,
    activeProviderFilter: 'all',

    async init() {
        this.bindEvents();
        await this.loadModels();
    },

    bindEvents() {
        const btn = document.getElementById('model-selector-btn');
        const dropdown = document.getElementById('model-dropdown');
        const searchInput = document.getElementById('model-search-input');
        const providerTagsContainer = document.getElementById('provider-tags-container');

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });

        searchInput.addEventListener('input', () => {
            this.renderModelList();
        });

        providerTagsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('provider-tag')) {
                document.querySelectorAll('.provider-tag').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.activeProviderFilter = e.target.getAttribute('data-provider');
                this.renderModelList();
            }
        });
    },

    async loadModels() {
        try {
            const fetched = await API.fetchModels();
            const favorites = JSON.parse(localStorage.getItem('favorite_models') || '[]');
            const favSet = new Set(favorites);

            this.models = fetched.map(m => ({
                ...m,
                is_favorite: favSet.has(m.id)
            }));

            // Select default model
            const savedDefault = localStorage.getItem('default_model') || 'openai/gpt-4o-mini';
            const initial = this.models.find(m => m.id === savedDefault) || this.models[0];
            if (initial) {
                this.selectModel(initial);
            }
            this.renderModelList();
        } catch (err) {
            console.error('Failed to load models:', err);
            // Fallback default list if offline
            this.models = [
                { id: 'openai/gpt-4o-mini', name: 'OpenAI GPT-4o Mini', provider: 'OpenAI', context_length: 128000, is_free: false, supports_vision: true },
                { id: 'openai/gpt-4o', name: 'OpenAI GPT-4o', provider: 'OpenAI', context_length: 128000, is_free: false, supports_vision: true },
                { id: 'anthropic/claude-3.5-sonnet', name: 'Anthropic Claude 3.5 Sonnet', provider: 'Anthropic', context_length: 200000, is_free: false, supports_vision: true },
                { id: 'google/gemini-2.0-flash-001', name: 'Google Gemini 2.0 Flash', provider: 'Google', context_length: 1000000, is_free: true, supports_vision: true },
                { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek', context_length: 64000, is_free: false, supports_vision: false },
                { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Meta Llama 3.3 70B', provider: 'Meta', context_length: 128000, is_free: true, supports_vision: false }
            ];
            this.selectModel(this.models[0]);
            this.renderModelList();
        }
    },

    renderModelList() {
        const container = document.getElementById('model-list-container');
        const searchTerm = document.getElementById('model-search-input').value.toLowerCase().trim();

        let filtered = this.models.filter(m => {
            const matchesSearch = m.name.toLowerCase().includes(searchTerm) || m.id.toLowerCase().includes(searchTerm) || m.provider.toLowerCase().includes(searchTerm);
            const matchesProvider = this.activeProviderFilter === 'all' || m.provider.toLowerCase() === this.activeProviderFilter.toLowerCase();
            return matchesSearch && matchesProvider;
        });

        if (filtered.length === 0) {
            container.innerHTML = '<div style="padding: 12px; font-size: 13px; color: var(--text-muted); text-align: center;">No models found</div>';
            return;
        }

        container.innerHTML = filtered.map(m => `
            <div class="model-option ${this.selectedModel && this.selectedModel.id === m.id ? 'active' : ''}" data-model-id="${m.id}">
                <div>
                    <div class="model-info-title">${this.escapeHtml(m.name)}</div>
                    <div class="model-info-sub">
                        <span>${this.escapeHtml(m.provider)}</span> •
                        <span>${(m.context_length / 1024).toFixed(0)}k ctx</span>
                        ${m.is_free ? '<span style="color: var(--accent-color); font-weight: bold;">FREE</span>' : ''}
                    </div>
                </div>
                <div>
                    ${m.supports_vision ? '<i class="fa-solid fa-eye" title="Vision Capable" style="color: var(--text-muted); font-size: 12px; margin-right: 6px;"></i>' : ''}
                    <button class="action-btn fav-btn" data-model-id="${m.id}" title="Favorite">
                        <i class="${m.is_favorite ? 'fa-solid' : 'fa-regular'} fa-star" style="${m.is_favorite ? 'color: #f59e0b;' : ''}"></i>
                    </button>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.model-option').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('.fav-btn')) {
                    const modelId = e.target.closest('.fav-btn').getAttribute('data-model-id');
                    this.toggleFavorite(modelId);
                    return;
                }
                const modelId = el.getAttribute('data-model-id');
                const selected = this.models.find(m => m.id === modelId);
                if (selected) {
                    this.selectModel(selected);
                    document.getElementById('model-dropdown').classList.remove('show');
                }
            });
        });
    },

    selectModel(model) {
        this.selectedModel = model;
        document.getElementById('selected-model-name').textContent = model.name;
        document.getElementById('selected-model-provider').textContent = model.provider;
        localStorage.setItem('default_model', model.id);
        this.renderModelList();
    },

    toggleFavorite(modelId) {
        const model = this.models.find(m => m.id === modelId);
        if (!model) return;
        model.is_favorite = !model.is_favorite;

        const favorites = JSON.parse(localStorage.getItem('favorite_models') || '[]');
        let updatedFavs;
        if (model.is_favorite) {
            updatedFavs = Array.from(new Set([...favorites, modelId]));
        } else {
            updatedFavs = favorites.filter(id => id !== modelId);
        }
        localStorage.setItem('favorite_models', JSON.stringify(updatedFavs));
        this.renderModelList();
    },

    escapeHtml(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
};
