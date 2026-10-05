import React, { useState, useEffect, useMemo } from 'react';
import { collection, doc, setDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useNavigate } from 'react-router-dom';
import { getCachedCollection, invalidateCollectionCache } from '../../utils/firestoreCache';
import { AVAILABLE_TENSES, SUBJECTS, PAIR_MAP, POOL_MAP, DISTRACTOR_MODES } from '../../utils/distractorConfig';

const BLANK_EXAMPLE = 'Yo [[fui]] a la tienda ayer.';
const SYNTAX_HELP = [
  '[[respuesta]] → un solo hueco: la mitad de las veces sale como opción múltiple, la otra mitad como oración desordenada (reconstruye la oración completa) — el "Modo de Distractores" de abajo solo cambia DE DÓNDE salen las opciones/palabras incorrectas en ambos casos.',
  '[[verbo|infinitivo]] → hueco de verbo (ordena y conjuga).',
  '[[a]] ... [[b]] ... [[c]] (2 o más) → la mitad de las veces, cloze múltiple con menús desplegables (sin traducción al inglés — se daría la respuesta); la otra mitad, oración desordenada con traducción (reconstruye la oración con todos los huecos ya llenos).',
  '{{palabra}} ... {{palabra}} (exactamente 2) → la mitad de las veces, Lógico o Ilógico (intercambia las dos palabras la mitad de esas veces; sin traducción — se daría la respuesta); la otra mitad, oración desordenada con traducción (siempre en orden lógico).',
  'Afirmación || ¿Pregunta correcta? → opción múltiple de "formula la pregunta".',
  'Sin ninguna marca → constructor de oraciones (arrastra las palabras en orden) — o escritura/dictado si el segmento pide ese tipo de pregunta.',
].join('\n');

// Bulk-paste format: one sentence per line, columns separated by " | "
// (a pipe WITH a space on each side) — deliberately distinct from the two
// in-sentence markup patterns that also use a bare pipe character with no
// surrounding space ([[verbo|infinitivo]] and the "||" reverse-question
// marker), so splitting on /\s\|\s/ never mistakes either of those for a
// column break. Always imports as distractorMode 'none' — the verb-contrast
// and fixed-pool modes need picking from this app's own verb/pool data, not
// something an LLM can fill in, so those stay on the one-at-a-time editor.
const parseBulkSentenceRow = (line) => {
  const parts = line.split(/\s\|\s/).map((s) => s.trim());
  const [spanish, english = '', chapterId = '', tagsRaw = ''] = parts;
  if (!spanish) return null;
  return {
    spanish,
    english,
    chapterId,
    grammarTags: tagsRaw.split(',').map((t) => t.trim()).filter(Boolean),
    distractorMode: 'none',
    pairTag: '',
    poolTag: '',
    targetLemma: '',
    targetTense: '',
    targetSubject: '',
  };
};

