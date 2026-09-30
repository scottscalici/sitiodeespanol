import React, { useState } from 'react';
import { db } from '../../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { invalidateCollectionCache } from '../../utils/firestoreCache';
import { CATEGORIES } from '../../student/GlosarioIdiomaticoPage';

// One-time bulk import: turns a JSON list of idiom categories into a single
// practice_pods doc — one Practice Hub circle per category, each with its
// own theme's idioms as its word bank. Pre-filled with the same content
// already on the Glosario page so this can be run immediately, but the
// textarea is editable/re-pasteable for adding more categories later.
//
// course: 'all' (not 's2'/'s4') so PracticeHub.jsx shows these circles to
// every course — idioms aren't tied to a specific textbook or class level.
const DOC_ID = 'idioms_glosario';

const buildPods = (categories) =>
  categories.map((cat) => ({
    id: `pod_idiom_${cat.id}`,
    title: `${cat.emoji || '💬'} ${cat.label}`,
    isExpanded: true,
    badgeAward: null,
    evalLink: null,
    gateConfig: null,
    isBonus: false,
    segments: [
      {
        id: `seg_idiom_${cat.id}`,
        // A hand-tuned "mini learning path" pace rather than the Practice
        // Hub speed-round default — untimed, moderate length, weighted
        // toward recall/mc/matching (idioms are learned by recognition and
        // recall, not conjugation or dictation).
        total_questions: 10,
        questionMix: { recall: 4, mc: 4, matching: 2, listen: 0, speak: 0, sentence: 0 },
        isSpeedRound: false,
        timeLimit: 60,
        targetTense: 'ALL',
        introduced_concepts: (cat.expresiones || []).map((e, idx) => ({
          id: `${cat.id}_${idx}`,
          label: e.expresion,
          translation: e.ingles,
          tags: cat.label,
          fullData: { palabra: e.expresion, traduccion: e.ingles, context_1: e.ejemplo },
        })),
        pinned_sentences: [],
      },
    ],
  }));

export default function IdiomPracticeImporter() {
  const [jsonInput, setJsonInput] = useState(() => JSON.stringify(CATEGORIES, null, 2));
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const handleImport = async () => {
    setSaving(true);
    setStatus('');
    try {
      const categories = JSON.parse(jsonInput);
      if (!Array.isArray(categories) || categories.length === 0) {
        throw new Error('Expected a non-empty JSON array of categories.');
      }
      const invalid = categories.find((c) => !c.id || !c.label || !Array.isArray(c.expresiones));
      if (invalid) throw new Error(`Every category needs id, label, and an expresiones array. Bad entry: ${JSON.stringify(invalid).slice(0, 120)}`);

      const pods = buildPods(categories);
      await setDoc(doc(db, 'practice_pods', DOC_ID), {
        path_id: DOC_ID,
        title: 'Modismos y Expresiones',
        course: 'all',
        contentType: 'idiom',
        textbook: '',
        chapter: '',
        total_pods: pods.length,
        updated_at: new Date().toISOString(),
        pods,
      }, { merge: true });
      invalidateCollectionCache('practice_pods');
      setStatus(`✅ Imported ${pods.length} idiom circles (course: all).`);
    } catch (err) {
      console.error('Idiom import error:', err);
      setStatus(`❌ ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-10 max-w-4xl mx-auto bg-slate-900 text-white rounded-2xl shadow-2xl border-4 border-amber-500">
      <h2 className="text-2xl font-black mb-4 uppercase text-amber-500">
        💬 Idiom Practice Circle Importer
      </h2>
      <p className="mb-4 text-sm text-slate-400">
        One category → one Practice Hub circle. Pre-filled from the Glosario de Expresiones Idiomáticas page —
        edit or paste your own list, then import. Safe to run again; it overwrites the same <code className="text-amber-300">practice_pods/{DOC_ID}</code> doc.
      </p>

      <textarea
        className="w-full h-96 p-4 bg-slate-800 border border-slate-700 rounded-xl font-mono text-xs text-amber-300 outline-none focus:border-amber-500 transition-colors"
        value={jsonInput}
        onChange={(e) => setJsonInput(e.target.value)}
        placeholder='[ { "id": "motivacion", "emoji": "🔋", "label": "Motivación", "expresiones": [{ "expresion": "...", "ejemplo": "...", "ingles": "..." }] } ]'
      />

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={handleImport}
          disabled={saving}
          className="px-8 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 active:scale-95 transition-all font-bold rounded-xl shadow-lg uppercase text-sm"
        >
          {saving ? 'Importando...' : 'Importar a Practice Hub'}
        </button>
        <span className="font-bold text-sm text-amber-300">{status}</span>
      </div>
    </div>
  );
}
