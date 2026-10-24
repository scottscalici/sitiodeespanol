import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCachedBucketedCollection } from '../../utils/firestoreCache';
import { VERB_TENSES, VERB_SUBJECTS } from '../../utils/verbTenses';
import { buildVerbConjugationQuestions, buildBlackboardPoolZip, triggerZipDownload } from '../../utils/exportToSchoology';

const TENSE_LABELS = Object.fromEntries(VERB_TENSES.map((t) => [t.id, t.label]));
const SUBJECT_LABELS = Object.fromEntries(VERB_SUBJECTS.map((s) => [s.id, s.label]));
const DEFAULT_TENSES = new Set(['presente', 'pretérito']);
const DEFAULT_SUBJECTS = new Set(VERB_SUBJECTS.filter((s) => s.id !== 'vosotros').map((s) => s.id));

// Schoology caps a Test/Quiz (and the newer Assessment object) at 200
// questions — but importing a Blackboard Pool zip always lands as a
// Test/Quiz FIRST, even though the actual destination (a Question/Item
// Bank, which has no such cap — that's the whole point of a bank) only
// comes after a later "add questions to bank" step. Staying safely under
// that intermediate limit avoids finding out the hard way whether a bulk
// XML import enforces it the same as adding questions by hand. Each part
// below gets imported + "added to bank" separately, accumulating into the
// SAME bank across multiple rounds.
const MAX_QUESTIONS_PER_FILE = 150;

