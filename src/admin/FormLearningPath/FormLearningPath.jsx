import React, { useState, useEffect } from 'react';
import { db } from '../../firebase.js';
import VaultSidebar from './VaultSidebar';
import PathBuilder from './PathBuilder';
import { collection, getDocs, doc, setDoc, getDoc, addDoc } from 'firebase/firestore';

export default function FormLearningPath() {
  const [course, setCourse] = useState('s2');
  const [pathId, setPathId] = useState('s2_descubre2_ch8');
  const [pathTitle, setPathTitle] = useState('Descubre 2 - Capítulo 8');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingVault, setIsLoadingVault] = useState(false);

  // --- MASTER VAULT STATE ---
  const [activeTab, setActiveTab] = useState('vocab');
  
  const [selectedBook, setSelectedBook] = useState('Descubre 2');
  const [availableBooks, setAvailableBooks] = useState(['Descubre 2']);
  
  const [selectedChapter, setSelectedChapter] = useState('8');
  const [selectedSection, setSelectedSection] = useState('8.1');
  
  const [availableChapters, setAvailableChapters] = useState([]);
  const [availableSections, setAvailableSections] = useState([]);
  const [rawChapterData, setRawChapterData] = useState(null);

  const [vaultVocab, setVaultVocab] = useState([]);
  const [vaultVerbs, setVaultVerbs] = useState([]);
  const [allVerbsList, setAllVerbsList] = useState([]); 
  const [selectedVerbFilter, setSelectedVerbFilter] = useState('ALL');
  const [availableVerbTenses, setAvailableVerbTenses] = useState([]);
  const [vaultGrammar, setVaultGrammar] = useState([]);
  const [allGrammarList, setAllGrammarList] = useState([]);
  const [selectedGrammarChapter, setSelectedGrammarChapter] = useState('all');
  const [selectedGrammarTag, setSelectedGrammarTag] = useState('all');
  const [availableGrammarChapters, setAvailableGrammarChapters] = useState([]);
  const [availableGrammarTags, setAvailableGrammarTags] = useState([]);

  // --- POD BUILDER STATE (one pod list per branch: vocab / verbs / practical) ---
  const BRANCHES = ['vocab', 'verbs', 'practical'];

  const makeDefaultPods = () => ([
    {
      id: `pod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: 'Pod 1: Introducción y Vocabulario Base',
      isExpanded: true,
      segments: [
        {
          id: `seg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          total_questions: 15,
          preset: '100_vocab',
          custom_ratios: { vocab: 34, verb: 33, grammar: 33 },
          modalities: { read: true, write: true, listen: true, speak: true },
          introduced_concepts: [],
          pinned_sentences: []
        }
      ]
    }
  ]);

  const [activeBranch, setActiveBranch] = useState('vocab');
  const [podsByBranch, setPodsByBranch] = useState(() => ({
    vocab: makeDefaultPods(),
    verbs: makeDefaultPods(),
    practical: makeDefaultPods(),
  }));

  // Everything below still just reads/writes `pods` — it's a view onto the active branch
  const pods = podsByBranch[activeBranch];
  const setPods = (updater) => {
    setPodsByBranch((prev) => ({
      ...prev,
      [activeBranch]: typeof updater === 'function' ? updater(prev[activeBranch]) : updater,
    }));
  };

  const [activeSegmentId, setActiveSegmentIdRaw] = useState(pods[0].segments[0].id);
  const setActiveSegmentId = setActiveSegmentIdRaw;

  const handleBranchChange = (branch) => {
    setActiveBranch(branch);
    const branchPods = podsByBranch[branch];
    setActiveSegmentIdRaw(branchPods[0]?.segments[0]?.id || null);
  };
  const [existingPaths, setExistingPaths] = useState([]);
  const [selectedExistingPathId, setSelectedExistingPathId] = useState('');

  const [pendingGroupAssign, setPendingGroupAssign] = useState(null);
  const [selectedGroupVerbs, setSelectedGroupVerbs] = useState([]);
  const [migrationStatus, setMigrationStatus] = useState('');

  // One-time migration: the "preliminar" unit was hand-built as 3 separate documents
  // (…_vocab, …_verbs, …_practical) before units were consolidated into a single doc
  // with a `branches` object. This reads those 3 docs and writes the new combined shape.
  const handleMigrateLegacyPreliminar = async () => {
    const LEGACY_BASE_ID = 's2_descubre2_preliminar';
    setMigrationStatus('Migrando...');
    try {
      const branchSnaps = await Promise.all(
        BRANCHES.map((branch) => getDoc(doc(db, 'learning_paths', `${LEGACY_BASE_ID}_${branch}`)))
      );
      const anyFound = branchSnaps.some((snap) => snap.exists());
      if (!anyFound) {
        setMigrationStatus('No se encontraron los documentos antiguos — ¿ya se migró?');
        return;
      }

      const branches = {};
      let title = 'Unidad Preliminar';
      let course = 's2';
      BRANCHES.forEach((branch, i) => {
        const snap = branchSnaps[i];
        if (snap.exists()) {
          const data = snap.data();
          branches[branch] = { pods: data.pods || [] };
          title = data.title || title;
          course = data.course || course;
        } else {
          branches[branch] = { pods: [] };
        }
      });

      const totalPods = BRANCHES.reduce((sum, b) => sum + branches[b].pods.length, 0);
      await setDoc(doc(db, 'learning_paths', LEGACY_BASE_ID), {
        path_id: LEGACY_BASE_ID,
        title,
        course,
        total_pods: totalPods,
        updated_at: new Date().toISOString(),
        branches,
      }, { merge: true });

      setMigrationStatus(`✅ Migrado a "${LEGACY_BASE_ID}" (${totalPods} pods). Los 3 documentos antiguos no se borraron — puedes eliminarlos manualmente cuando confirmes que todo funciona.`);
      fetchExistingPaths();
    } catch (err) {
      console.error('Error migrating legacy preliminar unit:', err);
      setMigrationStatus('❌ Error al migrar. Revisa la consola.');
    }
  };

  // =========================================================
  // LOAD EXISTING PATHS FROM FIRESTORE
  // =========================================================
  const fetchExistingPaths = async () => {
    try {
      const snap = await getDocs(collection(db, 'learning_paths'));
      const paths = [];
      snap.forEach(d => paths.push({ id: d.id, ...d.data() }));
      setExistingPaths(paths);
    } catch (err) { console.error("Error fetching paths:", err); }
  };

  const sanitizePods = (rawPods) => (rawPods || []).map(p => ({
    ...p,
    isExpanded: p.isExpanded !== undefined ? p.isExpanded : true,
    segments: p.segments.map(s => ({
      ...s,
      custom_ratios: s.custom_ratios || { vocab: 34, verb: 33, grammar: 33 }
    }))
  }));

  const handleLoadPath = async (id) => {
    if (!id) return;
    setSelectedExistingPathId(id);
    try {
      const docSnap = await getDoc(doc(db, 'learning_paths', id));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPathId(data.path_id || id);
        setPathTitle(data.title || 'Untitled Path');
        setCourse(data.course || 's2');
        if (data.textbook) setSelectedBook(data.textbook);
        if (data.chapter) setSelectedChapter(data.chapter);

        // New shape: one doc with a `branches` object. Old shape (pre-consolidation): a flat
        // `pods` array, which only ever represented the vocab branch — loaded as a best-effort fallback.
        const newPodsByBranch = data.branches
          ? {
              vocab: sanitizePods(data.branches.vocab?.pods).length ? sanitizePods(data.branches.vocab?.pods) : makeDefaultPods(),
              verbs: sanitizePods(data.branches.verbs?.pods).length ? sanitizePods(data.branches.verbs?.pods) : makeDefaultPods(),
              practical: sanitizePods(data.branches.practical?.pods).length ? sanitizePods(data.branches.practical?.pods) : makeDefaultPods(),
            }
          : {
              vocab: sanitizePods(data.pods).length ? sanitizePods(data.pods) : makeDefaultPods(),
              verbs: makeDefaultPods(),
              practical: makeDefaultPods(),
            };

        setPodsByBranch(newPodsByBranch);
        setActiveBranch('vocab');
        setActiveSegmentIdRaw(newPodsByBranch.vocab[0]?.segments[0]?.id || null);
      }
    } catch (err) { console.error("Error loading path:", err); }
  };

  // =========================================================
  // ASSIGNMENT LOGIC (With Group Intercept)
  // =========================================================
  const handleAssignItem = (item, type) => {
    if (item.isGroup) {
      setPendingGroupAssign(item);
      setSelectedGroupVerbs(item.verbIds || []);
      return;
    }
    executeAssignment(item, type);
  };

  const confirmGroupAssignment = () => {
    if (!pendingGroupAssign) return;
    const modifiedGroup = { ...pendingGroupAssign, verbIds: selectedGroupVerbs };
    executeAssignment(modifiedGroup, 'verb');
    setPendingGroupAssign(null);
  };

  const executeAssignment = (item, type) => {
    let targetPodIdx = 0, targetSegIdx = 0;
    pods.forEach((pod, pIdx) => {
      pod.segments.forEach((seg, sIdx) => {
        if (seg.id === activeSegmentId) { targetPodIdx = pIdx; targetSegIdx = sIdx; }
      });
    });

    const updatedPods = [...pods];
    const targetSegment = updatedPods[targetPodIdx].segments[targetSegIdx];

    if (type === 'grammar') {
      if (!targetSegment.pinned_sentences.some(s => s.id === item.id)) {
        targetSegment.pinned_sentences.push(item);
      }
    } else {
      if (!targetSegment.introduced_concepts.some(c => c.id === item.id)) {
        targetSegment.introduced_concepts.push(item);
      } else if (item.isGroup) {
        const existingIdx = targetSegment.introduced_concepts.findIndex(c => c.id === item.id);
        targetSegment.introduced_concepts[existingIdx] = item;
      }
    }
    setPods(updatedPods);
  };

  const handleRemoveItem = (podIdx, segIdx, field, itemIdx) => {
    const updatedPods = [...pods];
    updatedPods[podIdx].segments[segIdx][field].splice(itemIdx, 1);
    setPods(updatedPods);
  };

  // =========================================================
  // POD & SEGMENT CONTROLS 
  // =========================================================
  const handleTogglePod = (podIndex) => {
    const updated = [...pods];
    updated[podIndex].isExpanded = !updated[podIndex].isExpanded;
    setPods(updated);
  };

  const handleMovePod = (podIndex, direction) => {
    if (direction === 'up' && podIndex === 0) return;
    if (direction === 'down' && podIndex === pods.length - 1) return;
    const updated = [...pods];
    const swapIndex = direction === 'up' ? podIndex - 1 : podIndex + 1;
    [updated[podIndex], updated[swapIndex]] = [updated[swapIndex], updated[podIndex]];
    setPods(updated);
  };

  const handleMoveSegment = (podIndex, segIndex, direction) => {
    const segments = pods[podIndex].segments;
    if (direction === 'up' && segIndex === 0) return;
    if (direction === 'down' && segIndex === segments.length - 1) return;
    const updated = [...pods];
    const newSegments = [...segments];
    const swapIndex = direction === 'up' ? segIndex - 1 : segIndex + 1;
    [newSegments[segIndex], newSegments[swapIndex]] = [newSegments[swapIndex], newSegments[segIndex]];
    updated[podIndex].segments = newSegments;
    setPods(updated);
  };

  const handleDeleteSegment = (podIndex, segIndex) => {
    const updatedPods = [...pods];
    updatedPods[podIndex].segments.splice(segIndex, 1);
    setPods(updatedPods);
    setActiveSegmentId(updatedPods[podIndex].segments[0]?.id || pods[0].segments[0].id);
  };

  const handleDeletePod = (podIndex) => {
    if (pods.length <= 1) return alert("You must keep at least one pod.");
    const updatedPods = pods.filter((_, idx) => idx !== podIndex);
    setPods(updatedPods);
    setActiveSegmentId(updatedPods[0].segments[0].id);
  };

  const handleAddSegment = (podIndex) => {
    const updated = [...pods];
    const newSegId = `seg_${Date.now()}`;
    updated[podIndex].segments.push({ 
      id: newSegId, total_questions: 12, preset: 'balanced_spiral', 
      custom_ratios: { vocab: 34, verb: 33, grammar: 33 },
      modalities: { read: true, write: true, listen: true, speak: true }, 
      introduced_concepts: [], pinned_sentences: [] 
    });
    setPods(updated); 
    setActiveSegmentId(newSegId);
  };

  const handleAddPod = () => {
    const newSegId = `seg_${Date.now()}`;
    setPods([...pods, { 
      id: `pod_${Date.now()}`, title: `Pod ${pods.length + 1}: Lección y Práctica`, isExpanded: true, 
      segments: [{ 
        id: newSegId, total_questions: 15, preset: '100_vocab', 
        custom_ratios: { vocab: 34, verb: 33, grammar: 33 },
        modalities: { read: true, write: true, listen: true, speak: true }, 
        introduced_concepts: [], pinned_sentences: [] 
      }] 
    }]);
    setActiveSegmentId(newSegId);
  };

  // =========================================================
  // FIRESTORE FETCH & SAVE (NUEVA LÓGICA INTELIGENTE)
  // =========================================================
  
  // Función auxiliar para extraer el nombre del libro si falta el campo
  const guessBookName = (data, docId) => {
    if (data.book || data.textbook || data.course) return data.book || data.textbook || data.course;
    const idLower = docId.toLowerCase();
    if (idLower.includes('descubre1') || idLower.includes('descubre 1')) return 'Descubre 1';
    if (idLower.includes('descubre3') || idLower.includes('descubre 3')) return 'Descubre 3';
    return 'Descubre 2'; // Fallback por defecto
  };

  const fetchAllChapters = async () => {
    try {
      const snap = await getDocs(collection(db, 'vocab_bundles'));
      const booksSet = new Set();
      const chaptersSet = new Set();
      
      snap.forEach(d => { 
        const data = d.data();
        const bookName = guessBookName(data, d.id);
        booksSet.add(bookName);
        
        if (bookName === selectedBook && data.chapter) {
          chaptersSet.add(data.chapter); 
        }
      });
      
      if (booksSet.size > 0) setAvailableBooks(Array.from(booksSet).sort());
      
      if (chaptersSet.size > 0) {
        const sortedChaps = Array.from(chaptersSet).sort((a, b) => Number(b) - Number(a));
        setAvailableChapters(sortedChaps);
        if (!sortedChaps.includes(selectedChapter)) {
          setSelectedChapter(sortedChaps[0]); 
        }
      } else {
        setAvailableChapters([]);
      }
    } catch (err) { console.error("Fetch Chapters Error:", err); }
  };

  const fetchVocabVault = async () => {
    setIsLoadingVault(true);
    try {
      let targetData = null;
      const snap = await getDocs(collection(db, 'vocab_bundles'));
      
      snap.forEach(d => { 
        const data = d.data();
        const bookName = guessBookName(data, d.id);
        if (bookName === selectedBook && data.chapter === selectedChapter) {
           targetData = data; 
        }
      });

      if (targetData && targetData.words) {
        setRawChapterData(targetData);
        const uniqueSections = new Set();
        targetData.words.forEach(w => w.metadata?.secciones?.forEach(sec => uniqueSections.add(sec)));
        const sortedSections = Array.from(uniqueSections).sort();
        setAvailableSections(sortedSections);
        
        const targetSection = sortedSections.includes(selectedSection) ? selectedSection : sortedSections[0] || '';
        setSelectedSection(targetSection);
        
        const filteredWords = targetData.words.filter(w => w.metadata?.secciones?.includes(targetSection));
        setVaultVocab(filteredWords.map(w => ({ id: w.id || w.palabra, label: w.palabra, translation: w.traduccion, tags: targetSection, fullData: w })));
      } else {
        setVaultVocab([]); setAvailableSections([]);
      }
    } catch (err) { console.error("Fetch Vocab Error:", err); }
    setIsLoadingVault(false);
  };

  const fetchVerbsAndGrammar = async () => {
    try {
      const groupSnap = await getDocs(collection(db, 'verbGroups'));
      const groupList = [];
      groupSnap.forEach(doc => {
        const data = doc.data();
        groupList.push({ id: doc.id, label: data.name || doc.id, tags: data.tenses?.[0] || 'Cluster', tenses: data.tenses || [], verbIds: data.verbIds || [], isGroup: true, fullData: data });
      });

      const verbSnap = await getDocs(collection(db, 'verbs'));
      const verbList = [];
      verbSnap.forEach(doc => {
        const data = doc.data();
        verbList.push({ id: doc.id, label: data.infinitive || doc.id, tags: data.tense || data.type || 'Verbo', tenses: [data.tense, data.type].filter(Boolean), isGroup: false, fullData: data });
      });

      const combined = [...groupList, ...verbList];
      setAllVerbsList(combined);
      setVaultVerbs(combined);

      const tensesSet = new Set();
      combined.forEach(item => item.tenses?.forEach(t => tensesSet.add(t)));
      setAvailableVerbTenses(Array.from(tensesSet));

      const grammarSnap = await getDocs(collection(db, 'sentence_bank'));
      const grammarList = [];
      grammarSnap.forEach(doc => grammarList.push({ id: doc.id, ...doc.data() }));
      const mappedGrammar = grammarList.map(g => ({
        id: g.id,
        label: g.spanish || g.sentence,
        tags: (g.grammarTags && g.grammarTags[0]) || 'Gramática',
        chapterId: g.chapterId || '',
        grammarTags: g.grammarTags || [],
        fullData: g
      }));
      setAllGrammarList(mappedGrammar);
      setVaultGrammar(mappedGrammar);
      setAvailableGrammarChapters([...new Set(mappedGrammar.map(g => g.chapterId).filter(Boolean))].sort());
      setAvailableGrammarTags([...new Set(mappedGrammar.flatMap(g => g.grammarTags))].sort());
    } catch (err) {}
  };

  useEffect(() => { fetchExistingPaths(); fetchVerbsAndGrammar(); }, []);
  useEffect(() => { fetchAllChapters(); }, [selectedBook]);
  useEffect(() => { fetchVocabVault(); }, [selectedChapter, selectedBook]);

  useEffect(() => {
    let filtered = allGrammarList;
    if (selectedGrammarChapter !== 'all') filtered = filtered.filter(g => g.chapterId === selectedGrammarChapter);
    if (selectedGrammarTag !== 'all') filtered = filtered.filter(g => g.grammarTags.includes(selectedGrammarTag));
    setVaultGrammar(filtered);
  }, [selectedGrammarChapter, selectedGrammarTag, allGrammarList]);

  useEffect(() => {
    if (selectedVerbFilter === 'ALL') setVaultVerbs(allVerbsList);
    else setVaultVerbs(allVerbsList.filter(item => item.tenses?.includes(selectedVerbFilter)));
  }, [selectedVerbFilter, allVerbsList]);

  const handleSectionChange = (secKey) => {
    setSelectedSection(secKey);
    if (rawChapterData && rawChapterData.words) {
      const filtered = rawChapterData.words.filter(w => w.metadata?.secciones?.includes(secKey));
      setVaultVocab(filtered.map(w => ({ id: w.id || w.palabra, label: w.palabra, translation: w.traduccion, tags: secKey, fullData: w })));
    }
  };

  const handleSavePathToFirestore = async () => {
    if (!pathId.trim()) return alert("Please enter a valid ID.");
    setIsSaving(true);
    try {
      const branches = {
        vocab: { pods: podsByBranch.vocab },
        verbs: { pods: podsByBranch.verbs },
        practical: { pods: podsByBranch.practical },
      };
      const totalPods = BRANCHES.reduce((sum, b) => sum + podsByBranch[b].length, 0);
      await setDoc(doc(db, 'learning_paths', pathId), { path_id: pathId, title: pathTitle, course, textbook: selectedBook, chapter: selectedChapter, total_pods: totalPods, updated_at: new Date().toISOString(), branches }, { merge: true });
      alert("🎉 Saved!"); fetchExistingPaths();
    } catch (err) {}
    setIsSaving(false);
  };

  const handleCreateGrammar = async (sentence, topic) => {
    try {
      const grammarTags = topic ? [topic] : [];
      const payload = {
        spanish: sentence,
        english: '',
        chapterId: selectedChapter || '',
        grammarTags,
        distractorMode: 'none',
        pairTag: '',
        poolTag: '',
        targetLemma: '',
        targetTense: '',
        targetSubject: '',
        createdAt: new Date().toISOString(),
      };
      const docRef = await addDoc(collection(db, 'sentence_bank'), payload);
      const newItem = { id: docRef.id, label: sentence, tags: topic || 'Gramática', chapterId: payload.chapterId, grammarTags, fullData: payload };
      setAllGrammarList([newItem, ...allGrammarList]);
    } catch (err) {
      console.error("Error creating grammar sentence:", err);
      alert("Failed to create sentence.");
    }
  };

  return (
    <div className="flex w-screen h-screen bg-slate-100 font-sans fixed inset-0 z-50 overflow-hidden">
      {/* One-time migration for the hand-built "preliminar" unit (3 old docs -> 1 consolidated doc) */}
      <div className="fixed bottom-4 left-4 z-[200] flex flex-col items-start gap-2">
        <button
          onClick={handleMigrateLegacyPreliminar}
          className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg"
        >
          🛠️ Migrar Unidad Preliminar (legado)
        </button>
        {migrationStatus && (
          <p className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 shadow-lg max-w-sm">
            {migrationStatus}
          </p>
        )}
      </div>

      <VaultSidebar
        selectedBook={selectedBook} setSelectedBook={setSelectedBook} availableBooks={availableBooks}
        activeTab={activeTab} setActiveTab={setActiveTab} selectedChapter={selectedChapter} setSelectedChapter={setSelectedChapter}
        selectedSection={selectedSection} handleSectionChange={handleSectionChange} availableSections={availableSections}
        availableChapters={availableChapters} vaultVocab={vaultVocab} vaultVerbs={vaultVerbs} vaultGrammar={vaultGrammar}
        isLoadingVault={isLoadingVault} onAssignItem={handleAssignItem} pods={pods}
        selectedVerbFilter={selectedVerbFilter} setSelectedVerbFilter={setSelectedVerbFilter} availableVerbTenses={availableVerbTenses}
        handleCreateGrammar={handleCreateGrammar}
        selectedGrammarChapter={selectedGrammarChapter} setSelectedGrammarChapter={setSelectedGrammarChapter}
        selectedGrammarTag={selectedGrammarTag} setSelectedGrammarTag={setSelectedGrammarTag}
        availableGrammarChapters={availableGrammarChapters} availableGrammarTags={availableGrammarTags}
      />

      <PathBuilder 
        course={course} pathId={pathId} setPathId={setPathId} pathTitle={pathTitle} setPathTitle={setPathTitle}
        isSaving={isSaving} pods={pods} handleAddPod={handleAddPod} handleAddSegment={handleAddSegment}
        handleDeleteSegment={handleDeleteSegment} handleDeletePod={handleDeletePod} handleSavePathToFirestore={handleSavePathToFirestore}
        setPods={setPods} activeSegmentId={activeSegmentId} setActiveSegmentId={setActiveSegmentId} handleRemoveItem={handleRemoveItem}
        existingPaths={existingPaths} handleLoadPath={handleLoadPath} selectedExistingPathId={selectedExistingPathId} setSelectedExistingPathId={setSelectedExistingPathId}
        handleTogglePod={handleTogglePod} handleMovePod={handleMovePod} handleMoveSegment={handleMoveSegment}
        activeBranch={activeBranch} onBranchChange={handleBranchChange}
      />

      {pendingGroupAssign && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full max-h-[85vh] flex flex-col border border-slate-200">
            <h3 className="text-xl font-black text-slate-800 mb-1">{pendingGroupAssign.label}</h3>
            <p className="text-sm font-semibold text-slate-500 mb-4">Select the specific verbs you want to introduce in this segment.</p>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{selectedGroupVerbs.length} verbs selected</span>
              <div className="space-x-2">
                <button onClick={() => setSelectedGroupVerbs(pendingGroupAssign.fullData.verbIds || [])} className="text-xs text-blue-600 font-bold hover:underline">Select All</button>
                <span className="text-slate-300">|</span>
                <button onClick={() => setSelectedGroupVerbs([])} className="text-xs text-slate-500 font-bold hover:underline">Clear</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1 mb-6">
              {pendingGroupAssign.fullData.verbIds?.map(vid => (
                <label key={vid} className="flex items-center gap-3 p-2.5 hover:bg-white hover:shadow-sm cursor-pointer rounded-lg border border-transparent transition-all">
                  <input type="checkbox" checked={selectedGroupVerbs.includes(vid)} onChange={(e) => {
                    if (e.target.checked) setSelectedGroupVerbs([...selectedGroupVerbs, vid]);
                    else setSelectedGroupVerbs(selectedGroupVerbs.filter(v => v !== vid));
                  }} className="w-4 h-4 text-blue-600 rounded focus:ring-0" />
                  <span className={`text-sm font-bold ${selectedGroupVerbs.includes(vid) ? 'text-slate-800' : 'text-slate-400'}`}>{vid}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setPendingGroupAssign(null)} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
              <button onClick={confirmGroupAssignment} disabled={selectedGroupVerbs.length === 0} className="px-5 py-2.5 bg-emerald-600 disabled:bg-emerald-300 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-md transition-all">Assign {selectedGroupVerbs.length} Verbs</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}