# Machine Learning & AI-based Football Player Recommendation System

## 1. Project Overview

This project is a football player recommendation system designed to help users search for a target football player and retrieve relevant player information from a database. The long-term goal of the system is to recommend players with similar playing styles using Machine Learning, then use an AI model to generate deeper analysis and final recommendations.

The system is divided into five main parts:

- Frontend
- Backend
- Machine Learning
- Database
- Artificial Intelligence

At the current stage, the project focuses on connecting the Frontend, Backend, and Supabase database first. The Machine Learning and AI recommendation parts will be integrated in the next development phase.

## 2. System Requirements

The system requirements are:

- Allow users to enter a football player's name.
- Send the search request from the Frontend to the Backend.
- Retrieve player information from the database.
- Display player data such as name, position, age, club, nationality, current ability, potential ability, market value, and salary.
- In the next phase, use Machine Learning to find similar players.
- In the next phase, send Machine Learning results to an AI model for recommendation analysis.
- Display Similarity Score, Recommendation Score, AI-generated analysis, and final recommendation.

## 3. Current Project Structure

The project currently contains three main folders:

```txt
Project-Football-ML-AI
├── backend
├── frontend
└── ScoutAI
```

### 3.1 Backend

The backend is built with Node.js and Express.

Current responsibilities:

- Receive requests from the Frontend.
- Validate player search input.
- Connect to Supabase.
- Retrieve player data from the `fm_players` table.
- Return player data to the Frontend as JSON.

Important files:

```txt
backend/src/app.js
backend/src/config/supabase.js
backend/src/services/playerService.js
```

### 3.2 Frontend

The frontend is built with React, Vite, Tailwind CSS, Axios, and Ant Design.

Current responsibilities:

- Provide a simple search interface.
- Receive the target player's name from the user.
- Send the search request to the backend API.
- Display player search results in a clear table format.

Important files:

```txt
frontend/src/App.jsx
frontend/src/services/api.js
```

### 3.3 Machine Learning

The Machine Learning part is currently inside the `ScoutAI` folder.

Important files:

```txt
ScoutAI/ai.ipynb
ScoutAI/fm_dataset.csv
ScoutAI/requirements.txt
```

The existing notebook already contains the main ML concept for player recommendation, including:

- Data cleaning
- Feature scaling using StandardScaler
- Dynamic feature weighting
- K-Nearest Neighbors
- Radius Nearest Neighbors
- Cosine Similarity
- K-Means Clustering
- DBSCAN

This part has not yet been connected to the backend API.

## 4. Work Completed

### 4.1 Backend Supabase Connection

A Supabase configuration file was added:

```txt
backend/src/config/supabase.js
```

The backend currently connects to Supabase using the Supabase REST API and environment variables from:

```txt
backend/.env
```

Required environment variables:

```txt
SUPABASE_URL
SUPABASE_ANON_KEY
PORT
```

The backend uses the table:

```txt
fm_players
```

### 4.2 Player Search Service

A new player service was added:

```txt
backend/src/services/playerService.js
```

This service is responsible for:

- Cleaning the search input.
- Validating that the player name has at least 2 characters.
- Searching players from Supabase using the `Name` column.
- Formatting database rows into a clean API response.
- Returning key player information to the frontend.

The service supports common player fields such as:

- Name
- Position
- Age
- Nationality
- Club
- Current Ability
- Potential Ability
- Market Value
- Salary
- Key attributes

### 4.3 Backend API Endpoint

A new API endpoint was added in:

```txt
backend/src/app.js
```

Endpoint:

```txt
GET /api/players/search?name={playerName}&limit={limit}
```

Example:

```txt
GET /api/players/search?name=Kevin&limit=10
```

Example response structure:

```json
{
  "table": "fm_players",
  "searchedColumn": "Name",
  "count": 1,
  "players": [
    {
      "id": "18004457",
      "uid": "18004457",
      "name": "Kevin De Bruyne",
      "position": "M/AM RLC",
      "age": 31,
      "nationality": "Belgium",
      "club": "Manchester City",
      "currentAbility": 189,
      "potentialAbility": 189,
      "marketValue": 347975206,
      "salary": 394372
    }
  ]
}
```

### 4.4 Frontend Search Page

The frontend main page was updated in:

```txt
frontend/src/App.jsx
```

