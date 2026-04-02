# 🛠️ Technical Reference: Database & API Documentation

This document provides a summary of the backend architecture for the Football League Management System, including the data models and available API endpoints.

---

## 🗄️ 1. Database Schema (Prisma ERD)

The system uses PostgreSQL with Prisma ORM. Below is an overview of the core models and their relationships.

### Core Models
| Model | Description | Key Fields |
| :--- | :--- | :--- |
| **User** | System users with roles (ADMIN, MANAGER, PLAYER) | `id`, `email`, `role`, `isActive` |
| **League** | Tournament management entity | `status` (REGISTRATION, ONGOING, etc.), `maxTeams`, `matchFormat` |
| **Team** | Football club managed by a User | `name`, `logoUrl`, `status` (APPROVED, PENDING) |
| **Player** | Detailed profile for players | `number`, `position`, `teamId`, `userId` |
| **Match** | A fixture between two teams | `matchDate`, `homeScore`, `awayScore`, `status` (LIVE, COMPLETED) |
| **MatchEvent** | In-game events for statistics | `eventType` (GOAL, ASSIST, CARD), `minute`, `playerId` |
| **LeagueStanding** | Auto-calculated table rankings | `played`, `won`, `lost`, `points`, `goalDifference` |
| **PlayerStat** | Aggregated seasonal stats | `goals`, `assists`, `yellowCards` |

### Key Relationships
- **User (1) ↔ Team (0..1)**: A Manager owns/manages one team.
- **League (1) ↔ Team (N)**: A league contains multiple approved teams.
- **Team (1) ↔ Player (N)**: A team consists of multiple players.
- **Match (1) ↔ MatchEvent (N)**: A match tracks multiple events for live reporting and stats.
- **League (1) ↔ LeagueStanding (N)**: Each league has a dedicated ranking table.

---

## 📡 2. API Endpoints Reference

All endpoints are prefixed with `/api/v1/` and require a Bearer JWT Token unless marked as **[Public]**.

### 🔑 Authentication (`/auth`)
- `POST /register`: Create a new user account. **[Public]**
- `POST /login`: Authenticate and receive `accessToken`. **[Public]**
- `POST /refresh`: Refresh the session using a `refreshToken`. **[Public]**
- `GET /google`: Google OAuth2 authentication. **[Public]**

### 🏆 Leagues (`/leagues`)
- `GET /`: List all leagues with pagination and status filters. **[Public]**
- `POST /`: Create a new league. **[Admin Only]**
- `GET /:id`: Get full league details. **[Public]**
- `PATCH /:id/status`: Change league phase (e.g., to PRE_SEASON). **[Admin Only]**
- `POST /:id/generate-fixtures`: Auto-create match schedule. **[Admin Only]**
- `POST /:id/start-season`: Officially start the competition. **[Admin Only]**
- `GET /:id/standings`: Retrieve the live league table. **[Public]**
- `GET /:id/top-scorers`: Retrieve player goal/assist stats. **[Public]**

### 🛡️ Teams (`/teams`)
- `POST /`: Create a new team (Manager profile setup).
- `GET /:id`: Get team details and roster. **[Public]**
- `POST /:id/logo`: Upload team logo in multipart/form-data.
- `POST /:id/join-league`: Request to join an active registration phase.
- `PATCH /:id/status`: Approve or Reject a team application. **[Admin Only]**

### ⚽ Matches (`/matches`)
- `GET /`: List matches with filtering by `leagueId` or `teamId`. **[Public]**
- `GET /:id/live`: **[SSE]** Real-time server-sent events for live scores. **[Public]**
- `PATCH /:id/score`: Report the final result of a match. **[Admin Only]**
- `POST /:id/events`: Log goals, cards, and assists. **[Admin Only]**

### 👤 User Profile (`/user`)
- `GET /`: Get current user's profile and team status.
- `PATCH /`: Update own profile information.
- `GET /list`: List all system users. **[Admin Only]**
- `PATCH /:id/status`: Toggle user access (Activate/Deactivate). **[Admin Only]**

### 🤝 Join Requests (`/join-requests`)
- `POST /`: Player requests to join a specific team.
- `PATCH /:id`: Manager approves or rejects a player join request.
