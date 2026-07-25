import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  timeout: 130000,
});

const recommendationCache = new Map();

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

export function clearRecommendationCache(playerName) {
  const cacheKey = String(playerName || "").trim().toLocaleLowerCase();
  recommendationCache.delete(cacheKey);
}

export default api;
