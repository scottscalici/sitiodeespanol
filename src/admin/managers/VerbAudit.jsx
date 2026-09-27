import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getCachedBucketedCollection, invalidateCollectionCache, getBucketId } from '../../utils/firestoreCache';
import { VERB_TENSES, VERB_SUBJECTS } from '../../utils/verbTenses';
import { inferVerbTags } from '../../utils/verbTagInference';

// A tense only counts as a gap if it's PARTIALLY filled (some subjects
// done, others not) — a tense nobody has touched yet for this verb isn't
// a data problem, just unstarted work.
const auditVerb = (verb) => {
  const missingEnglish = !verb.translations?.infinitivo?.english?.trim();
  const missingSpanish = !verb.translations?.infinitivo?.target?.trim();

  const partialTenses = [];
  VERB_TENSES.forEach((tense) => {
    const cells = verb.tenses?.[tense.id];
    if (!cells) return;
    const missingSubjects = VERB_SUBJECTS.filter((s) => !cells[s.id]?.target?.trim());
    const filledCount = VERB_SUBJECTS.length - missingSubjects.length;
    if (filledCount > 0 && missingSubjects.length > 0) {
      partialTenses.push({ tenseId: tense.id, tenseLabel: tense.label, missing: missingSubjects.map((s) => s.label) });
    }
  });

  return { missingEnglish, missingSpanish, partialTenses };
};

