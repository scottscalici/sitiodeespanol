import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCachedCollection } from '../utils/firestoreCache';
import { awardPoints } from '../utils/pointsHelper';
import { fetchEvaluacionOptions, resolveCurrentEvalDia } from '../utils/evaluaciones';
import WorkoutEngine from './WorkoutEngine';

// Practice Hub is deliberately outside the graded Dominio learning path: every
// circle here is ungated (no prerequisites, no podIndex to advance) and
// replayable — clicking a circle always draws a fresh random slice of
// questions from its word bank (WorkoutEngine already picks a random concept
// per question from segment.introduced_concepts, so a bank bigger than the
// segment's total_questions naturally reshuffles on every play with zero
// extra code). Completions still award points on the same scale as the
// learning path, just without any progress pointer to write.
const CONTENT_TYPES = {
  vocab: { label: 'Vocabulario', icon: '📖', theme: 'indigo' },
  verb: { label: 'Verbos', icon: '⚡', theme: 'emerald' },
};

const TENSE_LABELS = {
  ALL: 'Todos los Tiempos',
  presente: 'Presente',
  pretérito: 'Pretérito',
  imperfecto: 'Imperfecto',
  futuro: 'Futuro',
  condicional: 'Condicional',
  presente_progresivo: 'Progresivo',
  imperativo_afirmativo: 'Mandatos (+)',
  imperativo_negativo: 'Mandatos (-)',
  subjuntivo_presente: 'Subjuntivo',
};

const THEME_CLASSES = {
  indigo: { ring: 'ring-indigo-400', bg: 'bg-indigo-600', hoverBg: 'hover:bg-indigo-500', text: 'text-indigo-700', chip: 'bg-indigo-100 text-indigo-800' },
  emerald: { ring: 'ring-emerald-400', bg: 'bg-emerald-600', hoverBg: 'hover:bg-emerald-500', text: 'text-emerald-700', chip: 'bg-emerald-100 text-emerald-800' },
};

