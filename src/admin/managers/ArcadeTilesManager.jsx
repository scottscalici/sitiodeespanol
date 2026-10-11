import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getArcadeTileImages, setArcadeTileImage } from '../../utils/arcadeTiles';
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
                <ImageUploadField
                  value={images[tile.id]}
                  onChange={(url) => handleSetImage(tile.id, url)}
                  folder="arcade_tiles"
                  placeholder="Usando el enlace de GitHub (sube una imagen para reemplazarlo)"
                  inputClassName="w-full bg-slate-50 border border-slate-200 rounded-md p-2 text-[10px] font-mono outline-none text-slate-500"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ArcadeTilesManager;
