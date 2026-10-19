// Wraps a direct file URL (e.g. a raw.githubusercontent.com .ppt/.pptx link)
// in Microsoft's public Office Online viewer — the same embedding pattern
// already used by the old static grammar-notes site, so an existing
// PowerPoint keeps working with zero new file hosting: the file stays
// wherever it already lives, only the embed wrapper is computed here.
export const toOfficeEmbedUrl = (url) => {
  if (!url) return url;
  const trimmed = url.trim();
  if (trimmed.includes('view.officeapps.live.com')) return trimmed;
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(trimmed)}`;
};