export default function PracticeHub() {
  const { currentUser, userData } = useAuth();
  const [searchParams] = useSearchParams();
  const isAdmin = userData?.role === 'admin';
  // Admins previewing the Dashboard's S2/S4 toggle carry that choice here via
  // ?course= (the tile they clicked was already scoped to it) — a real
  // student always uses their own profile course, never a URL override.
  const courseOverride = searchParams.get('course');
  const course = isAdmin && (courseOverride === 's2' || courseOverride === 's4')
    ? courseOverride
    : (userData?.course || 's2');

  const [isLoading, setIsLoading] = useState(true);
  const [circles, setCircles] = useState([]);
  const [view, setView] = useState('sequence'); // 'sequence' | 'quiz'

  const [activeCircle, setActiveCircle] = useState(null);
  const [sessionNonce, setSessionNonce] = useState(0);
  const [feedbackModal, setFeedbackModal] = useState(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const [docs, currentEvalOptions] = await Promise.all([
          getCachedCollection('practice_pods'),
          fetchEvaluacionOptions(course),
        ]);
        const flattened = [];
        docs
          .filter((d) => d.course === course && Array.isArray(d.pods))
          .forEach((d) => {
            d.pods.forEach((pod) => {
              const segment = pod.segments?.[0];
              if (!segment) return;
              // Re-resolve the día live against the current Evaluaciones
              // Sequencer calendar (by label match) instead of trusting the
              // day number saved when the link was made — so pushing a quiz
              // to a different día, or swapping two, is reflected here
              // without the admin having to re-link every circle.
              const evalLink = pod.evalLink
                ? { ...pod.evalLink, dia: resolveCurrentEvalDia(currentEvalOptions, pod.evalLink) }
                : null;
              flattened.push({
                id: `${d.path_id}__${pod.id}`,
                title: pod.title,
                contentType: d.contentType === 'verb' ? 'verb' : 'vocab',
                textbook: d.textbook || '',
                chapter: d.chapter || '',
                targetTense: segment.targetTense || 'ALL',
                evalLink,
                wordCount: segment.introduced_concepts?.length || 0,
                segment,
              });
            });
          });
        setCircles(flattened);
      } catch (err) {
        console.error('Error loading practice hub:', err);
      }
      setIsLoading(false);
    };
    load();
  }, [course]);

  // --- SCOPE-AND-SEQUENCE VIEW: vocab grouped by BOOK first (its own header,
  // so the same chapter number in two different textbooks — e.g. a shared
  // review chapter between courses — never gets conflated under one bucket),
  // then by chapter within that book; verbs grouped by target tense ---
  const sequenceGroups = useMemo(() => {
    const vocabByBook = new Map();
    const verbByTense = new Map();

    circles.forEach((c) => {
      if (c.contentType === 'vocab') {
        const bookKey = c.textbook || 'Sin libro';
        if (!vocabByBook.has(bookKey)) vocabByBook.set(bookKey, new Map());
        const chapterMap = vocabByBook.get(bookKey);
        const chapterKey = `Cap. ${c.chapter || '?'}`;
        if (!chapterMap.has(chapterKey)) chapterMap.set(chapterKey, { key: chapterKey, sortKey: Number(c.chapter) || 0, circles: [] });
        chapterMap.get(chapterKey).circles.push(c);
      } else {
        const key = TENSE_LABELS[c.targetTense] || c.targetTense;
        if (!verbByTense.has(key)) verbByTense.set(key, { key, sortKey: Object.keys(TENSE_LABELS).indexOf(c.targetTense), circles: [] });
        verbByTense.get(key).circles.push(c);
      }
    });

    const vocabBooks = Array.from(vocabByBook.entries())
      .map(([book, chapterMap]) => ({
        book,
        chapterGroups: Array.from(chapterMap.values()).sort((a, b) => a.sortKey - b.sortKey),
      }))
      .sort((a, b) => a.book.localeCompare(b.book));
    const verbGroups = Array.from(verbByTense.values()).sort((a, b) => a.sortKey - b.sortKey);
    return { vocabBooks, verbGroups };
  }, [circles]);

  // --- QUIZ-ORDER VIEW: every linked circle sorted by its evaluación día,
  // unlinked circles bucketed at the end as general practice ---
  const quizGroups = useMemo(() => {
    const linked = circles.filter((c) => c.evalLink);
    const unlinked = circles.filter((c) => !c.evalLink);

    const byDia = new Map();
    linked.forEach((c) => {
      const key = `Día ${c.evalLink.dia} — ${c.evalLink.label}`;
      if (!byDia.has(key)) byDia.set(key, { key, sortKey: c.evalLink.dia, circles: [] });
      byDia.get(key).circles.push(c);
    });

    const groups = Array.from(byDia.values()).sort((a, b) => a.sortKey - b.sortKey);
    if (unlinked.length > 0) groups.push({ key: 'Práctica General', sortKey: Infinity, circles: unlinked });
    return groups;
  }, [circles]);

  const playCircle = (circle) => {
    setActiveCircle(circle);
    setSessionNonce((n) => n + 1);
  };

  const handleComplete = async (segId, score, numQs, regularCount = 0, sentenceCount = 0) => {
    // --- Same base scale as the graded learning path (1 pt/regular question,
    // 2 pts/sentence question), but a simpler 2-tier multiplier for practice:
    // 100% = 2x, anything else = 1x — practice is ungated and endlessly
    // replayable, so it doesn't carry the learning path's full 3-tier scale.
    const baseScore = (regularCount * 1) + (sentenceCount * 2);
    const multiplier = score === 100 ? 2 : 1;
    const totalPointsEarned = Math.max(10, Math.round(baseScore * multiplier));

    setActiveCircle(null);

    if (!isAdmin && currentUser?.uid) {
      try {
        await awardPoints(currentUser.uid, totalPointsEarned);
      } catch (err) {
        console.error('Error awarding practice points:', err);
      }
    }

    setFeedbackModal({
      score,
      points: totalPointsEarned,
      circle: activeCircle,
    });
  };

  const renderCircleButton = (circle) => {
    const theme = THEME_CLASSES[CONTENT_TYPES[circle.contentType].theme];
    return (
      <button
        key={circle.id}
        onClick={() => playCircle(circle)}
        className="flex flex-col items-center gap-2 group"
      >
        <div className={`w-20 h-20 rounded-full ${theme.bg} ${theme.hoverBg} shadow-lg flex items-center justify-center text-3xl text-white transition-all group-hover:scale-105 ring-4 ring-offset-2 ${theme.ring}`}>
          {CONTENT_TYPES[circle.contentType].icon}
        </div>
        <span className="text-xs font-bold text-slate-700 text-center max-w-[100px]">{circle.title}</span>
        {circle.evalLink && (
          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${theme.chip}`}>
            Día {circle.evalLink.dia}
          </span>
        )}
      </button>
    );
  };

  const renderGroup = (group) => (
    <div key={group.key} className="mb-8">
      <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-3 border-b border-slate-200 pb-2">
        {group.key}
      </h3>
      <div className="flex flex-wrap gap-6">
        {group.circles.map(renderCircleButton)}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <h2 className="text-xl font-bold animate-pulse text-slate-400 uppercase tracking-widest">Cargando Practice Hub...</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-800">🎯 Practice Hub</h1>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Práctica libre — sin presión, repite las veces que quieras</p>
          </div>
          <div className="flex bg-slate-200 rounded-xl p-1">
            <button
              onClick={() => setView('sequence')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${view === 'sequence' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
            >
              Por Capítulo
            </button>
            <button
              onClick={() => setView('quiz')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${view === 'quiz' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
            >
              Por Evaluación
            </button>
          </div>
        </div>

        {circles.length === 0 && (
          <div className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest">
            Todavía no hay círculos de práctica disponibles.
          </div>
        )}

        {view === 'sequence' && (
          <>
            {sequenceGroups.vocabBooks.length > 0 && (
              <div className="mb-4">
                <h2 className="text-lg font-black text-indigo-700 mb-2">📖 Vocabulario</h2>
                {sequenceGroups.vocabBooks.map(({ book, chapterGroups }) => (
                  <div key={book} className="mb-8 bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5">
                    <h3 className="text-base font-black text-indigo-900 mb-4 flex items-center gap-2">
                      <span>📗</span> {book}
                    </h3>
                    {chapterGroups.map(renderGroup)}
                  </div>
                ))}
              </div>
            )}
            {sequenceGroups.verbGroups.length > 0 && (
              <div>
                <h2 className="text-lg font-black text-emerald-700 mb-2">⚡ Verbos</h2>
                {sequenceGroups.verbGroups.map(renderGroup)}
              </div>
            )}
          </>
        )}

        {view === 'quiz' && quizGroups.map(renderGroup)}
      </div>

      {activeCircle && (
        <WorkoutEngine
          key={`${activeCircle.id}_${sessionNonce}`}
          segment={activeCircle.segment}
          history={[]}
          podIndex={0}
          onClose={() => setActiveCircle(null)}
          onComplete={handleComplete}
        />
      )}

      {feedbackModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center border border-slate-200">
            <div className="text-5xl mb-3">{feedbackModal.score >= 80 ? '🎉' : '💪'}</div>
            <h3 className="text-xl font-black text-slate-800 mb-1">
              {feedbackModal.score >= 80 ? '¡Bien hecho!' : '¡Buen esfuerzo!'}
            </h3>
            <p className="text-sm text-slate-500 font-bold mb-6">
              Obtuviste un {feedbackModal.score}% (+{feedbackModal.points} pts)
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { const c = feedbackModal.circle; setFeedbackModal(null); if (c) playCircle(c); }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl uppercase tracking-wide text-sm transition-colors"
              >
                🔀 Practicar de Nuevo
              </button>
              <button
                onClick={() => setFeedbackModal(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-xl uppercase tracking-wide text-sm transition-colors"
              >
                Volver al Practice Hub
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
