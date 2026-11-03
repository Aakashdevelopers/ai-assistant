# FitUp ChatGPT-Style AI Web Application (OpenRouter Powered)

A full-stack, production-ready AI Assistant web application inspired by ChatGPT, featuring dynamic OpenRouter LLM model discovery, Server-Sent Events (SSE) streaming responses, encrypted API key management, SQLite database persistence, custom AI assistants, project workspaces, document extraction, speech-to-text, and a responsive interface.

---

## 🌟 Key Features

1. **ChatGPT-Inspired UI & UX**
   - Clean dark/light themes (`#202123` slate dark palette).
   - Responsive sidebar drawer for mobile devices.
   - Markdown rendering with code block syntax highlighting and copy buttons.
   - Conversation history grouped by time period (Today, Yesterday, 7 Days, 30 Days).
   - Speech-to-text voice input and text-to-speech audio response playback.

2. **OpenRouter API Integration**
   - **Dynamic Model Discovery:** Fetches models directly from `GET https://openrouter.ai/api/v1/models`.
   - **Search & Provider Filter:** OpenAI, Anthropic Claude, Google Gemini, DeepSeek R1, Meta Llama, Qwen, Mistral, xAI.
   - **Model Information:** Displays context window size, pricing per million tokens, vision support, and tool capabilities.
   - **SSE Real-time Streaming:** Real-time token delivery via Server-Sent Events.

3. **Security & Data Protection**
   - **API Key Encryption at Rest:** User API keys encrypted using AES-256-GCM before database storage.
   - **Masked Keys:** Keys are never exposed in plaintext to the frontend or API responses.
   - **Security Headers & Rate Limiting:** Helmet HTTP security headers and express-rate-limit protection.

4. **Document & Image Attachments**
   - Supports uploading PDF (`pdf-parse`), DOCX (`mammoth`), TXT, CSV, JSON, and images.
   - Secure server-side text extraction passed directly into prompt context.

5. **SQLite Persistence**
   - 10 structured SQLite tables (`users`, `user_settings`, `encrypted_api_credentials`, `conversations`, `messages`, `attachments`, `favorite_models`, `projects`, `project_files`, `custom_assistants`).

---

## 📁 Project Folder Structure

```text
ai-assistant/
├── frontend/
│   ├── index.html
│   ├── css/
│   │   ├── style.css
│   │   ├── responsive.css
│   │   └── themes.css
│   ├── js/
│   │   ├── api.js
│   │   ├── app.js
│   │   ├── chat.js
│   │   ├── models.js
│   │   ├── settings.js
│   │   ├── projects.js
│   │   └── assistants.js
│   └── assets/
├── backend/
│   ├── server.js
│   ├── config/
│   │   └── database.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── models.js
│   │   ├── chat.js
│   │   ├── settings.js
│   │   ├── projects.js
│   │   ├── assistants.js
│   │   └── upload.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── modelsController.js
│   │   ├── chatController.js
│   │   ├── settingsController.js
│   │   ├── projectsController.js
│   │   ├── assistantsController.js
│   │   └── uploadController.js
│   ├── services/
│   │   ├── openRouterService.js
│   │   ├── fileExtractionService.js
│   │   └── cryptoService.js
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   ├── rateLimiter.js
│   │   └── errorHandler.js
│   └── database/
│       ├── schema.sql
│       └── initDb.js
├── uploads/
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## 🚀 Quick Start & Installation

### 1. Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn

### 2. Navigate to Project Directory & Install Dependencies
```bash
cd ai-assistant
npm install
```

### 3. Environment Setup
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Edit `.env` to configure your custom encryption keys or fallback OpenRouter key if desired.

### 4. Initialize Database & Start Server
```bash
npm run init-db
npm start
```

Open your browser and navigate to: **`http://localhost:3000`**

---

## 🔑 Configuring Your OpenRouter API Key

1. Open the application at `http://localhost:3000`.
2. Click the **Settings** button at the bottom left of the sidebar.
3. Under the **OpenRouter API** tab, paste your key starting with `sk-or-v1-...`.
4. Click **Save API Key** (the key will be validated against OpenRouter and encrypted using AES-256-GCM).
5. You can now select any of the 200+ models in the model selector and start chatting!
