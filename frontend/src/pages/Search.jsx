import { useState } from "react";
import { useNavigate } from "react-router-dom";

import AuthMenu from "../components/AuthMenu";

const examplePlayers = [
  "Kevin De Bruyne",
  "Kylian Mbappe",
  "Mohamed Salah",
];

function Search() {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState("");
  const [error, setError] = useState("");

  function startAnalysis(name) {
    const cleanedName = String(name || "").trim();
    if (cleanedName.length < 2) {
      setError("Enter at least 2 characters to identify a player.");
      return;
    }

    navigate(`/result?${new URLSearchParams({ player: cleanedName })}`);
  }

  function handleSubmit(event) {
    event.preventDefault();
    startAnalysis(playerName);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07110d] text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-24 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -right-40 bottom-0 h-[30rem] w-[30rem] rounded-full bg-cyan-500/8 blur-3xl" />
        <div className="pitch-grid absolute inset-0 opacity-30" />
      </div>

      <section className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-emerald-300/30 bg-emerald-300/10 text-sm font-black text-emerald-300">
              SA
            </div>
            <div>
              <p className="font-bold tracking-tight text-white">ScoutAI</p>
              <p className="text-xs text-slate-400">Player similarity engine</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-emerald-300/20 bg-emerald-300/8 px-3 py-1 text-xs font-semibold text-emerald-200 sm:inline-flex">
              5 ML engines
            </span>
            <AuthMenu />
          </div>
        </header>

        <div className="grid flex-1 items-center gap-14 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:py-20">
          <div>
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.28em] text-emerald-300">
              Data-driven recruitment
            </p>
            <h1 className="max-w-3xl text-5xl font-black leading-[0.96] tracking-[-0.05em] text-white sm:text-6xl lg:text-7xl">
              Find the player behind the{" "}
              <span className="text-emerald-300">same football DNA.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Compare 89 attributes across 8,452 players using K-NN,
              cosine similarity, Radius NN, K-Means and DBSCAN.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/30 backdrop-blur sm:p-7">
            <div className="mb-6">
              <p className="text-sm font-semibold text-emerald-300">
                Start a scouting report
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">
                Who are you replacing?
              </h2>
            </div>

            <form onSubmit={handleSubmit}>
              <label
                className="mb-2 block text-sm font-medium text-slate-300"
                htmlFor="player-name"
              >
                Player name
              </label>
              <input
                autoComplete="off"
                autoFocus
                className="min-h-14 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-300/70 focus:ring-4 focus:ring-emerald-300/10"
                id="player-name"
                onChange={(event) => {
                  setPlayerName(event.target.value);
                  setError("");
                }}
                placeholder="e.g. Kevin De Bruyne"
                value={playerName}
              />

              {error && (
                <p className="mt-2 text-sm text-rose-300" role="alert">
                  {error}
                </p>
              )}

              <button
                className="mt-4 min-h-14 w-full rounded-xl bg-emerald-300 px-5 font-bold text-emerald-950 transition hover:bg-emerald-200 focus:outline-none focus:ring-4 focus:ring-emerald-300/25"
                type="submit"
              >
                Analyze similar players
              </button>
            </form>

            <div className="mt-6 border-t border-white/10 pt-5">
              <p className="mb-3 text-xs uppercase tracking-widest text-slate-500">
                Try an example
              </p>
              <div className="flex flex-wrap gap-2">
                {examplePlayers.map((name) => (
                  <button
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-300 transition hover:border-emerald-300/40 hover:text-emerald-200"
                    key={name}
                    onClick={() => startAnalysis(name)}
                    type="button"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <footer className="flex flex-col gap-2 border-t border-white/10 pt-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>ScoutAI · Football Manager 2023 dataset</span>
          <span>Unsupervised similarity, not performance prediction</span>
        </footer>
      </section>
    </main>
  );
}

export default Search;
