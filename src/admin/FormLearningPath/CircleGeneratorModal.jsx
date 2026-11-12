import { useState, useMemo } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { invalidateCollectionCache } from '../../utils/firestoreCache';
import { toConcept } from '../../utils/podGenerator';
import { isReferenceSection } from '../../utils/vocabSectionLabel';

// Same deterministic id convention as ChapterLearningPathImporter.jsx, so
// a circle created there and one created here never collide, and
// re-running this generator for an already-circled section is a safe
// no-op rather than a duplicate or an overwrite.
const slugSection = (section) => `circulo_${section.replace(/[^a-zA-Z0-9]+/g, '_')}`;

// Mirrors ChapterLearningPathImporter.jsx's own GATE_CONFIG_DEFAULT /
// REASSESSMENT_VOCAB_COUNT / REASSESSMENT_TIME_LIMIT_SECONDS — keep both
// in sync if either ever changes; duplicated rather than imported since
// one lives in admin/uploaders (a one-pass JSON tool) and this lives in
// admin/FormLearningPath (the interactive path/circle builder).
const GATE_CONFIG_DEFAULT = { questionCount: 50, timeLimitSeconds: 300, passThreshold: 90 };
const REASSESSMENT_VOCAB_COUNT = 10;
const REASSESSMENT_TIME_LIMIT_SECONDS = 300;

// All-escribir (plain recall), one question per word, no time limit —
// isSpeedRound: false makes `timeLimit` inert (see WorkoutEngine.jsx:
// the countdown only ever runs for a speed round), so this is already an
// untimed circle regardless of the timeLimit value kept here for parity
// with existing circles. evalLink is filled in by the caller once a
// section's evaluación día/etiqueta have been validated.
const buildCirclePod = (podId, section, words) => {
  const concepts = words.map((w) => toConcept(w, section));
  return {
    id: podId,
    title: `Sección ${section}`,
    isExpanded: true,
    badgeAward: null,
    evalLink: null,
    gateConfig: { ...GATE_CONFIG_DEFAULT },
    isBonus: false,
    segments: [
      {
        id: `seg_${podId}`,
        total_questions: concepts.length,
        questionMix: { recall: concepts.length, mc: 0, matching: 0, listen: 0, speak: 0, sentence: 0 },
        isSpeedRound: false,
        timeLimit: 120,
        introduced_concepts: concepts,
        pinned_sentences: [],
        masteryThreshold: null,
        speakingOnly: false,
      },
    ],
  };
};