The page now includes:

- Search input for player name.
- Search button.
- Loading state.
- Error message display.
- Player results table.

The displayed player information includes:

- Player name
- Position
- Age
- Club
- Nationality
- Current Ability
- Potential Ability
- Market Value
- Salary

### 4.5 API Service

The frontend uses Axios to communicate with the backend.

File:

```txt
frontend/src/services/api.js
```

Current backend base URL:

```txt
http://localhost:5000
```

## 5. Testing and Verification

The following checks were completed:

### 5.1 Frontend Build Test

Command:

```bash
cd frontend
npm run build
```

Result:

```txt
Build completed successfully.
```

### 5.2 Backend Load Test

Command:

```bash
cd backend
node -e "require('./src/app'); console.log('backend app loads')"
```

Result:

```txt
backend app loads
```

### 5.3 Supabase Connection Test

The backend was tested against Supabase. The connection worked, and the backend successfully reached the Supabase project.

During testing, it was found that the actual table name is:

```txt
fm_players
```

not:

```txt
players
```

The backend was updated to use `fm_players` by default.

## 6. Issue Found: Supabase RLS / Data Visibility

When testing from the backend using the Supabase anon key, the result returned an empty array:

```json
[]
```

However, when checking inside Supabase SQL Editor, the table contains player data such as:

```txt
Kevin De Bruyne
Kylian Mbappe
Robert Lewandowski
Erling Haaland
Mohamed Salah
```

This means the data exists in Supabase, but the backend may not be allowed to read it using the anon key.

The most likely cause is Supabase Row Level Security (RLS).

Recommended SQL policy:

```sql
alter table public.fm_players enable row level security;

drop policy if exists "Allow public read fm_players" on public.fm_players;

create policy "Allow public read fm_players"
on public.fm_players
for select
to anon
using (true);
```

After applying this policy, the frontend search should be able to display player data.

## 7. How to Run the Current System

### 7.1 Run Backend

```bash
cd backend
npm run dev
```

Backend URL:

```txt
http://localhost:5000
```

### 7.2 Run Frontend

```bash
cd frontend
npm run dev
```

Frontend URL:

```txt
http://localhost:5173
```

### 7.3 Test API Directly

```txt
http://localhost:5000/api/players/search?name=Kevin&limit=5
```

## 8. Current System Flow

The current implemented flow is:

```txt
User
  ↓
Frontend search input
  ↓
Backend API
  ↓
Supabase fm_players table
  ↓
Backend formats player data
  ↓
Frontend displays results
```

## 9. Next Development Steps

The recommended next steps are:

### 9.1 Fix Supabase Access

Make sure the backend can read rows from `fm_players`.

Actions:

- Confirm that data exists in `public.fm_players`.
- Add or update Supabase RLS SELECT policy.
- Test `/api/players/search`.

### 9.2 Improve Frontend Result Display

Add more useful player details:

- Key attributes
- Technical stats
- Mental stats
- Physical stats
- Market value formatting

### 9.3 Connect Machine Learning

Move ML logic from:

```txt
ScoutAI/ai.ipynb
```

into a reusable Python script or service, for example:

```txt
ScoutAI/scout_engine.py
```

Expected function:

```python
recommend_players(player_name, top_k=5)
```

The ML module should return:

- Target player
- Top-K similar players
- Similarity Score
- Statistical differences
- Market value

### 9.4 Add AI Analysis

After ML results work, send the target player and candidate players to an AI model such as Gemini.

The AI model should generate:

- Recommendation Score
- Playing Style analysis
- Strengths and Weaknesses
- Performance differences
- Team Suitability
- Value for Money
- Final best replacement

### 9.5 Final Recommendation Dashboard

The frontend should later display:

- Similar players list
- Similarity Score
- Recommendation Score
- AI explanation
- Best replacement player

## 10. Conclusion

At this stage, the project has successfully started the transition from a Machine Learning notebook into a real web-based system.

The completed work connects the Frontend, Backend, and Supabase database structure. Users can now enter a player name through the frontend, and the backend is prepared to search player information from Supabase.

The main remaining issue is database access from the backend, which is likely caused by Supabase RLS policy. Once the read policy is fixed, the current search feature should display player data correctly.

After that, the next major development phase is to connect the existing Machine Learning recommendation logic and then integrate AI-generated analysis.
