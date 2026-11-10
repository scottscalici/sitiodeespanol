import { useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDocs, collection, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { invalidateCollectionCache } from '../../utils/firestoreCache';

// One-time cleanup: Sentence Bank's "Sección X.X" tag was never unique on
// its own (section numbering restarts per chapter regardless of
// textbook), and "Repaso Examen" was too vague to tell different
// makeup-quiz batches apart once there's more than one. This renames both
// to self-describing tags — "<Textbook> — Sección X.X" and a specific
// "Repaso: <topic>" — across every sentence_bank doc, in a preview-then-
// apply flow (never writes anything until "Aplicar cambios" is clicked),
// same discipline as the chapter importer's validate-first step.

// Expand this list if a preview run flags more "needs review" docs than
// expected — a bare "Sección X.X" tag only auto-renames when EXACTLY ONE
// of these is found as a sibling tag on that same document; anything
// else (zero matches, or more than one) is left untouched and reported,
// never guessed at.
const KNOWN_TEXTBOOKS = ['Descubre 2', 'Reporteros 4'];

const BARE_SECTION_RE = /^Sección \d+\.\d+$/;
const REPASO_OLD_TAG = 'Repaso Examen';
const REPASO_NEW_TAG = 'Repaso: Pretérito-Imperfecto (Marcadores Temporales)';

const planRename = (sentence) => {
  const tags = sentence.grammarTags || [];
  const bareSectionTag = tags.find((t) => BARE_SECTION_RE.test(t));
  const hasRepaso = tags.includes(REPASO_OLD_TAG);
  if (!bareSectionTag && !hasRepaso) return null;

  let newTags = [...tags];
  const notes = [];

  if (bareSectionTag) {
    const candidates = KNOWN_TEXTBOOKS.filter((book) => tags.includes(book));
    if (candidates.length === 1) {
      const combined = `${candidates[0]} — ${bareSectionTag}`;
      newTags = newTags.map((t) => (t === bareSectionTag ? combined : t));
      notes.push({ type: 'section', from: bareSectionTag, to: combined, status: 'ready' });
    } else {
      notes.push({
        type: 'section',
        from: bareSectionTag,
        to: null,
        status: candidates.length === 0 ? 'no-textbook-found' : 'multiple-textbooks-found',
        candidates,
      });
    }
  }

  if (hasRepaso) {
    newTags = newTags.map((t) => (t === REPASO_OLD_TAG ? REPASO_NEW_TAG : t));
    notes.push({ type: 'repaso', from: REPASO_OLD_TAG, to: REPASO_NEW_TAG, status: 'ready' });
  }

  return { id: sentence.id, oldTags: tags, newTags, notes };
};

export default function SentenceTagMigration() {
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [plans, setPlans] = useState(null); // array of planRename() results
  const [status, setStatus] = useState('');

  const handleScan = async () => {
    setScanning(true);
    setStatus('');
    setPlans(null);
    try {
      const snap = await getDocs(collection(db, 'sentence_bank'));
      const sentences = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const results = sentences.map(planRename).filter(Boolean);
      setPlans(results);
    } catch (err) {
      console.error('Error scanning sentence_bank:', err);
      setStatus(`❌ Error al escanear: ${err.message}`);
    } finally {
      setScanning(false);
    }
  };

  const readyPlans = (plans || []).filter((p) => p.notes.every((n) => n.status === 'ready'));
  const reviewPlans = (plans || []).filter((p) => p.notes.some((n) => n.status !== 'ready'));

  const handleApply = async () => {
    if (readyPlans.length === 0) return;
    if (!window.confirm(`¿Renombrar etiquetas en ${readyPlans.length} oración(es)? Esto no se puede deshacer automáticamente.`)) return;
    setApplying(true);
    setStatus('');
    try {
      let done = 0;
      for (const plan of readyPlans) {
        await updateDoc(doc(db, 'sentence_bank', plan.id), { grammarTags: plan.newTags });
        done += 1;
      }
      invalidateCollectionCache('sentence_bank');
      setStatus(`✅ ${done} oración(es) actualizadas.`);
      setPlans((prev) => prev.filter((p) => !readyPlans.includes(p)));
    } catch (err) {
      console.error('Error applying tag migration:', err);
      setStatus(`❌ Error al aplicar: ${err.message}`);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 text-white font-sans">
      <div className="flex justify-between items-start mb-6">
        <h2 className="text-2xl font-black uppercase tracking-widest text-amber-400 flex items-center gap-3">
          <span>🏷️</span> Migración de Etiquetas (Sentence Bank)
        </h2>
        <Link to="/admin-secret-portal-sentences" className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700">
          ← Sentence Manager
        </Link>
      </div>

      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
        Renombra <code className="text-slate-400">"Sección X.X"</code> → <code className="text-slate-400">"Libro — Sección X.X"</code> y{' '}
        <code className="text-slate-400">"{REPASO_OLD_TAG}"</code> → <code className="text-slate-400">"{REPASO_NEW_TAG}"</code> en todo
        Sentence Bank. No escribe nada hasta que presiones "Aplicar cambios" — primero escanea y muestra exactamente qué cambiaría.
        Libros reconocidos: {KNOWN_TEXTBOOKS.join(', ')} — si una oración usa un libro distinto, aparecerá abajo para revisión manual
        en vez de adivinar.
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

      {plans && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <p className="text-sm font-bold text-slate-300">
              {plans.length} oración(es) con etiquetas por actualizar — {readyPlans.length} lista(s), {reviewPlans.length} necesitan revisión.
            </p>
            <button
              type="button"
              onClick={handleApply}
              disabled={applying || readyPlans.length === 0}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-lg disabled:opacity-50"
            >
              {applying ? 'Aplicando...' : `✅ Aplicar cambios (${readyPlans.length})`}
            </button>
          </div>

          {reviewPlans.length > 0 && (
            <div className="bg-rose-950/30 border border-rose-800 rounded-xl p-4">
              <p className="text-xs font-bold text-rose-300 mb-2">
                ⚠️ Estas no se tocarán automáticamente — revísalas a mano en el Sentence Manager:
              </p>
              <div className="space-y-2">
                {reviewPlans.map((p) => (
                  <div key={p.id} className="text-xs text-rose-200 font-mono">
                    {p.id}:{' '}
                    {p.notes
                      .filter((n) => n.status !== 'ready')
                      .map((n) =>
                        n.status === 'no-textbook-found'
                          ? `"${n.from}" — ningún libro reconocido entre sus etiquetas`
                          : `"${n.from}" — más de un libro reconocido (${n.candidates.join(', ')})`
                      )
                      .join('; ')}
                  </div>
                ))}
              </div>
            </div>
          )}

          {readyPlans.length > 0 && (
            <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
              {readyPlans.map((p) => (
                <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs font-mono">
                  <span className="text-slate-500">{p.id}:</span>{' '}
                  {p.notes.map((n, i) => (
                    <span key={i} className="text-emerald-400">
                      "{n.from}" → "{n.to}"
                      {i < p.notes.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}

          {plans.length === 0 && <p className="text-sm text-slate-500 italic">Nada que renombrar — ya está todo al día.</p>}
        </div>
      )}
    </div>
  );
}
