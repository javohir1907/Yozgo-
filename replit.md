# YOZGO - Typing Practice Platform

## Project Overview
YOZGO is a modern typing practice platform inspired by Monkeytype. It features a dark minimal UI, real-time WPM/accuracy tracking, multi-language support (English, Russian, Uzbek), a global leaderboard, and real-time multiplayer typing battles.

## Architecture

**Frontend**: React + TypeScript + Vite + TailwindCSS + shadcn/ui
**Backend**: Express.js + TypeScript
**Database**: PostgreSQL via Drizzle ORM
**Auth**: Email/password (bcryptjs + express-session)
**Real-time**: WebSockets (ws package) for multiplayer battles

## Pages & Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/` | LandingPage | Hero, features, CTA |
| `/auth` | AuthPage | Login / Register |
| `/typing-test` | TypingTestPage | Core typing experience |
| `/leaderboard` | LeaderboardPage | Global rankings (daily/weekly/alltime) |
| `/battle` | BattlePage | Real-time multiplayer battles |
| `/profile` | ProfilePage | User profile and statistics |
| `/settings` | SettingsPage | Font, theme, timer, language preferences |

## Key Features

### Typing Test
- Live WPM counter and accuracy indicator
- Timer modes: 15s, 30s, 60s
- Letter-by-letter mistake highlighting (correct=green, error=red)
- Custom blinking caret
- Language support: English, Russian, Uzbek
- Tab to restart, Escape to cancel

### Leaderboard
- Global rankings by period (daily/weekly/all-time)
- Filter by language
- API: `GET /api/leaderboard?period=alltime&language=en`

### Multiplayer Battle
- Create or join rooms with unique codes
- Real-time progress bars and WPM for all players
- Winner announcement overlay
- WebSocket-based: ws://host/

### User Profile
- Stats: total tests, best WPM, avg WPM, avg accuracy
- WPM history chart (recharts)
- Recent test history table

## Database Schema

Tables:
- `users` - User profiles (email/password auth)
- `sessions` - Auth sessions (connect-pg-simple)
- `test_results` - Individual typing test records
- `leaderboard_entries` - Top scores per user per language/period
- `battles` - Battle rooms
- `battle_participants` - Per-user battle stats

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/auth/user | required | Current user |
| POST | /api/auth/login | - | Login with email/password |
| POST | /api/auth/register | - | Register new account |
| POST | /api/auth/logout | required | Logout |
| POST | /api/results | optional | Save test result |
| GET | /api/results/me | required | User's test history |
| GET | /api/leaderboard | - | Leaderboard entries |
| GET | /api/profile/:userId | - | User profile + stats |
| POST | /api/battles | - | Create battle room |
| GET | /api/battles/:code | - | Get battle by code |

## Development

Start dev server: `npm run dev`
Push DB schema: `npm run db:push`

## Multilingual UI (i18n)

- UI language (interface text) is separate from typing test language (word vocabulary)
- i18n system: `client/src/lib/i18n.tsx` with `I18nProvider` and `useI18n()` hook
- Supported UI languages: English, Russian, Uzbek
- UI language stored in `localStorage["yozgo-ui-lang"]`
- Language switcher: globe icon in nav header dropdown (EN/RU/UZ)
- Also configurable via Settings page under "Interface Language"

## Design System

- Dark theme default (Monkeytype-inspired), light theme also supported
- Primary accent: orange/warm color
- Monospace font for typing area
- Semantic tokens: `--color-correct`, `--color-error`, `--color-caret`
- Light mode: `.light` CSS class in `index.css` with full color token overrides
- Theme toggled via Settings page (dark mode switch)
