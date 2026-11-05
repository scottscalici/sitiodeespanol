import React, { useState, useEffect } from 'react';
import { listAdminAudio } from '../../utils/imageUpload';

// Browses audio files already uploaded to a Storage folder, newest first —
// same reuse convenience ImagePickerModal gives for images.
const AudioPickerModal = ({ folder, onSelect, onClose }) => {
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    listAdminAudio(folder)
      .then((items) => {
        if (!cancelled) setClips(items);
      })
      .catch((err) => {
        console.error('Error listing audio:', err);
        if (!cancelled) setError('No se pudo cargar el audio. Intenta de nuevo.');
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
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-5"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Elegir audio existente</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl px-2">
            ✕
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400 italic text-center py-10">Cargando audio...</p>
        ) : error ? (
          <p className="text-sm text-rose-600 text-center py-10">{error}</p>
        ) : clips.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-10">
            Todavía no hay audio subido en esta carpeta.
          </p>
        ) : (
          <div className="space-y-2">
            {clips.map((clip) => (
              <div key={clip.url} className="border border-slate-200 rounded-lg p-2 flex items-center gap-2">
                <audio src={clip.url} controls className="h-8 flex-1 min-w-0" />
                <button
                  type="button"
                  onClick={() => onSelect(clip.url)}
                  className="shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg"
                  title={clip.name}
                >
                  Usar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioPickerModal;