// A ready-to-copy prompt so the admin can hand an LLM the exact row format
// above plus this app's own markup rules, instead of re-explaining it from
// scratch every time. [CORCHETES] are placeholders for the admin to fill in
// before sending it.
const BULK_LLM_PROMPT = `Genera [NÚMERO] oraciones en español para practicar [TEMA/GRAMÁTICA], nivel [NIVEL], para el Capítulo [CAPÍTULO].

Escribe cada oración en su PROPIA línea, en texto plano (sin numerar, sin viñetas, sin bloque de código, sin encabezados), en este formato EXACTO con cuatro columnas separadas por " | " (un espacio, un pipe, un espacio):

español | inglés | capítulo | etiquetas

Reglas para la columna "español" — marca la respuesta usando EXACTAMENTE una de estas formas:
- [[respuesta]] → un solo hueco. Ej: Yo [[fui]] a la tienda ayer.
- [[forma_conjugada|infinitivo]] → hueco de verbo: la forma conjugada, un pipe SIN espacios, y el infinitivo, todo dentro de los mismos corchetes dobles. Ej: Ella [[comió|comer]] pizza.
- [[a]] ... [[b]] ... [[c]] → dos o más huecos en la misma oración. Ej: [[Fui]] a la tienda y [[compré]] pan.
- {{palabra}} ... {{palabra}} → exactamente dos palabras marcadas (para lógico/ilógico). Ej: El hielo está {{caliente}} y el fuego está {{frío}}.
- Afirmación || ¿Pregunta correcta? → dos pipes juntos SIN espacios, para practicar formular la pregunta. Ej: Tiene veinte años. || ¿Cuántos años tiene?
- Sin ninguna marca → oración normal, para armar/dictado. Ej: Ella vive en Madrid.

Columnas restantes:
- inglés: traducción completa al inglés (déjala vacía si no aplica, pero no quites la columna).
- capítulo: el id del capítulo, ej. 8 (puede ir vacío).
- etiquetas: palabras clave separadas por comas, ej. pretérito, viajes (puede ir vacío).

MUY IMPORTANTE:
- La única forma de pipe con ESPACIOS a cada lado (" | ") es la que separa las cuatro columnas. En [[forma|infinitivo]] y en || el pipe NO lleva espacios.
- No generes oraciones con pares de contraste de verbos (eso se configura aparte, a mano, en la app).
- No agregues nada más que las líneas de oraciones — ni introducción ni explicación.

Ejemplo de salida:
Yo [[fui]] a la tienda ayer. | I went to the store yesterday. | 8 | pretérito
Ella [[comió|comer]] pizza anoche. | She ate pizza last night. | 8 | pretérito, comida
El hielo está {{caliente}} y el fuego está {{frío}}. |  | 8 | lógico
Tiene veinte años. || ¿Cuántos años tiene? | He is twenty years old. | 8 | preguntas`;

const emptyDraft = () => ({
  spanish: '',
  english: '',
  chapterId: '',
  grammarTags: '',
  distractorMode: 'none',
  pairTag: '',
  poolTag: '',
  targetLemma: '',
  targetTense: 'presente',
  targetSubject: 'yo',
});

