import React from 'react';

export default function PathBuilder({
  course,
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
  handleTogglePod, // NEW
  handleMovePod, // NEW
  handleMoveSegment // NEW
}) {
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
            onClick={() => window.location.href = '/admin'} 
            className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl font-bold text-xs shadow-sm transition-all"
          >
            ← Back to Admin
          </button>
        </div>

        {/* Path Metadata Inputs & Save/Add Actions */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 text-xs font-black bg-blue-100 text-blue-800 rounded-md uppercase tracking-wider">
                {course.toUpperCase()} Course
              </span>
              <input 
                type="text"
                value={pathId}
                onChange={(e) => setPathId(e.target.value)}
                className="text-xs font-mono text-slate-400 bg-transparent border-b border-slate-300 focus:outline-none focus:border-blue-500"
                placeholder="path_slug_id"
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
              <span>+ Add Pod ({pods.length}/20)</span>
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
                
                {/* Expand/Collapse Toggle */}
                <button 
                  onClick={() => handleTogglePod(podIndex)}
                  className="w-6 h-6 flex items-center justify-center bg-slate-800 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                >
                  {pod.isExpanded ? '▼' : '▶'}
                </button>

                <span className="bg-blue-600 px-3 py-1 rounded-lg text-xs font-black tracking-wider">
                  POD {podIndex + 1}
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
                {/* Pod Reorder Buttons */}
                <div className="flex flex-col gap-0.5 mr-2">
                  <button 
                    onClick={() => handleMovePod(podIndex, 'up')}
                    disabled={podIndex === 0}
                    className="text-[10px] bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 px-2 rounded-t transition-colors"
                  >▲</button>
                  <button 
                    onClick={() => handleMovePod(podIndex, 'down')}
                    disabled={podIndex === pods.length - 1}
                    className="text-[10px] bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 px-2 rounded-b transition-colors"
                  >▼</button>
                </div>

                <button 
                  onClick={() => handleAddSegment(podIndex)}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg font-bold transition-all"
                >
                  + Add Segment ({pod.segments.length})
                </button>
                {pods.length > 1 && (
                  <button 
                    onClick={() => handleDeletePod(podIndex)}
                    title="Delete Pod"
                    className="text-xs bg-red-900/40 hover:bg-red-600 text-red-300 hover:text-white border border-red-700/50 p-1.5 rounded-lg transition-all"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>

            {/* Segments Container (Collapsible) */}
            {pod.isExpanded && (
              <div className="p-6 bg-slate-50 space-y-5">
                {pod.segments.map((seg, segIndex) => {
                  const isActive = activeSegmentId === seg.id;

                  return (
                    <div 
                      key={seg.id} 
                      onClick={() => setActiveSegmentId(seg.id)}
                      className={`bg-white border-2 rounded-xl p-5 shadow-sm transition-all cursor-pointer relative ${
                        isActive ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      
                      {/* Segment Header & Controls */}
                      <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full font-black text-xs flex items-center justify-center border ${
                            isActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {segIndex + 1}
                          </span>
                          <h4 className="font-bold text-slate-800">Segment {segIndex + 1}</h4>
                          {isActive && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 font-black px-2 py-0.5 rounded-full uppercase">
                              Active Target 🎯
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            {seg.total_questions} Questions Total
                          </span>
                          
                          {/* Segment Reorder Buttons */}
                          <div className="flex gap-1 ml-2 mr-2">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleMoveSegment(podIndex, segIndex, 'up'); }}
                              disabled={segIndex === 0}
                              className="text-xs bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 px-2 py-1 rounded"
                            >▲</button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleMoveSegment(podIndex, segIndex, 'down'); }}
                              disabled={segIndex === pod.segments.length - 1}
                              className="text-xs bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 px-2 py-1 rounded"
                            >▼</button>
                          </div>

                          {pod.segments.length > 1 && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSegment(podIndex, segIndex);
                              }}
                              title="Delete Segment"
                              className="text-slate-400 hover:text-red-600 font-bold p-1 transition-colors"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Question Count & Presets */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4" onClick={(e) => e.stopPropagation()}>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Total Qs</label>
                          <input 
                            type="number" 
                            value={seg.total_questions} 
                            onChange={(e) => {
                              const copy = [...pods];
                              copy[podIndex].segments[segIndex].total_questions = Number(e.target.value);
                              setPods(copy);
                            }}
                            className="w-full border border-slate-200 rounded-lg p-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" 
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Ratio Preset</label>
                          <select 
                            value={seg.preset}
                            onChange={(e) => {
                              const copy = [...pods];
                              copy[podIndex].segments[segIndex].preset = e.target.value;
                              setPods(copy);
                            }}
                            className="w-full border border-slate-200 rounded-lg p-2 text-sm font-semibold bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                          >
                            <option value="100_vocab">100% Vocab</option>
                            <option value="100_verbs">100% Verbs (Conjugation Focus)</option>
                            <option value="100_grammar">100% Grammar (Syntax & Pinned Sentences)</option>
                            <option value="balanced_spiral">Balanced Spiral (50 Vocab / 30 Verb / 20 Grammar)</option>
                            <option value="custom">Custom Mix</option>
                          </select>
                        </div>

                        {/* CUSTOM RATIO INPUTS (Only shows if 'custom' is selected) */}
                        {seg.preset === 'custom' && (
                          <div className="md:col-span-3 grid grid-cols-3 gap-3 bg-blue-50/50 p-3 rounded-lg border border-blue-100 mt-1">
                            <div>
                              <label className="block text-[9px] font-black text-blue-800 uppercase mb-1">Vocab %</label>
                              <input 
                                type="number" 
                                value={seg.custom_ratios?.vocab || 0}
                                onChange={(e) => {
                                  const copy = [...pods];
                                  copy[podIndex].segments[segIndex].custom_ratios = { ...seg.custom_ratios, vocab: Number(e.target.value) };
                                  setPods(copy);
                                }}
                                className="w-full border border-blue-200 rounded-md p-1.5 text-xs font-bold focus:ring-1 focus:ring-blue-500 outline-none" 
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-black text-blue-800 uppercase mb-1">Verb %</label>
                              <input 
                                type="number" 
                                value={seg.custom_ratios?.verb || 0}
                                onChange={(e) => {
                                  const copy = [...pods];
                                  copy[podIndex].segments[segIndex].custom_ratios = { ...seg.custom_ratios, verb: Number(e.target.value) };
                                  setPods(copy);
                                }}
                                className="w-full border border-blue-200 rounded-md p-1.5 text-xs font-bold focus:ring-1 focus:ring-blue-500 outline-none" 
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-black text-blue-800 uppercase mb-1">Grammar %</label>
                              <input 
                                type="number" 
                                value={seg.custom_ratios?.grammar || 0}
                                onChange={(e) => {
                                  const copy = [...pods];
                                  copy[podIndex].segments[segIndex].custom_ratios = { ...seg.custom_ratios, grammar: Number(e.target.value) };
                                  setPods(copy);
                                }}
                                className="w-full border border-blue-200 rounded-md p-1.5 text-xs font-bold focus:ring-1 focus:ring-blue-500 outline-none" 
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Modalities */}
                      <div className="mb-4" onClick={(e) => e.stopPropagation()}>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Permitted Modalities</label>
                        <div className="flex flex-wrap gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                          {['read', 'write', 'listen', 'speak'].map((mod) => (
                            <label key={mod} className="text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer capitalize">
                              <input 
                                type="checkbox" 
                                checked={seg.modalities[mod]} 
                                onChange={(e) => {
                                  const copy = [...pods];
                                  copy[podIndex].segments[segIndex].modalities[mod] = e.target.checked;
                                  setPods(copy);
                                }}
                                className="w-4 h-4 text-blue-600 rounded" 
                              />
                              {mod === 'read' ? '📖 Read' : mod === 'write' ? '✍️ Write' : mod === 'listen' ? '🎧 Listen' : '🗣️ Speak'}
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Dropzones with Assigned Chips */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        <div className="border-2 border-dashed border-blue-200 rounded-xl p-4 bg-blue-50/50 min-h-[110px] flex flex-col justify-between">
                          <div>
                            <p className="text-blue-900 text-xs font-bold mb-2 flex items-center gap-1">
                              <span>📦</span> Introduced Vocab & Verbs ({seg.introduced_concepts.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {seg.introduced_concepts.map((concept, cIdx) => (
                                <span key={cIdx} className="bg-white text-blue-800 text-xs font-semibold px-2.5 py-1 rounded-md border border-blue-200 shadow-sm flex items-center gap-1.5">
                                  {concept.label} {concept.isGroup && `(${concept.verbIds?.length || 0})`}
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveItem(podIndex, segIndex, 'introduced_concepts', cIdx);
                                    }}
                                    className="text-blue-400 hover:text-red-500 font-bold ml-1"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                              {seg.introduced_concepts.length === 0 && (
                                <p className="text-blue-400 text-[10px] italic">Click items in vault to assign here</p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="border-2 border-dashed border-purple-200 rounded-xl p-4 bg-purple-50/50 min-h-[110px] flex flex-col justify-between">
                          <div>
                            <p className="text-purple-900 text-xs font-bold mb-2 flex items-center gap-1">
                              <span>📌</span> Pinned Sentences ({seg.pinned_sentences.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {seg.pinned_sentences.map((sent, sIdx) => (
                                <span key={sIdx} className="bg-white text-purple-800 text-xs font-semibold px-2.5 py-1 rounded-md border border-purple-200 shadow-sm flex items-center gap-1.5">
                                  {sent.label}
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveItem(podIndex, segIndex, 'pinned_sentences', sIdx);
                                    }}
                                    className="text-purple-400 hover:text-red-500 font-bold ml-1"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                              {seg.pinned_sentences.length === 0 && (
                                <p className="text-purple-400 text-[10px] italic">Click grammar sentences to pin here</p>
                              )}
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