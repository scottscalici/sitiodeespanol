// A theme's `imageOverrides` field is meant to hold a real uploaded image
// URL, but the admin field's own label ("reemplaza el emoji...") reads like
// an invitation to just type an emoji there instead — and nothing stops a
// teacher from doing exactly that. Call sites use this to tell the two
// apart before handing the value to an <img src>, so a plain emoji renders
// as text (swapping the card's default emoji, which is what was likely
// intended) instead of a broken-image icon.
export const isImageUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value);
