import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { uploadAdminImage, listAdminImages } from '../../utils/imageUpload';
import ImageUploadField from '../shared/ImageUploadField';

const RONDA_FOLDER = 'randomimage/rondarelampago';
const LOGOS_REF = doc(db, 'config', 'platform_logos');

// One-time (but safe to revisit) migration surface for the two batches of
// images that used to be fetched from raw.githubusercontent.com and broke
// on networks that block image downloads from that domain (JSON/text from
// the same domain was unaffected — only images). Fotos al Azar now reads
// from Firebase Storage directly (see FotosAzarPage.jsx), so this page's
// only job is getting the actual files there.
const MediaMigrationManager = () => {
  const [rondaImages, setRondaImages] = useState([]);
  const [rondaLoading, setRondaLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(null); // { done, total }

  const [logos, setLogos] = useState({});
  const [logosLoading, setLogosLoading] = useState(true);

  const refreshRonda = async () => {
    try {
      const list = await listAdminImages(RONDA_FOLDER);
      setRondaImages(list);
    } catch (err) {
      console.error('Error listing Ronda Relámpago images:', err);
    } finally {
      setRondaLoading(false);
    }
  };

  useEffect(() => {
    refreshRonda();
    getDoc(LOGOS_REF)
      .then((snap) => setLogos(snap.exists() ? snap.data() : {}))
      .catch((err) => console.error('Error loading platform logos:', err))
      .finally(() => setLogosLoading(false));
  }, []);

  const handleRondaFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    setUploadProgress({ done: 0, total: files.length });
    for (const file of files) {
      try {
        await uploadAdminImage(file, RONDA_FOLDER);
      } catch (err) {
        console.error(`Error uploading ${file.name}:`, err);
      }
      setUploadProgress((prev) => ({ ...prev, done: prev.done + 1 }));
    }
    setUploadProgress(null);
    refreshRonda();
  };

  const handleSetLogo = async (key, url) => {
    setLogos((prev) => ({ ...prev, [key]: url }));
    try {
      await setDoc(LOGOS_REF, { [key]: url }, { merge: true });
    } catch (err) {
      console.error('Error saving platform logo:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Migración de Imágenes</h1>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">
              Mover imágenes de GitHub a Firebase Storage
            </p>
          </div>
          <Link
            to="/admin-daily-plan-hub"
            className="text-slate-500 hover:text-slate-700 text-xs font-bold border border-slate-300 px-3 py-1.5 rounded-lg shrink-0"
          >
            ← Hub
          </Link>
        </div>

        {/* RONDA RELÁMPAGO — BATCH UPLOAD */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
          <h2 className="text-sm font-black text-indigo-600 uppercase tracking-widest">
            Fotos al Azar / Ronda Relámpago
          </h2>
          <p className="text-xs text-slate-400">
            {rondaLoading
              ? 'Cargando...'
              : `${rondaImages.length} ${rondaImages.length === 1 ? 'imagen' : 'imágenes'} ya en Firebase Storage.`}{' '}
            Selecciona todas las imágenes originales a la vez (las 209 que tenías en GitHub) — se suben una por una y
            no hace falta ningún archivo de lista, la página las encuentra automáticamente.
          </p>
          <label className="inline-block">
            <input type="file" accept="image/*" multiple onChange={handleRondaFiles} className="hidden" />
            <span className="inline-block cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-widest px-4 py-2.5 rounded-lg">
              📤 Elegir Imágenes
            </span>
          </label>
          {uploadProgress && (
            <p className="text-xs font-bold text-indigo-600">
              Subiendo... {uploadProgress.done} / {uploadProgress.total}
            </p>
          )}
        </section>

        {/* PLATFORM LOGOS */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
          <h2 className="text-sm font-black text-indigo-600 uppercase tracking-widest">Logos de Plataforma</h2>
          <p className="text-xs text-slate-400">Mostrados en el Dashboard cuando se asigna una tarea de VHL o KWL.</p>
          {logosLoading ? (
            <p className="text-xs text-slate-400">Cargando...</p>
          ) : (
            <div className="space-y-3">
              {['VHL', 'KWL'].map((key) => (
                <div key={key} className="flex items-center gap-4">
                  {logos[key] ? (
                    <img src={logos[key]} alt="" className="w-14 h-14 rounded-lg object-contain border border-slate-300 shrink-0 bg-white p-1" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center text-[8px] font-black text-amber-700 uppercase text-center leading-tight shrink-0 p-1">
                      GitHub (sin migrar)
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800 mb-1">{key}</p>
                    <ImageUploadField
                      value={logos[key]}
                      onChange={(url) => handleSetLogo(key, url)}
                      folder="platform_logos"
                      placeholder="Usando el enlace de GitHub (sube una imagen para reemplazarlo)"
                      inputClassName="w-full bg-slate-50 border border-slate-200 rounded-md p-2 text-[10px] font-mono outline-none text-slate-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default MediaMigrationManager;
