import { ref, uploadBytes, getDownloadURL, listAll, getMetadata } from 'firebase/storage';
import { storage } from '../firebase';

// Keep this in sync with the size cap enforced server-side in storage.rules —
// the client check just gives faster feedback; the rule is what actually
// protects the bucket from a tampered/bypassed client.
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB

// Uploads an admin-picked image file to Firebase Storage and returns its
// public download URL, ready to drop straight into any existing `img` /
// `imagen` / `image_url` field — those already just store arbitrary URL
// strings, so nothing downstream needs to change to consume this.
export const uploadAdminImage = async (file, folder = 'misc') => {
  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo debe ser una imagen.');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('La imagen es demasiado grande (máximo 10MB).');
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${folder}/${Date.now()}_${safeName}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
};

// Fetches an image from an arbitrary URL (e.g. a GitHub raw-content link
// that's broken as an embedded <img> on some networks' content filters but
// may still succeed as a fetch() from the browser) and re-uploads it to
// Firebase Storage — lets an admin migrate an existing image without first
// downloading it to their device and re-selecting it through a file picker.
// If the source request itself is blocked the same way the <img> tag was,
// this throws just like any other failed fetch — there's no way around a
// filter that blocks the image bytes themselves rather than just <img> tags.
export const importImageFromUrl = async (sourceUrl, folder = 'misc', filename = 'imagen.png') => {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`No se pudo descargar la imagen (${response.status}).`);
  }
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) {
    throw new Error('El archivo descargado no es una imagen.');
  }
  if (blob.size > MAX_IMAGE_BYTES) {
    throw new Error('La imagen es demasiado grande (máximo 10MB).');
  }

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${folder}/${Date.now()}_${safeName}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, blob);
  return getDownloadURL(fileRef);
};

// Lists every image already uploaded to a folder, newest first — lets an
// admin reuse an existing image instead of uploading the same file again
// (e.g. after redoing a curiosidad's questions a few times). Storage's
// `allow read` rule already covers listing, not just fetching one file, so
// no rules change is needed for this.
export const listAdminImages = async (folder = 'misc') => {
  const folderRef = ref(storage, folder);
  const result = await listAll(folderRef);
  const items = await Promise.all(
    result.items.map(async (itemRef) => {
      const [url, metadata] = await Promise.all([getDownloadURL(itemRef), getMetadata(itemRef)]);
      return { url, name: itemRef.name, timeCreated: metadata.timeCreated };
    })
  );
  return items.sort((a, b) => new Date(b.timeCreated) - new Date(a.timeCreated));
};
