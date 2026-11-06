import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { getCachedCollection, getCachedBucketedCollection } from '../../../utils/firestoreCache';
import { fetchEvaluacionOptions, resolveCurrentEvalDia } from '../../../utils/evaluaciones';
import { generateVerbQuestions } from '../../../utils/verbQuestionGenerator';
import { generateSentenceRecallQuestions } from '../../../utils/reassessmentSentenceGenerator';
import { VERB_TENSES } from '../../../utils/verbTenses';

// Phase A of Reassessments: define, per gate-enabled Practice Hub circle
// (the same circleId `${path_id}__${pod.id}` the recuperación gate already
// uses — see Recuperacion.jsx), which verbGroups to draw from, how many
// questions per group, and a time limit — then preview a live random draw
// using the site's existing generateVerbQuestions. No gating/enforcement
// yet (that's a later phase): this only builds and verifies the
// question-generation side in isolation, config saved to
// reassessment_configs/{circleId}.
export default function ReassessmentConfigManager() {
  const [course, setCourse] = useState('s2');
  const [circles, setCircles] = useState([]);
  const [verbGroups, setVerbGroups] = useState([]);
  const [masterVerbsMap, setMasterVerbsMap] = useState({});
  const [sentenceBank, setSentenceBank] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedCircleId, setSelectedCircleId] = useState('');
  const [groupRows, setGroupRows] = useState([]); // { groupId, tense, count }
  const [sentenceRows, setSentenceRows] = useState([]); // { tag, count } — discernment questions drawn from tagged Sentence Bank [[forma|infinitivo]] entries
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(15);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [previewQuestions, setPreviewQuestions] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [podDocs, groups, verbsArray, s2Options, s4Options, sentences] = await Promise.all([
          getCachedCollection('practice_pods'),
          getCachedCollection('verbGroups'),
          getCachedBucketedCollection('verbs'),
          fetchEvaluacionOptions('s2'),
          fetchEvaluacionOptions('s4'),
          getCachedCollection('sentence_bank'),
        ]);
        setSentenceBank(sentences);
        const evalOptionsByCourse = { s2: s2Options, s4: s4Options };

        const allCircles = [];
        podDocs
          .filter((d) => Array.isArray(d.pods))
          .forEach((d) => {
            d.pods.forEach((pod) => {
              if (!pod.gateConfig || !pod.evalLink) return;
              allCircles.push({
                id: `${d.path_id}__${pod.id}`,
                course: d.course,
                title: pod.title,
                evalLabel: pod.evalLink.label,
                evalDia: resolveCurrentEvalDia(evalOptionsByCourse[d.course] || [], pod.evalLink),
              });
            });
          });
        allCircles.sort((a, b) => (b.evalDia || 0) - (a.evalDia || 0));
        setCircles(allCircles);
        setVerbGroups([...groups].sort((a, b) => (a.name || '').localeCompare(b.name || '')));

        const verbsMap = {};
        verbsArray.forEach((v) => {
          verbsMap[v.id] = v;
        });
        setMasterVerbsMap(verbsMap);
      } catch (err) {
        console.error('Error loading reassessment config data:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const visibleCircles = circles.filter((c) => c.course === course);
  const selectedCircle = circles.find((c) => c.id === selectedCircleId) || null;

  const loadExistingConfig = async (circleId) => {
    setSelectedCircleId(circleId);
    setPreviewQuestions(null);
    setStatus('');
    if (!circleId) {
      setGroupRows([]);
      setSentenceRows([]);
      return;
    }
    try {
      const snap = await getDoc(doc(db, 'reassessment_configs', circleId));
      if (snap.exists()) {
        const data = snap.data();
        setGroupRows(data.groups || []);
        setSentenceRows(data.sentenceBlocks || []);
        setTimeLimitMinutes(Math.round((data.timeLimitSeconds || 900) / 60));
      } else {
        setGroupRows([]);
        setSentenceRows([]);
        setTimeLimitMinutes(15);
      }
    } catch (err) {
      console.error('Error loading reassessment config:', err);
    }
  };

  const addGroupRow = () => setGroupRows([...groupRows, { groupId: '', tense: 'presente', count: 3 }]);
  const updateGroupRow = (idx, patch) => setGroupRows(groupRows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const removeGroupRow = (idx) => setGroupRows(groupRows.filter((_, i) => i !== idx));

  // Only tags that actually have at least one [[forma|infinitivo]] sentence
  // are offered — a tag used only for [[respuesta]]/other sentence shapes
  // would silently draw zero questions (generateSentenceRecallQuestions
  // skips anything without that marker), so there's no point listing it here.
  const availableSentenceTags = [...new Set(
    sentenceBank.filter((s) => /\[\[(.*?)\|(.*?)\]\]/.test(s.spanish || '')).flatMap((s) => s.grammarTags || [])
  )].sort();

  const addSentenceRow = () => setSentenceRows([...sentenceRows, { tag: '', count: 3 }]);
  const updateSentenceRow = (idx, patch) => setSentenceRows(sentenceRows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const removeSentenceRow = (idx) => setSentenceRows(sentenceRows.filter((_, i) => i !== idx));

  const validRows = groupRows.filter((r) => r.groupId);
  const validSentenceRows = sentenceRows.filter((r) => r.tag);
  const totalQuestions =
    validRows.reduce((sum, r) => sum + (Number(r.count) || 0), 0) +
    validSentenceRows.reduce((sum, r) => sum + (Number(r.count) || 0), 0);

  const blocksFromRows = () =>
    validRows.map((r) => {
      const group = verbGroups.find((g) => g.id === r.groupId);
      return {
        label: group?.name || r.groupId,
        tense: r.tense,
        allowedVerbs: group?.verbIds || [],
        count: Number(r.count) || 0,
        specificVerb: 'any',
        targetSubject: 'any',
      };
    });

  const sentenceBlocksFromRows = () =>
    validSentenceRows.map((r) => ({ label: r.tag, tag: r.tag, count: Number(r.count) || 0 }));

  const handlePreview = () => {
    const verbQuestions = generateVerbQuestions(blocksFromRows(), masterVerbsMap, { withoutReplacement: true });
    const sentenceQuestions = generateSentenceRecallQuestions(sentenceBlocksFromRows(), sentenceBank, { withoutReplacement: true });
    setPreviewQuestions([...verbQuestions, ...sentenceQuestions]);
  };

  const handleSave = async () => {
    if (!selectedCircle) return;
    setSaving(true);
    setStatus('');
    try {
      await setDoc(doc(db, 'reassessment_configs', selectedCircle.id), {
        circleId: selectedCircle.id,
        course: selectedCircle.course,
        evalLabel: selectedCircle.evalLabel,
        groups: validRows,
        sentenceBlocks: validSentenceRows,
        timeLimitSeconds: Math.max(60, Number(timeLimitMinutes) || 15) * 60,
        updatedAt: new Date().toISOString(),
      });
      setStatus('✅ Guardado');
    } catch (err) {
      console.error('Error saving reassessment config:', err);
      setStatus('❌ Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-white text-center p-10 font-bold animate-pulse uppercase tracking-widest">Cargando...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6 text-white font-sans">
      <div className="flex justify-between items-start mb-6">
        <h2 className="text-2xl font-black uppercase tracking-widest text-violet-400 flex items-center gap-3">
          <span>🎲</span> Configurar Reevaluaciones
        </h2>
        <div className="flex gap-2">
          <Link to="/admin-class-schedule" className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700">
            🕐 Horario
          </Link>
          <Link to="/admin-secret-portal-master" className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700">
            ← Volver
          </Link>
        </div>
      </div>

      <div className="flex gap-1.5 mb-4">
        {['s2', 's4'].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setCourse(c);
              loadExistingConfig('');
            }}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest border ${
              course === c ? 'bg-violet-600 border-violet-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            {c.toUpperCase()}
          </button>
        ))}
      </div>

      <select
        value={selectedCircleId}
        onChange={(e) => loadExistingConfig(e.target.value)}
        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white mb-6 outline-none focus:border-violet-500"
      >
        <option value="">Elige una evaluación con gate habilitado...</option>
        {visibleCircles.map((c) => (
          <option key={c.id} value={c.id}>
            Día {c.evalDia ?? '?'} — {c.evalLabel} ({c.title})
          </option>
        ))}
      </select>

      {visibleCircles.length === 0 && (
        <p className="text-sm text-slate-500 italic text-center py-6">
          Ningún pod de este curso tiene gate + evaluación vinculada todavía (configúralo en el Pod Creator).
        </p>
      )}

      {selectedCircle && (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-sm">Grupos de verbos</h3>
            <button
              type="button"
              onClick={addGroupRow}
              className="text-[10px] font-black uppercase tracking-widest bg-violet-600 hover:bg-violet-500 px-3 py-1.5 rounded-lg"
            >
              + Agregar grupo
            </button>
          </div>

          {groupRows.length === 0 ? (
            <p className="text-sm text-slate-500 italic">Agrega al menos un grupo de verbos.</p>
          ) : (
            <div className="space-y-2">
              {groupRows.map((row, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <select
                    value={row.groupId}
                    onChange={(e) => updateGroupRow(idx, { groupId: e.target.value })}
                    className="flex-1 min-w-[160px] bg-slate-800 border border-slate-700 rounded-md p-2 text-xs"
                  >
                    <option value="">Elige un grupo...</option>
                    {verbGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.verbIds?.length || 0} verbos)
                      </option>
                    ))}
                  </select>
                  <select
                    value={row.tense}
                    onChange={(e) => updateGroupRow(idx, { tense: e.target.value })}
                    className="bg-slate-800 border border-slate-700 rounded-md p-2 text-xs"
                  >
                    {VERB_TENSES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={row.count}
                    onChange={(e) => updateGroupRow(idx, { count: e.target.value })}
                    className="w-20 bg-slate-800 border border-slate-700 rounded-md p-2 text-center text-sm font-bold"
                  />
                  <button type="button" onClick={() => removeGroupRow(idx)} className="text-rose-400 hover:text-rose-300 text-xs font-black px-2">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <h3 className="font-bold text-white text-sm">Oraciones de discernimiento (Sentence Bank)</h3>
            <button
              type="button"
              onClick={addSentenceRow}
              className="text-[10px] font-black uppercase tracking-widest bg-violet-600 hover:bg-violet-500 px-3 py-1.5 rounded-lg"
            >
              + Agregar etiqueta
            </button>
          </div>
          <p className="text-xs text-slate-500 italic -mt-2">
            Para gramática donde lo que se evalúa es ELEGIR el tiempo correcto (ej. pretérito vs. imperfecto) a partir de
            una pista en la oración — saca al azar oraciones [[forma|infinitivo]] etiquetadas con esta etiqueta.
          </p>

          {sentenceRows.length > 0 && (
            <div className="space-y-2">
              {sentenceRows.map((row, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <select
                    value={row.tag}
                    onChange={(e) => updateSentenceRow(idx, { tag: e.target.value })}
                    className="flex-1 min-w-[160px] bg-slate-800 border border-slate-700 rounded-md p-2 text-xs"
                  >
                    <option value="">Elige una etiqueta...</option>
                    {availableSentenceTags.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={row.count}
                    onChange={(e) => updateSentenceRow(idx, { count: e.target.value })}
                    className="w-20 bg-slate-800 border border-slate-700 rounded-md p-2 text-center text-sm font-bold"
                  />
                  <button type="button" onClick={() => removeSentenceRow(idx)} className="text-rose-400 hover:text-rose-300 text-xs font-black px-2">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          {availableSentenceTags.length === 0 && (
            <p className="text-xs text-slate-600 italic">
              Ninguna oración en Sentence Bank tiene todavía el formato [[forma|infinitivo]] con una etiqueta — agrega
              algunas desde el Sentence Manager para poder usarlas aquí.
            </p>
          )}

          <div className="flex items-center gap-4 pt-2 border-t border-slate-800">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Límite de tiempo (min)</label>
            <input
              type="number"
              min="1"
              value={timeLimitMinutes}
              onChange={(e) => setTimeLimitMinutes(e.target.value)}
              className="w-20 bg-slate-800 border border-slate-700 rounded-md p-2 text-center text-sm font-bold"
            />
            <span className="text-xs text-slate-500 font-bold ml-auto">{totalQuestions} preguntas totales</span>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handlePreview}
              disabled={validRows.length === 0 && validSentenceRows.length === 0}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-black uppercase tracking-widest rounded-lg disabled:opacity-50"
            >
              🎲 Vista previa (nuevo sorteo)
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || (validRows.length === 0 && validSentenceRows.length === 0)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-lg disabled:opacity-50"
            >
              {saving ? '...' : 'Guardar configuración'}
            </button>
            {status && <span className="text-xs font-bold text-slate-400 self-center">{status}</span>}
          </div>
        </div>
      )}

      {previewQuestions && (
        <div className="mt-6 bg-slate-900 border border-slate-700 rounded-xl p-5">
          <h3 className="font-bold text-white text-sm mb-3">
            Vista previa — {previewQuestions.length} de {totalQuestions} preguntas generadas
          </h3>
          {previewQuestions.length < totalQuestions && (
            <p className="text-amber-400 text-xs font-bold mb-3">
              ⚠️ Algunos grupos/etiquetas no tienen suficientes verbos u oraciones con datos para esto — agrega más al
              grupo/etiqueta o baja el conteo.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {previewQuestions.map((q, i) =>
              q.type === 'sentence_recall' ? (
                <div key={i} className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm">
                  <span className="text-white">{q.subject}</span>
                  <span className="text-slate-500"> ({q.infinitive})</span>
                  <p className="text-emerald-400 font-black mt-1">{q.forma}</p>
                </div>
              ) : (
                <div key={i} className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm">
                  <span className="text-slate-400">{q.sujeto}</span> <span className="font-bold text-white">{q.palabra}</span>
                  <span className="text-slate-500"> ({q.tense})</span>
                  <p className="text-emerald-400 font-black mt-1">{q.forma}</p>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
