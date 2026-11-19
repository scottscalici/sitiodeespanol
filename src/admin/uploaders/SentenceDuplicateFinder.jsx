import { useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDocs, collection, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { invalidateCollectionCache } from '../../utils/firestoreCache';

// One-time cleanup: Sentence Manager's bulk importer (handleBulkImport in
// SentenceManager.jsx) has no duplicate-detection at all — every line in
// the paste box becomes a brand-new addDoc() every time "Importar" is
// clicked, with zero check against what's already in sentence_bank. If a
// batch gets imported twice (a second click, or re-pasting the same box
// thinking the first attempt didn't go through), every sentence in it now
// exists as two-plus near-identical docs — which silently inflates "X
// oración(es) encontradas" counts everywhere sentences get matched by tag
// (the Vocab Pod Generator, FormLearningPath's grammar matcher, etc.)
// without ever looking like an error anywhere in the UI.
//
// Same discipline as SentenceTagMigration.jsx: preview first, never
// deletes anything until "Aplicar cambios" is clicked.

// Identity = normalized Spanish text + chapter. Two docs this similar are
// overwhelmingly a re-import of the same batch, not a teacher intentionally
// authoring the same sentence twice for the same chapter — and even if
// tags drifted between the two imports (e.g. one copy got tag-migrated
// before the other was deduped), the Spanish text itself won't have.
const normalizeText = (s) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();
const groupKey = (s) => `${normalizeText(s.spanish)}::${(s.chapterId || '').trim()}`;

// Firestore Timestamp → millis, for picking which copy is "the original."
// A doc from before createdAt existed (or mid-write) sorts last so it's
// never mistaken for the original over one with a real timestamp.
const toMillis = (ts) => (ts && typeof ts.toMillis === 'function' ? ts.toMillis() : Infinity);

const planGroup = (sentences) => {
  const sorted = [...sentences].sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
  const [keep, ...duplicates] = sorted;
  return { keep, duplicates };
};

export default function SentenceDuplicateFinder() {
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [groups, setGroups] = useState(null); // array of { keep, duplicates }
  const [status, setStatus] = useState('');

  const handleScan = async () => {
    setScanning(true);
    setStatus('');
    setGroups(null);
    try {
      const snap = await getDocs(collection(db, 'sentence_bank'));
      const sentences = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const byKey = new Map();
      sentences.forEach((s) => {
        const key = groupKey(s);
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key).push(s);
      });
      const results = [...byKey.values()].filter((g) => g.length > 1).map(planGroup);
      setGroups(results);
    } catch (err) {
      console.error('Error scanning sentence_bank for duplicates:', err);
      setStatus(`❌ Error al escanear: ${err.message}`);
    } finally {
      setScanning(false);
    }
  };

  const totalDuplicates = (groups || []).reduce((sum, g) => sum + g.duplicates.length, 0);

  const handleApply = async () => {
    if (totalDuplicates === 0) return;
    if (!window.confirm(`¿Eliminar ${totalDuplicates} oración(es) duplicada(s)? Se conserva la copia más antigua de cada una. Esto no se puede deshacer.`)) return;
    setApplying(true);
    setStatus('');
    try {
      let done = 0;
      for (const g of groups) {
        for (const dup of g.duplicates) {
          await deleteDoc(doc(db, 'sentence_bank', dup.id));
          done += 1;
        }
      }
      invalidateCollectionCache('sentence_bank');
      setStatus(`✅ ${done} oración(es) duplicada(s) eliminada(s).`);
      setGroups([]);
    } catch (err) {
      console.error('Error applying duplicate cleanup:', err);
      setStatus(`❌ Error al eliminar: ${err.message}`);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 text-white font-sans">
      <div className="flex justify-between items-start mb-6">
        <h2 className="text-2xl font-black uppercase tracking-widest text-amber-400 flex items-center gap-3">
          <span>🔍</span> Buscar Duplicados (Sentence Bank)
        </h2>
        <Link to="/admin-secret-portal-sentences" className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700">
          ← Sentence Manager
        </Link>
      </div>

      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
        Busca oraciones con el mismo texto en español y el mismo capítulo — normalmente el resultado de importar el
        mismo lote dos veces en "Importar en Lote". Se conserva la copia más antigua de cada grupo y el resto se
        marca para eliminar. No se borra nada hasta que presiones "Aplicar cambios" — primero escanea y muestra
        exactamente qué se eliminaría.
      </p>

      <button
        type="button"
        onClick={handleScan}
        disabled={scanning}
        className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-black uppercase tracking-widest rounded-lg disabled:opacity-50 mb-4"
      >
        {scanning ? 'Escaneando...' : '🔍 Escanear Sentence Bank'}
      </button>

      {status && <p className="text-sm font-bold mb-4">{status}</p>}

      {groups && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <p className="text-sm font-bold text-slate-300">
              {groups.length} oración(es) con duplicados — {totalDuplicates} copia(s) de más para eliminar.
            </p>
            <button
              type="button"
              onClick={handleApply}
              disabled={applying || totalDuplicates === 0}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-lg disabled:opacity-50"
            >
              {applying ? 'Eliminando...' : `✅ Aplicar cambios (${totalDuplicates})`}
            </button>
          </div>

          {groups.length > 0 && (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {groups.map((g, i) => (
                <div key={g.keep.id + i} className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs">
                  <p className="text-slate-200 font-bold mb-1">"{g.keep.spanish}"</p>
                  <p className="text-slate-500 mb-2">
                    Capítulo {g.keep.chapterId || '—'} · {g.duplicates.length + 1} copia(s) encontrada(s)
                  </p>
                  <p className="text-emerald-400 font-mono">✓ conservar: {g.keep.id}</p>
                  {g.duplicates.map((dup) => (
                    <p key={dup.id} className="text-rose-400 font-mono">
                      ✗ eliminar: {dup.id}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          )}

          {groups.length === 0 && <p className="text-sm text-slate-500 italic">No se encontraron duplicados.</p>}
        </div>
      )}
    </div>
  );
}
