# Database Connection Report

## 1. Objective

The purpose of this part is to connect the backend system with the Supabase database so that the frontend can search for football players and display player information.

At this stage, the system does not use Machine Learning yet. The goal is only to make sure that player data can be retrieved from the database through the backend.

## 2. Database Used

The database used in this project is:

```txt
Supabase
```

Supabase is used as the main database for storing football player data imported from the CSV file.

The table used is:

```txt
public.fm_players
```

This table stores player information such as:

- Name
- Position
- Age
- Nationality
- Club
- Current Ability
- Potential Ability
- Market Value
- Salary
- Player attributes

## 3. Data Source

The player data originally comes from the CSV file used by the Machine Learning notebook:

```txt
ScoutAI/fm_dataset.csv
```

The CSV data was imported into Supabase so that the backend can retrieve player information from a real database instead of reading directly from a local CSV file.

## 4. Connection Method

The backend connects to Supabase using the Supabase REST API.

Instead of installing an additional Supabase package, the backend uses the built-in `fetch` API from Node.js.

This method sends HTTP requests directly to:

```txt
https://{supabase-project-url}/rest/v1/{table-name}
```

For this project, the backend sends requests to:

```txt
{SUPABASE_URL}/rest/v1/fm_players
```

## 5. Environment Variables

The Supabase connection uses environment variables stored in:

```txt
backend/.env
```

Required variables:

```txt
PORT
SUPABASE_URL
SUPABASE_ANON_KEY
```

Explanation:

| Variable | Description |
|---|---|
| `PORT` | Backend server port |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Public anon key used by the backend to access Supabase |

The backend reads these values using:

```js
require("dotenv").config();
```

## 6. Files Added or Modified

### 6.1 Supabase Config File

New file:

```txt
backend/src/config/supabase.js
```

Purpose:

- Load Supabase environment variables.
- Validate that `SUPABASE_URL` and `SUPABASE_ANON_KEY` exist.
- Create a helper function for sending requests to Supabase REST API.

Main function:

```js
supabaseRequest(path, searchParams)
```

This function builds the Supabase REST URL, adds query parameters, sends the request, and returns the JSON response.

Headers used:

```js
{
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`
}
```

These headers are required by Supabase REST API.

### 6.2 Player Service File

New file:

```txt
backend/src/services/playerService.js
```

Purpose:

- Search players by name.
- Validate user input.
- Query the `fm_players` table.
- Format raw database rows into cleaner JSON for the frontend.

Main function:

```js
searchPlayersByName(name, limit)
```

This function searches the `Name` column using a case-insensitive search.

Example Supabase filter:

```txt
Name=ilike.*Kevin*
```

This means the backend can find players whose names contain `Kevin`.

### 6.3 Backend App File

Modified file:

```txt
backend/src/app.js
```

Purpose:

- Add a new API endpoint for player search.
- Handle errors from the database service.

New endpoint:

```txt
GET /api/players/search
```

Example request:

```txt
GET /api/players/search?name=Kevin&limit=10
```

Example response:

```json
{
  "table": "fm_players",
  "searchedColumn": "Name",
  "count": 1,
  "players": [
    {
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

## 7. Database Flow

Current database flow:

```txt
Frontend
  ↓
Backend API: /api/players/search
  ↓
Player Service
  ↓
Supabase REST API
  ↓
fm_players table
  ↓
Backend formats result
  ↓
Frontend displays player data
```

## 8. Why Supabase REST API Was Used

The backend currently uses Supabase REST API because:

- It avoids installing an extra dependency.
- Node.js already supports `fetch`.
- It works well for simple database reading.
- It is enough for the current MVP stage.

Another possible method is using the official Supabase JavaScript client:

```txt
@supabase/supabase-js
```

However, this package is not currently installed in the backend project, so REST API was used first.

## 9. Validation

The backend validates the player search input before querying the database.

Validation rule:

```txt
Player name must contain at least 2 characters.
```

If the input is too short, the backend returns an error instead of querying Supabase.

## 10. Issue Found

During testing, Supabase SQL Editor showed that the table contains data, for example:

```txt
Kevin De Bruyne
Kylian Mbappe
Robert Lewandowski
Erling Haaland
Mohamed Salah
```

However, the backend initially received:

```json
[]
```

This means the backend can connect to Supabase, but the anon key may not have permission to read rows from the table.

The likely cause is:

```txt
Supabase Row Level Security (RLS)
```

## 11. RLS Policy Fix

To allow the backend to read data using the anon key, a SELECT policy should be added in Supabase SQL Editor.

Recommended SQL:

```sql
alter table public.fm_players enable row level security;

drop policy if exists "Allow public read fm_players" on public.fm_players;

create policy "Allow public read fm_players"
on public.fm_players
for select
to anon
using (true);
```

After this policy is added, the backend should be able to retrieve player rows from Supabase.

## 12. How to Test the Connection

### 12.1 Start Backend

```bash
cd backend
npm run dev
```

### 12.2 Test Root API

```txt
http://localhost:5000/
```

Expected result:

```json
{
  "message": "Football AI API IS RUNNING"
}
```

### 12.3 Test Player Search API

```txt
http://localhost:5000/api/players/search?name=Kevin&limit=5
```

Expected result:

```txt
List of players whose names match Kevin
```

## 13. Summary

The database connection part has been implemented by connecting the Express backend to Supabase through the Supabase REST API.

The backend now has a player search endpoint that receives a player name, queries the `fm_players` table, formats the result, and returns it to the frontend.

The main files involved are:

```txt
backend/src/config/supabase.js
backend/src/services/playerService.js
backend/src/app.js
```

The remaining database-related task is to make sure Supabase RLS policy allows the backend anon key to read data from the `fm_players` table.
