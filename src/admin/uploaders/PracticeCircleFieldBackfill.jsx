import { useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDocs, collection, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { invalidateCollectionCache } from '../../utils/firestoreCache';
import { TEXTBOOK_ORDER } from '../../utils/textbookAccess';

// One-time cleanup: CircleGeneratorModal.jsx (the "🪄 Generar Círculos desde
// Vocabulario" tool) used to write a new practice_pods doc with no
// textbook/chapter fields at all — only FormLearningPath's own save and
// ChapterLearningPathImporter.jsx set those. PracticeHub.jsx's student-
// facing sequence view groups circles by textbook, then sorts chapters
// numerically off exactly those two fields, so a circle missing them
// collapsed into a "Sin libro"/"Cap. ?" bucket with sortKey 0 — thrown out
// of numeric order relative to every properly-tagged chapter. Fixed going
// forward in CircleGeneratorModal.jsx itself; this backfills circles
// already written without them.
//
// Same discipline as SentenceTagMigration.jsx: preview first, never writes
// until "Aplicar cambios" is clicked.

// Must match CircleGeneratorModal.jsx's own slugifyTextbook exactly, since
// every affected path_id was built with it (course_textbookslug_capN) —
// duplicated rather than imported since that component lives in
// admin/FormLearningPath and this lives in admin/uploaders, same tradeoff
// CircleGeneratorModal.jsx itself already made for its GATE_CONFIG_DEFAULT.
const slugifyTextbook = (name) =>
  (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

const PATH_ID_RE = /^(s2|s4)_([a-z0-9]+)_cap(\d+)$/;

const planFix = (circle) => {
  const needsTextbook = !circle.textbook;
  const needsChapter = !circle.chapter;
  if (!needsTextbook && !needsChapter) return null;

  const match = PATH_ID_RE.exec(circle.path_id || '');
  if (!match) {
    return { id: circle.path_id, status: 'no-pattern-match', needsTextbook, needsChapter };
  }
  const [, , slug, chapterNum] = match;
  const candidates = TEXTBOOK_ORDER.filter((name) => slugifyTextbook(name) === slug);
  if (candidates.length !== 1) {
    return {
      id: circle.path_id,
      status: candidates.length === 0 ? 'no-textbook-found' : 'multiple-textbooks-found',
      candidates,
      needsTextbook,
      needsChapter,
    };
  }

  const patch = {};
  if (needsTextbook) patch.textbook = candidates[0];
  if (needsChapter) patch.chapter = chapterNum;
  return { id: circle.path_id, status: 'ready', patch, title: circle.title };
};

export default function PracticeCircleFieldBackfill() {
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [plans, setPlans] = useState(null);
  const [status, setStatus] = useState('');

  const handleScan = async () => {
    setScanning(true);
    setStatus('');
    setPlans(null);
    try {
      const snap = await getDocs(collection(db, 'practice_pods'));
      const circles = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const results = circles
        .filter((c) => c.contentType === 'vocab')
        .map(planFix)
        .filter(Boolean);
      setPlans(results);
    } catch (err) {
      console.error('Error scanning practice_pods:', err);
      setStatus(`❌ Error al escanear: ${err.message}`);
    } finally {
      setScanning(false);
    }
  };

  const readyPlans = (plans || []).filter((p) => p.status === 'ready');
  const reviewPlans = (plans || []).filter((p) => p.status !== 'ready');

  const handleApply = async () => {
    if (readyPlans.length === 0) return;
    if (!window.confirm(`¿Agregar textbook/chapter a ${readyPlans.length} círculo(s)? Esto no se puede deshacer automáticamente.`)) return;
    setApplying(true);
    setStatus('');
    try {
      let done = 0;
      for (const plan of readyPlans) {
        await updateDoc(doc(db, 'practice_pods', plan.id), plan.patch);
        done += 1;
      }
      invalidateCollectionCache('practice_pods');
      setStatus(`✅ ${done} círculo(s) actualizado(s).`);
      setPlans((prev) => prev.filter((p) => !readyPlans.includes(p)));
    } catch (err) {
      console.error('Error applying circle field backfill:', err);
      setStatus(`❌ Error al aplicar: ${err.message}`);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 text-white font-sans">
      <div className="flex justify-between items-start mb-6">
        <h2 className="text-2xl font-black uppercase tracking-widest text-amber-400 flex items-center gap-3">
          <span>🔧</span> Reparar Textbook/Capítulo (Círculos de Práctica)
        </h2>
        <Link to="/admin-secret-portal-path-manager" className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700">
          ← Gestor de Rutas y Círculos
        </Link>
      </div>

      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
        Busca círculos de vocabulario (practice_pods) sin <code className="text-slate-400">textbook</code> y/o{' '}
        <code className="text-slate-400">chapter</code> — el resultado de circulos generados antes de este arreglo — e
        infiere ambos valores de su propio Path ID (<code className="text-slate-400">curso_libroslug_capN</code>). No
        escribe nada hasta que presiones "Aplicar cambios" — primero escanea y muestra exactamente qué cambiaría.
      </p>

      <button
        type="button"
        onClick={handleScan}
        disabled={scanning}
        className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-black uppercase tracking-widest rounded-lg disabled:opacity-50 mb-4"
      >
        {scanning ? 'Escaneando...' : '🔍 Escanear Círculos de Práctica'}
      </button>

      {status && <p className="text-sm font-bold mb-4">{status}</p>}

      {plans && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <p className="text-sm font-bold text-slate-300">
              {plans.length} círculo(s) sin textbook/chapter — {readyPlans.length} listo(s), {reviewPlans.length} necesitan revisión.
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
                ⚠️ Estos no se tocarán automáticamente — su Path ID no sigue el patrón esperado o su libro no se pudo identificar con certeza:
              </p>
              <div className="space-y-2">
                {reviewPlans.map((p) => (
                  <div key={p.id} className="text-xs text-rose-200 font-mono">
                    {p.id}:{' '}
                    {p.status === 'no-pattern-match'
                      ? 'Path ID no sigue el patrón "curso_libro_capN"'
                      : p.status === 'no-textbook-found'
                        ? 'ningún libro conocido coincide con el slug de su Path ID'
                        : `más de un libro coincide (${p.candidates.join(', ')})`}
                  </div>
                ))}
              </div>
            </div>
          )}

          {readyPlans.length > 0 && (
            <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
              {readyPlans.map((p) => (
                <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs font-mono">
                  <span className="text-slate-500">{p.id}</span>
                  {p.title ? <span className="text-slate-600"> ({p.title})</span> : null}
                  {': '}
                  <span className="text-emerald-400">
                    {Object.entries(p.patch).map(([k, v]) => `${k}="${v}"`).join(', ')}
                  </span>
                </div>
              ))}
            </div>
          )}

          {plans.length === 0 && <p className="text-sm text-slate-500 italic">Nada que reparar — ya está todo al día.</p>}
        </div>
      )}
    </div>
  );
}
