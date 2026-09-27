import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../../firebase';
import { collection, doc, getDoc, getDocs, setDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { invalidateCollectionCache } from '../../utils/firestoreCache';

const BUNDLE_DOC_ID = '_bundle';

const todayStr = () => new Date().toLocaleDateString('en-CA');

const SenordleUploader = () => {
  const [jsonInput, setJsonInput] = useState('');
  const [status, setStatus] = useState('');
  const [previewItems, setPreviewItems] = useState(null);
  const [isBundled, setIsBundled] = useState(false);
  const [legacyDocCount, setLegacyDocCount] = useState(0);
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [previewCourse, setPreviewCourse] = useState('s2');

  const handleUpload = async () => {
    console.log("--- STARTING SEÑORDLE DICTIONARY UPLOAD ---");
    try {
      const data = JSON.parse(jsonInput);
      let totalCount = 0;

      // Once the "consolidate into one document" migration has run (see
      // below), juego_senordle should only ever hold that one doc — so new
      // uploads merge into it instead of creating fresh individual docs,
      // which would silently bring back the per-doc-read cost that
      // migration exists to remove. Falls back to the original
      // one-doc-per-word behavior if that migration hasn't run yet.
      const bundleRef = doc(db, 'juego_senordle', BUNDLE_DOC_ID);
      const bundleSnap = await getDoc(bundleRef);
      const bundled = bundleSnap.exists();
      const merged = {};

      // Iterate through all keys in the JSON (s2, s4, dictionary, etc.)
      for (const courseKey in data) {
        const wordMap = data[courseKey];

        // 🛡️ Safety Check: Ensure this is a date-word map and not the 'dictionary' array
        if (wordMap && typeof wordMap === 'object' && !Array.isArray(wordMap)) {

          for (const [date, word] of Object.entries(wordMap)) {
            // Unique ID: course_date (e.g., "s2_2026-01-01")
            const docId = `${courseKey}_${date}`;

            console.log(`UPLOADING SEÑORDLE WORD: ${docId} -> ${word}`);

            const wordData = {
              word: word.toUpperCase(),
              date: date,
              course: courseKey,
              lastUpdated: serverTimestamp()
            };

            if (bundled) {
              merged[`items.${docId}`] = wordData;
            } else {
              await setDoc(doc(db, "juego_senordle", docId), wordData);
            }
            totalCount++;
          }
        } else {
          console.log(`Skipping key: ${courseKey} (not a valid word map)`);
        }
      }

      if (bundled && totalCount > 0) {
        await setDoc(bundleRef, merged, { merge: true });
      }
      invalidateCollectionCache('juego_senordle');

      setStatus(`✅ SUCCESS: ${totalCount} Words Synced`);
    } catch (error) {
      console.error("SEÑORDLE UPLOAD ERROR:", error);
      setStatus('❌ Error: Check Console');
    }
  };

  // --- ONE-TIME MIGRATION: many separate docs → one consolidated doc ---
  // No dedicated grid exists for this collection (unlike Destacado/
  // Curiosidades), so this loads a plain preview table first — the same
  // "verify it looks right before deleting anything" step, just without a
  // full editing UI attached to it.
  const handleLoadPreview = async () => {
    setMigrationStatus('loading');
    try {
      const querySnapshot = await getDocs(collection(db, 'juego_senordle'));
      let bundleData = null;
      const legacyItems = [];
      querySnapshot.forEach((docSnap) => {
        if (docSnap.id === BUNDLE_DOC_ID) bundleData = docSnap.data();
        else legacyItems.push({ id: docSnap.id, ...docSnap.data() });
      });

      const items = bundleData
        ? Object.entries(bundleData.items || {}).map(([id, data]) => ({ id, ...data }))
        : legacyItems;
      items.sort((a, b) => (a.id || '').localeCompare(b.id || ''));

      setIsBundled(!!bundleData);
      setLegacyDocCount(legacyItems.length);
      setPreviewItems(items);
      setMigrationStatus(null);
    } catch (error) {
      console.error('Error loading senordle preview:', error);
      setMigrationStatus('error');
    }
  };

  // Loads automatically so the schedule preview below is always up to
  // date, not just a byproduct of clicking into the migration tool.
  useEffect(() => {
    handleLoadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleForCourse = useMemo(
    () =>
      (previewItems || [])
        .filter((item) => (item.course || item.id?.split('_')[0]) === previewCourse)
        .sort((a, b) => (a.date || '').localeCompare(b.date || '')),
    [previewItems, previewCourse]
  );

  const todayScheduled = scheduleForCourse.some((item) => item.date === todayStr());

  const handleMigrateCopy = async () => {
    setMigrationStatus('copying');
    try {
      const querySnapshot = await getDocs(collection(db, 'juego_senordle'));
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

      await setDoc(doc(db, 'juego_senordle', BUNDLE_DOC_ID), { items: itemsMap }, { merge: true });
      invalidateCollectionCache('juego_senordle');
      setIsBundled(true);
      setLegacyDocCount(count);
      setMigrationStatus('copied');
      await handleLoadPreview();
      alert(`✅ Copiadas ${count} palabras al documento único. Revisa la vista previa antes de borrar los documentos antiguos.`);
    } catch (error) {
      console.error('Error migrating senordle:', error);
      setMigrationStatus('error');
      alert('Error al copiar. Nada se ha borrado.');
    }
  };

  const handleMigrateDelete = async () => {
    const confirmed = window.confirm(
      `Esto borrará permanentemente los ${legacyDocCount || '~muchos'} documentos individuales antiguos de 'juego_senordle' (el documento único ya los tiene copiados). Esta acción NO se puede deshacer. ¿Continuar?`
    );
    if (!confirmed) return;

    setMigrationStatus('deleting');
    try {
      const querySnapshot = await getDocs(collection(db, 'juego_senordle'));
      const batch = writeBatch(db);
      let count = 0;
      querySnapshot.forEach((docSnap) => {
        if (docSnap.id === BUNDLE_DOC_ID) return;
        batch.delete(docSnap.ref);
        count += 1;
      });
      await batch.commit();
      invalidateCollectionCache('juego_senordle');
      setMigrationStatus('done');
      setIsBundled(true);
      setLegacyDocCount(0);
      await handleLoadPreview();
      alert(`✅ Borrados ${count} documentos antiguos. 'juego_senordle' ahora tiene un solo documento.`);
    } catch (error) {
      console.error('Error deleting old senordle docs:', error);
      setMigrationStatus('error');
      alert('Error al borrar los documentos antiguos.');
    }
  };

  return (
    <div className="p-10 max-w-4xl mx-auto bg-slate-900 text-white rounded-2xl shadow-2xl border-4 border-emerald-500">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-2xl font-black uppercase text-emerald-500">
          🧩 SEÑORDLE ARCHITECT
        </h2>
        <Link
          to="/admin-daily-plan-senordle"
          className="text-xs font-bold text-emerald-400 hover:text-emerald-300 border border-emerald-700/50 px-3 py-1.5 rounded-lg uppercase tracking-widest whitespace-nowrap"
        >
          + Añadir una palabra →
        </Link>
      </div>
      <p className="mb-4 text-sm text-slate-400">Migrate word-to-date mappings to the <code className="text-emerald-300">juego_senordle</code> collection.</p>
      
      <textarea
        className="w-full h-96 p-4 bg-slate-800 border border-slate-700 rounded-xl font-mono text-xs text-emerald-400 outline-none"
        value={jsonInput}
        onChange={(e) => setJsonInput(e.target.value)}
        placeholder="Paste Señordle JSON here..."
      />

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={handleUpload}
          className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 font-bold rounded-xl shadow-lg uppercase text-sm"
        >
          Push to Firestore
        </button>
        <span className="font-bold text-sm text-emerald-300">{status}</span>
      </div>

      {/* SCHEDULE PREVIEW — always on, so you can check whether a word is
          already scheduled for a given day before/after uploading. */}
      <div className="mt-8 pt-6 border-t border-slate-700">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-black text-emerald-400 uppercase tracking-widest">
            📅 Calendario Programado
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              {['s2', 's4'].map((c) => (
                <button
                  key={c}
                  onClick={() => setPreviewCourse(c)}
                  className={`px-3 py-1.5 text-xs font-black uppercase ${
                    previewCourse === c ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <button
              onClick={handleLoadPreview}
              disabled={migrationStatus === 'loading'}
              className="text-xs font-bold text-slate-400 hover:text-white disabled:opacity-50"
            >
              {migrationStatus === 'loading' ? 'Cargando...' : '🔄 Actualizar'}
            </button>
          </div>
        </div>

        {!todayScheduled && previewItems && (
          <p className="text-xs font-bold text-rose-400 bg-rose-950/40 border border-rose-800 rounded-lg px-3 py-2 mb-3">
            ⚠️ No hay palabra programada para hoy ({todayStr()}, {previewCourse.toUpperCase()}) — el juego usará "LIBRO" como respaldo.
          </p>
        )}

        <div className="max-h-64 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg divide-y divide-slate-700/60">
          {scheduleForCourse.length === 0 ? (
            <p className="text-xs text-slate-500 italic p-3">
              {previewItems ? `Sin palabras programadas para ${previewCourse.toUpperCase()}.` : 'Cargando...'}
            </p>
          ) : (
            scheduleForCourse.map((item) => (
              <div
                key={item.id}
                className={`flex justify-between items-center px-3 py-1.5 text-xs ${
                  item.date === todayStr() ? 'bg-emerald-950/50' : ''
                }`}
              >
                <span className={`font-mono ${item.date === todayStr() ? 'text-emerald-300 font-bold' : 'text-slate-400'}`}>
                  {item.date} {item.date === todayStr() ? '(Hoy)' : ''}
                </span>
                <span className="font-bold text-white">{item.word}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ONE-TIME MIGRATION TOOL — remove this block once legacyDocCount is
          always 0 in production. Only shows once the schedule preview
          above has loaded AND found individual docs left to migrate. */}
      {legacyDocCount > 0 && (
        <div className="mt-8 pt-6 border-t border-slate-700">
          <p className="text-xs font-black text-amber-400 uppercase tracking-widest mb-2">
            ⚠️ Migración: consolidar en un solo documento
          </p>
          <p className="text-xs text-amber-200 mb-3">
            {isBundled
              ? `Documento único ya existe. Quedan ${legacyDocCount} documentos individuales antiguos sin borrar.`
              : `${legacyDocCount} documentos individuales. Paso 1 los copia sin borrar nada — revisa el calendario de arriba después.`}
            {' '}Paso 2 borra los antiguos (irreversible), solo después de confirmar el Paso 1.
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
            >
              {migrationStatus === 'deleting' ? 'Borrando...' : '2. Borrar documentos antiguos'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SenordleUploader;