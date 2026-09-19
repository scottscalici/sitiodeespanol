import React, { useState, useEffect, useMemo } from 'react';
import { collection, doc, getDocs, setDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useNavigate } from 'react-router-dom';
import { AVAILABLE_TENSES, SUBJECTS, PAIR_MAP, POOL_MAP, DISTRACTOR_MODES } from '../../utils/distractorConfig';

const BLANK_EXAMPLE = 'Yo [[fui]] a la tienda ayer.';

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

  const fetchSentences = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'sentence_bank'));
      setSentences(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
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
    setEditingId('new');
    setDraft(emptyDraft());
  };

  const startEditSentence = (s) => {
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
    if (!draft.spanish.includes('[[') || !draft.spanish.includes(']]')) {
      setStatus('❌ La oración necesita la respuesta marcada así: [[respuesta]]');
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
            {!draft ? (
              <p className="text-slate-500 text-sm text-center py-12">Selecciona una oración para editar, o crea una nueva.</p>
            ) : (
              <div className="space-y-4">
                <h3 className="text-sm font-black text-cyan-400 uppercase tracking-widest">
                  {editingId === 'new' ? 'Nueva Oración' : 'Editando Oración'}
                </h3>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Oración (marca la respuesta con [[así]])</label>
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