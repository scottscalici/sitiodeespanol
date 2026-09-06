import React, { useState } from 'react';

export default function VaultSidebar({
  selectedBook,
  setSelectedBook,
  availableBooks,
  activeTab,
  setActiveTab,
  selectedChapter,
  setSelectedChapter,
  selectedSection,
  handleSectionChange,
  availableSections,
  availableChapters,
  vaultVocab,
  vaultVerbs,
  vaultGrammar,
  isLoadingVault,
  onAssignItem,
  pods,
  selectedVerbFilter,
  setSelectedVerbFilter,
  availableVerbTenses,
  handleCreateGrammar,
}) {
  const [newGrammarText, setNewGrammarText] = useState('');
  const [newGrammarTopic, setNewGrammarTopic] = useState('');
  const [isCreatingGrammar, setIsCreatingGrammar] = useState(false);

  const isItemUsed = (itemId) => {
    for (const pod of pods) {
      for (const seg of pod.segments) {
        if (
          seg.introduced_concepts.some((c) => c.id === itemId) ||
          seg.pinned_sentences.some((s) => s.id === itemId)
        ) {
          return true;
        }
      }
    }
    return false;
  };

  const submitNewGrammar = async () => {
    if (!newGrammarText.trim()) return;
    setIsCreatingGrammar(true);
    await handleCreateGrammar(newGrammarText, newGrammarTopic);
    setNewGrammarText('');
    setNewGrammarTopic('');
    setIsCreatingGrammar(false);
  };

  return (
    <div className="w-1/3 bg-white border-r border-slate-200 flex flex-col shadow-sm z-10">
      {/* Vault Header & Source Selector */}
      <div className="p-4 border-b border-slate-200 bg-slate-900 text-white">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-black tracking-wide">Master Vault</h2>
          <span className="text-xs bg-blue-600 text-white font-bold px-2 py-0.5 rounded">
            Click to Assign 🎯
          </span>
        </div>

        {/* Dynamic Filters based on Active Tab */}
        {activeTab === 'verbs' ? (
          <div className="mt-2">
            <label className="text-[10px] uppercase font-bold text-slate-400">
              Filter by Tense / Type
            </label>
            <select
              value={selectedVerbFilter}
              onChange={(e) => setSelectedVerbFilter(e.target.value)}
              className="w-full p-1.5 rounded bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 mt-1"
            >
              <option value="ALL">All Tenses / Clusters</option>
              {availableVerbTenses.map((tense) => (
                <option key={tense} value={tense}>
                  {tense}
                </option>
              ))}
            </select>
          </div>
        ) : activeTab === 'vocab' ? (
          <div className="mt-2 space-y-2">
            {/* Textbook Dropdown */}
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400">
                Textbook
              </label>
              <select
                value={selectedBook}
                onChange={(e) => setSelectedBook(e.target.value)}
                className="w-full p-1.5 rounded bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {availableBooks.length === 0 && (
                  <option value="">Loading Books...</option>
                )}
                {availableBooks.map((bk) => (
                  <option key={bk} value={bk}>
                    {bk}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400">
                  Chapter
                </label>
                <select
                  value={selectedChapter}
                  onChange={(e) => setSelectedChapter(e.target.value)}
                  className="w-full p-1.5 rounded bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {/* PREVENTS CLIPPED DROPDOWNS IF EMPTY */}
                  {availableChapters.length === 0 && (
                    <option value="">No Chapters Found</option>
                  )}
                  {availableChapters.map((ch) => (
                    <option key={ch} value={ch}>
                      Ch {ch}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400">
                  Section
                </label>
                <select
                  value={selectedSection}
                  onChange={(e) => handleSectionChange(e.target.value)}
                  className="w-full p-1.5 rounded bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {/* PREVENTS CLIPPED DROPDOWNS IF EMPTY */}
                  {availableSections.length === 0 && (
                    <option value="">No Sections Found</option>
                  )}
                  {availableSections.map((sec) => (
                    <option key={sec} value={sec}>
                      Sección {sec}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">
              Grammar Builder
            </p>
            <p className="text-xs text-slate-300">
              Create new target sentences directly for this path.
            </p>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 text-sm font-bold bg-slate-50">
        <button
          className={`flex-1 p-3 text-center transition-all ${
            activeTab === 'vocab'
              ? 'border-b-2 border-blue-600 text-blue-700 bg-white shadow-sm'
              : 'text-slate-500 hover:bg-slate-100'
          }`}
          onClick={() => setActiveTab('vocab')}
        >
          Vocab ({vaultVocab.length})
        </button>
        <button
          className={`flex-1 p-3 text-center transition-all ${
            activeTab === 'verbs'
              ? 'border-b-2 border-emerald-600 text-emerald-700 bg-white shadow-sm'
              : 'text-slate-500 hover:bg-slate-100'
          }`}
          onClick={() => setActiveTab('verbs')}
        >
          Verbs ({vaultVerbs.length})
        </button>
        <button
          className={`flex-1 p-3 text-center transition-all ${
            activeTab === 'grammar'
              ? 'border-b-2 border-purple-600 text-purple-700 bg-white shadow-sm'
              : 'text-slate-500 hover:bg-slate-100'
          }`}
          onClick={() => setActiveTab('grammar')}
        >
          Grammar ({vaultGrammar.length})
        </button>
      </div>

      {/* Inventory Items List & Creators */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
        {activeTab === 'grammar' && (
          <div className="bg-purple-50/50 border border-purple-200 rounded-xl p-3 mb-4 shadow-sm">
            <h4 className="text-xs font-black text-purple-800 uppercase mb-2">
              Create New Sentence
            </h4>
            <div className="space-y-2">
              <input
                type="text"
                value={newGrammarText}
                onChange={(e) => setNewGrammarText(e.target.value)}
                placeholder="Ex: Yo [[fui]] a la tienda."
                className="w-full text-sm p-2 rounded-lg border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newGrammarTopic}
                  onChange={(e) => setNewGrammarTopic(e.target.value)}
                  placeholder="Topic (e.g. pretérito)"
                  className="flex-1 text-sm p-2 rounded-lg border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <button
                  onClick={submitNewGrammar}
                  disabled={isCreatingGrammar || !newGrammarText.trim()}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-bold text-xs px-4 rounded-lg transition-all"
                >
                  {isCreatingGrammar ? '...' : '+ Add'}
                </button>
              </div>
            </div>
          </div>
        )}

        {isLoadingVault ? (
          <div className="text-center py-10 text-slate-400 font-medium">
            Loading items...
          </div>
        ) : (
          <>
            {activeTab === 'vocab' &&
              vaultVocab.map((item) => {
                const used = isItemUsed(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => onAssignItem(item, 'vocab')}
                    className={`p-3 border rounded-lg transition-all flex items-center justify-between cursor-pointer group ${
                      used
                        ? 'bg-slate-100 border-slate-300 opacity-60 hover:opacity-100'
                        : 'bg-white border-slate-200 hover:border-blue-500 hover:bg-blue-50/30 shadow-sm'
                    }`}
                  >
                    <div>
                      <span
                        className={`font-bold block ${
                          used
                            ? 'line-through text-slate-500'
                            : 'text-slate-800 group-hover:text-blue-700'
                        }`}
                      >
                        {item.label}
                      </span>
                      <span className="text-xs text-slate-500">
                        {item.translation}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {used && (
                        <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                          ✓ Used
                        </span>
                      )}
                      <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                        {item.tags}
                      </span>
                    </div>
                  </div>
                );
              })}

            {activeTab === 'verbs' &&
              vaultVerbs.map((item) => {
                const used = isItemUsed(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => onAssignItem(item, 'verb')}
                    className={`p-3 border rounded-lg transition-all flex items-center justify-between cursor-pointer group ${
                      used
                        ? 'bg-slate-100 border-slate-300 opacity-60 hover:opacity-100'
                        : 'bg-white border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 shadow-sm'
                    }`}
                  >
                    <span
                      className={`font-bold ${
                        used
                          ? 'line-through text-slate-500'
                          : 'text-slate-800 group-hover:text-emerald-700'
                      }`}
                    >
                      {item.label}
                    </span>
                    <div className="flex items-center gap-2">
                      {used && (
                        <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                          ✓ Used
                        </span>
                      )}
                      <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                        {item.tags}
                      </span>
                    </div>
                  </div>
                );
              })}

            {activeTab === 'grammar' &&
              vaultGrammar.map((item) => {
                const used = isItemUsed(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => onAssignItem(item, 'grammar')}
                    className={`p-3 border rounded-lg transition-all flex flex-col gap-1 cursor-pointer group ${
                      used
                        ? 'bg-slate-100 border-slate-300 opacity-60 hover:opacity-100'
                        : 'bg-white border-slate-200 hover:border-purple-500 hover:bg-purple-50/30 shadow-sm'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span
                        className={`font-medium text-sm ${
                          used
                            ? 'line-through text-slate-500'
                            : 'text-slate-800 group-hover:text-purple-700'
                        }`}
                      >
                        {item.label}
                      </span>
                      {used && (
                        <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                          ✓ Used
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100 self-start">
                      {item.tags}
                    </span>
                  </div>
                );
              })}
          </>
        )}
      </div>
    </div>
  );
}
