# FarmFlow

FarmFlow is a "Local-First" agricultural management system designed for **offline-critical** environments. It allows farmers to track chemical applications, planting records, and harvest data without relying on constant internet connectivity.

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Git](https://git-scm.com/)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-org/farmflow.git
    cd farmflow
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Start the development server:**
    ```bash
    npm start
    ```
    This runs `expo start`, which allows you to run the app on:
    - **Web:** Press `w`
    - **iOS:** Press `i` (Requires Xcode/Simulator or Expo Go)
    - **Android:** Press `a` (Requires Android Studio/Emulator or Expo Go)

## 🏗 Architecture

FarmFlow follows the **GEMINI** engineering standards (see `GEMINI.md` for full details).

### Core Principles
1.  **Offline-First:** All data writes go to the local SQLite database (`PowerSync`). Data syncs to the cloud (`Supabase`) when online.
2.  **SOLID Design:** Components are strictly separated into UI, Hooks (Logic), and Utils.
3.  **Type Safety:** Strict TypeScript usage is enforced.

### Tech Stack
-   **Frontend:** React Native (Expo)
-   **Database (Local):** PowerSync (SQLite)
-   **Database (Cloud):** Supabase (PostgreSQL)
-   **Testing:** Playwright (E2E)

## 🛠 Scripts & Commands

| Command | Description |
| :--- | :--- |
| `npm start` | Start the Expo development server. |
| `npm run web` | Start the web version specifically. |
| `npm run build:web` | Build the web application for production (`dist/`). |
| `npx tsc --noEmit` | Run TypeScript type checking. |
| `npx playwright test` | Run End-to-End tests (requires web build running). |

## ❓ Troubleshooting

### "Sync Not Working"
-   Check the **Sync Indicator** pill in the header.
-   **Yellow:** Syncing in progress.
-   **Red:** Offline or Error.
-   **Green:** Fully synced.
-   If stuck, try restarting the app or checking your network connection.

### "Database Locked"
-   This occurs if a migration is interrupted.
-   Restart the app to trigger the self-healing database routine.

### "Blank Screen on Web"
-   Ensure you are using a supported browser (Chrome, Safari, Edge).
-   Check the console (F12) for errors.

## 📄 License
Private / Proprietary.
