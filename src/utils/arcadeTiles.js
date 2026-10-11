import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

// El Recreo's arcade tiles originally hardcoded GitHub raw-content URLs for
// their thumbnails — simple, but fragile: some networks (school content
// filters especially) block raw.githubusercontent.com wholesale, and it's
// outside this app's own control either way. This moves tile images into
// the same admin-managed Firestore + Storage pattern as every other image
// in the app (curiosidades, badges, question pool), with each tile's
// GitHub URL kept as a fallback so nothing breaks before it's migrated.
const CONFIG_REF = doc(db, 'config', 'arcade_tiles');

export const getArcadeTileImages = async () => {
  const snap = await getDoc(CONFIG_REF);
  return snap.exists() ? snap.data() : {};
};

export const setArcadeTileImage = async (tileId, imageUrl) => {
  await setDoc(CONFIG_REF, { [tileId]: imageUrl }, { merge: true });
};
