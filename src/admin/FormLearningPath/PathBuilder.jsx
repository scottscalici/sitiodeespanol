import React from 'react';
import { QUESTION_TYPE_LABELS, QUESTION_TYPE_ORDER, sumMix } from '../../utils/questionTypes';

export default function PathBuilder({
  contentType,
  setContentType,
  course,
  setCourse,
  pathId,
  setPathId,
  pathTitle,
  setPathTitle,
  isSaving,
  pods,
  handleAddPod,
  handleAddSegment,
  handleDeleteSegment,
  handleDeletePod,
  handleSavePathToFirestore,
  setPods,
  activeSegmentId,
  setActiveSegmentId,
  handleRemoveItem,
  existingPaths,
  handleLoadPath,
  selectedExistingPathId,
  setSelectedExistingPathId,
  handleTogglePod,
  handleMovePod,
  handleMoveSegment,
  selectedBook,
  selectedChapter,
  badgeCatalog,
  onCreateBadge,
  isPracticeHub = false,
  evaluacionOptions = [],
}) {
  const podLabel = isPracticeHub ? 'Círculo' : 'Pod';

  const handleEvalLinkChange = (podIndex, diaStr) => {
    const copy = [...pods];
    if (!diaStr) {
      copy[podIndex].evalLink = null;
      copy[podIndex].gateConfig = null; // a gate is meaningless without a quiz link
    } else {
      const dia = Number(diaStr);
      const match = evaluacionOptions.find((o) => o.dia === dia);
      copy[podIndex].evalLink = match ? { dia: match.dia, label: match.label } : null;
    }
    setPods(copy);
  };

  const DEFAULT_GATE_CONFIG = { questionCount: 50, timeLimitSeconds: 300, passThreshold: 90 };

  const handleGateToggle = (podIndex, enabled) => {
    const copy = [...pods];
    copy[podIndex].gateConfig = enabled ? { ...DEFAULT_GATE_CONFIG } : null;
    setPods(copy);
  };

  const updateGateConfig = (podIndex, field, value) => {
    const copy = [...pods];
    copy[podIndex].gateConfig = { ...copy[podIndex].gateConfig, [field]: Math.max(1, Number(value) || 1) };
    setPods(copy);
  };

  // "Finishing this pod awards X badge/tier" — set per pod, read live by
  // gamification.js against the student's podIndex for this path.
  const handleBadgeAwardChange = (podIndex, value) => {
    const copy = [...pods];
    if (value === '__new__') {
      const name = window.prompt('Nombre de la nueva insignia (ej. Word Families, Presente):');
      if (!name?.trim()) return;
      const icon = window.prompt('Ícono (emoji, o pega una URL de imagen más adelante):', '🏅') || '🏅';
      const tiered = window.confirm('¿Sube de nivel (bronce → plata → oro)? Aceptar = sí. Cancelar = insignia de un solo nivel.');
      const badge = { id: `badge_${Date.now()}`, name: name.trim(), icon: icon.trim(), tiered };
      onCreateBadge(badge);
      copy[podIndex].badgeAward = { badgeId: badge.id, tier: tiered ? 'bronze' : null };
    } else if (!value) {
      copy[podIndex].badgeAward = null;
    } else {
      const badgeDef = badgeCatalog.find((b) => b.id === value);
      copy[podIndex].badgeAward = { badgeId: value, tier: badgeDef?.tiered ? (copy[podIndex].badgeAward?.tier || 'bronze') : null };
    }
    setPods(copy);
  };

  const handleBadgeTierChange = (podIndex, tier) => {
    const copy = [...pods];
    copy[podIndex].badgeAward = { ...copy[podIndex].badgeAward, tier };
    setPods(copy);
  };

  // Bumping a quota count keeps total_questions in sync automatically — it's
  // no longer an independently-editable field, since it's just the sum.
  const updateQuestionMix = (podIndex, segIndex, type, value) => {
    const copy = [...pods];
    const seg = copy[podIndex].segments[segIndex];
    seg.questionMix = { ...seg.questionMix, [type]: Math.max(0, Number(value) || 0) };
    seg.total_questions = sumMix(seg.questionMix);
    setPods(copy);
  };

  const updateSegmentField = (podIndex, segIndex, field, value) => {
    const copy = [...pods];
    copy[podIndex].segments[segIndex][field] = value;
    setPods(copy);
  };

  const typeLabels = QUESTION_TYPE_LABELS[contentType] || QUESTION_TYPE_LABELS.vocab;

  return (
    <div className="w-2/3 overflow-y-auto p-8 bg-slate-100">

      {/* Top Control Bar */}
      <div className="flex flex-col gap-4 mb-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">

        {/* Load Existing Paths Selector Row */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 w-full max-w-md">
            <span className="text-xs font-bold text-slate-500 uppercase whitespace-nowrap">Load Path:</span>
            <select
              value={selectedExistingPathId}
              onChange={(e) => handleLoadPath(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 text-xs font-semibold bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">-- Choose saved path --</option>
              {existingPaths.map(p => (
                <option key={p.path_id} value={p.path_id}>{p.title} ({p.path_id})</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => window.location.href = '/admin-daily-plan-hub'}
            className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl font-bold text-xs shadow-sm transition-all"
          >
            ← Back to Admin
          </button>
        </div>

        {/* Path Metadata Inputs & Save/Add Actions */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <button
                type="button"
                onClick={() => setCourse(course === 's2' ? 's4' : 's2')}
                title="Click to switch which course this path is tagged for"
                className="px-2.5 py-0.5 text-xs font-black bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-md uppercase tracking-wider transition-colors cursor-pointer"
              >
                {course.toUpperCase()} Course ⇄
              </button>

              {/* A path is one content type from the start — no more branches
                  bundling vocab+verbs+practical into one document. Switching
                  this after content exists is allowed but will hide whichever
                  vault tab no longer matches, so only do it before assigning. */}
              <button
                type="button"
                onClick={() => setContentType(contentType === 'vocab' ? 'verb' : 'vocab')}
                title="Click to switch whether this whole path is vocab-based or verb-based"
                className={`px-2.5 py-0.5 text-xs font-black rounded-md uppercase tracking-wider transition-colors cursor-pointer ${
                  contentType === 'verb' ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800' : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-800'
                }`}
              >
                {contentType === 'verb' ? '⚡ Verbos' : '📖 Vocabulario'} ⇄
              </button>

              {contentType === 'vocab' && (
                <span
                  className={`px-2.5 py-0.5 text-xs font-black rounded-md uppercase tracking-wider ${
                    selectedBook ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                  title="Vocabulary assigned to this path's pods comes from this textbook — double check it matches the course above."
                >
                  📚 {selectedBook ? `${selectedBook}${selectedChapter ? ` Ch ${selectedChapter}` : ''}` : 'No textbook selected!'}
                </span>
              )}

              <input
                type="text"
                value={pathId}
                onChange={(e) => setPathId(e.target.value)}
                className="text-xs font-mono text-slate-400 bg-transparent border-b border-slate-300 focus:outline-none focus:border-blue-500"
                placeholder="s2_presente"
              />
            </div>

            <input
              type="text"
              value={pathTitle}
              onChange={(e) => setPathTitle(e.target.value)}
              className="text-2xl font-black text-slate-800 bg-transparent border-none focus:outline-none focus:ring-0 p-0"
              placeholder="Path Title..."
            />
          </div>

          <div className="flex gap-3 items-center">
            <button
              onClick={handleAddPod}
              className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow transition-all flex items-center gap-1.5"
            >
              <span>+ Add {podLabel} ({pods.length}/20)</span>
            </button>

            <button
              onClick={handleSavePathToFirestore}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2"
            >
              <span>{isSaving ? 'Saving...' : '💾 Save Path'}</span>
            </button>
          </div>
        </div>

      </div>

      {/* Pods List */}
      <div className="space-y-6 pb-20">
        {pods.map((pod, podIndex) => (
          <div key={pod.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

            {/* Pod Header Bar */}
            <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleTogglePod(podIndex)}
                  className="w-6 h-6 flex items-center justify-center bg-slate-800 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                >
                  {pod.isExpanded ? '▼' : '▶'}
                </button>
                <span className="bg-blue-600 px-3 py-1 rounded-lg text-xs font-black tracking-wider uppercase">
                  {podLabel} {podIndex + 1}
                </span>
                <input
                  type="text"
                  value={pod.title}
                  onChange={(e) => {
                    const copy = [...pods];
                    copy[podIndex].title = e.target.value;
                    setPods(copy);
                  }}
                  className="bg-transparent text-white font-bold text-base focus:outline-none focus:ring-1 focus:ring-blue-400 px-2 py-1 rounded w-64"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-0.5 mr-2">
                  <button onClick={() => handleMovePod(podIndex, 'up')} disabled={podIndex === 0} className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 rounded-t transition-colors disabled:opacity-30">▲</button>
                  <button onClick={() => handleMovePod(podIndex, 'down')} disabled={podIndex === pods.length - 1} className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 rounded-b transition-colors disabled:opacity-30">▼</button>
                </div>
                <button onClick={() => handleAddSegment(podIndex)} className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg font-bold transition-all">
                  + Add Segment ({pod.segments.length})
                </button>
                {pods.length > 1 && (
                  <button onClick={() => handleDeletePod(podIndex)} className="text-xs bg-red-900/40 hover:bg-red-600 text-red-300 hover:text-white border border-red-700/50 p-1.5 rounded-lg transition-all">🗑️</button>
                )}
              </div>
            </div>

            {/* Badge Award Row — "finishing this pod awards X badge/tier".
                Not applicable to Practice Hub circles (ungated, no badges). */}
            {!isPracticeHub && (
              <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                  🏆 Insignia al completar:
                </span>
                <select
                  value={pod.badgeAward?.badgeId || ''}
                  onChange={(e) => handleBadgeAwardChange(podIndex, e.target.value)}
                  className="bg-white border border-amber-300 rounded-lg px-2 py-1 text-xs font-bold text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">-- Ninguna --</option>
                  {badgeCatalog.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.icon} {b.name}
                      {b.tiered ? ' (por niveles)' : ''}
                    </option>
                  ))}
                  <option value="__new__">+ Nueva insignia...</option>
                </select>

                {pod.badgeAward?.badgeId && badgeCatalog.find((b) => b.id === pod.badgeAward.badgeId)?.tiered && (
                  <select
                    value={pod.badgeAward.tier || 'bronze'}
                    onChange={(e) => handleBadgeTierChange(podIndex, e.target.value)}
                    className="bg-white border border-amber-300 rounded-lg px-2 py-1 text-xs font-bold text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="bronze">🥉 Bronce</option>
                    <option value="silver">🥈 Plata</option>
                    <option value="gold">🥇 Oro</option>
                  </select>
                )}
              </div>
            )}

            {/* Eval Link Row — ties this circle to a día on the Evaluaciones
                Sequencer calendar so the student-side "quiz order" view can
                sort by when it's actually quizzed. Optional: leave unlinked
                for a standalone/general-practice circle. */}
            {isPracticeHub && (
              <div className="px-4 py-2 bg-sky-50 border-b border-sky-100 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-sky-700">
                  🗓️ Vincular a Evaluación:
                </span>
                <select
                  value={pod.evalLink?.dia ?? ''}
                  onChange={(e) => handleEvalLinkChange(podIndex, e.target.value)}
                  className="bg-white border border-sky-300 rounded-lg px-2 py-1 text-xs font-bold text-sky-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="">-- Ninguna (práctica general) --</option>
                  {evaluacionOptions.map((o) => (
                    <option key={o.dia} value={o.dia}>
                      Día {o.dia} — {o.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Recuperación Gate Row — only meaningful once this circle is
                linked to a quiz. Turns it from a normal ungated practice
                circle into a timed, full-coverage mastery check (every word
                in the bank gets asked at least once, no repeats until it
                has) that a student must clear at the pass threshold to show
                up on the teacher's eligibility list for that quiz. */}
            {isPracticeHub && pod.evalLink && (
              <div className="px-4 py-2 bg-rose-50 border-b border-rose-100 flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-rose-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!pod.gateConfig}
                    onChange={(e) => handleGateToggle(podIndex, e.target.checked)}
                    className="w-4 h-4 text-rose-600 rounded"
                  />
                  🎯 Habilitar como Recuperación (Gate)
                </label>
                {pod.gateConfig && (
                  <>
                    <div className="flex items-center gap-1">
                      <label className="text-[9px] font-black text-rose-800 uppercase">Preguntas</label>
                      <input
                        type="number" min="1"
                        value={pod.gateConfig.questionCount}
                        onChange={(e) => updateGateConfig(podIndex, 'questionCount', e.target.value)}
                        className="w-16 border border-rose-200 rounded-md p-1 text-xs font-bold bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <label className="text-[9px] font-black text-rose-800 uppercase">Minutos</label>
                      <input
                        type="number" min="1"
                        value={Math.round(pod.gateConfig.timeLimitSeconds / 60)}
                        onChange={(e) => updateGateConfig(podIndex, 'timeLimitSeconds', Number(e.target.value) * 60)}
                        className="w-16 border border-rose-200 rounded-md p-1 text-xs font-bold bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <label className="text-[9px] font-black text-rose-800 uppercase">% Para Aprobar</label>
                      <input
                        type="number" min="1" max="100"
                        value={pod.gateConfig.passThreshold}
                        onChange={(e) => updateGateConfig(podIndex, 'passThreshold', Math.min(100, Number(e.target.value)))}
                        className="w-16 border border-rose-200 rounded-md p-1 text-xs font-bold bg-white"
                      />
                    </div>
                    <p className="text-[10px] text-rose-700 italic basis-full">
                      Cubre cada palabra del banco al menos una vez (sin repetir hasta terminar la vuelta) — si tienes más palabras que preguntas, sube el número de preguntas para garantizar cobertura completa.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Segments Container */}
            {pod.isExpanded && (
              <div className="p-6 bg-slate-50 space-y-5">
                {isPracticeHub && pod.segments.length > 1 && (
                  <p className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 -mt-1">
                    ⚠️ Only this circle's first segment is used when a student plays it — extra segments below are ignored.
                  </p>
                )}
                {pod.segments.map((seg, segIndex) => {
                  const isActive = activeSegmentId === seg.id;
                  return (
                    <div key={seg.id} onClick={() => setActiveSegmentId(seg.id)} className={`bg-white border-2 rounded-xl p-5 shadow-sm transition-all cursor-pointer relative ${isActive ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-slate-200 hover:border-slate-300'}`}>

                      <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full font-black text-xs flex items-center justify-center border ${isActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                            {segIndex + 1}
                          </span>
                          <h4 className="font-bold text-slate-800">Segment {segIndex + 1}</h4>
                          {isActive && <span className="text-[10px] bg-blue-100 text-blue-700 font-black px-2 py-0.5 rounded-full uppercase">Active Target 🎯</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{seg.total_questions} Questions Total</span>
                          <div className="flex gap-1 ml-2 mr-2">
                            <button onClick={(e) => { e.stopPropagation(); handleMoveSegment(podIndex, segIndex, 'up'); }} disabled={segIndex === 0} className="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded disabled:opacity-30">▲</button>
                            <button onClick={(e) => { e.stopPropagation(); handleMoveSegment(podIndex, segIndex, 'down'); }} disabled={segIndex === pod.segments.length - 1} className="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded disabled:opacity-30">▼</button>
                          </div>
                          {pod.segments.length > 1 && (
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteSegment(podIndex, segIndex); }} className="text-slate-400 hover:text-red-600 font-bold p-1 transition-colors">🗑️</button>
                          )}
                        </div>
                      </div>

                      <div className="mb-4" onClick={(e) => e.stopPropagation()}>
                        <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!seg.isSpeedRound}
                            onChange={(e) => updateSegmentField(podIndex, segIndex, 'isSpeedRound', e.target.checked)}
                            className="w-4 h-4 text-rose-600 rounded"
                          />
                          <span className="text-rose-700">🔥 Reto de Velocidad (Boss Battle)</span>
                        </label>

                        {seg.isSpeedRound ? (
                          <div className="mt-2 bg-rose-50/50 p-3 rounded-lg border border-rose-100 flex items-end gap-4">
                            <div>
                              <label className="block text-[9px] font-black text-rose-800 uppercase mb-1">Tiempo Límite (segundos)</label>
                              <input
                                type="number"
                                value={seg.timeLimit || 60}
                                onChange={(e) => updateSegmentField(podIndex, segIndex, 'timeLimit', Number(e.target.value))}
                                className="w-32 border border-rose-200 rounded-md p-1.5 text-xs font-bold focus:ring-1 focus:ring-rose-500 outline-none bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-black text-rose-800 uppercase mb-1">Preguntas</label>
                              <input
                                type="number"
                                value={seg.total_questions}
                                onChange={(e) => updateSegmentField(podIndex, segIndex, 'total_questions', Number(e.target.value))}
                                className="w-24 border border-rose-200 rounded-md p-1.5 text-xs font-bold focus:ring-1 focus:ring-rose-500 outline-none bg-white"
                              />
                            </div>
                            <p className="text-[10px] text-rose-700 italic pb-1.5">Un reto de velocidad siempre usa recordatorio rápido (escribir/conjugar) — no usa la mezcla de tipos de abajo.</p>
                          </div>
                        ) : (
                          <div className="mt-2 grid grid-cols-3 md:grid-cols-6 gap-2 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                            {QUESTION_TYPE_ORDER.map((type) => (
                              <div key={type}>
                                <label className="block text-[9px] font-black text-blue-800 uppercase mb-1 truncate" title={typeLabels[type]}>
                                  {typeLabels[type]}
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={seg.questionMix?.[type] ?? 0}
                                  onChange={(e) => updateQuestionMix(podIndex, segIndex, type, e.target.value)}
                                  className="w-full border border-blue-200 rounded-md p-1.5 text-xs font-bold focus:ring-1 focus:ring-blue-500 outline-none"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {contentType === 'verb' && (
                        <div className="mb-4" onClick={(e) => e.stopPropagation()}>
                          <label className="block text-[10px] font-black text-emerald-600 uppercase mb-1">Verb Tense</label>
                          <select
                            value={seg.targetTense || 'ALL'}
                            onChange={(e) => updateSegmentField(podIndex, segIndex, 'targetTense', e.target.value)}
                            className="w-full max-w-xs border border-emerald-200 rounded-lg p-2 text-sm font-semibold bg-emerald-50 text-emerald-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                          >
                            <option value="ALL">Mix All Tenses</option>
                            <option value="presente">Presente</option>
                            <option value="pretérito">Pretérito</option>
                            <option value="imperfecto">Imperfecto</option>
                            <option value="futuro">Futuro</option>
                            <option value="condicional">Condicional</option>
                            <option value="presente_progresivo">Progresivo</option>
                            <option value="imperativo_afirmativo">Mandatos (+)</option>
                            <option value="imperativo_negativo">Mandatos (-)</option>
                            <option value="subjuntivo_presente">Subjuntivo</option>
                          </select>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border-2 border-dashed border-blue-200 rounded-xl p-4 bg-blue-50/50 min-h-[110px] flex flex-col justify-between">
                          <div>
                            <p className="text-blue-900 text-xs font-bold mb-2 flex items-center gap-1">
                              <span>📦</span> {contentType === 'verb' ? 'Verbos Introducidos' : 'Vocabulario Introducido'} ({seg.introduced_concepts.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {seg.introduced_concepts.map((concept, cIdx) => (
                                <span key={cIdx} className="bg-white text-blue-800 text-xs font-semibold px-2.5 py-1 rounded-md border border-blue-200 shadow-sm flex items-center gap-1.5">
                                  {concept.label} {concept.isGroup && `(${concept.verbIds?.length || 0})`}
                                  <button onClick={(e) => { e.stopPropagation(); handleRemoveItem(podIndex, segIndex, 'introduced_concepts', cIdx); }} className="text-blue-400 hover:text-red-500 font-bold ml-1">×</button>
                                </span>
                              ))}
                              {seg.introduced_concepts.length === 0 && <p className="text-blue-400 text-[10px] italic">Click items in vault to assign here</p>}
                            </div>
                          </div>
                        </div>

                        <div className="border-2 border-dashed border-purple-200 rounded-xl p-4 bg-purple-50/50 min-h-[110px] flex flex-col justify-between">
                          <div>
                            <p className="text-purple-900 text-xs font-bold mb-2 flex items-center gap-1"><span>📌</span> Pinned Sentences ({seg.pinned_sentences.length})</p>
                            <div className="flex flex-wrap gap-1.5">
                              {seg.pinned_sentences.map((sent, sIdx) => (
                                <span key={sIdx} className="bg-white text-purple-800 text-xs font-semibold px-2.5 py-1 rounded-md border border-purple-200 shadow-sm flex items-center gap-1.5">
                                  {sent.label}
                                  <button onClick={(e) => { e.stopPropagation(); handleRemoveItem(podIndex, segIndex, 'pinned_sentences', sIdx); }} className="text-purple-400 hover:text-red-500 font-bold ml-1">×</button>
                                </span>
                              ))}
                              {seg.pinned_sentences.length === 0 && <p className="text-purple-400 text-[10px] italic">Click grammar sentences to pin here</p>}
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
