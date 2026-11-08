import { useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getCachedCollection, invalidateCollectionCache } from '../../utils/firestoreCache';
import { fetchEvaluacionOptions } from '../../utils/evaluaciones';

// One-pass chapter importer: given just a course/textbook/chapter and a list
// of sections ({section, evalDia, evalLabel}), builds everything a vocab
// chapter needs across four collections — a Learning Path pod (graded, fixed
// 15-question mix) and a Practice Hub circle (all-escribir, full word
// coverage, gate + evalLink) per section, plus one reassessment_configs doc
// per circle — without the teacher re-entering any vocab or sentence
// content. Vocab/sentences are pulled live from `vocabulary`
// (metadata.secciones) and `sentence_bank` ("Sección X.X" grammarTags) —
// the exact same section tagging those collections already use elsewhere
// (FormLearningPath's own vault picker, the vocab-sentences-bulk skill) —
// and evaluaciones are only ever VALIDATED against
// curriculum_tracks/evaluaciones_master, never created/overwritten there
// (Scott's own Evaluaciones Sequencer already owns that data).
//
// Re-running this importer for the same pathId only ever APPENDS sections
// that aren't already present (matched by a deterministic pod id derived
// from the section string) — an already-imported section is reported as
// skipped, never touched or overwritten, so adding "2.3" later to an
// existing chapter is safe.

const slugSection = (section) => `circulo_${section.replace(/[^a-zA-Z0-9]+/g, '_')}`;

const LEARNING_PATH_QUESTION_MIX = { recall: 5, mc: 3, matching: 2, listen: 0, speak: 0, sentence: 5 };
const LEARNING_PATH_TOTAL = Object.values(LEARNING_PATH_QUESTION_MIX).reduce((a, b) => a + b, 0);
const GATE_CONFIG_DEFAULT = { questionCount: 50, timeLimitSeconds: 300, passThreshold: 90 };
const REASSESSMENT_VOCAB_COUNT = 10;
const REASSESSMENT_TIME_LIMIT_SECONDS = 300;

const PLACEHOLDER = `{
  "course": "s2",
  "textbook": "Descubre 2",
  "chapter": "2",
  "pathId": "s2_descubre2_cap2",
  "sections": [
    { "section": "2.1", "evalDia": 23, "evalLabel": "Vocabulario 2.1 (prueba)" },
    { "section": "2.2", "evalDia": 25, "evalLabel": "Vocabulario 2.2 (prueba)" }
  ]
}`;

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

const buildConcept = (v, section) => ({
  id: v.id || v.palabra,
  label: v.palabra,
  translation: v.traduccion,
  tags: section,
  fullData: v,
});

const buildPinnedSentence = (s) => ({
  id: s.id,
  label: s.spanish,
  chapterId: s.chapterId || '',
  grammarTags: s.grammarTags || [],
  distractorGroup: s.distractorGroup || '',
  distractorExclude: s.distractorExclude || [],
  altAnswers: s.altAnswers || [],
  fullData: s,
});

// A "Sección X.X" tag alone isn't unique — section numbering restarts per
// chapter regardless of textbook/course, so a different book's own chapter
// 2 section 1 can carry the identical "Sección 2.1" tag. The
// vocab-sentences-bulk skill always tags the textbook name as its own
// separate entry in the same array (per its SKILL.md), so requiring BOTH
// tags is what actually scopes a sentence to this specific chapter.
const matchesSentenceSection = (s, textbook, section) =>
  (s.grammarTags || []).includes(textbook) && (s.grammarTags || []).includes(`Sección ${section}`);

const findPinnedSentences = (sentenceBank, textbook, section) =>
  sentenceBank.filter((s) => matchesSentenceSection(s, textbook, section)).map(buildPinnedSentence);

