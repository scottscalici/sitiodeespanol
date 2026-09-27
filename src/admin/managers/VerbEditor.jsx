import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, deleteField, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { getCachedCollection, invalidateCollectionCache, invalidateDocCache, getBucketId } from '../../utils/firestoreCache';
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
  const [tagDraft, setTagDraft] = useState('');

  // Docs in the collection still in the old one-doc-per-verb shape (not yet
  // grouped into a bucket document — see getBucketId). Tracked so the
  // migration banner (and its delete step) stays correct across reloads
  // regardless of whether bucket docs already exist alongside them.
  const [legacyDocCount, setLegacyDocCount] = useState(0);
  const [migrationStatus, setMigrationStatus] = useState(null);

  const loadVerbs = async () => {
    try {
      const rawDocs = await getCachedCollection('verbs');
      const flattened = [];
      let legacyCount = 0;
      rawDocs.forEach((d) => {
        if (d.items && typeof d.items === 'object') {
          Object.entries(d.items).forEach(([id, data]) => flattened.push({ id, ...data }));
        } else {
          const { id, ...rest } = d;
          flattened.push({ id, ...rest });
          legacyCount += 1;
        }
      });
      setVerbs(flattened.sort((a, b) => (a.palabra || '').localeCompare(b.palabra || '')));
      setLegacyDocCount(legacyCount);
    } catch (err) {
      console.error('Error loading verbs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVerbs();
  }, []);

  // Every tag already in use on any verb, for a simple autocomplete list.
  const allKnownTags = useMemo(() => {
    const set = new Set();
    verbs.forEach((v) => (v.tags || []).forEach((t) => set.add(t)));
    return [...set].sort();
  }, [verbs]);

  const filteredVerbs = useMemo(
    () => verbs.filter((v) => (v.palabra || '').toLowerCase().includes(search.toLowerCase())),
    [verbs, search]
  );

  const selectVerb = (verb) => {
    // Deep-copy so edits don't mutate the sidebar list until saved.
    setDraft(JSON.parse(JSON.stringify(verb)));
    setActiveTense('presente');
    setStatus('');
    setTagDraft('');
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
      tags: [],
    });
    setActiveTense('presente');
    setStatus('');
  };

  const addTag = (raw) => {
    const tag = raw.trim().toLowerCase();
    if (!tag) return;
    setDraft((d) => (d.tags || []).includes(tag) ? d : { ...d, tags: [...(d.tags || []), tag] });
    setTagDraft('');
  };

  const removeTag = (tag) => {
    setDraft((d) => ({ ...d, tags: (d.tags || []).filter((t) => t !== tag) }));
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
        tags: [...new Set((draft.tags || []).map((t) => t.trim().toLowerCase()).filter(Boolean))],
        lastUpdated: new Date().toISOString(),
      };

      // Always writes into this verb's bucket document (see getBucketId) —
      // never creates a fresh individual doc, so new verbs are bucketed
      // from day one even before the migration tool below has been run.
      const bucketId = getBucketId(id);
      await setDoc(doc(db, 'verbs', bucketId), { [`items.${id}`]: payload }, { merge: true });
      invalidateCollectionCache('verbs');
      invalidateDocCache('verbs', bucketId);

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
      // Removes it from wherever it currently lives — its bucket doc (the
      // normal case) or, during the migration window, a leftover individual
      // doc — without needing to know in advance which shape it's in.
      const bucketId = getBucketId(draft.id);
      await Promise.all([
        updateDoc(doc(db, 'verbs', bucketId), { [`items.${draft.id}`]: deleteField() }).catch(() => {}),
        deleteDoc(doc(db, 'verbs', draft.id)).catch(() => {}),
      ]);
      invalidateCollectionCache('verbs');
      invalidateDocCache('verbs', bucketId);
      setVerbs((prev) => prev.filter((v) => v.id !== draft.id));
      setDraft(null);
    } catch (err) {
      console.error('Error deleting verb:', err);
      setStatus('❌ Error al eliminar. Revisa la consola.');
    }
  };

  // --- ONE-TIME MIGRATION: ~400 separate docs → ~12 bucket docs ---
  // Bucket assignment is a pure function of each verb's own (immutable) ID
  // (see getBucketId), so this needs no manual classification — it's a
  // deterministic regroup, done in one pass. Still split into copy-then-
  // confirmed-delete, same as every other collection migration this
  // session, since the delete step is irreversible.
  const handleMigrateCopy = async () => {
    setMigrationStatus('copying');
    try {
      const querySnapshot = await getDocs(collection(db, 'verbs'));
      const bucketMap = {};
      let count = 0;
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.items && typeof data.items === 'object') return; // already a bucket doc
        const bucketId = getBucketId(docSnap.id);
        if (!bucketMap[bucketId]) bucketMap[bucketId] = {};
        bucketMap[bucketId][docSnap.id] = data;
        count += 1;
      });

      if (count === 0) {
        setMigrationStatus('error');
        alert('No se encontraron verbos individuales para copiar (¿ya se migró?).');
        return;
      }

      const batch = writeBatch(db);
      Object.entries(bucketMap).forEach(([bucketId, itemsMap]) => {
        batch.set(doc(db, 'verbs', bucketId), { items: itemsMap }, { merge: true });
      });
      await batch.commit();
      invalidateCollectionCache('verbs');
      setLegacyDocCount(count);
      setMigrationStatus('copied');
      await loadVerbs();
      alert(`✅ Copiados ${count} verbos en ${Object.keys(bucketMap).length} documentos agrupados. Revisa la lista antes de borrar los documentos antiguos.`);
    } catch (err) {
      console.error('Error migrating verbs:', err);
      setMigrationStatus('error');
      alert('Error al copiar. Nada se ha borrado.');
    }
  };

  const handleMigrateDelete = async () => {
    const confirmed = window.confirm(
      `Esto borrará permanentemente los ${legacyDocCount || '~400'} documentos individuales antiguos de 'verbs' (ya copiados a los documentos agrupados). Esta acción NO se puede deshacer. ¿Continuar?`
    );
    if (!confirmed) return;

    setMigrationStatus('deleting');
    try {
      const querySnapshot = await getDocs(collection(db, 'verbs'));
      const bucketItems = {}; // bucketId -> Set of verb IDs already copied there
      const legacyDocs = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.items && typeof data.items === 'object') {
          bucketItems[docSnap.id] = new Set(Object.keys(data.items));
        } else {
          legacyDocs.push(docSnap);
        }
      });

      // Refuse to delete any legacy doc that isn't actually copied into its
      // bucket yet — a stale bucket read, a partial copy failure, or a verb
      // added after copy but before delete could all leave this true.
      const uncopied = legacyDocs.filter(
        (d) => !bucketItems[getBucketId(d.id)]?.has(d.id)
      );
      if (uncopied.length > 0) {
        setMigrationStatus('error');
        alert(`⚠️ ${uncopied.length} verbo(s) no están copiados todavía (p. ej. "${uncopied[0].id}"). Ejecuta el Paso 1 de nuevo antes de borrar.`);
        return;
      }

      const batch = writeBatch(db);
      let count = 0;
      legacyDocs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
        count += 1;
      });
      await batch.commit();
      invalidateCollectionCache('verbs');
      setLegacyDocCount(0);
      setMigrationStatus('done');
      await loadVerbs();
      alert(`✅ Borrados ${count} documentos individuales antiguos. 'verbs' ahora vive en documentos agrupados.`);
    } catch (err) {
      console.error('Error deleting old verb docs:', err);
      setMigrationStatus('error');
      alert('Error al borrar los documentos antiguos.');
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

        {/* ONE-TIME MIGRATION TOOL — remove this block once legacyDocCount is
            always 0 in production. See DestacadoManager for the full
            rationale on the two-step copy/delete shape. */}
        {legacyDocCount > 0 && (
          <div className="p-4 bg-amber-950/40 border border-amber-800 rounded-2xl flex flex-col gap-2">
            <p className="text-xs font-black text-amber-400 uppercase tracking-widest">
              ⚠️ Migración disponible: agrupar en ~12 documentos
            </p>
            <p className="text-xs text-amber-200">
              {`${legacyDocCount} verbos siguen en documentos individuales. Paso 1 los agrupa sin borrar nada — revisa la lista después. Paso 2 borra los documentos antiguos (irreversible), solo después de confirmar el Paso 1.`}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleMigrateCopy}
                disabled={migrationStatus === 'copying'}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-lg text-xs uppercase tracking-widest disabled:opacity-50"
              >
                {migrationStatus === 'copying' ? 'Agrupando...' : '1. Agrupar en documentos'}
              </button>
              <button
                type="button"
                onClick={handleMigrateDelete}
                disabled={migrationStatus === 'deleting'}
                className="px-4 py-2 bg-rose-800 hover:bg-rose-700 text-white font-black rounded-lg text-xs uppercase tracking-widest disabled:opacity-50"
              >
                {migrationStatus === 'deleting' ? 'Borrando...' : '2. Borrar documentos antiguos'}
              </button>
            </div>
          </div>
        )}

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

              {/* TAGS */}
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Etiquetas
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {(draft.tags || []).length === 0 && (
                    <p className="text-xs text-slate-500 italic">Sin etiquetas todavía.</p>
                  )}
                  {(draft.tags || []).map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1.5 bg-slate-800 border border-slate-600 text-amber-300 text-xs font-bold px-3 py-1 rounded-full"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="text-slate-500 hover:text-rose-400 font-black"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag(tagDraft);
                      }
                    }}
                    list="known-verb-tags"
                    placeholder="p. ej. stem_e_ie, reflexivo, comun..."
                    className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-sm focus:outline-none focus:border-amber-500"
                  />
                  <datalist id="known-verb-tags">
                    {allKnownTags.map((tag) => (
                      <option key={tag} value={tag} />
                    ))}
                  </datalist>
                  <button
                    type="button"
                    onClick={() => addTag(tagDraft)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg text-xs uppercase tracking-widest"
                  >
                    + Añadir
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-2 italic">
                  Libres — úsalas para lo que te sea útil (patrón de conjugación, tema, dificultad...).
                </p>
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
