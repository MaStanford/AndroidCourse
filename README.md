# Android Study Guide

An interactive, web-based study guide for mastering Android development — built for senior/staff engineer interviews at top tech companies.

**27 modules, 253 questions** covering everything from Compose basics to Binder IPC internals, with AI-powered feedback via the Claude API.

![Screenshot](https://img.shields.io/badge/modules-27-blue) ![Screenshot](https://img.shields.io/badge/questions-253-green) ![Screenshot](https://img.shields.io/badge/references-124-orange)

## What's Covered

| Category | Modules |
|----------|---------|
| **Kotlin** | Kotlin Essentials, Advanced Kotlin, DSA in Kotlin |
| **Compose** | Compose Basics, Compose Advanced, Compose State Mastery |
| **Architecture** | Architecture Patterns, Navigation, Dependency Injection, Modularization & Build |
| **Data** | Networking, Auth & Security, Data & Storage |
| **Quality** | Testing, Performance, Accessibility & Quality |
| **Concurrency** | Coroutines Deep Dive, Flow & StateFlow, Background Processing |
| **Framework Internals** | Android Internals & Process Model, Binder/Services/IPC, Tasks/Intents/Windows, Rendering Pipeline (Views & Compose) |
| **System Design** | Mobile System Design, View-Compose Interop & Adaptive Layouts |
| **Capstone** | Build a Gemini App |

## Features

- **6 question types**: Multiple choice, fill-in-the-blank, fix-the-bug, write code, what-does-this-do, concept/trivia
- **Monaco code editor** for code questions (syntax highlighting, IntelliSense)
- **AI feedback** via Claude API (optional — bring your own API key)
- **Spaced repetition** with review queue for questions you got wrong
- **Progress tracking** with per-module completion, streak counter, and weak area detection
- **References & Learn More** links to official Android docs, AOSP source code, GitHub repos, and videos
- **Dark/light theme** toggle
- **Export/import** progress as JSON
- **Mobile responsive** with collapsible sidebar

## Installation

No build tools or dependencies required. Just clone and serve.

```bash
git clone https://github.com/MaStanford/AndroidCourse.git
cd AndroidCourse
```

## Running

Serve the files with any static HTTP server. The simplest option:

```bash
python3 -m http.server 8000
```

Then open your browser to:

```
http://localhost:8000
```

### Alternative servers

```bash
# Node.js
npx serve .

# PHP
php -S localhost:8000

# Ruby
ruby -run -e httpd . -p 8000
```

> **Note:** You must serve via HTTP — opening `index.html` directly as a `file://` URL won't work because the app fetches module JSON files, which browsers block for local files due to CORS.

## Usage

1. **Select a module** from the sidebar to read the lesson
2. **Click "Start Questions"** to begin the interactive exercises
3. **Use the code editor** for fix-the-bug and write-code questions
4. **Check your answer** — get instant feedback with explanations
5. **Use hints** if you're stuck (costs nothing, just learning)
6. **Ask Claude** for AI-powered tutoring feedback (requires API key in Settings)
7. **Review due questions** appear in the review queue based on spaced repetition

### Claude API Setup (Optional)

To enable AI feedback:

1. Click **Settings** in the top-right
2. Enter your [Anthropic API key](https://console.anthropic.com/)
3. The key is stored in your browser's localStorage only — never sent anywhere except the Anthropic API

## Project Structure

```
.
├── index.html          # Single-page app shell + CSS
├── app.js              # Application logic (state, rendering, grading, API)
├── modules/
│   ├── index.json      # Module registry (27 entries)
│   ├── android-fundamentals.json
│   ├── kotlin-essentials.json
│   ├── compose-basics.json
│   ├── ...             # 24 more module files
│   └── rendering-pipeline.json
└── README.md
```

Each module JSON file contains:
- `lesson` — HTML content with diagrams, code examples, and tables
- `questions` — Array of interactive exercises with grading logic
- `references` — Links to official docs, AOSP source, videos
- Questions may include `learnMore` links for deeper exploration

## License

MIT