export default function ChapterLearningPathImporter() {
  const [jsonText, setJsonText] = useState('');
  const [validating, setValidating] = useState(false);
  const [parseError, setParseError] = useState('');
  const [report, setReport] = useState(null); // { input, sections: [...], hardErrorCount }
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');

  const validate = async () => {
    setParseError('');
    setReport(null);
    setImportStatus('');

    let input;
    try {
      input = JSON.parse(jsonText);
    } catch (err) {
      setParseError(`JSON inválido: ${err.message}`);
      return;
    }

    const topErrors = [];
    if (!['s2', 's4'].includes(input.course)) topErrors.push('"course" debe ser "s2" o "s4".');
    if (!isNonEmptyString(input.textbook)) topErrors.push('Falta "textbook".');
    if (!isNonEmptyString(input.chapter)) topErrors.push('Falta "chapter".');
    if (!isNonEmptyString(input.pathId)) topErrors.push('Falta "pathId".');
    if (!Array.isArray(input.sections) || input.sections.length === 0) topErrors.push('"sections" debe ser un array con al menos una sección.');
    if (topErrors.length > 0) {
      setParseError(topErrors.join(' '));
      return;
    }

    setValidating(true);
    try {
      const [vocabulary, sentenceBank, evalOptions, pathSnap, circleSnap] = await Promise.all([
        getCachedCollection('vocabulary'),
        getCachedCollection('sentence_bank'),
        fetchEvaluacionOptions(input.course),
        getDoc(doc(db, 'learning_paths', input.pathId)),
        getDoc(doc(db, 'practice_pods', input.pathId)),
      ]);

      const existingLearningPods = pathSnap.exists() ? pathSnap.data().pods || [] : [];
      const existingCirclePods = circleSnap.exists() ? circleSnap.data().pods || [] : [];
      const existingPodIds = new Set([...existingLearningPods.map((p) => p.id), ...existingCirclePods.map((p) => p.id)]);

      const sectionReports = [];
      for (const [idx, sec] of input.sections.entries()) {
        const tag = `Sección ${idx + 1}`;
        if (!isNonEmptyString(sec.section) || typeof sec.evalDia !== 'number' || !isNonEmptyString(sec.evalLabel)) {
          sectionReports.push({ status: 'error', section: sec.section || '?', reason: `${tag}: necesita "section" (texto), "evalDia" (número) y "evalLabel" (texto).` });
          continue;
        }

        const podId = slugSection(sec.section);
        if (existingPodIds.has(podId)) {
          // Already imported — never touch the pod itself, but DO check
          // whether its pinned_sentences match what the (correctly scoped)
          // query would produce today, so a section imported before the
          // textbook-scoping fix (or before real sentences existed yet) can
          // be repaired without re-importing the whole section.
          const existingPod = existingLearningPods.find((p) => p.id === podId);
          const currentSentences = existingPod?.segments?.[0]?.pinned_sentences || [];
          const correctSentences = findPinnedSentences(sentenceBank, input.textbook, sec.section);
          const currentIds = new Set(currentSentences.map((p) => p.id));
          const correctIds = new Set(correctSentences.map((p) => p.id));
          const sentencesMatch = currentIds.size === correctIds.size && [...currentIds].every((id) => correctIds.has(id));
          sectionReports.push({
            status: 'skip',
            section: sec.section,
            podId,
            reason: 'Ya existe — no se toca.',
            needsSentenceRepair: !!existingPod && !sentencesMatch,
            currentSentenceCount: currentIds.size,
            correctSentenceCount: correctIds.size,
            correctSentences,
          });
          continue;
        }

        const evalEntry = evalOptions.find((o) => o.dia === sec.evalDia);
        if (!evalEntry) {
          sectionReports.push({ status: 'error', section: sec.section, reason: `No hay ninguna evaluación en el día ${sec.evalDia} para ${input.course} en el Secuenciador de Evaluaciones.` });
          continue;
        }
        if (evalEntry.label !== sec.evalLabel) {
          sectionReports.push({
            status: 'error',
            section: sec.section,
            reason: `El día ${sec.evalDia} ya existe pero su etiqueta real es "${evalEntry.label}", no "${sec.evalLabel}" — corrige el JSON para que coincida exactamente.`,
          });
          continue;
        }

        const conceptList = vocabulary
          .filter((v) => (v.metadata?.secciones || []).includes(sec.section) && v.metadata?.textbook === input.textbook)
          .map((v) => buildConcept(v, sec.section));
        if (conceptList.length === 0) {
          sectionReports.push({ status: 'error', section: sec.section, reason: `Ninguna palabra en Vocabulario tiene metadata.secciones="${sec.section}" y metadata.textbook="${input.textbook}".` });
          continue;
        }

        const sentenceList = findPinnedSentences(sentenceBank, input.textbook, sec.section);

        sectionReports.push({
          status: 'new',
          section: sec.section,
          podId,
          evalLink: { dia: evalEntry.dia, label: evalEntry.label },
          conceptList,
          sentenceList,
          wordCount: conceptList.length,
          sentenceCount: sentenceList.length,
        });
      }

      setReport({
        input,
        sections: sectionReports,
        hardErrorCount: sectionReports.filter((s) => s.status === 'error').length,
      });
    } catch (err) {
      console.error('Error validating chapter import:', err);
      setParseError(`Error al validar: ${err.message}`);
    } finally {
      setValidating(false);
    }
  };

  // Overwrites ONLY one existing pod's pinned_sentences in learning_paths —
  // never touches concepts, questionMix, or anything else on the pod — so a
  // section imported before this fix (or before its real sentences existed
  // yet) can be corrected without re-importing it from scratch.
  const handleRepairSentences = async (sectionReport) => {
    if (!report) return;
    setImportStatus('');
    try {
      const pathId = report.input.pathId;
      const snap = await getDoc(doc(db, 'learning_paths', pathId));
      if (!snap.exists()) throw new Error(`learning_paths/${pathId} ya no existe.`);
      const data = snap.data();
      const pods = (data.pods || []).map((p) =>
        p.id === sectionReport.podId
          ? { ...p, segments: p.segments.map((seg, i) => (i === 0 ? { ...seg, pinned_sentences: sectionReport.correctSentences } : seg)) }
          : p
      );
      await setDoc(doc(db, 'learning_paths', pathId), { pods, updated_at: new Date().toISOString() }, { merge: true });
      invalidateCollectionCache('learning_paths');
      setImportStatus(`✅ Oraciones corregidas para la sección ${sectionReport.section}.`);
      setReport({
        ...report,
        sections: report.sections.map((s) =>
          s.podId === sectionReport.podId ? { ...s, needsSentenceRepair: false, currentSentenceCount: sectionReport.correctSentenceCount } : s
        ),
      });
    } catch (err) {
      console.error('Error repairing pinned sentences:', err);
      setImportStatus(`❌ Error al corregir: ${err.message}`);
    }
  };

  const handleImport = async () => {
    if (!report || report.hardErrorCount > 0) return;
    const newSections = report.sections.filter((s) => s.status === 'new');
    if (newSections.length === 0) {
      setImportStatus('Nada nuevo que importar — todas las secciones ya existían.');
      return;
    }

    setImporting(true);
    setImportStatus('');
    try {
      const { input } = report;

      const newLearningPods = newSections.map((s) => ({
        id: s.podId,
        title: `Sección ${s.section}`,
        isExpanded: true,
        badgeAward: null,
        evalLink: null,
        gateConfig: null,
        isBonus: false,
        segments: [
          {
            id: `seg_${s.podId}`,
            total_questions: LEARNING_PATH_TOTAL,
            questionMix: { ...LEARNING_PATH_QUESTION_MIX },
            isSpeedRound: false,
            timeLimit: 60,
            introduced_concepts: s.conceptList,
            pinned_sentences: s.sentenceList,
            masteryThreshold: null,
            speakingOnly: false,
          },
        ],
      }));

      const newCirclePods = newSections.map((s) => ({
        id: s.podId,
        title: `Sección ${s.section}`,
        isExpanded: true,
        badgeAward: null,
        evalLink: s.evalLink,
        gateConfig: { ...GATE_CONFIG_DEFAULT },
        isBonus: false,
        segments: [
          {
            id: `seg_${s.podId}`,
            total_questions: s.wordCount,
            questionMix: { recall: s.wordCount, mc: 0, matching: 0, listen: 0, speak: 0, sentence: 0 },
            isSpeedRound: false,
            timeLimit: 120,
            introduced_concepts: s.conceptList,
            pinned_sentences: [],
            masteryThreshold: null,
            speakingOnly: false,
          },
        ],
      }));

      const pathSnap = await getDoc(doc(db, 'learning_paths', input.pathId));
      const existingPathData = pathSnap.exists() ? pathSnap.data() : null;
      const pathPods = [...(existingPathData?.pods || []), ...newLearningPods];
      await setDoc(
        doc(db, 'learning_paths', input.pathId),
        {
          path_id: input.pathId,
          title: existingPathData?.title || `Capítulo ${input.chapter}`,
          course: input.course,
          contentType: 'vocab',
          textbook: input.textbook,
          chapter: input.chapter,
          total_pods: pathPods.length,
          updated_at: new Date().toISOString(),
          pods: pathPods,
        },
        { merge: true }
      );

      const circleSnap = await getDoc(doc(db, 'practice_pods', input.pathId));
      const existingCircleData = circleSnap.exists() ? circleSnap.data() : null;
      const circlePods = [...(existingCircleData?.pods || []), ...newCirclePods];
      await setDoc(
        doc(db, 'practice_pods', input.pathId),
        {
          path_id: input.pathId,
          title: existingCircleData?.title || `Capítulo ${input.chapter} — Círculos de Práctica`,
          course: input.course,
          contentType: 'vocab',
          textbook: input.textbook,
          chapter: input.chapter,
          total_pods: circlePods.length,
          updated_at: new Date().toISOString(),
          pods: circlePods,
        },
        { merge: true }
      );

      await Promise.all(
        newSections.map((s) => {
          const circleId = `${input.pathId}__${s.podId}`;
          return setDoc(
            doc(db, 'reassessment_configs', circleId),
            {
              circleId,
              course: input.course,
              evalLabel: s.evalLink.label,
              groups: [],
              sentenceBlocks: [],
              vocabBlocks: [{ label: s.section, section: s.section, count: REASSESSMENT_VOCAB_COUNT }],
              timeLimitSeconds: REASSESSMENT_TIME_LIMIT_SECONDS,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        })
      );

      invalidateCollectionCache('learning_paths');
      invalidateCollectionCache('practice_pods');

      setImportStatus(`✅ ${newSections.length} sección${newSections.length === 1 ? '' : 'es'} creada${newSections.length === 1 ? '' : 's'}.`);
      setReport(null);
      setJsonText('');
    } catch (err) {
      console.error('Error importing chapter:', err);
      setImportStatus(`❌ Error al importar: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 text-white font-sans">
      <div className="flex justify-between items-start mb-6">
        <h2 className="text-2xl font-black uppercase tracking-widest text-violet-400 flex items-center gap-3">
          <span>📘</span> Importar Capítulo (Vocabulario)
        </h2>
        <Link to="/admin-secret-portal-master" className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700">
          ← Volver
        </Link>
      </div>

      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
        Crea, en un solo paso, la Ruta de Aprendizaje graduada y los Círculos de Práctica de un capítulo de vocabulario,
        más su reevaluación — por cada sección, leyendo las palabras y oraciones que ya existen (por{' '}
        <code className="text-slate-400">metadata.secciones</code> y la etiqueta <code className="text-slate-400">"Sección X.X"</code>),
        sin que tengas que volver a escribirlas. Las evaluaciones deben existir YA en el Secuenciador — esto solo las
        valida, nunca las crea ni las sobrescribe. Volver a correr esto para el mismo pathId solo AGREGA secciones
        nuevas; una sección que ya existe se salta, nunca se toca.
      </p>

      <textarea
        value={jsonText}
        onChange={(e) => setJsonText(e.target.value)}
        rows={14}
        placeholder={PLACEHOLDER}
        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-white outline-none focus:border-violet-500"
      />

      {parseError && <p className="text-rose-400 text-xs font-bold mt-2">{parseError}</p>}

      <div className="flex gap-3 mt-3">
        <button
          type="button"
          onClick={validate}
          disabled={validating || !jsonText.trim()}
          className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-black uppercase tracking-widest rounded-lg disabled:opacity-50"
        >
          {validating ? 'Validando...' : '🔍 Validar'}
        </button>
        {report && (
          <button
            type="button"
            onClick={handleImport}
            disabled={importing || report.hardErrorCount > 0}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-lg disabled:opacity-50"
          >
            {importing ? 'Importando...' : '💾 Importar secciones nuevas'}
          </button>
        )}
      </div>

      {importStatus && <p className="text-sm font-bold mt-3">{importStatus}</p>}

      {report && (
        <div className="mt-5 space-y-2">
          {report.hardErrorCount > 0 && (
            <p className="text-rose-400 text-xs font-bold">
              ⚠️ {report.hardErrorCount} sección{report.hardErrorCount === 1 ? '' : 'es'} con error — corrige el JSON y vuelve a validar antes de importar.
            </p>
          )}
          {report.sections.map((s, i) => (
            <div
              key={i}
              className={`rounded-lg border p-3 text-sm ${
                s.status === 'error'
                  ? 'bg-rose-950/30 border-rose-800'
                  : s.status === 'skip'
                  ? 'bg-slate-900 border-slate-700'
                  : 'bg-emerald-950/30 border-emerald-800'
              }`}
            >
              <p className="font-bold">
                {s.status === 'error' ? '❌' : s.status === 'skip' ? '⏭️' : '✅'} Sección {s.section}
              </p>
              {s.status === 'new' && (
                <p className="text-xs text-slate-400 mt-1">
                  {s.wordCount} palabras · {s.sentenceCount} oraciones · evaluación: {s.evalLink.label} (día {s.evalLink.dia})
                </p>
              )}
              {s.reason && <p className="text-xs text-slate-400 mt-1">{s.reason}</p>}
              {s.needsSentenceRepair && (
                <div className="mt-2 flex items-center gap-2">
                  <p className="text-amber-400 text-xs font-bold">
                    ⚠️ Oraciones fijadas: {s.currentSentenceCount} (deberían ser {s.correctSentenceCount}).
                  </p>
                  <button
                    type="button"
                    onClick={() => handleRepairSentences(s)}
                    className="text-[10px] font-black uppercase tracking-widest bg-amber-600 hover:bg-amber-500 px-2.5 py-1.5 rounded-lg"
                  >
                    🔧 Corregir oraciones
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
