import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCachedCollection, getCachedBucketedCollection } from '../../utils/firestoreCache';
import { VERB_TENSES, VERB_SUBJECTS } from '../../utils/verbTenses';
import { generateVerbQuestions } from '../../utils/verbQuestionGenerator';
import { buildBlackboardPoolZip, triggerZipDownload } from '../../utils/exportToSchoology';

const TENSE_LABELS = Object.fromEntries(VERB_TENSES.map((t) => [t.id, t.label]));

// Schoology caps a Test/Quiz (and the newer Assessment object) at 200
// questions — but importing a Blackboard Pool zip always lands as a
// Test/Quiz FIRST, even though the actual destination only comes after a
// later "add questions to bank" step. Staying safely under that
// intermediate limit avoids finding out the hard way whether a bulk XML
// import enforces it the same as adding questions by hand.
const MAX_QUESTIONS_PER_FILE = 150;

export default function VerbSchoologyExport() {
  const [verbGroups, setVerbGroups] = useState([]);
  const [masterVerbsMap, setMasterVerbsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [configBlocks, setConfigBlocks] = useState([]);
  const [includeVosotros, setIncludeVosotros] = useState(false);
  const [previewQuestions, setPreviewQuestions] = useState([]);
  const [title, setTitle] = useState('Quiz de Recuperación');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    Promise.all([getCachedCollection('verbGroups'), getCachedBucketedCollection('verbs')])
      .then(([groups, verbsArray]) => {
        setVerbGroups(groups);
        const verbsMap = {};
        verbsArray.forEach((v) => {
          verbsMap[v.id] = v;
        });
        setMasterVerbsMap(verbsMap);
      })
      .catch((err) => console.error('Error loading verb groups/verbs:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleGroupSelect = (groupId) => {
    const found = verbGroups.find((g) => g.id === groupId);
    if (found) {
      setConfigBlocks((prev) => [
        ...prev,
        {
          label: found.name,
          tense: 'presente',
          allowedVerbs: found.verbIds || [],
          count: 5,
          specificVerb: 'any',
          targetSubject: 'any',
        },
      ]);
    }
    // Reset to the placeholder so picking the SAME group again still fires
    // a change event — a plain <select> doesn't fire onChange when you
    // choose the option it's already showing.
    setSelectedGroup('');
  };

  const updateBlockConfig = (index, field, value) => {
    setConfigBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, [field]: value } : b)));
  };

  const removeBlockConfig = (index) => {
    setConfigBlocks((prev) => prev.filter((_, i) => i !== index));
  };

  const totalRequestedCount = useMemo(() => configBlocks.reduce((sum, b) => sum + (Number(b.count) || 0), 0), [configBlocks]);

  const handlePreview = () => {
    setPreviewQuestions(generateVerbQuestions(configBlocks, masterVerbsMap, { includeVosotros }));
  };

  const partCount = Math.ceil(previewQuestions.length / MAX_QUESTIONS_PER_FILE) || 0;

  const handleExport = async () => {
    if (previewQuestions.length === 0) return;
    setExporting(true);
    try {
      const questions = previewQuestions.map((q, i) => ({
        id: `q${i + 1}`,
        prompt: `${q.palabra} (${q.sujeto}) - ${TENSE_LABELS[q.tense] || q.tense}`,
        answers: [q.forma],
      }));

      // Strip accents BEFORE collapsing non-alphanumerics, so "Recuperación"
      // becomes "recuperacion" instead of splitting on the "ó" into
      // "recuperaci-n".
      const safeFilename =
        (title || 'quiz-recuperacion')
          .trim()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'quiz-recuperacion';
      const chunks = [];
      for (let i = 0; i < questions.length; i += MAX_QUESTIONS_PER_FILE) {
        chunks.push(questions.slice(i, i + MAX_QUESTIONS_PER_FILE));
      }
      for (let i = 0; i < chunks.length; i++) {
        const partLabel = chunks.length > 1 ? ` — Parte ${i + 1} de ${chunks.length}` : '';
        const blob = await buildBlackboardPoolZip({ title: `${title}${partLabel}`, questions: chunks[i] });
        const filenamePart = chunks.length > 1 ? `-parte-${i + 1}-de-${chunks.length}` : '';
        triggerZipDownload(blob, `${safeFilename}${filenamePart}.zip`);
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
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
            <span>📤</span> Quiz de Recuperación para Schoology
          </h2>
          <Link
            to="/admin-secret-portal-verb-editor"
            className="text-slate-400 hover:text-white text-xs font-bold border border-slate-700 px-3 py-1.5 rounded-lg"
          >
            ← Editor de Verbos
          </Link>
        </div>

        <p className="text-sm text-slate-400 max-w-3xl">
          Igual que un Calentamiento: elige uno o más grupos de verbos, cuántas preguntas sacar de cada uno y de qué
          tiempo — cada verbo se sortea al azar dentro de su grupo. Genera una vista previa, y si quieres una versión
          distinta simplemente vuelve a generarla. El archivo resultante se importa en Schoology (Resources → el menú
          junto a "My Resources" → Import → "Blackboard (ZIP)") como una Test/Quiz lista para asignar.
        </p>

        {/* BLOCK BUILDER */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end justify-between">
            <div className="max-w-md flex-1">
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Añadir Grupo de Verbos</label>
              <select
                value={selectedGroup}
                onChange={(e) => handleGroupSelect(e.target.value)}
                disabled={loading}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-sm focus:outline-none focus:border-amber-500"
              >
                <option value="">{loading ? 'Cargando grupos...' : '-- Selecciona un Grupo --'}</option>
                {verbGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.verbIds?.length || 0} verbos)
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer bg-slate-800 px-3 py-2.5 rounded-lg border border-slate-700">
              <input
                type="checkbox"
                checked={includeVosotros}
                onChange={(e) => setIncludeVosotros(e.target.checked)}
                className="rounded text-amber-500"
              />
              Incluir "Vosotros"
            </label>
          </div>

          {configBlocks.length === 0 ? (
            <p className="text-slate-500 text-xs italic">Añade un grupo arriba para empezar a configurar bloques.</p>
          ) : (
            <div className="space-y-3">
              {configBlocks.map((block, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-slate-800 rounded-xl border border-slate-700 grid grid-cols-1 sm:grid-cols-6 gap-3 items-center"
                >
                  <div>
                    <p className="text-xs font-black text-white">{block.label}</p>
                    <p className="text-[10px] text-slate-400">{block.allowedVerbs.length} verbo(s)</p>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Tiempo</label>
                    <select
                      value={block.tense}
                      onChange={(e) => updateBlockConfig(idx, 'tense', e.target.value)}
                      className="w-full p-1.5 bg-slate-900 border border-slate-700 text-white rounded-lg text-xs"
                    >
                      {VERB_TENSES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      value={block.count}
                      onChange={(e) => updateBlockConfig(idx, 'count', Number(e.target.value))}
                      className="w-full p-1.5 bg-slate-900 border border-slate-700 text-white rounded-lg text-xs text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Verbo Específico</label>
                    <select
                      value={block.specificVerb}
                      onChange={(e) => updateBlockConfig(idx, 'specificVerb', e.target.value)}
                      className="w-full p-1.5 bg-slate-900 border border-slate-700 text-white rounded-lg text-xs"
                    >
                      <option value="any">Cualquiera</option>
                      {block.allowedVerbs.map((vId) => (
                        <option key={vId} value={masterVerbsMap[vId]?.palabra || vId}>
                          {masterVerbsMap[vId]?.palabra || vId}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Sujeto</label>
                    <select
                      value={block.targetSubject}
                      onChange={(e) => updateBlockConfig(idx, 'targetSubject', e.target.value)}
                      className="w-full p-1.5 bg-slate-900 border border-slate-700 text-white rounded-lg text-xs"
                    >
                      <option value="any">Mix (70/30 Singulares)</option>
                      {VERB_SUBJECTS.filter((s) => s.id !== 'vosotros' || includeVosotros).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeBlockConfig(idx)}
                      className="p-2 text-rose-400 hover:text-rose-300 font-bold text-sm"
                      title="Eliminar bloque"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {configBlocks.length > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-xs font-bold text-slate-400">Total solicitado: {totalRequestedCount} preguntas</span>
              <button
                type="button"
                onClick={handlePreview}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl text-xs uppercase tracking-wider"
              >
                👁️ Generar Vista Previa Aleatoria
              </button>
            </div>
          )}
        </div>

        {/* PREVIEW */}
        {previewQuestions.length > 0 && (
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-[11px] font-black text-amber-400 uppercase tracking-widest">
                Vista Previa ({previewQuestions.length})
              </h3>
              <button
                type="button"
                onClick={handlePreview}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 underline"
              >
                🔀 Generar otra versión
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
              {previewQuestions.map((q, i) => (
                <div key={i} className="p-2.5 bg-slate-800 border border-slate-700 rounded-lg text-xs">
                  <p className="text-slate-400">
                    {q.palabra} ({q.sujeto}) - {TENSE_LABELS[q.tense] || q.tense}
                  </p>
                  <p className="text-emerald-400 font-bold">{q.forma}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EXPORT */}
        {previewQuestions.length > 0 && (
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3">
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Título del Quiz</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            {partCount > 1 && (
              <p className="text-xs text-amber-400">
                Esto se descargará en <span className="font-black">{partCount} archivos</span> de hasta{' '}
                {MAX_QUESTIONS_PER_FILE} cada uno, por el límite de 200 preguntas de Schoology en el Test/Quiz
                intermedio.
              </p>
            )}
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-black uppercase tracking-widest text-xs py-3 rounded-lg transition-colors"
            >
              {exporting ? 'Generando...' : '📤 Descargar para Schoology'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
