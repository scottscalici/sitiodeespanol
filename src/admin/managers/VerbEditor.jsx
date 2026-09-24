import { useState, useEffect, useMemo } from 'react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getCachedCollection, invalidateCollectionCache } from '../../utils/firestoreCache';
import { Link } from 'react-router-dom';

// Same 11 tenses the calentamiento generator actually knows how to draw
// questions from (src/admin/managers/CalentamientoAdmin.jsx keeps its own
// copy of this list too — small and stable enough that duplicating it here
// is simpler than threading a shared import through both admin tools).
const TENSES = [
  { id: 'presente', label: 'Presente' },
  { id: 'pretérito', label: 'Pretérito' },
  { id: 'imperfecto', label: 'Imperfecto' },
  { id: 'futuro', label: 'Futuro' },
  { id: 'condicional', label: 'Condicional' },
  { id: 'subjuntivo_presente', label: 'Subjuntivo (Presente)' },
  { id: 'subjuntivo_imperfecto_ra', label: 'Subjuntivo (Imperfecto -ra)' },
  { id: 'imperativo_afirmativo', label: 'Mandatos Afirmativos' },
  { id: 'imperativo_negativo', label: 'Mandatos Negativos' },
  { id: 'presente_progresivo', label: 'Presente Progresivo' },
  { id: 'pluscuamperfecto', label: 'Pluscuamperfecto' },
];

const SUBJECTS = [
  { id: 'yo', label: 'yo' },
  { id: 'tú', label: 'tú' },
  { id: 'él_ella_ud', label: 'él / ella / Ud.' },
  { id: 'nosotros', label: 'nosotros' },
  { id: 'vosotros', label: 'vosotros' },
  { id: 'ellos_ellas_uds', label: 'ellos / ellas / Uds.' },
];

