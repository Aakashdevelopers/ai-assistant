/* Chat Manager Module (Pure Client-Side with localStorage) */

const ChatModule = {
    currentConversationId: null,
    attachments: [],
    isGenerating: false,
    recognition: null,

    init() {
        this.bindEvents();
        this.initSpeechRecognition();
        this.loadChatHistory();
    },

    bindEvents() {
        const sendBtn = document.getElementById('btn-send-message');
        const textarea = document.getElementById('chat-textarea');
        const newChatBtn = document.getElementById('btn-new-chat');
        const fileBtn = document.getElementById('btn-attach-file');
        const fileInput = document.getElementById('file-input');
        const voiceBtn = document.getElementById('btn-voice-input');

        sendBtn.addEventListener('click', () => this.sendMessage());

        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                const enterToSend = localStorage.getItem('enter_to_send') !== 'false';
                if (enterToSend) {
                    e.preventDefault();
                    this.sendMessage();
                }
            }
        });

        // Auto resize textarea
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
        });

        newChatBtn.addEventListener('click', () => this.startNewChat());

        fileBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => this.handleFileSelection(e));

        voiceBtn.addEventListener('click', () => this.toggleVoiceRecognition());

        // Prompt suggestion cards on welcome screen
        document.querySelectorAll('.suggestion-card').forEach(card => {
            card.addEventListener('click', () => {
                const prompt = card.getAttribute('data-prompt');
                textarea.value = prompt;
                this.sendMessage();
            });
        });
    },

    initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';

            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                const textarea = document.getElementById('chat-textarea');
                textarea.value += (textarea.value ? ' ' : '') + transcript;
                document.getElementById('btn-voice-input').style.color = 'var(--text-muted)';
            };

            this.recognition.onerror = () => {
                document.getElementById('btn-voice-input').style.color = 'var(--text-muted)';
            };

            this.recognition.onend = () => {
                document.getElementById('btn-voice-input').style.color = 'var(--text-muted)';
            };
        }
    },

    toggleVoiceRecognition() {
        if (!this.recognition) {
            alert('Voice recognition is not supported in your browser.');
            return;
        }

        try {
            this.recognition.start();
            document.getElementById('btn-voice-input').style.color = 'var(--accent-color)';
        } catch (e) {
            this.recognition.stop();
            document.getElementById('btn-voice-input').style.color = 'var(--text-muted)';
        }
    },

    getConversationsFromStorage() {
        return JSON.parse(localStorage.getItem('conversations') || '[]');
    },

    saveConversationsToStorage(conversations) {
        localStorage.setItem('conversations', JSON.stringify(conversations));
    },

    getMessagesFromStorage(convId) {
        return JSON.parse(localStorage.getItem(`messages_${convId}`) || '[]');
    },

    saveMessagesToStorage(convId, messages) {
        localStorage.setItem(`messages_${convId}`, JSON.stringify(messages));
    },

    loadChatHistory() {
        const conversations = this.getConversationsFromStorage();
        this.renderSidebarHistory(conversations);
    },

    renderSidebarHistory(conversations) {
        const container = document.getElementById('sidebar-history-container');
        if (!conversations || conversations.length === 0) {
            container.innerHTML = '<div style="padding: 12px; font-size: 13px; color: var(--text-muted);">No recent chats</div>';
            return;
        }

        container.innerHTML = `
            <div class="chat-group-title">Recent Chats</div>
            ${conversations.map(c => `
                <div class="history-item ${c.id === this.currentConversationId ? 'active' : ''}" data-conv-id="${c.id}">
                    <span class="history-item-title">${this.escapeHtml(c.title)}</span>
                    <div class="history-item-actions">
                        <button class="action-btn delete-conv-btn" data-conv-id="${c.id}" title="Delete Chat">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('')}
        `;

        container.querySelectorAll('.history-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('.delete-conv-btn')) {
                    const convId = e.target.closest('.delete-conv-btn').getAttribute('data-conv-id');
                    this.deleteConversation(convId);
                    return;
                }
                const convId = el.getAttribute('data-conv-id');
                this.loadConversation(convId);
            });
        });
    },

    loadConversation(convId) {
        this.currentConversationId = convId;
        const messages = this.getMessagesFromStorage(convId);

        document.getElementById('welcome-container').style.display = 'none';
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.style.display = 'flex';
        chatMessages.innerHTML = '';

        messages.forEach(msg => {
            this.appendMessageBubble(msg.role, msg.content, msg.id, msg.attachments);
        });

        this.scrollToBottom();
        this.loadChatHistory();
    },

    startNewChat() {
        this.currentConversationId = null;
        document.getElementById('welcome-container').style.display = 'flex';
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.style.display = 'none';
        chatMessages.innerHTML = '';
        this.attachments = [];
        this.renderAttachments();
        document.getElementById('chat-textarea').value = '';
    },

    deleteConversation(convId) {
        if (!confirm('Are you sure you want to delete this conversation?')) return;

        let conversations = this.getConversationsFromStorage();
        conversations = conversations.filter(c => c.id !== convId);
        this.saveConversationsToStorage(conversations);
        localStorage.removeItem(`messages_${convId}`);

        if (this.currentConversationId === convId) {
            this.startNewChat();
        } else {
            this.loadChatHistory();
        }
    },

    async handleFileSelection(e) {
        const files = Array.from(e.target.files);
        for (const file of files) {
            try {
                const textContent = await this.readFileAsTextOrBase64(file);
                this.attachments.push({
                    file_name: file.name,
                    file_type: file.type,
                    file_size: file.size,
                    extracted_text: textContent
                });
            } catch (err) {
                alert(`Error reading file ${file.name}: ${err.message}`);
            }
        }
        this.renderAttachments();
    },

    readFileAsTextOrBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            if (file.type.startsWith('image/')) {
                reader.readAsDataURL(file);
            } else {
                reader.readAsText(file);
            }
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
        });
    },

    renderAttachments() {
        const container = document.getElementById('attachment-preview-bar');
        container.innerHTML = this.attachments.map((att, idx) => `
            <div class="attachment-pill">
                <i class="fa-solid fa-file"></i>
                <span>${this.escapeHtml(att.file_name)}</span>
                <button class="remove-att-btn" data-index="${idx}">&times;</button>
            </div>
        `).join('');

        container.querySelectorAll('.remove-att-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-index'), 10);
                this.attachments.splice(idx, 1);
                this.renderAttachments();
            });
        });
    },

    async sendMessage() {
        if (this.isGenerating) return;

        const textarea = document.getElementById('chat-textarea');
        const text = textarea.value.trim();

        if (!text && this.attachments.length === 0) return;

        // Hide welcome screen
        document.getElementById('welcome-container').style.display = 'none';
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.style.display = 'flex';

        // Prepare or create conversation ID
        if (!this.currentConversationId) {
            this.currentConversationId = 'conv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
            const title = text.substring(0, 30) + (text.length > 30 ? '...' : '');
            const conversations = this.getConversationsFromStorage();
            conversations.unshift({ id: this.currentConversationId, title, created_at: new Date().toISOString() });
            this.saveConversationsToStorage(conversations);
        }

        // Save User Message to local storage
        const userMsgId = 'msg_' + Date.now();
        const existingMessages = this.getMessagesFromStorage(this.currentConversationId);
        const userMsgObj = { id: userMsgId, role: 'user', content: text, attachments: [...this.attachments] };
        existingMessages.push(userMsgObj);
        this.saveMessagesToStorage(this.currentConversationId, existingMessages);

        // Append User Bubble to UI
        this.appendMessageBubble('user', text, userMsgId, [...this.attachments]);

        const currentAtts = [...this.attachments];
        textarea.value = '';
        textarea.style.height = 'auto';
        this.attachments = [];
        this.renderAttachments();

        // Append Streaming AI Bubble Placeholder
        const aiMsgId = 'msg_' + (Date.now() + 1);
        const aiBubbleContent = this.appendMessageBubble('assistant', '<i class="fa-solid fa-circle-notch fa-spin"></i> Thinking...', aiMsgId);

        this.isGenerating = true;
        const selectedModel = ModelsModule.selectedModel ? ModelsModule.selectedModel.id : 'openai/gpt-4o-mini';

        // Prepare LLM message payload
        const apiMessages = [];
        const customInstructions = localStorage.getItem('custom_instructions') || '';
        let sysPrompt = 'You are a helpful, clever, and articulate AI assistant.';
        if (customInstructions) {
            sysPrompt += `\n\nUser Custom Instructions:\n${customInstructions}`;
        }
        apiMessages.push({ role: 'system', content: sysPrompt });

        // Add history
        existingMessages.forEach(m => {
            let content = m.content;
            if (m.attachments && m.attachments.length > 0) {
                m.attachments.forEach(att => {
                    content += `\n\n[Attached file: ${att.file_name}]\n${att.extracted_text}`;
                });
            }
            apiMessages.push({ role: m.role, content: content });
        });

        const temperature = parseFloat(localStorage.getItem('temperature') || '0.7');
        const max_tokens = parseInt(localStorage.getItem('max_tokens') || '4096', 10);

        let accumulatedText = '';

        await API.streamChat({
            model_id: selectedModel,
            messages: apiMessages,
            temperature,
            max_tokens
        }, (chunk, fullText) => {
            accumulatedText = fullText;
            aiBubbleContent.innerHTML = this.parseMarkdown(accumulatedText);
            this.highlightCodeBlocks(aiBubbleContent);
            this.scrollToBottom();
        }, (finalText) => {
            this.isGenerating = false;
            aiBubbleContent.innerHTML = this.parseMarkdown(finalText);
            this.highlightCodeBlocks(aiBubbleContent);

            // Save AI message to storage
            const updatedMessages = this.getMessagesFromStorage(this.currentConversationId);
            updatedMessages.push({ id: aiMsgId, role: 'assistant', content: finalText });
            this.saveMessagesToStorage(this.currentConversationId, updatedMessages);

            this.loadChatHistory();
        }, (err) => {
            this.isGenerating = false;
            aiBubbleContent.innerHTML = `<span style="color: var(--danger-color);">Error: ${this.escapeHtml(err.message)}</span>`;
        });
    },

    appendMessageBubble(role, content, msgId = null, attachments = []) {
        const container = document.getElementById('chat-messages');
        const isUser = role === 'user';

        const row = document.createElement('div');
        row.className = 'message-row';
        if (msgId) row.id = msgId;

        const avatarHtml = isUser
            ? `<div class="message-avatar user-avatar"><i class="fa-solid fa-user"></i></div>`
            : `<div class="message-avatar ai-avatar"><i class="fa-solid fa-bolt"></i></div>`;

        let attHtml = '';
        if (attachments && attachments.length > 0) {
            attHtml = `<div class="attachment-preview-bar" style="margin-bottom: 8px;">` +
                attachments.map(att => `<div class="attachment-pill"><i class="fa-solid fa-paperclip"></i> ${this.escapeHtml(att.file_name)}</div>`).join('') +
                `</div>`;
        }

        const formattedContent = isUser ? this.escapeHtml(content) : this.parseMarkdown(content);

        row.innerHTML = `
            ${avatarHtml}
            <div class="message-content-wrapper">
                <div class="message-sender">${isUser ? 'You' : 'FitUp AI'}</div>
                ${attHtml}
                <div class="message-bubble">${formattedContent}</div>
                ${!isUser ? `
                    <div class="message-actions">
                        <button class="msg-btn copy-msg-btn" title="Copy Response"><i class="fa-regular fa-copy"></i> Copy</button>
                        <button class="msg-btn speak-msg-btn" title="Read Aloud"><i class="fa-solid fa-volume-high"></i> Speak</button>
                    </div>
                ` : ''}
            </div>
        `;

        container.appendChild(row);

        const bubble = row.querySelector('.message-bubble');
        if (!isUser) {
            this.highlightCodeBlocks(bubble);

            row.querySelector('.copy-msg-btn')?.addEventListener('click', () => {
                navigator.clipboard.writeText(bubble.innerText);
                alert('Copied message to clipboard!');
            });

            row.querySelector('.speak-msg-btn')?.addEventListener('click', () => {
                const utterance = new SpeechSynthesisUtterance(bubble.innerText);
                window.speechSynthesis.speak(utterance);
            });
        }

        this.scrollToBottom();
        return bubble;
    },

    parseMarkdown(text) {
        if (window.marked) {
            return marked.parse(text || '');
        }
        return this.escapeHtml(text);
    },

    highlightCodeBlocks(container) {
        if (window.hljs) {
            container.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
                const pre = block.parentElement;
                if (!pre.querySelector('.code-header')) {
                    const header = document.createElement('div');
                    header.className = 'code-header';
                    header.innerHTML = `<span>Code</span><button class="copy-code-btn"><i class="fa-regular fa-copy"></i> Copy</button>`;
                    pre.insertBefore(header, block);
                    header.querySelector('.copy-code-btn').addEventListener('click', () => {
                        navigator.clipboard.writeText(block.innerText);
                        alert('Code copied to clipboard!');
                    });
                }
            });
        }
    },

    scrollToBottom() {
        const container = document.getElementById('chat-container');
        container.scrollTop = container.scrollHeight;
    },

    escapeHtml(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
};
