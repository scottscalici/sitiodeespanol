import React, { useState } from 'react';
import { db } from '../../firebase';
import { collection, doc, getDoc, getDocs, setDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { invalidateCollectionCache } from '../../utils/firestoreCache';

const BUNDLE_DOC_ID = '_bundle';

const SenordleUploader = () => {
  const [jsonInput, setJsonInput] = useState('');
  const [status, setStatus] = useState('');
  const [previewItems, setPreviewItems] = useState(null);
  const [isBundled, setIsBundled] = useState(false);
  const [legacyDocCount, setLegacyDocCount] = useState(0);
  const [migrationStatus, setMigrationStatus] = useState(null);

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
      <h2 className="text-2xl font-black mb-4 uppercase text-emerald-500">
        🧩 SEÑORDLE ARCHITECT
      </h2>
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

      {/* ONE-TIME MIGRATION TOOL — remove this block once legacyDocCount is
          always 0 in production. Unlike Destacado/Curiosidades there's no
          existing grid for this collection, so "load preview" stands in for
          "look at the grid" as the pre-delete sanity check. */}
      <div className="mt-8 pt-6 border-t border-slate-700">
        <p className="text-xs font-black text-amber-400 uppercase tracking-widest mb-2">
          ⚠️ Migración: consolidar en un solo documento
        </p>
        <button
          type="button"
          onClick={handleLoadPreview}
          disabled={migrationStatus === 'loading'}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-black rounded-lg text-xs uppercase tracking-widest disabled:opacity-50 mb-3"
        >
          {migrationStatus === 'loading' ? 'Cargando...' : 'Cargar palabras actuales'}
        </button>

        {previewItems && (
          <>
            <p className="text-xs text-amber-200 mb-2">
              {isBundled
                ? `Documento único ya existe. Quedan ${legacyDocCount} documentos individuales antiguos sin borrar.`
                : `${legacyDocCount} documentos individuales. Paso 1 los copia sin borrar nada — revisa la lista después.`}
              {' '}Paso 2 borra los antiguos (irreversible), solo después de confirmar el Paso 1.
            </p>
            <div className="max-h-48 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg p-3 mb-3 font-mono text-[10px] text-slate-300 grid grid-cols-2 md:grid-cols-3 gap-1">
              {previewItems.map((item) => (
                <div key={item.id}>{item.id}: <span className="text-emerald-400">{item.word}</span></div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleMigrateCopy}
                disabled={migrationStatus === 'copying' || legacyDocCount === 0}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-lg text-xs uppercase tracking-widest disabled:opacity-50"
              >
                {migrationStatus === 'copying' ? 'Copiando...' : isBundled ? '1. Volver a copiar' : '1. Copiar a documento único'}
              </button>
              <button
                type="button"
                onClick={handleMigrateDelete}
                disabled={!isBundled || legacyDocCount === 0 || migrationStatus === 'deleting'}
                className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white font-black rounded-lg text-xs uppercase tracking-widest disabled:opacity-50"
              >
                {migrationStatus === 'deleting' ? 'Borrando...' : '2. Borrar documentos antiguos'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SenordleUploader;