// Generates a practice circle (one pod, full word coverage, all-escribir,
// untimed) PLUS its reassessment config doc, per chosen vocab section —
// writes directly to Firestore itself (unlike VocabPodGeneratorModal,
// which only ever hands pods back for the surrounding form to save
// later), since a circle without its reassessment config half-wired in
// would leave the recuperación flow broken; generating and saving as one
// atomic action avoids ever having one half without the other.
export default function CircleGeneratorModal({ rawChapterData, availableSections, selectedChapter, course, pathId, evaluacionOptions, onDone, onClose }) {
  const gradableSections = useMemo(() => availableSections.filter((s) => !isReferenceSection(s)), [availableSections]);
  const [checkedSections, setCheckedSections] = useState(() => new Set(gradableSections));
  const [evalInputs, setEvalInputs] = useState({}); // { [section]: { dia: '', label: '' } }
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState('');

  const sectionInfo = useMemo(() => {
    return gradableSections.map((section) => {
      const words = (rawChapterData?.words || []).filter((w) => w.metadata?.secciones?.includes(section));
      return { section, words };
    });
  }, [gradableSections, rawChapterData]);

  const toggleSection = (section) => {
    setCheckedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const updateEvalInput = (section, field, value) => {
    setEvalInputs((prev) => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
  };

  const chosen = sectionInfo.filter((s) => checkedSections.has(s.section) && s.words.length > 0);

  const handleGenerate = async () => {
    setStatus('');
    if (!pathId) {
      setStatus('❌ Asigna un Path ID a este círculo antes de generar.');
      return;
    }
    if (chosen.length === 0) return;

    // Validate every chosen section's evaluación before writing anything —
    // same día+etiqueta match ChapterLearningPathImporter.jsx requires,
    // since evalLink points at a real entry in the Evaluaciones Sequencer.
    for (const s of chosen) {
      const input = evalInputs[s.section] || {};
      const dia = Number(input.dia);
      if (!dia || !input.label?.trim()) {
        setStatus(`❌ Sección ${s.section}: falta el día o la etiqueta de evaluación.`);
        return;
      }
      const match = evaluacionOptions.find((o) => o.dia === dia);
      if (!match) {
        setStatus(`❌ Sección ${s.section}: no hay evaluación en el día ${dia} para ${course} en el Secuenciador de Evaluaciones.`);
        return;
      }
      if (match.label !== input.label.trim()) {
        setStatus(`❌ Sección ${s.section}: el día ${dia} ya existe pero su etiqueta real es "${match.label}".`);
        return;
      }
    }

    setGenerating(true);
    try {
      const snap = await getDoc(doc(db, 'practice_pods', pathId));
      const existing = snap.exists() ? snap.data() : null;
      const existingPods = existing?.pods || [];
      const existingIds = new Set(existingPods.map((p) => p.id));

      const newPods = [];
      const newConfigs = [];
      chosen.forEach((s) => {
        const podId = slugSection(s.section);
        if (existingIds.has(podId)) return; // already has a circle — never touched or duplicated
        const input = evalInputs[s.section];
        const pod = buildCirclePod(podId, s.section, s.words);
        pod.evalLink = { dia: Number(input.dia), label: input.label.trim() };
        newPods.push(pod);
        newConfigs.push({
          circleId: `${pathId}__${podId}`,
          course,
          evalLabel: input.label.trim(),
          groups: [],
          sentenceBlocks: [],
          vocabBlocks: [{ label: s.section, section: s.section, count: REASSESSMENT_VOCAB_COUNT }],
          timeLimitSeconds: REASSESSMENT_TIME_LIMIT_SECONDS,
          updatedAt: new Date().toISOString(),
        });
      });

      if (newPods.length === 0) {
        setStatus('Nada nuevo — todas las secciones elegidas ya tenían un círculo.');
        setGenerating(false);
        return;
      }

      await setDoc(
        doc(db, 'practice_pods', pathId),
        {
          path_id: pathId,
          title: existing?.title || `Capítulo ${selectedChapter} — Círculos de Práctica`,
          course,
          contentType: 'vocab',
          total_pods: existingPods.length + newPods.length,
          updated_at: new Date().toISOString(),
          pods: [...existingPods, ...newPods],
        },
        { merge: true }
      );

      await Promise.all(newConfigs.map((cfg) => setDoc(doc(db, 'reassessment_configs', cfg.circleId), cfg, { merge: true })));

      invalidateCollectionCache('practice_pods');
      setStatus(`✅ ${newPods.length} círculo(s) creado(s), con su recuperación ya configurada.`);
      onDone?.();
    } catch (err) {
      console.error('Error generating circles:', err);
      setStatus(`❌ Error: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col border border-slate-200">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-black text-slate-800">🪄 Generar Círculos desde Vocabulario</h3>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">Capítulo {selectedChapter || '—'}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          <p className="text-xs text-slate-500">
            Un círculo por sección: todas las palabras, una vez cada una, puro escribir, sin límite de tiempo —
            más su recuperación ya configurada (90% de 50 preguntas en 300 segundos).
          </p>
          {!pathId && <p className="text-xs font-bold text-rose-600">⚠️ Asigna un Path ID arriba antes de generar.</p>}

          {sectionInfo.length === 0 && (
            <p className="text-sm text-slate-400 italic text-center py-8">No hay secciones de vocabulario cargadas para este capítulo.</p>
          )}

          {sectionInfo.map(({ section, words }) => (
            <div key={section} className="p-3 rounded-xl border border-slate-200 space-y-2">
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="flex items-center gap-3">
                  <input type="checkbox" checked={checkedSections.has(section)} onChange={() => toggleSection(section)} disabled={words.length === 0} />
                  <span className="font-bold text-slate-800">{isReferenceSection(section) ? 'Referencias' : `Sección ${section}`}</span>
                </span>
                <span className="text-xs text-slate-500 font-semibold">
                  {words.length === 0 ? 'sin palabras' : `${words.length} palabras → ${words.length} preguntas`}
                </span>
              </label>
              {checkedSections.has(section) && words.length > 0 && (
                <div className="grid grid-cols-2 gap-2 pl-7">
                  <input
                    type="number"
                    placeholder="Día de evaluación"
                    value={evalInputs[section]?.dia || ''}
                    onChange={(e) => updateEvalInput(section, 'dia', e.target.value)}
                    className="border border-slate-300 rounded-md p-1.5 text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Etiqueta de evaluación"
                    value={evalInputs[section]?.label || ''}
                    onChange={(e) => updateEvalInput(section, 'label', e.target.value)}
                    className="border border-slate-300 rounded-md p-1.5 text-xs font-bold focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
              )}
            </div>
          ))}

          {status && <p className={`text-xs font-bold ${status.startsWith('❌') ? 'text-rose-600' : 'text-emerald-600'}`}>{status}</p>}
        </div>

        <div className="p-5 border-t border-slate-100 flex items-center justify-between gap-3">
          <p className="text-xs font-bold text-slate-500">{chosen.length} sección(es) seleccionada(s)</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100">
              Cerrar
            </button>
            <button
              onClick={handleGenerate}
              disabled={chosen.length === 0 || generating || !pathId}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {generating ? 'Generando...' : `Generar (${chosen.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
