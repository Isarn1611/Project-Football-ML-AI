import { useEffect, useMemo, useRef, useState } from "react";

import {
  getPlayerImageSignedUrl,
  getPlayerImageUrl,
  getPlayerInitials,
} from "./playerImageUrls";

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
function PlayerAvatarImage({
  alt,
  className = "",
  initialUrl,
  name,
  overlay,
  showStatus = false,
  uid,
}) {
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [hasError, setHasError] = useState(false);
  const [triedSigned, setTriedSigned] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

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

export default function PlayerAvatar(props) {
  const publicUrl = useMemo(() => getPlayerImageUrl(props.uid), [props.uid]);

  return (
    <PlayerAvatarImage
      {...props}
      initialUrl={publicUrl}
      key={`${props.uid ?? ""}:${publicUrl ?? "fallback"}`}
    />
  );
}

