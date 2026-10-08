import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { invalidateCollectionCache } from '../../utils/firestoreCache';
import ImageUploadField from '../shared/ImageUploadField';

const BUNDLE_DOC_ID = '_bundle';

const generateImageCardId = () => `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const emptyImageCard = () => ({
  id: generateImageCardId(),
  course: 's2',
  dia: null,
  caption: '',
  text: '',
  images: [''],
});

// A lightweight, one-off "share a photo" card — distinct from Curiosidades
// (which carries interactive questions) and Destacado (a single themed
// highlight slot per day): just a quick picture (or several, shown as a
// sequence) with an optional caption/note, assigned to one día/course like
// a practice card. Stored the same single-bundle-doc way as Curiosidades
// and Destacado (one Firestore read for every card, instead of one per
// card), since there's no legacy one-doc-per-item history to migrate from
// here — this type starts bundled.
const ImageCardsManager = () => {
  const [items, setItems] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchImageCards = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'image_cards'));
        let bundleData = null;
        querySnapshot.forEach((docSnap) => {
          if (docSnap.id === BUNDLE_DOC_ID) bundleData = docSnap.data();
        });
        const fetchedItems = bundleData
          ? Object.entries(bundleData.items || {}).map(([id, data]) => ({ id, ...data }))
          : [];
        fetchedItems.sort((a, b) => (a.dia || 999) - (b.dia || 999));
        setItems(fetchedItems);
      } catch (error) {
        console.error('Error fetching image cards:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchImageCards();
  }, []);

  const updateItem = (id, patch) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleAddCard = () => {
    setItems((prev) => [emptyImageCard(), ...prev]);
  };

  const handleRemoveCard = (item) => {
    const confirmed = window.confirm(
      `¿Quitar esta tarjeta${item.caption ? ` ("${item.caption}")` : ''}? Esto no se guarda hasta que hagas clic en "Guardar Cambios".`
    );
    if (!confirmed) return;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  const updateImage = (itemId, imgIdx, url) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, images: item.images.map((img, i) => (i === imgIdx ? url : img)) } : item
      )
    );
  };

  const addImageSlot = (itemId) => {
    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, images: [...item.images, ''] } : item)));
  };

  const removeImageSlot = (itemId, imgIdx) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, images: item.images.filter((_, i) => i !== imgIdx) } : item
      )
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const itemsMap = {};
      items.forEach((item) => {
        const { id, ...rest } = item;
        itemsMap[id] = { ...rest, images: rest.images.filter(Boolean) };
      });
      await setDoc(doc(db, 'image_cards', BUNDLE_DOC_ID), { items: itemsMap });
      invalidateCollectionCache('image_cards');
      alert('¡Tarjetas de imagen guardadas!');
    } catch (error) {
      console.error('Error saving image cards:', error);
      alert('Error al guardar.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-400 font-bold uppercase tracking-widest animate-pulse">Cargando Tarjetas de Imagen...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex justify-between items-center z-10 shadow-sm">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Tarjetas de Imagen</h1>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">
              Comparte una foto rápida — una o varias — en cualquier día
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleAddCard}
              className="bg-white hover:bg-slate-50 text-indigo-600 border border-indigo-200 px-5 py-3 rounded-lg font-black uppercase tracking-widest text-xs transition-colors"
            >
              + Agregar Tarjeta
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-black uppercase tracking-widest text-xs transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="text-center text-slate-400 italic font-bold py-16">
            Todavía no hay tarjetas de imagen. Agrega una arriba.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <div key={item.id} className="p-5 space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <select
                    value={item.course}
                    onChange={(e) => updateItem(item.id, { course: e.target.value })}
                    className="bg-slate-100 border-none focus:ring-2 focus:ring-indigo-500 rounded-md p-2 text-xs font-black text-slate-600 outline-none"
                  >
                    <option value="s2">S2</option>
                    <option value="s4">S4</option>
                  </select>
                  <input
                    type="number"
                    value={item.dia ?? ''}
                    onChange={(e) => updateItem(item.id, { dia: e.target.value === '' ? null : Number(e.target.value) })}
                    placeholder="Día"
                    className="w-20 bg-slate-100 border-none focus:ring-2 focus:ring-indigo-500 rounded-md p-2 text-center text-xs font-black text-slate-600 outline-none"
                  />
                  <input
                    type="text"
                    value={item.caption || ''}
                    onChange={(e) => updateItem(item.id, { caption: e.target.value })}
                    placeholder="Título o pie de foto (opcional)"
                    className="flex-1 min-w-[200px] bg-slate-100 border-none focus:ring-2 focus:ring-indigo-500 rounded-md p-2 text-xs font-bold text-slate-700 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveCard(item)}
                    className="text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg px-2 py-2 border border-rose-200 transition-colors shrink-0"
                    title="Quitar esta tarjeta (no se guarda hasta hacer clic en Guardar Cambios)"
                  >
                    🗑️
                  </button>
                </div>

                <textarea
                  value={item.text || ''}
                  onChange={(e) => updateItem(item.id, { text: e.target.value })}
                  placeholder="Texto adicional (opcional) — se muestra al ampliar la imagen"
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500 rounded-md p-2 text-xs text-slate-600 outline-none"
                />

                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Imágenes ({item.images.filter(Boolean).length})
                  </p>
                  {item.images.map((img, imgIdx) => (
                    <div key={imgIdx} className="flex items-center gap-2">
                      <div className="shrink-0 w-10 h-10 bg-slate-200 rounded-md overflow-hidden border border-slate-300 flex items-center justify-center">
                        {img ? (
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[8px] font-black text-slate-400">N/A</span>
                        )}
                      </div>
                      <ImageUploadField
                        value={img}
                        onChange={(url) => updateImage(item.id, imgIdx, url)}
                        folder="image_cards"
                        inputClassName="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-md p-2 text-[10px] font-mono outline-none transition-all text-slate-500"
                      />
                      {item.images.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeImageSlot(item.id, imgIdx)}
                          className="shrink-0 text-slate-400 hover:text-rose-600 text-xs px-1"
                          title="Quitar esta imagen"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addImageSlot(item.id)}
                    className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest"
                  >
                    + Agregar Imagen
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageCardsManager;
