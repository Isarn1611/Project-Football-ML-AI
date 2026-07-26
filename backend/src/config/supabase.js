require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

let supabaseAuthClient;

function ensureSupabaseConfig() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Missing SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY in backend .env"
    );
  }
}

function getSupabaseAuthClient() {
  ensureSupabaseConfig();

  if (!supabaseAuthClient) {
    supabaseAuthClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return supabaseAuthClient;
}

async function supabaseRequest(path, searchParams = {}) {
  ensureSupabaseConfig();

  const url = new URL(`/rest/v1/${path}`, SUPABASE_URL);
  Object.entries(searchParams).forEach(([key, value]) => {
    const values = Array.isArray(value) ? value : [value];

    for (const entry of values) {
      if (entry !== undefined && entry !== null && entry !== "") {
        url.searchParams.append(key, String(entry));
      }
    }
  });

  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.message || payload?.error || "Supabase request failed";
    const error = new Error(message);
    error.status = response.status;
    error.details = payload;
    throw error;
  }

  return payload;
}

module.exports = {
  getSupabaseAuthClient,
  supabaseRequest,
};
