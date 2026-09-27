import React, { useState, useEffect } from 'react';
import { collection, getDocs, writeBatch, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { invalidateCollectionCache } from '../../utils/firestoreCache';

const BUNDLE_DOC_ID = '_bundle';

const DestacadoManager = () => {
  const [items, setItems] = useState([]);
  const [calendarMap, setCalendarMap] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isBundled, setIsBundled] = useState(false);
  // Docs in the collection other than _bundle itself — the true "is there
  // still cleanup to do" signal. Tracked separately from isBundled: the
  // bundle existing only means step 1 has run at some point, not that step
  // 2 has, and both can be true/false independently across page reloads.
  const [legacyDocCount, setLegacyDocCount] = useState(0);
  const [migrationStatus, setMigrationStatus] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch Calendar Dates to group both A and B days
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

        // 2. Fetch Destacado Diario. Always scans the whole collection (this
        // is an admin-only page, not multiplied by every student's session,
        // so the extra cost here is a non-issue) so it can tell apart "the
        // bundle exists" from "the old docs are gone" — those are two
        // different migration steps and can each be true or false
        // independently across page reloads.
        const querySnapshot = await getDocs(collection(db, 'destacado_diario'));
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

        const fetchedItems = bundleData
          ? Object.entries(bundleData.items || {}).map(([id, data]) => ({ id, ...data }))
          : legacyItems;

        // Sort items primarily by dia, putting unassigned (null) at the bottom
        fetchedItems.sort((a, b) => {
          const dayA = a.dia || 999;
          const dayB = b.dia || 999;
          return dayA - dayB;
        });

        setItems(fetchedItems);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleInputChange = (id, field, value) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        if (field === 'dia') {
          const numVal = value === '' ? null : Number(value);
          return { ...item, [field]: numVal };
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
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
        await setDoc(doc(db, 'destacado_diario', BUNDLE_DOC_ID), { items: itemsMap });
      } else {
        const batch = writeBatch(db);
        items.forEach(item => {
          const docRef = doc(db, 'destacado_diario', item.id);
          const { id, ...dataToSave } = item;
          batch.set(docRef, dataToSave, { merge: true });
        });
        await batch.commit();
      }
      invalidateCollectionCache('destacado_diario');
      alert("¡Destacados guardados exitosamente!");
    } catch (error) {
      console.error("Error saving batch:", error);
      alert("Error al guardar.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- ONE-TIME MIGRATION: ~200 separate docs → one consolidated doc ---
  // Split into two deliberate steps so a teacher can verify the copy (in
  // this same grid, after step 1) before anything old gets deleted — step
  // 2 is irreversible and requires an explicit confirmation on top of that.
  const handleMigrateCopy = async () => {
    setMigrationStatus('copying');
    try {
      const querySnapshot = await getDocs(collection(db, 'destacado_diario'));
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

      await setDoc(doc(db, 'destacado_diario', BUNDLE_DOC_ID), { items: itemsMap }, { merge: true });
      invalidateCollectionCache('destacado_diario');
      setIsBundled(true);
      setLegacyDocCount(count);
      setMigrationStatus('copied');
      alert(`✅ Copiados ${count} destacados al documento único. Revisa la cuadrícula (recárgala) antes de borrar los documentos antiguos.`);
    } catch (error) {
      console.error('Error migrating destacados:', error);
      setMigrationStatus('error');
      alert('Error al copiar. Nada se ha borrado.');
    }
  };

  const handleMigrateDelete = async () => {
    const confirmed = window.confirm(
      `Esto borrará permanentemente los ${legacyDocCount || '~200'} documentos individuales antiguos de 'destacado_diario' (el documento único ya los tiene copiados). Esta acción NO se puede deshacer. ¿Continuar?`
    );
    if (!confirmed) return;

    setMigrationStatus('deleting');
    try {
      const querySnapshot = await getDocs(collection(db, 'destacado_diario'));
      const batch = writeBatch(db);
      let count = 0;
      querySnapshot.forEach((docSnap) => {
        if (docSnap.id === BUNDLE_DOC_ID) return;
        batch.delete(docSnap.ref);
        count += 1;
      });
      await batch.commit();
      invalidateCollectionCache('destacado_diario');
      setMigrationStatus('done');
      setIsBundled(true);
      setLegacyDocCount(0);
      alert(`✅ Borrados ${count} documentos antiguos. 'destacado_diario' ahora tiene un solo documento.`);
    } catch (error) {
      console.error('Error deleting old destacado docs:', error);
      setMigrationStatus('error');
      alert('Error al borrar los documentos antiguos.');
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-400 font-bold uppercase tracking-widest animate-pulse">Cargando Destacados...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8 font-sans">
      <div className="max-w-[1400px] mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex justify-between items-center z-10 shadow-sm">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Destacado Diario Manager</h1>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Gestor de base de datos en cuadrícula</p>
          </div>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-lg font-black uppercase tracking-widest text-xs transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>

        {/* ONE-TIME MIGRATION TOOL — remove this block once legacyDocCount
            is always 0 in production (i.e. once the migration has been run
            and confirmed). Shown whenever old individual docs still exist,
            regardless of whether the bundle has already been created —
            those are two independent steps that can persist across page
            reloads in either combination. */}
        {legacyDocCount > 0 && (
          <div className="p-4 bg-amber-50 border-b-2 border-amber-300 flex flex-col gap-2">
            <p className="text-xs font-black text-amber-800 uppercase tracking-widest">
              ⚠️ Migración disponible: consolidar en un solo documento
            </p>
            <p className="text-xs text-amber-700">
              {isBundled
                ? `El documento único ya existe con los destacados copiados. Quedan ${legacyDocCount} documentos individuales antiguos sin borrar.`
                : `Actualmente cada destacado es su propio documento (~${legacyDocCount}). Paso 1 los copia a un solo documento sin borrar nada — revisa que la cuadrícula se vea bien después.`}
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

        {/* Grid Headers */}
        <div className="grid grid-cols-12 gap-4 p-4 bg-slate-100 border-b border-slate-200 font-black text-[10px] uppercase tracking-widest text-slate-500 items-center">
          <div className="col-span-2 text-center">Día / Fecha</div>
          <div className="col-span-1 text-rose-600">Tipo</div>
          <div className="col-span-2">Ubicación / Persona</div>
          <div className="col-span-3">Titular (Header)</div>
          <div className="col-span-3">Imagen (Vista Previa & URL)</div>
          <div className="col-span-1 text-center">ID</div>
        </div>

        <div className="divide-y divide-slate-100">
          {items.map((item) => {
            const activeDates = calendarMap[item.dia] || [];
            
            return (
              <div key={item.id} className="grid grid-cols-12 gap-4 p-2 hover:bg-slate-50 transition-colors items-center">
                
                <div className="col-span-2 text-center flex flex-col items-center justify-center">
                  <input 
                    type="number" 
                    value={item.dia || ''}
                    onChange={(e) => handleInputChange(item.id, 'dia', e.target.value)}
                    className="w-16 bg-slate-100 border-none focus:ring-2 focus:ring-rose-500 rounded-md p-2 text-center text-sm font-black text-slate-600 outline-none transition-all mb-1.5"
                    placeholder="-"
                  />
                  <div className="flex flex-col gap-1">
                    {activeDates.length > 0 ? (
                      activeDates.map((dateStr, idx) => (
                        <span key={idx} className="block text-[9px] font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 whitespace-nowrap">
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

                <div className="col-span-1">
                  <input 
                    type="text" 
                    value={item.type || ''}
                    onChange={(e) => handleInputChange(item.id, 'type', e.target.value)}
                    className="w-full bg-transparent border-none focus:ring-2 focus:ring-rose-500 rounded-md p-2 text-xs font-black uppercase text-rose-600 outline-none transition-all"
                    placeholder="Destino"
                  />
                </div>

                <div className="col-span-2">
                  <input 
                    type="text" 
                    value={item.location || ''}
                    onChange={(e) => handleInputChange(item.id, 'location', e.target.value)}
                    className="w-full bg-transparent border-none focus:ring-2 focus:ring-rose-500 rounded-md p-2 text-xs font-medium outline-none transition-all text-slate-800"
                  />
                </div>

                <div className="col-span-3">
                  <input 
                    type="text" 
                    value={item.header || ''}
                    onChange={(e) => handleInputChange(item.id, 'header', e.target.value)}
                    className="w-full bg-transparent border-none focus:ring-2 focus:ring-rose-500 rounded-md p-2 text-xs font-medium outline-none transition-all text-slate-800"
                  />
                </div>

                <div className="col-span-3 flex items-center gap-3">
  <div className="shrink-0 w-28 h-16 bg-slate-200 rounded-lg overflow-hidden border border-slate-300 flex items-center justify-center shadow-sm">
    {item.image_url ? (
      <img 
        src={item.image_url} 
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
  <input 
    type="text" 
    value={item.image_url || ''}
    onChange={(e) => handleInputChange(item.id, 'image_url', e.target.value)}
    className="w-full bg-transparent border border-slate-200 hover:border-slate-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-md p-2 text-[10px] font-mono outline-none transition-all text-slate-500"
    placeholder="https://..."
  />
</div>
                <div className="col-span-1 font-mono text-[9px] text-slate-400 font-bold truncate px-2 text-center" title={item.id}>
                  {item.id}
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};

export default DestacadoManager;