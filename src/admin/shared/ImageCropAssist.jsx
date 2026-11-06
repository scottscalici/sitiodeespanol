import { useState, useEffect, useMemo } from 'react';
import CropBoxEditor from './CropBoxEditor';

// Turns one or more flat worksheet-photo scans into cropped picture files,
// driven by a crop-instructions JSON a Claude skill can produce directly
// from looking at the photo (normalized 0-1 coordinates, independent of the
// photo's actual pixel size):
//
//   [
//     { "sourcePhoto": "worksheet1.jpg",
//       "crop": { "x": 0.12, "y": 0.30, "width": 0.25, "height": 0.20 },
//       "targetFilename": "pic1.png",
//       "role": "question" | "decorative" }
//   ]
//
// The admin picks the source photo(s), adjusts each crop box by dragging/
// resizing it over the real photo, then confirms — each box becomes a real
// cropped `File` (PNG, named by targetFilename) reported to the parent via
// onCroppedFiles, which merges them into the same filename->File map its
// own image-upload step already resolves against. Nothing here touches
// Storage directly; cropping is purely a client-side canvas operation that
// produces files indistinguishable from ones picked by hand.
const ImageCropAssist = ({ onCroppedFiles }) => {
  const [cropJson, setCropJson] = useState('');
  const [sourcePhotos, setSourcePhotos] = useState([]); // File[]
  const [boxesByPhoto, setBoxesByPhoto] = useState(null); // { [filename]: box[] } | null
  const [error, setError] = useState('');
  const [cropping, setCropping] = useState(false);
  const [confirmedCount, setConfirmedCount] = useState(0);

  const photoMap = new Map(sourcePhotos.map((f) => [f.name, f]));

  // One object URL per picked photo, derived straight from the current
  // selection (not a ref — reading one during render is then a plain,
  // synchronous computation rather than a ref access React warns against).
  // The effect below only revokes the previous batch; it never sets state.
  const photoUrls = useMemo(() => new Map(sourcePhotos.map((f) => [f.name, URL.createObjectURL(f)])), [sourcePhotos]);
  useEffect(() => {
    return () => photoUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [photoUrls]);

  const handlePreview = () => {
    setError('');
    setConfirmedCount(0);
    if (!cropJson.trim()) {
      setBoxesByPhoto(null);
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(cropJson);
    } catch (e) {
      setError(`JSON de recortes inválido: ${e.message}`);
      return;
    }
    if (!Array.isArray(parsed)) {
      setError('El JSON de recortes debe ser un arreglo [ ].');
      return;
    }

    const grouped = {};
    const missingPhotos = new Set();
    for (const entry of parsed) {
      const { sourcePhoto, crop, targetFilename } = entry || {};
      if (!sourcePhoto || !crop || !targetFilename) {
        setError('Cada recorte necesita "sourcePhoto", "crop" {x,y,width,height} y "targetFilename".');
        return;
      }
      if (!photoMap.has(sourcePhoto)) missingPhotos.add(sourcePhoto);
      if (!grouped[sourcePhoto]) grouped[sourcePhoto] = [];
      grouped[sourcePhoto].push({
        id: `${sourcePhoto}::${targetFilename}`,
        sourcePhoto,
        targetFilename,
        role: entry.role || 'question',
        x: crop.x,
        y: crop.y,
        width: crop.width,
        height: crop.height,
      });
    }
    if (missingPhotos.size > 0) {
      const providedNames = sourcePhotos.length > 0 ? sourcePhotos.map((f) => f.name).join(', ') : '(ninguna)';
      setError(
        `Falta seleccionar la(s) foto(s) de origen: ${[...missingPhotos].join(', ')} ` +
        `(fotos seleccionadas: ${providedNames}). Revisa que el nombre coincida exactamente, incluida la extensión.`
      );
      return;
    }
    setBoxesByPhoto(grouped);
  };

  const updatePhotoBoxes = (sourcePhoto, newBoxes) => {
    setBoxesByPhoto((prev) => ({ ...prev, [sourcePhoto]: newBoxes }));
  };

  const cropOneBox = (imgEl, box) =>
    new Promise((resolve, reject) => {
      const sx = Math.round(box.x * imgEl.naturalWidth);
      const sy = Math.round(box.y * imgEl.naturalHeight);
      const sw = Math.round(box.width * imgEl.naturalWidth);
      const sh = Math.round(box.height * imgEl.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(sw, 1);
      canvas.height = Math.max(sh, 1);
      canvas.getContext('2d').drawImage(imgEl, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error(`No se pudo recortar "${box.targetFilename}".`));
        resolve(new File([blob], box.targetFilename, { type: 'image/png' }));
      }, 'image/png');
    });

  const loadImage = (url) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo cargar la foto de origen.'));
      img.src = url;
    });

  const handleConfirmCrops = async () => {
    if (!boxesByPhoto) return;
    setError('');
    setCropping(true);
    try {
      const croppedFiles = [];
      for (const [sourcePhoto, boxes] of Object.entries(boxesByPhoto)) {
        const img = await loadImage(photoUrls.get(sourcePhoto));
        for (const box of boxes) {
          croppedFiles.push(await cropOneBox(img, box));
        }
      }
      onCroppedFiles(croppedFiles);
      setConfirmedCount(croppedFiles.length);
    } catch (e) {
      setError(e.message || 'Error al recortar.');
    } finally {
      setCropping(false);
    }
  };

  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
      <p className="text-xs font-black text-slate-600 uppercase tracking-widest mb-2">
        ✂️ Recortar imágenes de una foto de hoja de trabajo (opcional)
      </p>
      <p className="text-[11px] text-slate-500 mb-3">
        Pega el JSON de recortes (uno por imagen a extraer) y selecciona la(s) foto(s) de origen. Ajusta cada recuadro
        sobre la foto real antes de confirmar — los recortes resultantes se usan como si fueran archivos subidos a mano,
        por su <code className="bg-slate-200 px-1 rounded">targetFilename</code>.
      </p>

      <textarea
        rows={4}
        value={cropJson}
        onChange={(e) => setCropJson(e.target.value)}
        placeholder='[ { "sourcePhoto": "hoja1.jpg", "crop": {"x":0.12,"y":0.30,"width":0.25,"height":0.20}, "targetFilename": "pic1.png", "role": "question" } ]'
        className="w-full font-mono text-[11px] bg-white border border-slate-300 rounded-lg p-3 mb-2 focus:ring-2 focus:ring-amber-400 outline-none"
      />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => {
            setSourcePhotos(Array.from(e.target.files || []));
            setBoxesByPhoto(null);
          }}
          className="block text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-700 file:text-white file:text-[10px] file:font-black file:uppercase file:tracking-widest hover:file:bg-slate-600"
        />
        <button
          type="button"
          onClick={handlePreview}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg"
        >
          Previsualizar Recortes
        </button>
      </div>

      {error && <p className="text-[11px] text-rose-600 font-bold mb-3">{error}</p>}

      {boxesByPhoto && (
        <div className="space-y-6">
          {Object.entries(boxesByPhoto).map(([sourcePhoto, boxes]) => (
            <div key={sourcePhoto}>
              <p className="text-[10px] font-bold text-slate-500 mb-1">{sourcePhoto}</p>
              <CropBoxEditor
                photoUrl={photoUrls.get(sourcePhoto)}
                boxes={boxes}
                onChange={(newBoxes) => updatePhotoBoxes(sourcePhoto, newBoxes)}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={handleConfirmCrops}
            disabled={cropping}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg disabled:opacity-50"
          >
            {cropping ? 'Recortando...' : 'Confirmar Recortes'}
          </button>
          {confirmedCount > 0 && (
            <p className="text-[11px] text-emerald-700 font-bold">
              ✅ {confirmedCount} imagen(es) recortada(s) — listas para usarse por su nombre de archivo al subir.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ImageCropAssist;