export default function SentenceManager() {
  const navigate = useNavigate();
  const [sentences, setSentences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  const [chapterFilter, setChapterFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);

  const fetchSentences = async () => {
    setLoading(true);
    try {
      // Shared cache — FormLearningPath also reads sentence_bank in full.
      setSentences(await getCachedCollection('sentence_bank'));
    } catch (err) {
      console.error('Error fetching sentence bank:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSentences();
  }, []);

  const availableChapters = useMemo(
    () => [...new Set(sentences.map((s) => s.chapterId).filter(Boolean))].sort(),
    [sentences]
  );

  const availableTags = useMemo(
    () => [...new Set(sentences.flatMap((s) => s.grammarTags || []))].sort(),
    [sentences]
  );

  const filteredSentences = sentences.filter((s) => {
    if (chapterFilter !== 'all' && s.chapterId !== chapterFilter) return false;
    if (tagFilter !== 'all' && !(s.grammarTags || []).includes(tagFilter)) return false;
    if (search && !s.spanish?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const startNewSentence = () => {
    setBulkOpen(false);
    setEditingId('new');
    setDraft(emptyDraft());
  };

  const openBulkImport = () => {
    cancelEdit();
    setBulkStatus('');
    setBulkOpen(true);
  };

  const closeBulkImport = () => {
    setBulkOpen(false);
    setBulkText('');
    setBulkStatus('');
  };

  const handleBulkImport = async () => {
    // Trimming here is only to detect blank lines — NOT applied to the line
    // itself before parsing, since a trailing empty column (e.g. no tags)
    // legitimately ends in " | " and trimming the whole line would eat that
    // space, corrupting the separator parseBulkSentenceRow looks for.
    const rows = bulkText.split('\n').filter((l) => l.trim());
    const parsed = rows.map(parseBulkSentenceRow).filter(Boolean);
    if (parsed.length === 0) {
      setBulkStatus('❌ No se encontró ninguna oración válida para importar.');
      return;
    }
    setBulkSaving(true);
    setBulkStatus('');
    try {
      await Promise.all(
        parsed.map((payload) =>
          addDoc(collection(db, 'sentence_bank'), { ...payload, createdAt: serverTimestamp(), lastUpdated: serverTimestamp() })
        )
      );
      invalidateCollectionCache('sentence_bank');
      await fetchSentences();
      setBulkStatus(`✅ ${parsed.length} oración${parsed.length === 1 ? '' : 'es'} importada${parsed.length === 1 ? '' : 's'}.`);
      setBulkText('');
    } catch (err) {
      console.error('Error bulk-importing sentences:', err);
      setBulkStatus('❌ Error al importar. Tus líneas no se perdieron — intenta de nuevo.');
    } finally {
      setBulkSaving(false);
    }
  };

  const copyLlmPrompt = async () => {
    try {
      await navigator.clipboard.writeText(BULK_LLM_PROMPT);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    } catch (err) {
      console.error('Error copying prompt:', err);
    }
  };

  const startEditSentence = (s) => {
    setBulkOpen(false);
    setEditingId(s.id);
    setDraft({
      spanish: s.spanish || '',
      english: s.english || '',
      chapterId: s.chapterId || '',
      grammarTags: (s.grammarTags || []).join(', '),
      distractorMode: s.distractorMode || 'none',
      pairTag: s.pairTag || '',
      poolTag: s.poolTag || '',
      targetLemma: s.targetLemma || '',
      targetTense: s.targetTense || 'presente',
      targetSubject: s.targetSubject || 'yo',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const updateDraft = (field, value) => setDraft((prev) => ({ ...prev, [field]: value }));

  const saveDraft = async () => {
    const hasCloze = draft.spanish.includes('[[') && draft.spanish.includes(']]');
    const hasSwap = draft.spanish.includes('{{') && draft.spanish.includes('}}');
    const hasReverse = draft.spanish.includes('||');
    if (!hasCloze && !hasSwap && !hasReverse) {
      setStatus('❌ Marca la oración con [[respuesta]], {{palabra}}...{{palabra}}, o "afirmación || pregunta".');
      return;
    }
    if (draft.distractorMode === 'binary_verb' || draft.distractorMode === 'quad_verb') {
      if (!draft.targetLemma.trim() || !draft.pairTag) {
        setStatus('❌ Los modos de verbo necesitan un lema (infinitivo) y un par de contraste.');
        return;
      }
    }
    if (draft.distractorMode === 'fixed_pool' && !draft.poolTag) {
      setStatus('❌ Selecciona un banco de palabras fijo.');
      return;
    }

    setSaving(true);
    setStatus('');
    try {
      const payload = {
        spanish: draft.spanish.trim(),
        english: draft.english.trim(),
        chapterId: draft.chapterId.trim(),
        grammarTags: draft.grammarTags.split(',').map((t) => t.trim()).filter(Boolean),
        distractorMode: draft.distractorMode,
        pairTag: draft.distractorMode === 'binary_verb' || draft.distractorMode === 'quad_verb' ? draft.pairTag : '',
        poolTag: draft.distractorMode === 'fixed_pool' ? draft.poolTag : '',
        targetLemma: draft.distractorMode === 'binary_verb' || draft.distractorMode === 'quad_verb' ? draft.targetLemma.trim() : '',
        targetTense: draft.distractorMode === 'binary_verb' || draft.distractorMode === 'quad_verb' ? draft.targetTense : '',
        targetSubject: draft.distractorMode === 'binary_verb' || draft.distractorMode === 'quad_verb' ? draft.targetSubject : '',
        lastUpdated: serverTimestamp(),
      };

      if (editingId === 'new') {
        await addDoc(collection(db, 'sentence_bank'), { ...payload, createdAt: serverTimestamp() });
        setStatus('✅ Oración creada.');
      } else {
        await setDoc(doc(db, 'sentence_bank', editingId), payload, { merge: true });
        setStatus('✅ Oración actualizada.');
      }

      invalidateCollectionCache('sentence_bank');
      cancelEdit();
      await fetchSentences();
    } catch (err) {
      console.error('Error saving sentence:', err);
      setStatus('❌ Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const deleteSentence = async (id) => {
    if (!window.confirm('¿Eliminar esta oración permanentemente?')) return;
    try {
      await deleteDoc(doc(db, 'sentence_bank', id));
      invalidateCollectionCache('sentence_bank');
      setSentences((prev) => prev.filter((s) => s.id !== id));
      if (editingId === id) cancelEdit();
    } catch (err) {
      console.error('Error deleting sentence:', err);
      alert('Error al eliminar.');
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest bg-slate-950 min-h-screen text-white">
        Cargando Sentence Manager...
      </div>
    );
  }

  const showVerbFields = draft?.distractorMode === 'binary_verb' || draft?.distractorMode === 'quad_verb';
  const showPoolField = draft?.distractorMode === 'fixed_pool';

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans p-4 sm:p-8 pb-24">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
              <span>✍️</span> Sentence Manager
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Banco central de oraciones. Marca la respuesta con [[así]]. Independiente de capítulo, pero filtrable por capítulo y etiqueta.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={startNewSentence}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer"
            >
              + Nueva Oración
            </button>
            <button
              onClick={openBulkImport}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer"
            >
              📋 Importar en Lote
            </button>
            <button
              onClick={() => navigate('/admin-daily-plan-hub')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs px-4 py-2.5 rounded-xl border border-slate-700 cursor-pointer"
            >
              ← Hub
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr,420px] gap-6">
          {/* LEFT: LIBRARY */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap gap-3">
              <select
                value={chapterFilter}
                onChange={(e) => setChapterFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-bold text-cyan-400"
              >
                <option value="all">Todos los Capítulos</option>
                {availableChapters.map((c) => (
                  <option key={c} value={c}>Capítulo {c}</option>
                ))}
              </select>
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-bold text-cyan-400"
              >
                <option value="all">Todas las Etiquetas</option>
                {availableTags.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="flex-1 min-w-[140px] bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
              />
              <span className="text-[10px] font-bold text-slate-500 self-center">
                {filteredSentences.length} de {sentences.length}
              </span>
            </div>

            <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
              {filteredSentences.length === 0 && (
                <p className="text-slate-500 text-xs italic text-center py-8">No hay oraciones que coincidan.</p>
              )}
              {filteredSentences.map((s) => (
                <div
                  key={s.id}
                  onClick={() => startEditSentence(s)}
                  className={`p-3 border rounded-xl cursor-pointer transition-all ${
                    editingId === s.id ? 'border-cyan-500 bg-cyan-950/20' : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-start gap-3">
                    <p className="text-sm font-medium text-slate-200">{s.spanish}</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSentence(s.id); }}
                      className="text-rose-400 hover:text-rose-300 text-xs shrink-0"
                    >
                      🗑️
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {s.chapterId && (
                      <span className="text-[10px] font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded">Cap. {s.chapterId}</span>
                    )}
                    {(s.grammarTags || []).map((t) => (
                      <span key={t} className="text-[10px] font-bold bg-purple-950/50 text-purple-300 px-2 py-0.5 rounded">{t}</span>
                    ))}
                    {s.distractorMode && s.distractorMode !== 'none' && (
                      <span className="text-[10px] font-bold bg-emerald-950/50 text-emerald-300 px-2 py-0.5 rounded">{s.distractorMode}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: EDITOR */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            {bulkOpen ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest">Importar en Lote</h3>
                  <button onClick={closeBulkImport} className="text-slate-500 hover:text-slate-300 text-xs font-bold">
                    ✕ Cerrar
                  </button>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Instrucciones para pedirle oraciones a una IA
                    </p>
                    <button
                      onClick={copyLlmPrompt}
                      className="shrink-0 bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold text-[10px] px-2.5 py-1.5 rounded-lg border border-slate-700"
                    >
                      {promptCopied ? '✅ Copiado' : '📋 Copiar prompt'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Copia este prompt, reemplaza lo que está entre corchetes (tema, nivel, capítulo, número de oraciones)
                    y pégaselo a tu IA de preferencia. Pega lo que te devuelva directamente en el cuadro de abajo.
                  </p>
                  <pre className="text-[9px] text-slate-500 bg-slate-900 border border-slate-800 rounded-lg p-2 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono">
                    {BULK_LLM_PROMPT}
                  </pre>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">
                    Pega aquí las oraciones (una por línea)
                  </label>
                  <textarea
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    rows={10}
                    placeholder={'Yo [[fui]] a la tienda ayer. | I went to the store yesterday. | 8 | pretérito'}
                    className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-white outline-none focus:border-indigo-500"
                  />
                </div>

                {bulkStatus && (
                  <p className={`text-xs font-bold text-center ${bulkStatus.includes('❌') ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {bulkStatus}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleBulkImport}
                    disabled={bulkSaving || !bulkText.trim()}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg transition-all"
                  >
                    {bulkSaving ? 'Importando...' : 'Importar Oraciones'}
                  </button>
                  <button
                    onClick={closeBulkImport}
                    className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : !draft ? (
              <p className="text-slate-500 text-sm text-center py-12">Selecciona una oración para editar, o crea una nueva.</p>
            ) : (
              <div className="space-y-4">
                <h3 className="text-sm font-black text-cyan-400 uppercase tracking-widest">
                  {editingId === 'new' ? 'Nueva Oración' : 'Editando Oración'}
                </h3>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Oración</label>
                  <p className="text-[10px] text-slate-500 whitespace-pre-line leading-relaxed">{SYNTAX_HELP}</p>
                  <textarea
                    value={draft.spanish}
                    onChange={(e) => updateDraft('spanish', e.target.value)}
                    placeholder={BLANK_EXAMPLE}
                    rows={2}
                    className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Traducción (Inglés)</label>
                  <input
                    type="text"
                    value={draft.english}
                    onChange={(e) => updateDraft('english', e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Capítulo</label>
                    <input
                      type="text"
                      value={draft.chapterId}
                      onChange={(e) => updateDraft('chapterId', e.target.value)}
                      placeholder="8"
                      className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Etiquetas (separadas por coma)</label>
                    <input
                      type="text"
                      value={draft.grammarTags}
                      onChange={(e) => updateDraft('grammarTags', e.target.value)}
                      placeholder="pretérito, viajes"
                      className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-4">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Modo de Distractores</label>
                  <select
                    value={draft.distractorMode}
                    onChange={(e) => updateDraft('distractorMode', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-cyan-400 font-bold"
                  >
                    {DISTRACTOR_MODES.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>

                  {showVerbFields && (
                    <div className="mt-3 space-y-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Lema (infinitivo, tal como aparece en la colección "verbs")</label>
                        <input
                          type="text"
                          value={draft.targetLemma}
                          onChange={(e) => updateDraft('targetLemma', e.target.value)}
                          placeholder="ir"
                          className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-sm text-white outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Tiempo Objetivo</label>
                          <select
                            value={draft.targetTense}
                            onChange={(e) => updateDraft('targetTense', e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white"
                          >
                            {AVAILABLE_TENSES.map((t) => (
                              <option key={t.id} value={t.id}>{t.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Sujeto</label>
                          <select
                            value={draft.targetSubject}
                            onChange={(e) => updateDraft('targetSubject', e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white"
                          >
                            {SUBJECTS.map((s) => (
                              <option key={s.id} value={s.id}>{s.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Par de Contraste</label>
                        <select
                          value={draft.pairTag}
                          onChange={(e) => updateDraft('pairTag', e.target.value)}
                          className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white"
                        >
                          <option value="">-- Selecciona --</option>
                          {Object.entries(PAIR_MAP).map(([key, pair]) => (
                            <option key={key} value={key}>{pair.label}</option>
                          ))}
                        </select>
                      </div>
                      <p className="text-[10px] text-slate-500 italic">
                        El motor buscará en vivo la forma de "{draft.targetLemma || 'lema'}" en el tiempo contrario del par, con el mismo sujeto, para usarla como distractor.
                      </p>
                    </div>
                  )}

                  {showPoolField && (
                    <div className="mt-3 flex flex-col gap-1 bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Banco de Palabras</label>
                      <select
                        value={draft.poolTag}
                        onChange={(e) => updateDraft('poolTag', e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white"
                      >
                        <option value="">-- Selecciona --</option>
                        {Object.entries(POOL_MAP).map(([key, pool]) => (
                          <option key={key} value={key}>{pool.label} ({pool.words.join(', ')})</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-500 italic mt-1">
                        La respuesta marcada en la oración debe ser una de las palabras del banco elegido.
                      </p>
                    </div>
                  )}
                </div>

                {status && (
                  <p className={`text-xs font-bold text-center ${status.includes('❌') ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {status}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={saveDraft}
                    disabled={saving}
                    className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg transition-all"
                  >
                    {saving ? 'Guardando...' : editingId === 'new' ? 'Crear Oración' : 'Actualizar Oración'}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
