// Accepts whatever form of a YouTube link an admin pastes — a normal watch
// link (youtube.com/watch?v=ID), the short youtu.be/ID form, a Shorts link
// (youtube.com/shorts/ID), or an already-correct embed link — and always
// returns the embed form the player <iframe> actually needs. Anything that
// isn't a recognizable YouTube link (a non-YouTube URL, or a URL still being
// typed/pasted) is returned unchanged rather than mangled.
const YOUTUBE_ID_PATTERNS = [
  /youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/,
  /youtu\.be\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
];

export const toYoutubeEmbedUrl = (url) => {
  if (!url) return url;
  const trimmed = url.trim();
  for (const pattern of YOUTUBE_ID_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) return `https://www.youtube.com/embed/${match[1]}`;
  }
  return trimmed;
};
