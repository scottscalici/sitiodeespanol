import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCachedCollection } from '../utils/firestoreCache';
import { renderFormattedText } from '../utils/formattedText';

// Grading breakdown data lives here as plain config, not hardcoded into the
// JSX below — makes it obvious at a glance that the two courses' categories
// are independent lists, and keeps the (not-quite-identical) S2/S4 wording
// for "Trabajo de Clase" and "Dominio" from drifting apart by accident if
// one gets edited later without the other.
const GRADING = {
  s2: {
    label: 'Spanish 2 (S2)',
    categories: [
      {
        name: 'Evaluaciones',
        weight: 35,
        desc: 'Quizzes and tests. Both are recorded in the gradebook the same way, but tests are weighted more heavily than quizzes.',
      },
      {
        name: 'Dominio',
        weight: 25,
        desc: 'All of your assigned Learning Paths (Rutas de Aprendizaje). This grade is based only on completing the path — not on your score within each segment.',
      },
      {
        name: 'Español Práctico',
        weight: 20,
        desc: 'Speaking, listening, reading, and writing activities.',
      },
      {
        name: 'Trabajo de Clase',
        weight: 10,
        desc: 'Classwork — the warm-ups and other practice activities that show up on this website. Verb conjugations in the warm-up and práctica are graded on accuracy, but you can redo them as many times as you need — only your best score counts. Curiosidades are graded on completion only.',
      },
      {
        name: 'Práctica',
        weight: 10,
        desc: 'Assignments from VHL.',
      },
    ],
  },
  s4: {
    label: 'Spanish 4 / IB (S4)',
    categories: [
      {
        name: 'Evaluaciones',
        weight: 25,
        desc: 'Quizzes and tests — for us, mostly quizzes.',
      },
      {
        name: 'Dominio',
        weight: 25,
        desc: 'The completion percentage of your Learning Paths — this is the only thing that goes into this category.',
      },
      {
        name: 'Práctica',
        weight: 20,
        desc: 'Assignments from Reporteros Cuatro, via the KWL hub.',
      },
      {
        name: 'Español Práctico',
        weight: 20,
        desc: 'IB reading texts, and speaking practice like IA prep.',
      },
      {
        name: 'Trabajo de Clase',
        weight: 10,
        desc: 'Classwork — the warm-ups (calentamientos) and other practice activities on this website, including Curiosidades.',
      },
    ],
  },
};

const SiteSection = ({ title, children }) => (
  <div className="space-y-2">
    <h3 className="text-lg font-black text-slate-800">{title}</h3>
    <div className="text-slate-600 leading-relaxed space-y-2">{children}</div>
  </div>
);