export default function VerbAudit() {
  const [verbs, setVerbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onlyGaps, setOnlyGaps] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [applying, setApplying] = useState(false);
  const [status, setStatus] = useState('');

  const loadVerbs = async () => {
    try {
      const list = await getCachedBucketedCollection('verbs');
      setVerbs(list.sort((a, b) => (a.palabra || '').localeCompare(b.palabra || '')));
    } catch (err) {
      console.error('Error loading verbs for audit:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVerbs();
  }, []);

  const rows = useMemo(() => {
    return verbs
      .filter((v) => (v.palabra || '').toLowerCase().includes(search.toLowerCase()))
      .map((verb) => {
        const audit = auditVerb(verb);
        const existingTags = verb.tags || [];
        const suggestedTags = inferVerbTags(verb).filter((t) => !existingTags.includes(t));
        const hasGap = audit.missingEnglish || audit.missingSpanish || audit.partialTenses.length > 0;
        return { verb, audit, suggestedTags, hasGap };
      })
      .filter((r) => !onlyGaps || r.hasGap || r.suggestedTags.length > 0);
  }, [verbs, search, onlyGaps]);

  const toggleSelected = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllWithSuggestions = () => {
    setSelected(new Set(rows.filter((r) => r.suggestedTags.length > 0).map((r) => r.verb.id)));
  };

  // Writes the FULL verb object back (not just the tags field) — a
  // narrower dot-path update to just `.tags` would be unsafe for a verb
  // that hasn't been "promoted" into its bucket yet: it would create a
  // bucket entry containing ONLY a tags field, silently dropping every
  // other field that verb has (translations, tenses, etc.), since a
  // dot-path merge on a not-yet-existing nested key creates just that key.
  const applySuggestedTagsToSelected = async () => {
    setApplying(true);
    setStatus('');
    try {
      const bucketUpdates = {}; // bucketId -> { 'items.<id>': fullVerbObject }
      let count = 0;
      rows.forEach(({ verb, suggestedTags }) => {
        if (!selected.has(verb.id) || suggestedTags.length === 0) return;
        const { id, ...verbData } = verb;
        const mergedTags = [...new Set([...(verb.tags || []), ...suggestedTags])];
        const bucketId = getBucketId(id);
        if (!bucketUpdates[bucketId]) bucketUpdates[bucketId] = {};
        bucketUpdates[bucketId][`items.${id}`] = { ...verbData, tags: mergedTags };
        count += 1;
      });

      if (count === 0) {
        setStatus('Nada seleccionado con etiquetas sugeridas pendientes.');
        return;
      }

      await Promise.all(
        Object.entries(bucketUpdates).map(([bucketId, updates]) =>
          setDoc(doc(db, 'verbs', bucketId), updates, { merge: true })
        )
      );
      invalidateCollectionCache('verbs');
      setSelected(new Set());
      await loadVerbs();
      setStatus(`✅ Etiquetas aplicadas a ${count} verbo(s).`);
    } catch (err) {
      console.error('Error applying suggested tags:', err);
      setStatus('❌ Error al aplicar etiquetas. Revisa la consola.');
    } finally {
      setApplying(false);
    }
  };

  const gapCount = rows.filter((r) => r.hasGap).length;
  const suggestionCount = rows.filter((r) => r.suggestedTags.length > 0).length;

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
            <span>🔍</span> Auditoría de Verbos
          </h2>
          <Link to="/admin-daily-plan-hub" className="text-slate-400 hover:text-white text-xs font-bold border border-slate-700 px-3 py-1.5 rounded-lg">
            ← Hub
          </Link>
        </div>

        {loading ? (
          <p className="text-slate-500 text-sm italic">Cargando {verbs.length ? `(${verbs.length} verbos)` : '...'}</p>
        ) : (
          <>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-wrap items-center gap-4">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar verbo..."
                className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-sm flex-1 min-w-[160px] focus:outline-none focus:border-amber-500"
              />
              <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-widest cursor-pointer">
                <input type="checkbox" checked={onlyGaps} onChange={(e) => setOnlyGaps(e.target.checked)} />
                Solo con huecos o sugerencias
              </label>
              <span className="text-xs text-slate-500">
                {rows.length} verbo(s) mostrados · {gapCount} con huecos de datos · {suggestionCount} con etiquetas sugeridas
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex items-center gap-4">
              <button
                type="button"
                onClick={selectAllWithSuggestions}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 uppercase tracking-widest"
              >
                Seleccionar todos con sugerencias ({suggestionCount})
              </button>
              <button
                type="button"
                onClick={applySuggestedTagsToSelected}
                disabled={applying || selected.size === 0}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-black rounded-lg text-xs uppercase tracking-widest"
              >
                {applying ? 'Aplicando...' : `✨ Aplicar etiquetas sugeridas (${selected.size} seleccionado(s))`}
              </button>
              {status && <span className="text-xs font-bold text-slate-300">{status}</span>}
            </div>

            <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-12 gap-2 p-3 bg-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <div className="col-span-1"></div>
                <div className="col-span-2">Verbo</div>
                <div className="col-span-4">Huecos de datos</div>
                <div className="col-span-3">Etiquetas sugeridas</div>
                <div className="col-span-2"></div>
              </div>
              <div className="divide-y divide-slate-800 max-h-[65vh] overflow-y-auto">
                {rows.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500 italic">Sin resultados.</p>
                ) : (
                  rows.map(({ verb, audit, suggestedTags }) => (
                    <div key={verb.id} className="grid grid-cols-12 gap-2 p-3 items-start text-xs">
                      <div className="col-span-1">
                        {suggestedTags.length > 0 && (
                          <input
                            type="checkbox"
                            checked={selected.has(verb.id)}
                            onChange={() => toggleSelected(verb.id)}
                          />
                        )}
                      </div>
                      <div className="col-span-2 font-bold text-white">{verb.palabra}</div>
                      <div className="col-span-4 space-y-1">
                        {audit.missingEnglish && <p className="text-rose-400">Falta infinitivo (inglés)</p>}
                        {audit.missingSpanish && <p className="text-rose-400">Falta infinitivo (español)</p>}
                        {audit.partialTenses.map((t) => (
                          <p key={t.tenseId} className="text-amber-400">
                            {t.tenseLabel}: falta {t.missing.join(', ')}
                          </p>
                        ))}
                        {!audit.missingEnglish && !audit.missingSpanish && audit.partialTenses.length === 0 && (
                          <p className="text-slate-600 italic">Sin huecos</p>
                        )}
                      </div>
                      <div className="col-span-3 flex flex-wrap gap-1">
                        {suggestedTags.length === 0 ? (
                          <span className="text-slate-600 italic">—</span>
                        ) : (
                          suggestedTags.map((t) => (
                            <span key={t} className="bg-slate-800 border border-amber-700/50 text-amber-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              {t}
                            </span>
                          ))
                        )}
                      </div>
                      <div className="col-span-2 text-right">
                        <Link
                          to={`/admin-secret-portal-verb-editor?verbo=${encodeURIComponent(verb.id)}`}
                          className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 uppercase tracking-widest"
                        >
                          Editar →
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