export default function VerbSchoologyExport() {
  const [verbs, setVerbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [selectedVerbIds, setSelectedVerbIds] = useState(new Set());
  const [selectedTenses, setSelectedTenses] = useState(DEFAULT_TENSES);
  const [selectedSubjects, setSelectedSubjects] = useState(DEFAULT_SUBJECTS);
  const [title, setTitle] = useState('Verb Vault Export');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    getCachedBucketedCollection('verbs')
      .then((list) => setVerbs(list.sort((a, b) => (a.palabra || '').localeCompare(b.palabra || ''))))
      .catch((err) => console.error('Error loading verbs:', err))
      .finally(() => setLoading(false));
  }, []);

  const allKnownTags = useMemo(() => {
    const set = new Set();
    verbs.forEach((v) => (v.tags || []).forEach((t) => set.add(t)));
    return [...set].sort();
  }, [verbs]);

  const filteredVerbs = useMemo(
    () =>
      verbs.filter(
        (v) =>
          (v.palabra || '').toLowerCase().includes(search.toLowerCase()) &&
          (!tagFilter || (v.tags || []).includes(tagFilter))
      ),
    [verbs, search, tagFilter]
  );

  const toggleVerb = (id) => {
    setSelectedVerbIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedVerbIds((prev) => new Set([...prev, ...filteredVerbs.map((v) => v.id)]));
  };

  const clearSelection = () => setSelectedVerbIds(new Set());

  const toggleInSet = (setter) => (id) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedVerbs = useMemo(() => verbs.filter((v) => selectedVerbIds.has(v.id)), [verbs, selectedVerbIds]);

  const previewQuestions = useMemo(
    () =>
      buildVerbConjugationQuestions({
        verbs: selectedVerbs,
        tenseIds: [...selectedTenses],
        subjectIds: [...selectedSubjects],
        tenseLabels: TENSE_LABELS,
        subjectLabels: SUBJECT_LABELS,
      }),
    [selectedVerbs, selectedTenses, selectedSubjects]
  );

  const partCount = Math.ceil(previewQuestions.length / MAX_QUESTIONS_PER_FILE) || 0;

  const handleExport = async () => {
    if (previewQuestions.length === 0) return;
    setExporting(true);
    try {
      const safeFilename = (title || 'verb-export').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'verb-export';
      const chunks = [];
      for (let i = 0; i < previewQuestions.length; i += MAX_QUESTIONS_PER_FILE) {
        chunks.push(previewQuestions.slice(i, i + MAX_QUESTIONS_PER_FILE));
      }
      for (let i = 0; i < chunks.length; i++) {
        const partLabel = chunks.length > 1 ? ` — Parte ${i + 1} de ${chunks.length}` : '';
        const blob = await buildBlackboardPoolZip({ title: `${title}${partLabel}`, questions: chunks[i] });
        const filenamePart = chunks.length > 1 ? `-parte-${i + 1}-de-${chunks.length}` : '';
        triggerZipDownload(blob, `${safeFilename}${filenamePart}.zip`);
        // A short gap between downloads — triggering several at once in a
        // tight loop can make the browser silently block all but the first.
        if (i < chunks.length - 1) await new Promise((resolve) => setTimeout(resolve, 400));
      }
    } catch (err) {
      console.error('Error building Schoology export:', err);
      alert('Error al generar el archivo. Revisa la consola.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
            <span>📤</span> Exportar a Schoology
          </h2>
          <Link
            to="/admin-secret-portal-verb-editor"
            className="text-slate-400 hover:text-white text-xs font-bold border border-slate-700 px-3 py-1.5 rounded-lg"
          >
            ← Editor de Verbos
          </Link>
        </div>

        <p className="text-sm text-slate-400 max-w-3xl">
          Genera un archivo .zip (formato Blackboard Pool) con preguntas de "completar el espacio" a partir de las
          conjugaciones del Verbo Vault. En Schoology: Resources → el menú junto a "My Resources" → Import → elige
          "Blackboard (ZIP)" → sube este archivo. Luego usa "Opciones → Agregar preguntas al banco" para convertirlo
          en un Item Bank reutilizable.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6">
          {/* VERB PICKER */}
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar verbo..."
                className="flex-1 min-w-[160px] bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-sm focus:outline-none focus:border-amber-500"
              />
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-sm"
              >
                <option value="">Todas las etiquetas</option>
                {allKnownTags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={selectAllFiltered}
                className="text-[11px] font-bold text-amber-400 hover:text-amber-300 underline"
              >
                Seleccionar {filteredVerbs.length} visibles
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="text-[11px] font-bold text-slate-400 hover:text-slate-300 underline"
              >
                Limpiar selección
              </button>
            </div>

            {loading ? (
              <p className="text-slate-500 text-sm italic">Cargando...</p>
            ) : (
              <div className="max-h-[50vh] overflow-y-auto space-y-1">
                {filteredVerbs.map((v) => (
                  <label
                    key={v.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedVerbIds.has(v.id)}
                      onChange={() => toggleVerb(v.id)}
                      className="rounded text-amber-500"
                    />
                    {v.palabra}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* OPTIONS + EXPORT */}
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Tiempos</h3>
              <div className="flex flex-wrap gap-2">
                {VERB_TENSES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleInSet(setSelectedTenses)(t.id)}
                    className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-colors ${
                      selectedTenses.has(t.id)
                        ? 'bg-amber-500 border-amber-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Sujetos</h3>
              <div className="flex flex-wrap gap-2">
                {VERB_SUBJECTS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleInSet(setSelectedSubjects)(s.id)}
                    className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-colors ${
                      selectedSubjects.has(s.id)
                        ? 'bg-amber-500 border-amber-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Título del Pool</h3>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3">
              <p className="text-sm text-slate-300">
                <span className="font-black text-white">{selectedVerbs.length}</span> verbo
                {selectedVerbs.length === 1 ? '' : 's'} seleccionado{selectedVerbs.length === 1 ? '' : 's'}
              </p>
              <p className="text-sm text-slate-300">
                <span className="font-black text-white">{previewQuestions.length}</span> pregunta
                {previewQuestions.length === 1 ? '' : 's'} se generarían
              </p>
              {partCount > 1 && (
                <p className="text-xs text-amber-400">
                  Schoology limita un Test/Quiz (el paso intermedio antes del banco) a 200 preguntas, así que esto se
                  descargará en <span className="font-black">{partCount} archivos</span> de hasta {MAX_QUESTIONS_PER_FILE}{' '}
                  cada uno. Importa y "agrega al banco" cada uno por separado, en el mismo banco.
                </p>
              )}
              <button
                type="button"
                onClick={handleExport}
                disabled={previewQuestions.length === 0 || exporting}
                className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest text-xs py-3 rounded-lg transition-colors"
              >
                {exporting ? 'Generando...' : '📤 Descargar para Schoology'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
