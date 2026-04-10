# Android Study Guide

An interactive, web-based study guide for mastering Android development — built for senior/staff engineer interviews at top tech companies.

**40 modules, 373 questions, 725K+ characters of lesson content** covering everything from Compose basics to Binder IPC internals, with AI-powered feedback via the Claude API.

![modules](https://img.shields.io/badge/modules-40-blue) ![questions](https://img.shields.io/badge/questions-373-green) ![content](https://img.shields.io/badge/lesson%20content-725K%20chars-orange)

## What's Covered

| Category | Modules |
|----------|---------|
| **Foundations** | Android Fundamentals, Kotlin Essentials, Advanced Kotlin, Android Internals & Process Model |
| **Threading & Concurrency** | Handler/Looper/MessageQueue, The Async Evolution, Coroutines Deep Dive, Background Processing & WorkManager |
| **Reactive Data & State** | Flow & StateFlow, LiveData & RxJava, Message Bus Evolution, Hot vs Cold Streams & Threading |
| **Lifecycle & Architecture** | Lifecycle-Aware Components, Architecture Patterns, Dependency Injection, Offline-First Architecture |
| **Jetpack Compose** | Compose Basics, Compose Advanced, Compose State Mastery, View-Compose Interop & Adaptive Layouts |
| **Theming & Resources** | Themes/Styles/Dark Mode, Configuration Changes & RROs |
| **App Plumbing** | Navigation, Networking, Data & Storage, Auth & Security |
| **Android Internals** | Binder/Services/IPC, Tasks/Intents/Window Management |
| **Performance & Debugging** | UI Responsiveness & RecyclerView vs Compose, Rendering Pipeline, Performance, Debugging & Profiling Tools, Battery & Power Management |
| **Quality & Shipping** | Testing, Accessibility & Quality, App Modularization & Build System |
| **Interview Prep** | Mobile System Design, DSA in Kotlin |
| **Capstone Projects** | Build a Gemini App, 4 Full Jetpack Compose Projects (Weather Dashboard, Offline Notes, Real-Time Chat, Multi-Module Task Manager) |

## Features

- **6 question types**: Multiple choice, fill-in-the-blank, fix-the-bug, write code, what-does-this-do, concept/trivia
- **Monaco code editor** for code questions (syntax highlighting, IntelliSense)
- **AI feedback** via Claude API (optional — bring your own API key)
- **Spaced repetition** with review queue for questions you got wrong
- **Progress tracking** with per-module completion, streak counter, and weak area detection
- **Sidebar category grouping** — 10 collapsible categories with aggregate progress
- **Lesson table of contents** — sticky right-side "On This Page" nav with scroll spy
- **Font size controls** — A-/A+ buttons for comfortable reading
- **References & Learn More** links to official Android docs, AOSP source, and articles
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
8. **Adjust font size** with A-/A+ buttons in the top-right toolbar

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
│   ├── index.json      # Module registry (40 entries with categories)
│   ├── android-fundamentals.json
│   ├── kotlin-essentials.json
│   ├── compose-basics.json
│   ├── capstone-projects.json
│   ├── ...             # 36 more module files
│   └── themes-styles.json
└── README.md
```

Each module JSON file contains:
- `lesson` — Rich HTML content with ASCII diagrams, code examples, comparison tables, info/warn boxes
- `questions` — Array of interactive exercises (6 types) with grading logic, hints, and explanations
- `references` — Links to official docs, AOSP source, videos, and articles
- `category` — Grouping for sidebar organization (defined in index.json)

## License

MIT
