import { useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "../lib/supabase";

const PLAYER_IMAGE_BUCKET = "player-images";
const PLAYER_IMAGE_FOLDER = "players";
const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour
const signedUrlCache = new Map();

function normalizeUid(uid) {
  return String(uid ?? "").trim();
}

/**
 * Build a public Supabase Storage URL for a player image.
 *
 * Images are uploaded by the image-import script to the `player-images`
 * bucket at `players/{UID}.webp`. Returns null when Supabase is not
 * configured or the uid is missing so callers can fall back to initials.
 */
export function getPlayerImageUrl(uid) {
  const normalizedUid = normalizeUid(uid);

  if (!supabase || !normalizedUid) {
    return null;
  }

  const { data } = supabase.storage
    .from(PLAYER_IMAGE_BUCKET)
    .getPublicUrl(`${PLAYER_IMAGE_FOLDER}/${normalizedUid}.webp`);

  return data?.publicUrl || null;
}

/**
 * Create (and cache) a temporarily signed URL for a player image.
 *
 * Signed URLs also work for private buckets as long as the signed-in user
 * has SELECT access on the bucket. The URL token is embedded in the query
 * string, so it can be used directly in an <img> tag.
 */
export async function getPlayerImageSignedUrl(
  uid,
  expiresIn = SIGNED_URL_EXPIRY_SECONDS,
) {
  const normalizedUid = normalizeUid(uid);

  if (!supabase || !normalizedUid) {
    return null;
  }

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

  if (error || !data?.signedUrl) {
    return null;
  }

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

/**
 * Avatar that shows the player image from Supabase Storage when available.
 *
 * Rendering strategy:
 *   1. Try the public Storage URL (works once the bucket is public).
 *   2. If that image fails to load, fall back to a signed URL created with
 *      the signed-in Supabase session (works for private buckets).
 *   3. If there is no uid, no image, no session, or every load fails, fall
 *      back to the player's initials.
 *
 * @param {string} [alt]   Alternative text for the image.
 * @param {string} [className] Extra classes for sizing/shape.
 * @param {string} [name]  Player name (used for alt + initials).
 * @param {React.ReactNode} [overlay] Optional child rendered inside the avatar.
 * @param {boolean} [showStatus] Render an online/active status dot.
 * @param {string|number} [uid] Player UID used to build the storage path.
 */
export default function PlayerAvatar({
  alt,
  className = "",
  name,
  overlay,
  showStatus = false,
  uid,
}) {
  const publicUrl = useMemo(() => getPlayerImageUrl(uid), [uid]);
  const [currentUrl, setCurrentUrl] = useState(publicUrl);
  const [hasError, setHasError] = useState(false);
  const [triedSigned, setTriedSigned] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    setCurrentUrl(publicUrl);
    setHasError(false);
    setTriedSigned(false);
  }, [publicUrl]);

  async function handleImageError() {
    if (!triedSigned) {
      setTriedSigned(true);

      const signedUrl = await getPlayerImageSignedUrl(uid);

      if (isMounted.current) {
        if (signedUrl) {
          setCurrentUrl(signedUrl);
        } else {
          setHasError(true);
        }
      }

      return;
    }

    setHasError(true);
  }

  const showImage = Boolean(currentUrl && !hasError);

  return (
    <span
      className={`player-photo${showImage ? " has-photo" : ""} ${className}`.trim()}
    >
      {showImage ? (
        <img
          alt={alt || name || "Player"}
          loading="lazy"
          onError={handleImageError}
          src={currentUrl}
        />
      ) : (
        <span className="player-photo-initials" aria-hidden="true">
          {getPlayerInitials(name)}
        </span>
      )}
      {showStatus && (
        <span className="player-photo-status" aria-hidden="true" />
      )}
      {overlay}
    </span>
  );
}

