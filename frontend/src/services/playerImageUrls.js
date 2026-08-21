import { supabase } from "../lib/supabase";

const PLAYER_IMAGE_BUCKET = "player-images";
const PLAYER_IMAGE_FOLDER = "players";
const SIGNED_URL_EXPIRY_SECONDS = 3600;
const signedUrlCache = new Map();

function normalizeUid(uid) {
  return String(uid ?? "").trim();
}

export function getPlayerImageUrl(uid) {
  const normalizedUid = normalizeUid(uid);

  if (!supabase || !normalizedUid) return null;

  const { data } = supabase.storage
    .from(PLAYER_IMAGE_BUCKET)
    .getPublicUrl(`${PLAYER_IMAGE_FOLDER}/${normalizedUid}.webp`);

  return data?.publicUrl || null;
}

export async function getPlayerImageSignedUrl(
  uid,
  expiresIn = SIGNED_URL_EXPIRY_SECONDS,
) {
  const normalizedUid = normalizeUid(uid);

  if (!supabase || !normalizedUid) return null;

  const seconds = Math.min(
    Math.max(Number(expiresIn) || SIGNED_URL_EXPIRY_SECONDS, 60),
    86400,
  );
  const cacheKey = `${normalizedUid}:${seconds}`;
  const cached = signedUrlCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.url;
  }

  const { data, error } = await supabase.storage
    .from(PLAYER_IMAGE_BUCKET)
    .createSignedUrl(`${PLAYER_IMAGE_FOLDER}/${normalizedUid}.webp`, seconds);

  if (error || !data?.signedUrl) return null;

  signedUrlCache.set(cacheKey, {
    url: data.signedUrl,
    expiresAt: Date.now() + seconds * 1000,
  });

  return data.signedUrl;
}

export function getPlayerInitials(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