const GradingTable = ({ data }) => (
  <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
    <h3 className="text-xl font-black text-slate-800">{data.label}</h3>
    <div className="space-y-3">
      {[...data.categories].sort((a, b) => b.weight - a.weight).map((cat) => (
        <div key={cat.name} className="flex gap-4 items-start border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
          <div className="shrink-0 w-16 text-right">
            <span className="text-2xl font-black text-indigo-600">{cat.weight}%</span>
          </div>
          <div>
            <p className="font-bold text-slate-800">{cat.name}</p>
            <p className="text-sm text-slate-500">{cat.desc}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const FaqPage = () => {
  const { userData } = useAuth();
  // Each student only ever sees their own course's grading breakdown — the
  // two use different categories (and S2's "Práctica" and S4's "Práctica"
  // aren't even the same source), so showing both every time was just
  // asking a student to find themselves in the wrong half of the page.
  // Falls back to showing both only if a course somehow isn't set, rather
  // than silently showing nobody's.
  const course = userData?.course;
  const gradingToShow = course === 's2' ? [GRADING.s2] : course === 's4' ? [GRADING.s4] : [GRADING.s2, GRADING.s4];

  // Teacher-added entries (see admin/managers/FaqEditorManager.jsx) — kept
  // separate from the hand-curated content above so that content (sourced
  // word-for-word from the teacher's own dictated policy) never gets
  // reshuffled by an ad hoc admin form. These are purely additive, sorted
  // by `order`, and filtered to the student's own course same as grading.
  const [extraEntries, setExtraEntries] = useState([]);
  useEffect(() => {
    getCachedCollection('faq_entries')
      .then((entries) => {
        const visible = entries
          .filter((e) => !e.course || e.course === 'all' || e.course === course)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setExtraEntries(visible);
      })
      .catch((err) => console.error('Error loading FAQ entries:', err));
  }, [course]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-10">
        <div>
          <Link to="/" className="text-slate-400 hover:text-slate-600 text-sm font-bold">← Volver</Link>
          <h1 className="text-4xl font-black text-slate-900 mt-2">Preguntas Frecuentes <span className="text-slate-400 text-xl font-bold">(FAQ)</span></h1>
          <p className="text-slate-500 mt-2">Answers to the questions I get asked most. This page is in English on purpose — it's meant to save both of us some time.</p>
        </div>

        {/* RECUPERACIONES */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
          <h2 className="text-2xl font-black text-slate-900">"I didn't do so great on my quiz — can I redo it?"</h2>
          <p className="text-slate-600 leading-relaxed">
            Yes. Go to your <strong>Evaluaciones</strong> card and click the <strong>Recuperaciones</strong> button.
            Select the quiz you want to retake and complete the reflection — it can be in English or Spanish.
            After that, you'll be given practice material; passing it with <strong>90% accuracy</strong> within the
            allotted time qualifies you to reassess.
          </p>
        </div>

        {/* GRADING */}
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900">How is my grade calculated?</h2>
          </div>
          {gradingToShow.map((data) => <GradingTable key={data.label} data={data} />)}
        </div>

        {/* SITE TOUR */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="text-2xl font-black text-slate-900">How do I use this website?</h2>
            <p className="text-slate-600 mt-2 leading-relaxed">
              Think of the main panel as your <strong>digital lesson plan for the day</strong> — it's laid out in the
              same order we actually do things in class. The side panel is for resources, required work, and games.
            </p>
          </div>

          <SiteSection title="Main panel, top to bottom">
            <p><strong>Evaluaciones</strong> — shows today's quiz (if there is one) and the next two coming up. The <strong>Calendario</strong> button shows long-term assessments, and <strong>Recuperaciones</strong> is where you go to make up a quiz (see above).</p>
            <p><strong>Calentamiento</strong> — your daily warm-up: verb practice on whatever we're covering most recently, plus a vocab review pulling from everything since the beginning of Spanish 1 — not just this course. The <strong>Promedio</strong> score here feeds into your Trabajo de Clase grade — it's based on accuracy, but you can redo any part of it until you're happy with your score.</p>
            <p><strong>Curiosidad</strong> — a daily cultural fact or bit of trivia about a Spanish-speaking place, person, or custom. Graded on completion only.</p>
            <p><strong>Gramática</strong> — what we're covering that day, split into new material and review, with links to the specific grammar notes plus broader topic pages if you want to look something up that isn't on today's agenda.</p>
            <p><strong>Vocabulario</strong> — the vocab set we're currently working with. The <strong>Índice</strong> button lets you browse other chapters, including past years' notes.</p>
            <p>Some days you'll also see other cards — música, reading, writing, listening, or a cultural activity — these aren't daily, but when they show up they're usually interactive.</p>
            <p>At the very bottom of the main panel is the <strong>daily highlight</strong> — a person, place, or word of the day from Spanish-speaking cultures. It's just for fun; there's nothing to complete.</p>
          </SiteSection>

          <SiteSection title="Side panel">
            <p><strong>El Recreo</strong> — the "activity room." Nothing here is ever required for class; it's just for fun and extra practice. Games include Señordle (a daily Spanish word puzzle), Atando Cabos (a Connections-style category game), Eslabones (a word-chain game), ¡Zas! and Ráfaga (live multiplayer games you join with a room code), El Impostor (another room-code multiplayer game), Silabaso (build words from a shared pool of syllables using the clues given), and Tico Talk (a curated video section). New games get added from time to time, so it's worth checking back.</p>
            <p><strong>Tareas</strong> — your homework: what's assigned and when it's due.</p>
            <p><strong>Ruta de Aprendizaje</strong> — your assigned learning paths (think of it as a Duolingo made for exactly what we're covering). These appear below Tareas with their own due dates. After the due date, a path moves to the archive, where you can still complete it for a grade penalty — the longer you wait, the bigger the penalty. You can also revisit any path at any time just for extra practice; that earns ranking points but has no effect on your grade either way.</p>
            <p><strong>Leaderboard / ranking</strong> — tracks points from everything you do (practice, homework, games, warm-ups) and shows all-time, monthly, and weekly top scores, plus the longest active streaks. You also earn badges as you go. These points are mostly just for fun and motivation.</p>
            <p><strong>Panel de Recursos</strong> — an expandable panel with general help resources and information on upcoming trips, plus other practice or reference links.</p>
            <p><strong>Practice Hub</strong> — optional, à la carte practice by specific skill or vocab set. You can filter it "por evaluación" to see practice tied to your next quiz, or just browse everything else. Nothing here is assigned, but you do earn points for it.</p>
          </SiteSection>
        </div>

        {/* TEACHER-ADDED ENTRIES */}
        {extraEntries.length > 0 && (
          <div className="space-y-4">
            {extraEntries.map((entry) => (
              <div key={entry.id} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                <h2 className="text-2xl font-black text-slate-900">{entry.question}</h2>
                <p className="text-slate-600 leading-relaxed">{renderFormattedText(entry.answer)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FaqPage;
