import React, { useState, useEffect } from 'react';
import { collection, getDocs, writeBatch, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import ImageUploadField from '../shared/ImageUploadField';
import AudioUploadField from '../shared/AudioUploadField';
import AudioQuestionsModal from './AudioQuestionsModal';

const AudioManager = () => {
  const [items, setItems] = useState([]);
  const [calendarMap, setCalendarMap] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [questionsModalItem, setQuestionsModalItem] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const configRef = doc(db, 'config', 'academic_year_2026_2027');
        const configSnap = await getDoc(configRef);
        const mapping = {};

        if (configSnap.exists()) {
          const configData = configSnap.data();
          if (configData.map && Array.isArray(configData.map)) {
            configData.map.forEach((item) => {
              if (item.dia !== null && item.dia !== undefined && item.status === 'school') {
                const dayNum = Number(item.dia);
                if (!mapping[dayNum]) mapping[dayNum] = [];
                let formattedDate = item.fecha;
                if (item.fecha && item.fecha.includes('-')) {
                  const parts = item.fecha.split('-');
                  if (parts.length === 3) formattedDate = `${parts[1]}/${parts[2]}`;
                }
                mapping[dayNum].push(`${formattedDate}${item.ciclo ? ` (${item.ciclo})` : ''}`);
              }
            });
          }
          setCalendarMap(mapping);
        }

        const querySnapshot = await getDocs(collection(db, 'audio_clips'));
        let fetchedItems = [];
        querySnapshot.forEach((docSnap) => {
          fetchedItems.push({ id: docSnap.id, ...docSnap.data() });
        });

        fetchedItems.sort((a, b) => (a.dia || 999) - (b.dia || 999));
        setItems(fetchedItems);
      } catch (error) {
        console.error('Error fetching audio clips:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleAddNew = () => {
    const newClip = {
      id: `new_${Date.now()}`, // Temporary ID for React mapping
      dia: '',
      title: '',
      description: '',
      thumbnail_url: '',
      audio_url: '',
      tags: activeFilter !== 'all' ? [activeFilter] : ['s2'], // Default tag to current filter
      questions: [],
    };
    setItems([newClip, ...items]);
  };

  const handleInputChange = (id, field, value) => {
    setItems((prev) => prev.map((item) => {
      if (item.id === id) {
        if (field === 'dia') {
          const numVal = value === '' ? null : Number(value);
          return { ...item, [field]: numVal };
        }
        if (field === 'tags') {
          // Deliberately NOT filtering out a trailing empty entry here (e.g.
          // right after typing "s2," before "s4" follows) — this runs on
          // every keystroke, and the input's displayed value is this same
          // array re-joined, so dropping that trailing entry immediately
          // would erase the comma the instant it's typed. Empty entries are
          // stripped once, at save time, instead (see handleSave).
          const arr = value.split(',').map((t) => t.trim());
          return { ...item, [field]: arr };
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const batch = writeBatch(db);

      items.forEach((item) => {
        let docRef;
        // If it's a new item, let Firebase auto-generate the document ID
        if (item.id.startsWith('new_')) {
          docRef = doc(collection(db, 'audio_clips'));
        } else {
          docRef = doc(db, 'audio_clips', item.id);
        }

        const { id, ...dataToSave } = item;
        // Strip the trailing empty tag editing leaves around (see
        // handleInputChange's 'tags' case) before this ever reaches Firestore.
        if (Array.isArray(dataToSave.tags)) {
          dataToSave.tags = dataToSave.tags.filter((t) => t !== '');
        }
        batch.set(docRef, dataToSave, { merge: true });
      });

      await batch.commit();
      alert('¡Audios guardados exitosamente!');

      // Clean up the temporary IDs by doing a quick visual refresh
      const cleanItems = items.map((item) => (item.id.startsWith('new_') ? { ...item, id: 'guardado_refresca_pagina' } : item));
      setItems(cleanItems);
    } catch (error) {
      console.error('Error saving batch:', error);
      alert('Error al guardar.');
    } finally {
      setIsSaving(false);
    }
  };

  // The questions modal is its own complete save, independent of the big
  // "Guardar Cambios" batch above — same behavior as MusicaQuestionsModal/
  // MusicaEditor, so closing the modal after saving always reflects what's
  // actually in Firestore even if the rest of the grid has unsaved edits.
  const handleSaveQuestions = async (clipId, finalizedQuestions) => {
    if (!clipId.startsWith('new_')) {
      await updateDoc(doc(db, 'audio_clips', clipId), { questions: finalizedQuestions });
    }
    setItems((prev) => prev.map((item) => (item.id === clipId ? { ...item, questions: finalizedQuestions } : item)));
  };

  if (loading) {
    return <div className="p-8 text-slate-400 font-bold uppercase tracking-widest animate-pulse">Cargando Audio...</div>;
  }

  const displayedItems = items.filter((item) => {
    if (activeFilter === 'all') return true;
    return item.tags && item.tags.includes(activeFilter);
  });

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8 font-sans">
      <div className="max-w-[1400px] mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center z-10 shadow-sm gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Audio Manager</h1>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Gestor de clips de audio</p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleAddNew}
              className="bg-cyan-50 text-cyan-700 hover:bg-cyan-100 border border-cyan-200 px-4 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-colors"
            >
              + Nuevo Audio
            </button>

            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all ${activeFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Todos ({items.length})
              </button>
              <button
                onClick={() => setActiveFilter('s2')}
                className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all ${activeFilter === 's2' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Español II
              </button>
              <button
                onClick={() => setActiveFilter('s4')}
                className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all ${activeFilter === 's4' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Español 4
              </button>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4 p-4 bg-slate-100 border-b border-slate-200 font-black text-[10px] uppercase tracking-widest text-slate-500 items-center">
          <div className="col-span-2 text-center">Día / Fecha</div>
          <div className="col-span-2">Título</div>
          <div className="col-span-3">Audio</div>
          <div className="col-span-2">Portada (opcional)</div>
          <div className="col-span-2">Tags (s2, s4, cultura)</div>
          <div className="col-span-1 text-center">Preguntas</div>
        </div>

        <div className="divide-y divide-slate-100">
          {displayedItems.map((item) => {
            const activeDates = calendarMap[item.dia] || [];

            return (
              <div key={item.id} className={`grid grid-cols-12 gap-4 p-2 transition-colors items-center ${item.id.startsWith('new_') ? 'bg-cyan-50/50' : 'hover:bg-slate-50'}`}>

                <div className="col-span-2 text-center flex flex-col items-center justify-center">
                  <input
                    type="number"
                    value={item.dia || ''}
                    onChange={(e) => handleInputChange(item.id, 'dia', e.target.value)}
                    className="w-16 bg-white border border-slate-200 focus:ring-2 focus:ring-purple-500 rounded-md p-2 text-center text-sm font-black text-slate-600 outline-none transition-all mb-1.5 shadow-sm"
                    placeholder="Día"
                  />
                  <div className="flex flex-col gap-1">
                    {activeDates.length > 0 ? (
                      activeDates.map((dateStr, idx) => (
                        <span key={idx} className="block text-[9px] font-mono font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 whitespace-nowrap">
                          {dateStr}
                        </span>
                      ))
                    ) : (
                      <span className="block text-[9px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap">
                        Sin fecha
                      </span>
                    )}
                  </div>
                </div>

                <div className="col-span-2 space-y-1.5">
                  <input
                    type="text"
                    value={item.title || ''}
                    onChange={(e) => handleInputChange(item.id, 'title', e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:ring-2 focus:ring-purple-500 rounded-md p-2 text-xs font-medium outline-none transition-all text-slate-800 shadow-sm"
                    placeholder="Título del audio"
                  />
                  <input
                    type="text"
                    value={item.description || ''}
                    onChange={(e) => handleInputChange(item.id, 'description', e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:ring-1 focus:ring-purple-500 rounded-md p-2 text-[10px] outline-none transition-all text-slate-500 shadow-sm"
                    placeholder="Descripción (opcional)"
                  />
                </div>

                <div className="col-span-3">
                  <AudioUploadField
                    value={item.audio_url}
                    onChange={(url) => handleInputChange(item.id, 'audio_url', url)}
                    folder="audio_clips"
                    placeholder="Audio URL..."
                    inputClassName="w-full bg-white border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-md p-2 text-[10px] font-mono outline-none transition-all text-slate-500 shadow-sm"
                  />
                </div>

                <div className="col-span-2 flex items-center gap-3">
                  <div className="shrink-0 w-16 h-16 bg-slate-200 rounded-lg overflow-hidden border border-slate-300 flex items-center justify-center shadow-sm">
                    {item.thumbnail_url ? (
                      <img
                        src={item.thumbnail_url}
                        alt="preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentElement.classList.add('bg-red-50', 'text-red-400', 'text-[8px]', 'font-bold', 'p-1', 'text-center');
                          e.target.parentElement.innerText = 'Roto';
                        }}
                      />
                    ) : (
                      <span className="text-[9px] font-black text-slate-400">N/A</span>
                    )}
                  </div>
                  <ImageUploadField
                    value={item.thumbnail_url}
                    onChange={(url) => handleInputChange(item.id, 'thumbnail_url', url)}
                    folder="audio_clips"
                    placeholder="Portada URL..."
                    inputClassName="w-full bg-white border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-md p-2 text-[10px] font-mono outline-none transition-all text-slate-500 shadow-sm"
                  />
                </div>

                <div className="col-span-2">
                  <input
                    type="text"
                    value={item.tags?.join(', ') || ''}
                    onChange={(e) => handleInputChange(item.id, 'tags', e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:ring-1 focus:ring-purple-500 rounded-md p-2 text-[10px] font-mono outline-none transition-all text-slate-600 shadow-sm"
                    placeholder="s2, s4, cultura"
                  />
                </div>

                <div className="col-span-1 flex justify-center">
                  <button
                    onClick={() => setQuestionsModalItem(item)}
                    disabled={item.id.startsWith('new_')}
                    title={item.id.startsWith('new_') ? 'Guarda el audio antes de agregar preguntas' : 'Administrar preguntas de comprensión'}
                    className="px-2 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-30 transition-colors"
                  >
                    📝 {(item.questions || []).length}
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {questionsModalItem && (
        <AudioQuestionsModal
          clip={questionsModalItem}
          onClose={() => setQuestionsModalItem(null)}
          onSave={(finalizedQuestions) => handleSaveQuestions(questionsModalItem.id, finalizedQuestions)}
        />
      )}
    </div>
  );
};

export default AudioManager;
