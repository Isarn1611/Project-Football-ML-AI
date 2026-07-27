import axios from "axios";

import { supabase } from "../lib/supabase";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  timeout: 130000,
});

const PLAYER_SEARCH_TIMEOUT_MS = 15000;

api.interceptors.request.use(async (config) => {
  if (!supabase) return config;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }

  return config;
});

const recommendationCache = new Map();
const aiAnalysisCache = new Map();

export function getRecommendations(playerName) {
  const normalizedName = String(playerName || "").trim();
  const cacheKey = normalizedName.toLocaleLowerCase();

  if (!recommendationCache.has(cacheKey)) {
    const request = api
      .post("/api/recommendations", {
        playerName: normalizedName,
      })
      .then((response) => response.data)
      .catch((error) => {
        recommendationCache.delete(cacheKey);
        throw error;
      });

    recommendationCache.set(cacheKey, request);
  }

  return recommendationCache.get(cacheKey);
}

export function searchPlayers(filters = {}, options = {}) {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => {
      return value !== undefined && value !== null && value !== "";
    })
  );

  return api
    .get("/api/players/search", {
      params,
      signal: options.signal,
      timeout: PLAYER_SEARCH_TIMEOUT_MS,
    })
    .then((response) => response.data);
}

export function clearRecommendationCache(playerName) {
  const cacheKey = String(playerName || "").trim().toLocaleLowerCase();
  recommendationCache.delete(cacheKey);
}

function normalizeAiLanguage(language) {
  return language === "th" ? "th" : "en";
}

export function getAiAnalysis(playerName, language = "en") {
  const normalizedName = String(playerName || "").trim();
  const normalizedLanguage = normalizeAiLanguage(language);
  const cacheKey = `${normalizedLanguage}:${normalizedName.toLocaleLowerCase()}`;

  if (!aiAnalysisCache.has(cacheKey)) {
    const request = api
      .post("/api/ai/analyze", {
        language: normalizedLanguage,
        playerName: normalizedName,
      })
      .then((response) => response.data)
      .catch((error) => {
        aiAnalysisCache.delete(cacheKey);
        throw error;
      });

    aiAnalysisCache.set(cacheKey, request);
  }

  return aiAnalysisCache.get(cacheKey);
}

export function clearAiAnalysisCache(playerName, language = "en") {
  const normalizedLanguage = normalizeAiLanguage(language);
  const cacheKey = `${normalizedLanguage}:${String(playerName || "")
    .trim()
    .toLocaleLowerCase()}`;
  aiAnalysisCache.delete(cacheKey);
}

export default api;
