import React, { useState, useEffect } from 'react';
import { collection, getDocs, writeBatch, doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { invalidateCollectionCache, repairSplitBucketFields } from '../../utils/firestoreCache';
import ImageUploadField from '../shared/ImageUploadField';
import CuriosidadQuestionsModal from './CuriosidadQuestionsModal';

const BUNDLE_DOC_ID = '_bundle';

// A short, readable id from the title (e.g. "Las Fallas" -> "las-fallas-k3j9f2")
// plus a base-36 timestamp suffix so two curiosidades added back to back, or
// one typed with no title yet, never collide.
const slugify = (text) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const generateCuriosidadId = (title) => `${slugify(title) || 'curiosidad'}-${Date.now().toString(36)}`;

const emptyCuriosidad = () => ({
  id: generateCuriosidadId(''),
  title: '',
  img: '',
  student_note: '',
  teacher_notes: '',
  s2_dia: null,
  s4_dia: null,
});

const CuriosidadesManager = () => {
  const [items, setItems] = useState([]);
  // The curiosidad currently open in the question-authoring modal, or null.
  const [questionsModalItem, setQuestionsModalItem] = useState(null);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isBundled, setIsBundled] = useState(false);
  // Docs in the collection other than _bundle itself — see DestacadoManager
  // for why this is tracked separately from isBundled (they're two
  // independent migration steps that can persist across page reloads).
  const [legacyDocCount, setLegacyDocCount] = useState(0);
  const [migrationStatus, setMigrationStatus] = useState(null);

  // Items sitting in a bogus "items.<id>" sibling field instead of the real
  // items map — a bug in the uploader's merge writes (see
  // repairSplitBucketFields in firestoreCache.js).
  const [repairableCount, setRepairableCount] = useState(0);
  const [repairStatus, setRepairStatus] = useState(null);

  const handleRepairSplitFields = async () => {
    setRepairStatus('repairing');
    try {
      const { recoveredCount, bucketsTouched } = await repairSplitBucketFields('curiosidades');
      setRepairStatus('done');
      setRepairableCount(0);
      invalidateCollectionCache('curiosidades');
      alert(
        bucketsTouched > 0
          ? `✅ Recuperadas ${recoveredCount} curiosidad(es) con ediciones que se habían guardado mal.`
          : 'No se encontró nada que reparar.'
      );
      window.location.reload();
    } catch (err) {
      console.error('Error repairing split curiosidades fields:', err);
      setRepairStatus('error');
      alert('Error al reparar. Revisa la consola.');
    }
  };

  useEffect(() => {
    const fetchCuriosidades = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'curiosidades'));
        let bundleData = null;
        const legacyItems = [];
        querySnapshot.forEach((docSnap) => {
          if (docSnap.id === BUNDLE_DOC_ID) {
            bundleData = docSnap.data();
          } else {
            legacyItems.push({ id: docSnap.id, ...docSnap.data() });
          }
        });

        setIsBundled(!!bundleData);
        setLegacyDocCount(legacyItems.length);
        setRepairableCount(
          Object.keys(bundleData || {}).filter((k) => k.startsWith('items.') && k !== 'items').length
        );

        const fetchedItems = bundleData
          ? Object.entries(bundleData.items || {}).map(([id, data]) => ({ id, ...data }))
          : legacyItems;

        // Sort items primarily by s2_dia, putting unassigned (null) at the bottom
        fetchedItems.sort((a, b) => {
          const dayA = a.s2_dia || 999;
          const dayB = b.s2_dia || 999;
          return dayA - dayB;
        });

        setItems(fetchedItems);
      } catch (error) {
        console.error("Error fetching curiosidades:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCuriosidades();
  }, []);

  const handleInputChange = (id, field, value) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        if (field === 's2_dia' || field === 's4_dia') {
          const numVal = value === '' ? null : Number(value);
          return { ...item, [field]: numVal };
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // New rows only exist in local state until the top-level "Guardar
  // Cambios" click, same as any other field edit here (title, image, día) —
  // there's nothing curiosidad-creation-specific to persist separately.
  const handleAddCuriosidad = () => {
    setItems((prev) => [emptyCuriosidad(), ...prev]);
  };

  const handleRemoveCuriosidad = (item) => {
    const confirmed = window.confirm(
      `¿Quitar "${item.title || item.id}"? Esto no se guarda hasta que hagas clic en "Guardar Cambios".`
    );
    if (!confirmed) return;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  // Saving a curiosidad's questions used to only update this page's local
  // state, relying on a separate top-level "Guardar Cambios" click to
  // actually reach Firestore — easy to miss, and a refresh (or a stale
  // screen restored by the browser's back/forward buttons) would silently
  // lose it with no error shown. This writes immediately and re-reads the
  // bundle doc fresh first, merging in just this one item's change, so a
  // stale local `items` snapshot can't clobber anyone else's edits either.
  const handleSaveQuestions = async (itemId, { questions, minSeconds, gradeWeight }) => {
    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, questions, minSeconds, gradeWeight } : item)));
    setSavingQuestions(true);
    try {
      if (isBundled) {
        const querySnapshot = await getDocs(collection(db, 'curiosidades'));
        let bundleData = null;
        querySnapshot.forEach((docSnap) => {
          if (docSnap.id === BUNDLE_DOC_ID) bundleData = docSnap.data();
        });
        const liveItems = bundleData?.items || {};
        const updatedItems = {
          ...liveItems,
          [itemId]: { ...(liveItems[itemId] || {}), questions, minSeconds, gradeWeight },
        };
        await setDoc(doc(db, 'curiosidades', BUNDLE_DOC_ID), { items: updatedItems });
      } else {
        await setDoc(doc(db, 'curiosidades', itemId), { questions, minSeconds, gradeWeight }, { merge: true });
      }
      invalidateCollectionCache('curiosidades');
    } catch (error) {
      console.error('Error saving curiosidad questions:', error);
      // Re-thrown so the modal can show its own inline error and stay open
      // (instead of closing and silently losing the unsaved edits).
      throw error;
    } finally {
      setSavingQuestions(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (isBundled) {
        const itemsMap = {};
        items.forEach((item) => {
          const { id, ...dataToSave } = item;
          itemsMap[id] = dataToSave;
        });
        await setDoc(doc(db, 'curiosidades', BUNDLE_DOC_ID), { items: itemsMap });
      } else {
        const batch = writeBatch(db);
        items.forEach(item => {
          const docRef = doc(db, 'curiosidades', item.id);
          const { id, ...dataToSave } = item;
          batch.set(docRef, dataToSave, { merge: true });
        });
        await batch.commit();
      }
      invalidateCollectionCache('curiosidades');
      alert("¡Curiosidades guardadas exitosamente!");
    } catch (error) {
      console.error("Error saving batch:", error);
      alert("Error al guardar.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- ONE-TIME MIGRATION: many separate docs → one consolidated doc ---
  // See DestacadoManager for the full rationale — split into two deliberate
  // steps so a teacher can verify the copy before anything old gets deleted.
  const handleMigrateCopy = async () => {
    setMigrationStatus('copying');
    try {
      const querySnapshot = await getDocs(collection(db, 'curiosidades'));
      const itemsMap = {};
      let count = 0;
      querySnapshot.forEach((docSnap) => {
        if (docSnap.id === BUNDLE_DOC_ID) return;
        itemsMap[docSnap.id] = docSnap.data();
        count += 1;
      });

      if (count === 0) {
        setMigrationStatus('error');
        alert('No se encontraron documentos individuales para copiar (¿ya se migró?).');
        return;
      }

      await setDoc(doc(db, 'curiosidades', BUNDLE_DOC_ID), { items: itemsMap }, { merge: true });
      invalidateCollectionCache('curiosidades');
      setIsBundled(true);
      setLegacyDocCount(count);
      setMigrationStatus('copied');
      alert(`✅ Copiadas ${count} curiosidades al documento único. Revisa la cuadrícula (recárgala) antes de borrar los documentos antiguos.`);
    } catch (error) {
      console.error('Error migrating curiosidades:', error);
      setMigrationStatus('error');
      alert('Error al copiar. Nada se ha borrado.');
    }
  };

  const handleMigrateDelete = async () => {
    const confirmed = window.confirm(
      `Esto borrará permanentemente los ${legacyDocCount || '~200'} documentos individuales antiguos de 'curiosidades' (el documento único ya los tiene copiados). Esta acción NO se puede deshacer. ¿Continuar?`
    );
    if (!confirmed) return;

    setMigrationStatus('deleting');
    try {
      const querySnapshot = await getDocs(collection(db, 'curiosidades'));
      const batch = writeBatch(db);
      let count = 0;
      querySnapshot.forEach((docSnap) => {
        if (docSnap.id === BUNDLE_DOC_ID) return;
        batch.delete(docSnap.ref);
        count += 1;
      });
      await batch.commit();
      invalidateCollectionCache('curiosidades');
      setMigrationStatus('done');
      setIsBundled(true);
      setLegacyDocCount(0);
      alert(`✅ Borrados ${count} documentos antiguos. 'curiosidades' ahora tiene un solo documento.`);
    } catch (error) {
      console.error('Error deleting old curiosidades docs:', error);
      setMigrationStatus('error');
      alert('Error al borrar los documentos antiguos.');
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-400 font-bold uppercase tracking-widest animate-pulse">Cargando Curiosidades...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-[1400px] mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex justify-between items-center z-10 shadow-sm">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Curiosidades Manager</h1>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Gestor de base de datos</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleAddCuriosidad}
              className="bg-white hover:bg-slate-50 text-indigo-600 border border-indigo-200 px-5 py-3 rounded-lg font-black uppercase tracking-widest text-xs transition-colors"
            >
              + Agregar Curiosidad
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

        {/* ONE-TIME REPAIR TOOL for a fixed uploader bug — see
            repairSplitBucketFields in firestoreCache.js. */}
        {repairableCount > 0 && (
          <div className="p-4 bg-rose-50 border-b-2 border-rose-300 flex flex-col gap-2">
            <p className="text-xs font-black text-rose-800 uppercase tracking-widest">
              🩹 {repairableCount} edición(es) guardadas mal por un bug — reparables
            </p>
            <p className="text-xs text-rose-700">
              El subidor masivo guardaba ediciones en un campo equivocado en vez de actualizar la curiosidad real —
              nada se borró, pero no aparecía en ningún lado. Este botón recupera esos datos. Es seguro repetirlo.
            </p>
            <button
              type="button"
              onClick={handleRepairSplitFields}
              disabled={repairStatus === 'repairing'}
              className="self-start px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white font-black rounded-lg text-xs uppercase tracking-widest disabled:opacity-50"
            >
              {repairStatus === 'repairing' ? 'Reparando...' : '🩹 Reparar ahora'}
            </button>
          </div>
        )}

        {/* ONE-TIME MIGRATION TOOL — remove this block once legacyDocCount
            is always 0 in production (i.e. once the migration has been run
            and confirmed). See DestacadoManager for the full rationale. */}
        {legacyDocCount > 0 && (
          <div className="p-4 bg-amber-50 border-b-2 border-amber-300 flex flex-col gap-2">
            <p className="text-xs font-black text-amber-800 uppercase tracking-widest">
              ⚠️ Migración disponible: consolidar en un solo documento
            </p>
            <p className="text-xs text-amber-700">
              {isBundled
                ? `El documento único ya existe con las curiosidades copiadas. Quedan ${legacyDocCount} documentos individuales antiguos sin borrar.`
                : `Actualmente cada curiosidad es su propio documento (~${legacyDocCount}). Paso 1 las copia a un solo documento sin borrar nada — revisa que la cuadrícula se vea bien después.`}
              {' '}Paso 2 borra los documentos antiguos (irreversible), y solo debe hacerse después de confirmar el Paso 1.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleMigrateCopy}
                disabled={migrationStatus === 'copying'}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-lg text-xs uppercase tracking-widest disabled:opacity-50"
              >
                {migrationStatus === 'copying' ? 'Copiando...' : isBundled ? '1. Volver a copiar' : '1. Copiar a documento único'}
              </button>
              <button
                type="button"
                onClick={handleMigrateDelete}
                disabled={!isBundled || migrationStatus === 'deleting'}
                className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white font-black rounded-lg text-xs uppercase tracking-widest disabled:opacity-50"
                title={isBundled ? '' : 'Primero completa el Paso 1'}
              >
                {migrationStatus === 'deleting' ? 'Borrando...' : '2. Borrar documentos antiguos'}
              </button>
            </div>
          </div>
        )}

        {/* Updated Grid Headers for 14 columns */}
        <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-4 p-4 bg-slate-100 border-b border-slate-200 font-black text-[10px] uppercase tracking-widest text-slate-500 items-center">
          <div className="col-span-1 text-center">Día S2</div>
          <div className="col-span-1 text-center">Día S4</div>
          <div className="col-span-1 text-indigo-600">ID</div>
          <div className="col-span-2">Título</div>
          <div className="col-span-4">Imagen (Vista Previa & URL)</div>
          <div className="col-span-3">Notas del Maestro</div>
          <div className="col-span-1 text-center">Preguntas</div>
          <div className="col-span-1 text-center">Quitar</div>
        </div>

        <div className="divide-y divide-slate-100">
          {items.map((item) => (
            <div key={item.id} className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-4 p-2 hover:bg-slate-50 transition-colors items-center">
              
              <div className="col-span-1">
                <input 
                  type="number" 
                  value={item.s2_dia || ''}
                  onChange={(e) => handleInputChange(item.id, 's2_dia', e.target.value)}
                  className="w-full bg-slate-100 border-none focus:ring-2 focus:ring-indigo-500 rounded-md p-2 text-center text-sm font-black text-slate-600 outline-none transition-all"
                  placeholder="-"
                />
              </div>

              <div className="col-span-1">
                <input 
                  type="number" 
                  value={item.s4_dia || ''}
                  onChange={(e) => handleInputChange(item.id, 's4_dia', e.target.value)}
                  className="w-full bg-slate-100 border-none focus:ring-2 focus:ring-emerald-500 rounded-md p-2 text-center text-sm font-black text-slate-600 outline-none transition-all"
                  placeholder="-"
                />
              </div>

              <div className="col-span-1 font-mono text-[10px] text-slate-400 font-bold truncate">
                {item.id}
              </div>

              <div className="col-span-2">
                <input 
                  type="text" 
                  value={item.title || ''}
                  onChange={(e) => handleInputChange(item.id, 'title', e.target.value)}
                  className="w-full bg-transparent border-none focus:ring-2 focus:ring-indigo-500 rounded-md p-2 text-xs font-medium outline-none transition-all text-slate-800"
                />
              </div>

              {/* NEW: Image Preview + URL Editor */}
              <div className="col-span-4 flex items-center gap-3">
                <div className="shrink-0 w-12 h-12 bg-slate-200 rounded-md overflow-hidden border border-slate-300 flex items-center justify-center shadow-sm">
                  {item.img ? (
                    <img 
                      src={item.img} 
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
                  value={item.img}
                  onChange={(url) => handleInputChange(item.id, 'img', url)}
                  folder="curiosidades"
                  inputClassName="w-full bg-transparent border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-md p-2 text-[10px] font-mono outline-none transition-all text-slate-500"
                />
              </div>

              <div className="col-span-3">
                <input
                  type="text"
                  value={item.teacher_notes || ''}
                  onChange={(e) => handleInputChange(item.id, 'teacher_notes', e.target.value)}
                  className="w-full bg-transparent border-none focus:ring-2 focus:ring-indigo-500 rounded-md p-2 text-xs font-medium outline-none transition-all text-slate-500 placeholder-slate-300"
                  placeholder="Notas internas..."
                />
              </div>

              <div className="col-span-1 text-center">
                <button
                  type="button"
                  onClick={() => setQuestionsModalItem(item)}
                  className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg px-2 py-1.5 border border-indigo-200 transition-colors"
                  title="Editar preguntas interactivas (convierte esta curiosidad en un juego jugable)"
                >
                  🧩 {item.questions?.length || 0}
                </button>
              </div>

              <div className="col-span-1 text-center">
                <button
                  type="button"
                  onClick={() => handleRemoveCuriosidad(item)}
                  className="text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg px-2 py-1.5 border border-rose-200 transition-colors"
                  title="Quitar esta curiosidad (no se guarda hasta hacer clic en Guardar Cambios)"
                >
                  🗑️
                </button>
              </div>

            </div>
          ))}
        </div>

      </div>

      {questionsModalItem && (
        <CuriosidadQuestionsModal
          curiosidad={questionsModalItem}
          onClose={() => setQuestionsModalItem(null)}
          onSave={(payload) => handleSaveQuestions(questionsModalItem.id, payload)}
        />
      )}
    </div>
  );
};

export default CuriosidadesManager;