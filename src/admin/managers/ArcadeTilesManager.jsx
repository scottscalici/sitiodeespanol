import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getArcadeTileImages, setArcadeTileImage, ARCADE_TILE_FALLBACK_IMAGES } from '../../utils/arcadeTiles';
import { importImageFromUrl } from '../../utils/imageUpload';
import ImageUploadField from '../shared/ImageUploadField';

// El Recreo's tile thumbnails, in display order — kept as a plain list here
// rather than derived from RecreoHub.jsx so this page works even for a tile
// not linked anywhere yet (like a future game added before its route exists).
const TILES = [
  { id: 'senordle', name: 'Señordle' },
  { id: 'eslabones', name: 'Eslabones' },
  { id: 'atandocabos', name: 'Atando Cabos' },
  { id: 'ticotalk', name: 'Tico Talk' },
  { id: 'impostor', name: 'Impostor' },
  { id: 'silabas', name: 'Sílabas' },
  { id: 'rafaga', name: 'Ráfaga' },
  { id: 'zas', name: '¡Zas!' },
];

// Replaces El Recreo's old hardcoded GitHub raw-content image URLs (fragile
// — some networks block that domain outright) with admin-managed Firebase
// Storage uploads, same pattern as curiosidades/badges/question pool images.
// RecreoHub.jsx falls back to the original GitHub URL for any tile not yet
// migrated here, so nothing breaks mid-migration.
const ArcadeTilesManager = () => {
  const [images, setImages] = useState({});
  const [loading, setLoading] = useState(true);
  const [importingId, setImportingId] = useState(null);
  const [importError, setImportError] = useState({});

  useEffect(() => {
    getArcadeTileImages()
      .then(setImages)
      .catch((err) => console.error('Error loading arcade tile images:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleSetImage = async (tileId, url) => {
    setImages((prev) => ({ ...prev, [tileId]: url }));
    try {
      await setArcadeTileImage(tileId, url);
    } catch (err) {
      console.error('Error saving arcade tile image:', err);
    }
  };

  // Tries fetching the original GitHub URL straight from the browser instead
  // of requiring a manual download + re-upload. Whether this actually works
  // depends on what a network's content filter is blocking — some only
  // intercept <img> tag loads, in which case a fetch() slips through; others
  // block the image bytes themselves regardless of how they're requested, in
  // which case this fails exactly the same way the <img> tag did. Worth one
  // click to find out before assuming the manual path is the only option.
  const handleImportFromGithub = async (tileId) => {
    setImportingId(tileId);
    setImportError((prev) => ({ ...prev, [tileId]: '' }));
    try {
      const url = await importImageFromUrl(ARCADE_TILE_FALLBACK_IMAGES[tileId], 'arcade_tiles', `${tileId}.png`);
      await handleSetImage(tileId, url);
    } catch (err) {
      console.error(`Error importing ${tileId} from GitHub:`, err);
      setImportError((prev) => ({ ...prev, [tileId]: 'Bloqueado — descarga y sube el archivo manualmente.' }));
    } finally {
      setImportingId(null);
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-400 font-bold uppercase tracking-widest animate-pulse">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Imágenes de El Recreo</h1>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">
              Sube cada imagen una vez para reemplazar el enlace de GitHub por una copia en Firebase Storage
            </p>
          </div>
          <Link
            to="/admin-daily-plan-hub"
            className="text-slate-500 hover:text-slate-700 text-xs font-bold border border-slate-300 px-3 py-1.5 rounded-lg shrink-0"
          >
            ← Hub
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 divide-y divide-slate-100">
          {TILES.map((tile) => (
            <div key={tile.id} className="p-4 flex items-center gap-4">
              {images[tile.id] ? (
                <img src={images[tile.id]} alt="" className="w-14 h-14 rounded-lg object-cover border border-slate-300 shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center text-[9px] font-black text-amber-700 uppercase text-center leading-tight shrink-0 p-1">
                  GitHub (sin migrar)
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800 mb-1">{tile.name}</p>
                <div className="flex items-center gap-2">
                  <ImageUploadField
                    value={images[tile.id]}
                    onChange={(url) => handleSetImage(tile.id, url)}
                    folder="arcade_tiles"
                    placeholder="Usando el enlace de GitHub (sube una imagen para reemplazarlo)"
                    inputClassName="w-full bg-slate-50 border border-slate-200 rounded-md p-2 text-[10px] font-mono outline-none text-slate-500"
                  />
                  {!images[tile.id] && (
                    <button
                      type="button"
                      onClick={() => handleImportFromGithub(tile.id)}
                      disabled={importingId === tile.id}
                      title="Intenta descargar la imagen original de GitHub automáticamente"
                      className="shrink-0 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors"
                    >
                      {importingId === tile.id ? '⏳...' : '📥 Importar de GitHub'}
                    </button>
                  )}
                </div>
                {importError[tile.id] && (
                  <p className="text-[10px] text-rose-500 font-bold mt-1">{importError[tile.id]}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ArcadeTilesManager;
