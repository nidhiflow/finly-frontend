<p align="center">
  <img src="public/finly-logo.png" alt="Finly Logo" width="120" height="120" style="border-radius: 16px;" />
</p>

<h1 align="center">Finly Frontend</h1>

<p align="center">
  <strong>🚀 Modern personal finance management — built with React 19 & Vite</strong>
</p>

<p align="center">
  <a href="https://www.nidhiflow.in">🌐 Live App</a> •
  <a href="https://github.com/nidhiflow/finly-backend">⚙️ Backend Repo</a> •
  <a href="https://github.com/nidhiflow/finly-db">🗄️ Database Repo</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor&logoColor=white" />
  <img src="https://img.shields.io/badge/License-Private-red" />
</p>

---

## 📖 About

Finly is a full-featured personal finance application that helps users track expenses, income, budgets, savings goals, and more — across web, Android, and iOS.

This repository contains the **frontend** client built with React, styled with custom CSS, and powered by Vite for blazing-fast development.

---

## ✨ Features

- 📊 **Dashboard** — Real-time overview of finances with charts & summaries
- 💸 **Transactions** — Add, edit, search, and filter income/expense/transfers
- 📂 **Categories** — Hierarchical categories with icons & colors
- 💰 **Budgets** — Set monthly budgets with AI-powered suggestions
- 🎯 **Savings Goals** — Track progress toward financial goals
- 🤖 **AI Agent** — Chat with an AI financial assistant
- 📅 **Calendar** — Visualize spending by date
- 📈 **Charts** — Detailed analytics and trends
- 🔔 **Notifications** — Budget alerts, goal milestones, weekly summaries
- 🔖 **Bookmarks** — Save important transactions for quick access
- ☁️ **Google Drive Backup** — Automatic cloud backups
- 📱 **Mobile App** — Native Android & iOS via Capacitor
- 🌙 **Dark Mode** — Beautiful dark theme by default

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **React 19** | UI framework |
| **Vite 7** | Build tool & dev server |
| **React Router 7** | Client-side routing |
| **Recharts** | Charts & data visualization |
| **Lucide React** | Icon library |
| **Capacitor 8** | Native mobile (Android/iOS) |
| **date-fns** | Date utilities |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- npm 9+

### Installation

```bash
git clone https://github.com/nidhiflow/finly-frontend.git
cd finly-frontend
npm install
```

### Development

```bash
npm run dev
```

The dev server starts at `http://localhost:5173` with API proxy to `http://localhost:3001`.

### Production Build

```bash
npm run build
```

Output is generated in the `dist/` directory.

### Deploy on Render (client-side routes)

This app uses **React Router**. Deep links such as `/login` or `/accounts` must return the SPA shell, not a 404.

On a **Render Static Site**, either:

1. Open **Redirects / Rewrites**, add: **Source** `/*`, **Destination** `/index.html`, **Action** **Rewrite** (not Redirect), or  
2. Sync the repo’s [`render.yaml`](render.yaml) blueprint so the same rule is applied.

`public/_redirects` is for Netlify-style hosts; **Render does not read it** for static sites.

### Bank logos (Accounts)

Bundled SVGs live in [`public/bank-logos/`](public/bank-logos/) (simplified brand marks, CC0 via [Simple Icons](https://simpleicons.org)). To add another bank, place `yourid.svg` there and set `logoSrc: '/bank-logos/yourid.svg'` on that row in [`src/data/bankLogos.js`](src/data/bankLogos.js). You can also set `simpleIconSlug` (Simple Icons slug) to load from their CDN when `logoSrc` is omitted.

---

## 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `/api` (proxied in dev) |

Create a `.env.local` file:

```env
VITE_API_BASE_URL=http://localhost:3001/api
```

---

## 🐳 Docker

```bash
# Build
docker build --build-arg VITE_API_BASE_URL=https://api.nidhiflow.in -t finly-frontend .

# Run
docker run -p 80:80 finly-frontend
```

The Docker image uses a multi-stage build: Node.js for building, Nginx for serving.

---

## 🔄 CI/CD Pipeline

Every push to `main` triggers the GitHub Actions pipeline:

```
📦 Build → Install deps, lint, build, Docker image → Push to GHCR
🔍 Test  → Trivy (vulnerability scan), SonarQube (code quality), OWASP ZAP (DAST)
🚀 Deploy → Trigger Render deploy hook (only after Build + Test pass)
```

---

## 📁 Project Structure

```
finly-frontend/
├── public/              # Static assets (icons, manifest)
├── src/
│   ├── assets/          # Images & static resources
│   ├── context/         # React context providers (App, Auth)
│   ├── hooks/           # Custom React hooks
│   ├── pages/           # Page components
│   ├── services/        # API service layer
│   ├── utils/           # Utility functions
│   ├── App.jsx          # Root component
│   ├── index.css        # Global styles
│   └── main.jsx         # Entry point
├── Dockerfile           # Multi-stage Docker build
├── nginx.conf           # Nginx config for SPA routing
├── vite.config.js       # Vite configuration
└── package.json
```

---

## 🏗️ Architecture

This frontend is part of the **Finly microservices architecture**:

| Service | Repository | Description |
|---------|------------|-------------|
| **Frontend** | [`finly-frontend`](https://github.com/nidhiflow/finly-frontend) | React SPA (this repo) |
| **Backend** | [`finly-backend`](https://github.com/nidhiflow/finly-backend) | Express.js REST API |
| **Database** | [`finly-db`](https://github.com/nidhiflow/finly-db) | PostgreSQL schema & migrations |

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/nidhiflow">NidhiFlow</a>
</p>
