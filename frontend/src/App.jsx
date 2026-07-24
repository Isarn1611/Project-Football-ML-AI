import { useState } from "react";
import api from "./services/api";

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function formatCurrency(value) {
  return value === null || value === undefined ? "-" : currencyFormatter.format(value);
}

function formatValue(value) {
  return value === null || value === undefined ? "-" : value;
}

function App() {
  const [playerName, setPlayerName] = useState("");
  const [players, setPlayers] = useState([]);
  const [searchedColumn, setSearchedColumn] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  async function handleSearch(event) {
    event.preventDefault();
    setError("");
    setPlayers([]);
    setSearchedColumn("");
    setHasSearched(false);

    const name = playerName.trim();
    if (name.length < 2) {
      setError("Please enter at least 2 characters.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.get("/api/players/search", {
        params: {
          name,
          limit: 10,
        },
      });

      setPlayers(response.data.players || []);
      setSearchedColumn(response.data.searchedColumn || "");
      setHasSearched(true);
    } catch (err) {
      setError(err.response?.data?.message || "Could not search players.");
      setHasSearched(true);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-8 sm:px-8">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
            Football Scout AI
          </p>
          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            Search Player Data
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-300">
            Enter a football player name to retrieve player information from the backend and Supabase.
          </p>
        </div>

        <form
          className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4 sm:flex-row"
          onSubmit={handleSearch}
        >
          <input
            className="min-h-11 flex-1 rounded-md border border-slate-700 bg-slate-950 px-4 text-base text-white outline-none transition focus:border-emerald-400"
            placeholder="e.g. Kevin De Bruyne"
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
          />
          <button
            className="min-h-11 rounded-md bg-emerald-400 px-6 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? "Searching..." : "Search"}
          </button>
        </form>

        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {!error && players.length > 0 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="text-xl font-semibold text-white">Search Results</h2>
              {searchedColumn && (
                <p className="text-sm text-slate-400">
                  Matched by database column: <span className="text-slate-200">{searchedColumn}</span>
                </p>
              )}
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-800">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse bg-slate-900 text-left text-sm">
                  <thead className="bg-slate-800 text-xs uppercase tracking-wide text-slate-300">
                    <tr>
                      <th className="px-4 py-3">Player</th>
                      <th className="px-4 py-3">Position</th>
                      <th className="px-4 py-3">Age</th>
                      <th className="px-4 py-3">Club</th>
                      <th className="px-4 py-3">Nationality</th>
                      <th className="px-4 py-3">CA</th>
                      <th className="px-4 py-3">PA</th>
                      <th className="px-4 py-3">Market Value</th>
                      <th className="px-4 py-3">Salary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player, index) => (
                      <tr
                        className="border-t border-slate-800 text-slate-200"
                        key={player.uid || player.id || `${player.name}-${index}`}
                      >
                        <td className="px-4 py-3 font-semibold text-white">{player.name}</td>
                        <td className="px-4 py-3">{formatValue(player.position)}</td>
                        <td className="px-4 py-3">{formatValue(player.age)}</td>
                        <td className="px-4 py-3">{formatValue(player.club)}</td>
                        <td className="px-4 py-3">{formatValue(player.nationality)}</td>
                        <td className="px-4 py-3">{formatValue(player.currentAbility)}</td>
                        <td className="px-4 py-3">{formatValue(player.potentialAbility)}</td>
                        <td className="px-4 py-3">{formatCurrency(player.marketValue)}</td>
                        <td className="px-4 py-3">{formatCurrency(player.salary)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {!error && !isLoading && hasSearched && players.length === 0 && (
          <div className="rounded-md border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
            No players found from Supabase for this search.
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
