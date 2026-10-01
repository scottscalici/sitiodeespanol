import { useState, useMemo } from 'react';
import { wordIntroSegmentCount, generatePodsForSections } from '../../utils/podGenerator';
import { QUESTION_TYPE_DEFAULTS, QUESTION_TYPE_LABELS, QUESTION_TYPE_ORDER, sumMix } from '../../utils/questionTypes';

// Builds a "Nivel N: word-intro" + "Nivel N+1: boss battle" pod pair for
// each chosen vocab section in the currently-selected chapter — see
// podGenerator.js for the actual pattern. Generated pods are appended to
// whatever's already in the path, never replacing existing pods, so this
// is safe to run more than once (e.g. adding a chapter's remaining
// sections after already generating a few).
export default function VocabPodGeneratorModal({ rawChapterData, availableSections, selectedChapter, existingPodCount, onGenerate, onClose }) {
  const [checkedSections, setCheckedSections] = useState(() => new Set(availableSections));
  // Every intro segment gets this same mix; boss segments ignore the mix at
  // runtime (a speed round always drills plain recall) so only their
  // question COUNT is editable, same split PathBuilder's own per-segment
  // editor uses for a hand-made speed-round segment.
  const [introMix, setIntroMix] = useState({ ...QUESTION_TYPE_DEFAULTS });
  const [bossTotalQuestions, setBossTotalQuestions] = useState(sumMix(QUESTION_TYPE_DEFAULTS));

  const sectionInfo = useMemo(() => {
    return availableSections.map((section) => {
      const words = (rawChapterData?.words || []).filter((w) => w.metadata?.secciones?.includes(section));
      return { section, words, segmentCount: wordIntroSegmentCount(words.length) };
    });
  }, [availableSections, rawChapterData]);

  const toggleSection = (section) => {
    setCheckedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const updateIntroMix = (type, value) => {
    setIntroMix((prev) => ({ ...prev, [type]: Math.max(0, Number(value) || 0) }));
  };

  const introTotal = sumMix(introMix);
  const typeLabels = QUESTION_TYPE_LABELS.vocab;

  const selectedCount = sectionInfo.filter((s) => checkedSections.has(s.section)).length;
  const totalNewPods = selectedCount * 2;

  const handleGenerate = () => {
    const chosen = sectionInfo.filter((s) => checkedSections.has(s.section) && s.words.length > 0);
    if (chosen.length === 0) return;
    const newPods = generatePodsForSections(
      chosen.map(({ section, words }) => ({ section, words })),
      existingPodCount,
      { introQuestionMix: introMix, bossTotalQuestions }
    );
    onGenerate(newPods);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col border border-slate-200">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-black text-slate-800">🪄 Generar Pods desde Vocabulario</h3>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">Capítulo {selectedChapter || '—'}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3">
            <p className="text-[10px] font-black text-blue-800 uppercase mb-2">Preguntas por segmento (Palabras Nuevas)</p>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {QUESTION_TYPE_ORDER.map((type) => (
                <div key={type}>
                  <label className="block text-[9px] font-black text-blue-800 uppercase mb-1 truncate" title={typeLabels[type]}>
                    {typeLabels[type]}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={introMix[type] ?? 0}
                    onChange={(e) => updateIntroMix(type, e.target.value)}
                    className="w-full border border-blue-200 rounded-md p-1.5 text-xs font-bold focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
              ))}
            </div>
            <p className="text-[10px] text-blue-700 font-semibold mt-2">{introTotal} preguntas por segmento de Palabras Nuevas</p>
          </div>

          <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black text-rose-800 uppercase">Preguntas por Batalla Final</p>
              <p className="text-[10px] text-rose-700 italic mt-0.5">Un reto de velocidad siempre usa recordatorio rápido — no usa la mezcla de arriba.</p>
            </div>
            <input
              type="number"
              min="1"
              value={bossTotalQuestions}
              onChange={(e) => setBossTotalQuestions(Math.max(1, Number(e.target.value) || 1))}
              className="w-20 border border-rose-200 rounded-md p-1.5 text-xs font-bold focus:ring-1 focus:ring-rose-500 outline-none bg-white shrink-0"
            />
          </div>

          <div className="space-y-2">
            {sectionInfo.length === 0 && (
              <p className="text-sm text-slate-400 italic text-center py-8">
                No hay secciones de vocabulario cargadas para este capítulo.
              </p>
            )}
            {sectionInfo.map(({ section, words, segmentCount }) => (
              <label
                key={section}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={checkedSections.has(section)}
                    onChange={() => toggleSection(section)}
                    disabled={words.length === 0}
                  />
                  <span className="font-bold text-slate-800">Sección {section}</span>
                </span>
                <span className="text-xs text-slate-500 font-semibold">
                  {words.length === 0
                    ? 'sin palabras'
                    : `${words.length} palabras → ${segmentCount} segmentos (${introTotal}p c/u) + 2 batallas (${bossTotalQuestions}p c/u)`}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 flex items-center justify-between gap-3">
          <p className="text-xs font-bold text-slate-500">
            {selectedCount} sección(es) seleccionada(s) → {totalNewPods} pods nuevos
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100">
              Cancelar
            </button>
            <button
              onClick={handleGenerate}
              disabled={selectedCount === 0}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Generar {totalNewPods > 0 ? `(${totalNewPods} pods)` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
