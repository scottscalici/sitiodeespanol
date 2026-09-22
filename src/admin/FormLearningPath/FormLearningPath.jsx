import React, { useState, useEffect } from 'react';
import { db } from '../../firebase.js';
import VaultSidebar from './VaultSidebar';
import PathBuilder from './PathBuilder';
import { collection, doc, setDoc, getDoc, addDoc, arrayUnion, deleteField } from 'firebase/firestore';
import { getCachedCollection, invalidateCollectionCache } from '../../utils/firestoreCache';
import { QUESTION_TYPE_DEFAULTS, sumMix } from '../../utils/questionTypes';

export default function FormLearningPath() {
  // A path is now one content type from the start — no more vocab/verbs/
  // practical branches bundled into one document. "practical" is gone
  // entirely; sentences now attach directly to a vocab or verb path's
  // segments via pinned_sentences + the "sentence" slice of questionMix.
  const [contentType, setContentType] = useState('vocab'); // 'vocab' | 'verb'
  const [course, setCourse] = useState('s2');
  const [pathId, setPathId] = useState('');
  const [pathTitle, setPathTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingVault, setIsLoadingVault] = useState(false);

  // --- MASTER VAULT STATE ---
  const [activeTab, setActiveTab] = useState('vocab');

  // Intentionally starts blank (not a hardcoded book) so a new pod is never
  // silently built from whatever textbook happened to be the last default —
  // the admin must actively pick a book before any vocab can be assigned.
  const [selectedBook, setSelectedBook] = useState('');
  const [availableBooks, setAvailableBooks] = useState([]);

  const [selectedChapter, setSelectedChapter] = useState('');
  const [selectedSection, setSelectedSection] = useState('');

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

  // --- POD BUILDER STATE — one flat pod list for the whole path ---
  const makeDefaultSegment = () => ({
    id: `seg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    total_questions: sumMix(QUESTION_TYPE_DEFAULTS),
    questionMix: { ...QUESTION_TYPE_DEFAULTS },
    isSpeedRound: false,
    timeLimit: 60,
    targetTense: 'ALL',
    introduced_concepts: [],
    pinned_sentences: [],
  });

  const makeDefaultPods = () => ([
    {
      id: `pod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: 'Pod 1: Introducción',
      isExpanded: true,
      badgeAward: null,
      segments: [makeDefaultSegment()],
    },
  ]);

  const [pods, setPods] = useState(makeDefaultPods);
  const [activeSegmentId, setActiveSegmentIdRaw] = useState(pods[0].segments[0].id);
  const setActiveSegmentId = setActiveSegmentIdRaw;

  const [existingPaths, setExistingPaths] = useState([]);
  const [selectedExistingPathId, setSelectedExistingPathId] = useState('');

  const [pendingGroupAssign, setPendingGroupAssign] = useState(null);
  const [selectedGroupVerbs, setSelectedGroupVerbs] = useState([]);

  // Badge catalog (config/gamification.badges) — pods reference these by id
  // via pod.badgeAward to say "finishing this pod awards X badge/tier".
  const [badgeCatalog, setBadgeCatalog] = useState([]);

  useEffect(() => {
    const fetchBadgeCatalog = async () => {
      try {
        const snap = await getDoc(doc(db, 'config', 'gamification'));
        if (snap.exists()) setBadgeCatalog(snap.data().badges || []);
      } catch (err) {
        console.error('Error fetching badge catalog:', err);
      }
    };
    fetchBadgeCatalog();
  }, []);

  // Lets the Pod Creator create a new badge on the fly (without a trip to the
  // Gamification Manager) the moment an admin wants to tag a pod with one.
  const handleCreateBadge = async (newBadge) => {
    setBadgeCatalog((prev) => [...prev, newBadge]);
    try {
      await setDoc(doc(db, 'config', 'gamification'), { badges: arrayUnion(newBadge) }, { merge: true });
    } catch (err) {
      console.error('Error saving new badge to catalog:', err);
    }
  };

  // =========================================================
  // LOAD EXISTING PATHS FROM FIRESTORE
  // =========================================================
  const fetchExistingPaths = async () => {
    try {
      // Shared cache — TareasSequencer also reads learning_paths for its
      // Dominio-tarea picker, so this dedupes with that tool too.
      const paths = await getCachedCollection('learning_paths');
      setExistingPaths(paths);
    } catch (err) { console.error("Error fetching paths:", err); }
  };

  const sanitizeSegment = (s) => ({
    ...s,
    questionMix: s.questionMix || { ...QUESTION_TYPE_DEFAULTS },
    total_questions: s.total_questions ?? sumMix(s.questionMix || QUESTION_TYPE_DEFAULTS),
    isSpeedRound: s.isSpeedRound ?? (s.preset === 'speed_round'),
    timeLimit: s.timeLimit || 60,
    targetTense: s.targetTense || 'ALL',
    introduced_concepts: s.introduced_concepts || [],
    pinned_sentences: s.pinned_sentences || [],
  });

  const sanitizePods = (rawPods) => (rawPods || []).map((p) => ({
    ...p,
    isExpanded: p.isExpanded !== undefined ? p.isExpanded : true,
    badgeAward: p.badgeAward || null,
    segments: (p.segments || []).map(sanitizeSegment),
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

        // New shape: a flat `pods` array + explicit contentType. A path saved
        // before the vocab/verb split only has `branches` — load whichever
        // branch actually has pods (vocab preferred) as a best-effort import,
        // since that old shape can't be edited here directly anymore.
        let loadedPods, loadedContentType;
        if (Array.isArray(data.pods)) {
          loadedPods = data.pods;
          loadedContentType = data.contentType || 'vocab';
        } else if (data.branches?.vocab?.pods?.length) {
          loadedPods = data.branches.vocab.pods;
          loadedContentType = 'vocab';
        } else if (data.branches?.verbs?.pods?.length) {
          loadedPods = data.branches.verbs.pods;
          loadedContentType = 'verb';
        } else {
          loadedPods = [];
          loadedContentType = 'vocab';
        }

        const sanitized = sanitizePods(loadedPods);
        setPods(sanitized.length ? sanitized : makeDefaultPods());
        setContentType(loadedContentType);
        setActiveTab(loadedContentType === 'verb' ? 'verbs' : 'vocab');
        setActiveSegmentIdRaw(sanitized[0]?.segments[0]?.id || null);
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
    const newSeg = makeDefaultSegment();
    updated[podIndex].segments.push(newSeg);
    setPods(updated);
    setActiveSegmentId(newSeg.id);
  };

  const handleAddPod = () => {
    const newSeg = makeDefaultSegment();
    setPods([...pods, {
      id: `pod_${Date.now()}`, title: `Pod ${pods.length + 1}`, isExpanded: true, badgeAward: null,
      segments: [newSeg],
    }]);
    setActiveSegmentId(newSeg.id);
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
      // Shared cache — VocabSequencer and the student useGymData hook also
      // read vocab_bundles in full.
      const bundles = await getCachedCollection('vocab_bundles');
      const booksSet = new Set();
      const chaptersSet = new Set();

      bundles.forEach(data => {
        const bookName = guessBookName(data, data.id);
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
      const bundles = await getCachedCollection('vocab_bundles');

      bundles.forEach(data => {
        const bookName = guessBookName(data, data.id);
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
      // Shared cache — verbGroups/verbs are also read by VerbVault and
      // CalentamientoAdmin; sentence_bank is also read by SentenceManager.
      const [groups, verbs, grammarList] = await Promise.all([
        getCachedCollection('verbGroups'),
        getCachedCollection('verbs'),
        getCachedCollection('sentence_bank'),
      ]);

      const groupList = groups.map(data => ({ id: data.id, label: data.name || data.id, tags: data.tenses?.[0] || 'Cluster', tenses: data.tenses || [], verbIds: data.verbIds || [], isGroup: true, fullData: data }));
      const verbList = verbs.map(data => ({ id: data.id, label: data.infinitive || data.id, tags: data.tense || data.type || 'Verbo', tenses: [data.tense, data.type].filter(Boolean), isGroup: false, fullData: data }));

      const combined = [...groupList, ...verbList];
      setAllVerbsList(combined);
      setVaultVerbs(combined);

      const tensesSet = new Set();
      combined.forEach(item => item.tenses?.forEach(t => tensesSet.add(t)));
      setAvailableVerbTenses(Array.from(tensesSet));

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

  // A vocab path's vault can never show verbs, and vice versa — keeps the
  // "no vocab bleeding into a verb path" rule enforced by the tool itself,
  // not just convention.
  useEffect(() => {
    if (contentType === 'verb' && activeTab === 'vocab') setActiveTab('verbs');
    if (contentType === 'vocab' && activeTab === 'verbs') setActiveTab('vocab');
  }, [contentType, activeTab]);

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
    if (contentType === 'vocab' && !selectedBook) return alert("Please select a textbook before saving — nothing has been chosen yet.");
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'learning_paths', pathId), {
        path_id: pathId,
        title: pathTitle,
        course,
        contentType,
        textbook: contentType === 'vocab' ? selectedBook : '',
        chapter: contentType === 'vocab' ? selectedChapter : '',
        total_pods: pods.length,
        updated_at: new Date().toISOString(),
        pods,
        branches: deleteField(), // clear any stale pre-split shape on this doc
      }, { merge: true });
      invalidateCollectionCache('learning_paths');
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
      invalidateCollectionCache('sentence_bank');
      const newItem = { id: docRef.id, label: sentence, tags: topic || 'Gramática', chapterId: payload.chapterId, grammarTags, fullData: payload };
      setAllGrammarList([newItem, ...allGrammarList]);
    } catch (err) {
      console.error("Error creating grammar sentence:", err);
      alert("Failed to create sentence.");
    }
  };

  return (
    <div className="flex w-screen h-screen bg-slate-100 font-sans fixed inset-0 z-50 overflow-hidden">
      <VaultSidebar
        contentType={contentType}
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
        contentType={contentType} setContentType={setContentType}
        course={course} setCourse={setCourse} pathId={pathId} setPathId={setPathId} pathTitle={pathTitle} setPathTitle={setPathTitle}
        isSaving={isSaving} pods={pods} handleAddPod={handleAddPod} handleAddSegment={handleAddSegment}
        handleDeleteSegment={handleDeleteSegment} handleDeletePod={handleDeletePod} handleSavePathToFirestore={handleSavePathToFirestore}
        setPods={setPods} activeSegmentId={activeSegmentId} setActiveSegmentId={setActiveSegmentId} handleRemoveItem={handleRemoveItem}
        existingPaths={existingPaths} handleLoadPath={handleLoadPath} selectedExistingPathId={selectedExistingPathId} setSelectedExistingPathId={setSelectedExistingPathId}
        handleTogglePod={handleTogglePod} handleMovePod={handleMovePod} handleMoveSegment={handleMoveSegment}
        selectedBook={selectedBook} selectedChapter={selectedChapter}
        badgeCatalog={badgeCatalog} onCreateBadge={handleCreateBadge}
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
