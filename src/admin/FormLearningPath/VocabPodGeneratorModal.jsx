import { useState, useMemo } from 'react';
import { wordIntroSegmentCount, generatePodsForSections } from '../../utils/podGenerator';

// Builds a "Nivel N: word-intro" + "Nivel N+1: boss battle" pod pair for
// each chosen vocab section in the currently-selected chapter — see
// podGenerator.js for the actual pattern. Generated pods are appended to
// whatever's already in the path, never replacing existing pods, so this
// is safe to run more than once (e.g. adding a chapter's remaining
// sections after already generating a few).
export default function VocabPodGeneratorModal({ rawChapterData, availableSections, selectedChapter, existingPodCount, onGenerate, onClose }) {
  const [checkedSections, setCheckedSections] = useState(() => new Set(availableSections));

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

  const selectedCount = sectionInfo.filter((s) => checkedSections.has(s.section)).length;
  const totalNewPods = selectedCount * 2;

  const handleGenerate = () => {
    const chosen = sectionInfo.filter((s) => checkedSections.has(s.section) && s.words.length > 0);
    if (chosen.length === 0) return;
    const newPods = generatePodsForSections(
      chosen.map(({ section, words }) => ({ section, words })),
      existingPodCount
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

        <div className="p-5 overflow-y-auto flex-1 space-y-2">
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
                  : `${words.length} palabras → ${segmentCount} segmentos + 2 batallas`}
              </span>
            </label>
          ))}
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
