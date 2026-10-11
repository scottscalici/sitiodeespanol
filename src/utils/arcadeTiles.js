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

// Shared by RecreoHub.jsx (as a fallback until a tile is migrated) and
// ArcadeTilesManager.jsx (as the source URL for its "Importar desde GitHub"
// button) — one place to add a new tile's original GitHub URL.
export const ARCADE_TILE_FALLBACK_IMAGES = {
  senordle: 'https://raw.githubusercontent.com/scottscalici/imagenes/main/juegos/senordle.png',
  eslabones: 'https://raw.githubusercontent.com/scottscalici/imagenes/main/juegos/eslabon.png',
  atandocabos: 'https://raw.githubusercontent.com/scottscalici/imagenes/main/juegos/atando_cabos.png',
  ticotalk: 'https://raw.githubusercontent.com/scottscalici/imagenes/main/juegos/tico_talk.png',
  impostor: 'https://raw.githubusercontent.com/scottscalici/imagenes/main/juegos/impostor.png',
  silabas: 'https://raw.githubusercontent.com/scottscalici/imagenes/main/juegos/silabazo.png',
  rafaga: 'https://raw.githubusercontent.com/scottscalici/imagenes/main/juegos/rafaga.png',
  zas: 'https://raw.githubusercontent.com/scottscalici/imagenes/main/juegos/zas.png',
};

export const getArcadeTileImages = async () => {
  const snap = await getDoc(CONFIG_REF);
  return snap.exists() ? snap.data() : {};
};

export const setArcadeTileImage = async (tileId, imageUrl) => {
  await setDoc(CONFIG_REF, { [tileId]: imageUrl }, { merge: true });
};