const slugify = (palabra) =>
  (palabra || '')
    .replace(/\//g, '-')
    .replace(/\s+/g, '_')
    .replace(/[()]/g, '')
    .toLowerCase();

export default function VerbEditor() {
  const [verbs, setVerbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [draft, setDraft] = useState(null); // the verb currently being edited
  const [activeTense, setActiveTense] = useState('presente');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const list = await getCachedCollection('verbs');
        setVerbs([...list].sort((a, b) => (a.palabra || '').localeCompare(b.palabra || '')));
      } catch (err) {
        console.error('Error loading verbs:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredVerbs = useMemo(
    () => verbs.filter((v) => (v.palabra || '').toLowerCase().includes(search.toLowerCase())),
    [verbs, search]
  );

  const selectVerb = (verb) => {
    // Deep-copy so edits don't mutate the sidebar list until saved.
    setDraft(JSON.parse(JSON.stringify(verb)));
    setActiveTense('presente');
    setStatus('');
  };

  const startNewVerb = () => {
    const palabra = window.prompt('Palabra (infinitivo), tal como debe aparecer:');
    if (!palabra || !palabra.trim()) return;
    const id = slugify(palabra.trim());
    if (verbs.some((v) => v.id === id)) {
      alert(`Ya existe un verbo con el ID "${id}". Selecciónalo en la lista para editarlo.`);
      return;
    }
    setDraft({
      id,
      palabra: palabra.trim(),
      translations: { infinitivo: { target: palabra.trim(), english: '' } },
      tenses: {},
    });
    setActiveTense('presente');
    setStatus('');
  };

  const updateCell = (subjectId, field, value) => {
    setDraft((d) => ({
      ...d,
      tenses: {
        ...d.tenses,
        [activeTense]: {
          ...d.tenses?.[activeTense],
          [subjectId]: {
            ...d.tenses?.[activeTense]?.[subjectId],
            [field]: value,
          },
        },
      },
    }));
  };

  const handleSave = async () => {
    if (!draft?.palabra?.trim()) {
      setStatus('❌ Falta la palabra (infinitivo).');
      return;
    }
    setSaving(true);
    setStatus('');
    try {
      // Blank cells drop out of the saved doc entirely, rather than storing
      // an empty target that the generator would show as "???" to a student.
      const cleanedTenses = {};
      Object.entries(draft.tenses || {}).forEach(([tenseId, subjects]) => {
        const cleanedSubjects = {};
        Object.entries(subjects || {}).forEach(([subjectId, data]) => {
          const target = (data?.target || '').trim();
          if (target) {
            cleanedSubjects[subjectId] = { target, english: (data.english || '').trim() };
          }
        });
        if (Object.keys(cleanedSubjects).length > 0) cleanedTenses[tenseId] = cleanedSubjects;
      });

      const { id, ...rest } = draft;
      const payload = {
        ...rest,
        palabra: draft.palabra.trim(),
        translations: {
          ...draft.translations,
          infinitivo: {
            target: (draft.translations?.infinitivo?.target || draft.palabra).trim(),
            english: (draft.translations?.infinitivo?.english || '').trim(),
          },
        },
        tenses: cleanedTenses,
        lastUpdated: new Date().toISOString(),
      };

      await setDoc(doc(db, 'verbs', id), payload);
      invalidateCollectionCache('verbs');

      const saved = { id, ...payload };
      setVerbs((prev) => {
        const exists = prev.some((v) => v.id === id);
        const next = exists ? prev.map((v) => (v.id === id ? saved : v)) : [...prev, saved];
        return next.sort((a, b) => (a.palabra || '').localeCompare(b.palabra || ''));
      });
      setDraft(JSON.parse(JSON.stringify(saved)));
      setStatus(`✅ ¡Guardado "${saved.palabra}"!`);
    } catch (err) {
      console.error('Error saving verb:', err);
      setStatus('❌ Error al guardar. Revisa la consola.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!draft?.id) return;
    if (!window.confirm(`¿Eliminar "${draft.palabra}" permanentemente? Esto no se puede deshacer.`)) return;
    try {
      await deleteDoc(doc(db, 'verbs', draft.id));
      invalidateCollectionCache('verbs');
      setVerbs((prev) => prev.filter((v) => v.id !== draft.id));
      setDraft(null);
    } catch (err) {
      console.error('Error deleting verb:', err);
      setStatus('❌ Error al eliminar. Revisa la consola.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
            <span>📖</span> Editor de Verbos
          </h2>
          <Link to="/admin-daily-plan-hub" className="text-slate-400 hover:text-white text-xs font-bold border border-slate-700 px-3 py-1.5 rounded-lg">
            ← Hub
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
          {/* SIDEBAR: SEARCH + LIST */}
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 h-fit md:sticky md:top-4">
            <button
              onClick={startNewVerb}
              className="w-full mb-3 bg-amber-600 hover:bg-amber-500 text-white font-black uppercase tracking-widest text-xs py-2.5 rounded-lg transition-colors"
            >
              + Nuevo Verbo
            </button>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar verbo..."
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-sm mb-3 focus:outline-none focus:border-amber-500"
            />
            {loading ? (
              <p className="text-slate-500 text-sm italic">Cargando...</p>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto space-y-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                  {filteredVerbs.length} verbo{filteredVerbs.length === 1 ? '' : 's'}
                </p>
                {filteredVerbs.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => selectVerb(v)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                      draft?.id === v.id
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {v.palabra}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* MAIN PANEL: EDITOR */}
          {!draft ? (
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-10 flex items-center justify-center">
              <p className="text-slate-500 text-sm italic">Selecciona un verbo de la lista, o crea uno nuevo.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* PALABRA + INFINITIVO */}
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Palabra (Infinitivo)
                    </label>
                    <input
                      value={draft.palabra || ''}
                      onChange={(e) => setDraft({ ...draft, palabra: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-3 font-bold text-lg focus:outline-none focus:border-amber-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">ID en Firestore: {draft.id}</p>
                  </div>
                  <button
                    onClick={handleDelete}
                    className="text-[10px] font-bold uppercase tracking-widest bg-rose-950/50 hover:bg-rose-900 text-rose-300 px-3 py-1.5 rounded border border-rose-800/50 shrink-0 mt-6"
                  >
                    Eliminar Verbo
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Infinitivo (Español)
                    </label>
                    <input
                      value={draft.translations?.infinitivo?.target || ''}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          translations: {
                            ...draft.translations,
                            infinitivo: { ...draft.translations?.infinitivo, target: e.target.value },
                          },
                        })
                      }
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Infinitivo (English)
                    </label>
                    <input
                      value={draft.translations?.infinitivo?.english || ''}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          translations: {
                            ...draft.translations,
                            infinitivo: { ...draft.translations?.infinitivo, english: e.target.value },
                          },
                        })
                      }
                      placeholder="to speak"
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* TENSE TABS */}
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
                <div className="flex flex-wrap gap-2 mb-5">
                  {TENSES.map((t) => {
                    const hasData = Object.keys(draft.tenses?.[t.id] || {}).length > 0;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setActiveTense(t.id)}
                        className={`text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-colors ${
                          activeTense === t.id
                            ? 'bg-amber-600 border-amber-600 text-white'
                            : hasData
                            ? 'bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700'
                            : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'
                        }`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-3">
                  {SUBJECTS.map((s) => {
                    const cell = draft.tenses?.[activeTense]?.[s.id] || {};
                    return (
                      <div key={s.id} className="grid grid-cols-1 sm:grid-cols-[140px_1fr_1fr] gap-3 items-center">
                        <span className="text-sm font-bold text-slate-300">{s.label}</span>
                        <input
                          value={cell.target || ''}
                          onChange={(e) => updateCell(s.id, 'target', e.target.value)}
                          placeholder="Español"
                          className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-sm focus:outline-none focus:border-amber-500"
                        />
                        <input
                          value={cell.english || ''}
                          onChange={(e) => updateCell(s.id, 'english', e.target.value)}
                          placeholder="English"
                          className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-sm focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-500 mt-3 italic">
                  Deja un campo en blanco si ese sujeto no aplica para este tiempo (p. ej. "yo" en mandatos).
                </p>
              </div>

              {status && (
                <p className={`text-xs font-bold text-center ${status.includes('❌') ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {status}
                </p>
              )}

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-black uppercase tracking-widest py-3 rounded-lg transition-colors shadow-lg"
              >
                {saving ? 'Guardando...' : 'Guardar Verbo'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
