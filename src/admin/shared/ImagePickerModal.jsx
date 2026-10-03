import React, { useState, useEffect } from 'react';
import { listAdminImages } from '../../utils/imageUpload';

// Browses images already uploaded to a Storage folder, newest first, so an
// admin can reuse one instead of uploading the same file again.
const ImagePickerModal = ({ folder, onSelect, onClose }) => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    listAdminImages(folder)
      .then((imgs) => {
        if (!cancelled) setImages(imgs);
      })
      .catch((err) => {
        console.error('Error listing images:', err);
        if (!cancelled) setError('No se pudieron cargar las imágenes. Intenta de nuevo.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [folder]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto p-5"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
            Elegir imagen existente
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl px-2">
            ✕
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400 italic text-center py-10">Cargando imágenes...</p>
        ) : error ? (
          <p className="text-sm text-rose-600 text-center py-10">{error}</p>
        ) : images.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-10">
            Todavía no hay imágenes subidas en esta carpeta.
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {images.map((img) => (
              <button
                key={img.url}
                type="button"
                onClick={() => onSelect(img.url)}
                className="border border-slate-200 hover:border-indigo-400 rounded-lg overflow-hidden text-left transition-colors"
                title={img.name}
              >
                <img src={img.url} alt={img.name} className="w-full h-24 object-cover" />
                <p className="text-[9px] text-slate-500 truncate p-1">{img.name}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImagePickerModal;
