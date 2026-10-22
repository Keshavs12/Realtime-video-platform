/**
 * Utility to extract meeting room code from incoming deep link URLs
 * Supported patterns:
 * - supercall://room/a1b2c3d4
 * - supercall://a1b2c3d4
 * - https://realtime-video-platform.onrender.com/room/a1b2c3d4
 * - .../room?code=a1b2c3d4
 */
export const extractRoomCodeFromUrl = (url: string | null | undefined): string | null => {
  if (!url || typeof url !== "string") return null;

  try {
    const cleanUrl = decodeURIComponent(url.trim());

    // 1. Check for ?code= or &code= query param
    const queryMatch = cleanUrl.match(/[?&]code=([a-zA-Z0-9_-]{4,32})/i);
    if (queryMatch && queryMatch[1]) {
      return queryMatch[1].toLowerCase();
    }

    // 2. Check for /room/<code> path
    const roomPathMatch = cleanUrl.match(/\/room\/([a-zA-Z0-9_-]{4,32})/i);
    if (roomPathMatch && roomPathMatch[1]) {
      return roomPathMatch[1].toLowerCase();
    }

    // 3. Check for custom scheme supercall://<code> or supercall://room/<code>
    const schemeMatch = cleanUrl.match(/^supercall:\/\/(?:room\/)?([a-zA-Z0-9_-]{4,32})/i);
    if (schemeMatch && schemeMatch[1]) {
      return schemeMatch[1].toLowerCase();
    }

    // 4. Fallback: match 8-char hex code anywhere in URL
    const hexMatch = cleanUrl.match(/\b([a-f0-9]{8})\b/i);
    if (hexMatch && hexMatch[1]) {
      return hexMatch[1].toLowerCase();
    }

    return null;
  } catch {
    return null;
  }
};
