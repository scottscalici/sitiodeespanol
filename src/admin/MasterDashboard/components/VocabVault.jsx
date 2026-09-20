import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase.js';
import { collection, doc, setDoc, updateDoc, deleteDoc, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';

// --- SLUG HELPERS (shared by bulk importer + single-word editor) ---
const slugifyBook = (textbook) => (textbook || 'unknown_book').replace(/\s+/g, '_').toLowerCase();
const slugifyWord = (palabra) => (palabra || '').replace(/\//g, '-').replace(/\s+/g, '_').replace(/[()]/g, '').toLowerCase();
const buildWordId = (textbook, palabra) => `${slugifyBook(textbook)}_${slugifyWord(palabra)}`;

const tagsToText = (arr) => (Array.isArray(arr) ? arr.join(', ') : '');
const textToTags = (text) => (text || '').split(',').map(t => t.trim()).filter(Boolean);

// --- BULK IMPORT EXAMPLE (shown + loadable in the Importer tab) ---
// id and lastUpdated are generated automatically on import — leave them out.
const EXAMPLE_JSON = JSON.stringify([
  {
    palabra: "brindar",
    traduccion: "to toast (drink)",
    definiciones: {
      nivel1: [
        "To toast. Raising a glass to say cheers.",
        "To toast. Queremos brindar por la felicidad de los novios."
      ],
      nivel2: [
        "Es la acción de levantar tu vaso de champán o vino para celebrar la salud y la alegría de otras personas.",
        "Siempre dices '¡Salud!' al hacerlo."
      ],
      nivel3: [
        "Manifestar, al ir a beber, el bien que se desea a alguien o la satisfacción por algo.",
        "Elevar las copas en un acto de comunión social para expresar parabienes o buenos augurios hacia un individuo o proyecto."
      ]
    },
    usage_tags: ["tema:celebraciones", "tema:interacciones"],
    metadata: {
      textbook: "Descubre 1",
      secciones: [],
      tipo: "verbo",
      evaluacion: true,
      ib_tags: ["Organización social"]
    }
  },
  {
    palabra: "celebrar",
    traduccion: "to celebrate",
    definiciones: {
      nivel1: ["To celebrate. Having a party for a special event."],
      nivel2: ["Es la acción de hacer una fiesta o un evento feliz porque es un día importante."],
      nivel3: ["Conmemorar un acontecimiento, especialmente si es feliz, con fiestas o actos solemnes."]
    },
    usage_tags: ["tema:celebraciones"],
    metadata: {
      textbook: "Descubre 1",
      secciones: [],
      tipo: "verbo",
      evaluacion: true,
      ib_tags: ["Organización social"]
    }
  }
], null, 2);

// --- DATA HEALER HELPER ---
const getSafeSectionsArray = (metadata) => {
  if (!metadata) return [];
  if (Array.isArray(metadata.secciones) && metadata.secciones.length > 0) return metadata.secciones;
  if (typeof metadata.secciones === 'string' && metadata.secciones.trim() !== '') return metadata.secciones.split(',').map(s => s.trim()).filter(Boolean);
  if (Array.isArray(metadata.seccion) && metadata.seccion.length > 0) return metadata.seccion;
  if (typeof metadata.seccion === 'string' && metadata.seccion.trim() !== '') return metadata.seccion.split(',').map(s => s.trim()).filter(Boolean);
  return [];
};

// --- CHAPTER FILTER LOGIC ---
const isWordInTargetSection = (word, targetSection) => {
  if (!targetSection || targetSection === "all") return true;
  const wordSections = getSafeSectionsArray(word?.metadata);
  if (targetSection.startsWith("chapter_")) {
    const chap = targetSection.replace("chapter_", "");
    return wordSections.some(s => s === chap || s.startsWith(`${chap}.`));
  }
  return wordSections.includes(targetSection);
};

const formatSectionLabel = (sec) => {
  if (!sec || sec === "all") return "All Sections";
  if (sec.startsWith("chapter_")) return `Chapter ${sec.replace("chapter_", "")}`;
  return `Section ${sec}`;
};

const VocabVault = () => {
  const [activeTab, setActiveTab] = useState('library'); 
  
  // --- DATA STATES ---
  const [fullVocab, setFullVocab] = useState([]);
  const [savedPaths, setSavedPaths] = useState([]);
  const [savedWarmups, setSavedWarmups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // --- UPLOADER STATES ---
  const [jsonInput, setJsonInput] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [showJsonExample, setShowJsonExample] = useState(false);

  // --- EDITOR STATES ---
  const [editingWord, setEditingWord] = useState(null);
  const [librarySearch, setLibrarySearch] = useState("");
  const [auditFilter, setAuditFilter] = useState("all");
  const [libraryTextbookFilter, setLibraryTextbookFilter] = useState("all");
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedWords, setSelectedWords] = useState([]);
  const [bulkTextbook, setBulkTextbook] = useState("");
  const [bulkSection, setBulkSection] = useState("");

  // --- BAKING STATION STATES ---
  const [editingWarmupId, setEditingWarmupId] = useState(null);
  const [diaNumber, setDiaNumber] = useState(1);
  const [warmupName, setWarmupName] = useState("");
  const [courseTag, setCourseTag] = useState("s2"); // 🚀 Added Course Stamping State
  const [sequence, setSequence] = useState([]);
  
  // Baking Mode: 'manual' or 'path'
  const [bakeMode, setBakeMode] = useState('path'); 
  const [recipeBlocks, setRecipeBlocks] = useState([{ id: Date.now(), textbook: "", section: "all", count: 10 }]);
  
  // Path Auto-Pilot States
  const [selectedPathId, setSelectedPathId] = useState("");
  const [currentLocationIndex, setCurrentLocationIndex] = useState(0);
  const [targetWordCount, setTargetWordCount] = useState(30);

  // Drag and Drop States
  const [draggedIndex, setDraggedIndex] = useState(null);

  // --- PATH BUILDER STATES ---
  const [editingPath, setEditingPath] = useState(null); 

  // --- OVERRIDE MODAL STATES ---
  const [isSearching, setIsSearching] = useState(null); 
  const [replaceSearch, setReplaceSearch] = useState("");
  const [replaceTextbook, setReplaceTextbook] = useState("");
  const [replaceSection, setReplaceSection] = useState("all");

  // Load Data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const vocabSnap = await getDocs(collection(db, "vocabulary"));
      setFullVocab(vocabSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      const pathsSnap = await getDocs(collection(db, "vocabPaths"));
      setSavedPaths(pathsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const warmupsSnap = await getDocs(collection(db, "dailyVocabWarmups"));
      setSavedWarmups(warmupsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.dia - b.dia));
      
      setIsLoading(false);
    } catch (err) {
      console.error("Database error:", err);
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // --- DROPDOWN HELPERS ---
  const availableTextbooks = [...new Set(fullVocab.map(v => v?.metadata?.textbook))].filter(Boolean).sort();
  
  const getSectionsForTextbook = (textbook) => {
    const wordsInBook = fullVocab.filter(v => v?.metadata?.textbook === textbook);
    const sections = new Set();
    wordsInBook.forEach(w => getSafeSectionsArray(w?.metadata).forEach(s => sections.add(s)));
    return [...sections].sort();
  };

  const getChaptersForTextbook = (textbook) => {
    const sections = getSectionsForTextbook(textbook);
    const chapters = new Set();
    sections.forEach(s => {
      if (s && s.includes('.')) chapters.add(s.split('.')[0]);
    });
    return [...chapters].sort((a, b) => parseInt(a) - parseInt(b));
  };

  const renderSectionDropdown = (textbook, value, onChangeHandler, disabled = false) => {
    const sections = getSectionsForTextbook(textbook);
    const chapters = getChaptersForTextbook(textbook);
    return (
      <select value={value} onChange={onChangeHandler} style={s.selectBox} disabled={disabled}>
        <option value="all">All Sections</option>
        {chapters.length > 0 && <optgroup label="Entire Chapters">{chapters.map(c => <option key={`ch_${c}`} value={`chapter_${c}`}>Chapter {c}</option>)}</optgroup>}
        {sections.length > 0 && <optgroup label="Specific Subsections">{sections.map(sec => <option key={sec} value={sec}>Section {sec}</option>)}</optgroup>}
      </select>
    );
  };

  // --- LOGIC: PUBLISHER (STUDENT COMPILER) ---
  const publishChapters = async () => {
    if (!window.confirm("Ready to publish Chapter Bundles to the student site? This will compile all words into single-read documents.")) return;
    
    setUploadStatus('⏳ Publishing Bundles...');
    try {
      const textbooks = [...new Set(fullVocab.map(v => v?.metadata?.textbook))].filter(Boolean);

      for (const book of textbooks) {
        const bookWords = fullVocab.filter(v => v?.metadata?.textbook === book);
        
        const chapters = new Set();
        bookWords.forEach(w => {
          const sections = getSafeSectionsArray(w.metadata);
          sections.forEach(s => {
            if (s.includes('.')) chapters.add(s.split('.')[0]);
            else if (!isNaN(s)) chapters.add(s);
          });
        });

        for (const chap of chapters) {
          const chapterWords = bookWords.filter(w => {
            const sections = getSafeSectionsArray(w.metadata);
            return sections.some(s => s === chap || s.startsWith(`${chap}.`));
          });

          const docId = `${book.replace(/\s+/g, '_').toLowerCase()}_ch${chap}`;
          
          await setDoc(doc(db, "vocab_bundles", docId), {
            textbook: book,
            chapter: chap,
            wordCount: chapterWords.length,
            words: chapterWords, 
            lastUpdated: serverTimestamp()
          });
        }
      }
      alert("✅ Chapter Bundles successfully published!");
      setUploadStatus('');
    } catch (err) {
      console.error("Publish failed:", err);
      setUploadStatus('❌ Error publishing bundles.');
    }
  };

  // --- LOGIC: UPLOADER ---
  const handleUpload = async () => {
    try {
      const data = JSON.parse(jsonInput);
      setUploadStatus('⏳ Processing...');
      for (const item of data) {
        const docId = buildWordId(item.metadata?.textbook, item.palabra);
        await setDoc(doc(db, "vocabulary", docId), { ...item, lastUpdated: serverTimestamp() });
      }
      setJsonInput('');
      await fetchData(); 
      setUploadStatus('✅ Library updated.');
    } catch (error) { setUploadStatus('❌ Error: Invalid JSON'); }
  };

  // --- LOGIC: EDITOR & BULK ---
  const openEditor = (wordObj) => {
    const safelyGetText = (def) => {
      if (Array.isArray(def)) return def.join('\n');
      if (typeof def === 'string') return def;
      return "";
    };
    setEditingWord({
      ...wordObj,
      isNew: false,
      edit_textbook: wordObj?.metadata?.textbook || "",
      edit_section: getSafeSectionsArray(wordObj?.metadata).join(', '),
      edit_tipo: wordObj?.metadata?.tipo || "",
      edit_evaluacion: !!wordObj?.metadata?.evaluacion,
      edit_ib_tags: tagsToText(wordObj?.metadata?.ib_tags),
      edit_usage_tags: tagsToText(wordObj?.usage_tags),
      def1_text: safelyGetText(wordObj?.definiciones?.nivel1),
      def2_text: safelyGetText(wordObj?.definiciones?.nivel2),
      def3_text: safelyGetText(wordObj?.definiciones?.nivel3)
    });
  };

  const createNewWord = () => {
    const presetBook = libraryTextbookFilter !== 'all' ? libraryTextbookFilter : "";
    setEditingWord({
      isNew: true,
      id: null,
      palabra: "",
      traduccion: "",
      edit_textbook: presetBook,
      edit_section: "",
      edit_tipo: "",
      edit_evaluacion: false,
      edit_ib_tags: "",
      edit_usage_tags: "",
      def1_text: "",
      def2_text: "",
      def3_text: ""
    });
  };

  const saveEditedWord = async () => {
    if (!editingWord.palabra?.trim()) return alert("Word (palabra) is required.");
    if (!editingWord.edit_textbook?.trim()) return alert("Textbook is required.");
    try {
      const metadata = {
        ...(editingWord.metadata || {}),
        textbook: editingWord.edit_textbook,
        secciones: editingWord.edit_section.split(',').map(s => s.trim()).filter(Boolean),
        tipo: editingWord.edit_tipo,
        evaluacion: editingWord.edit_evaluacion,
        ib_tags: textToTags(editingWord.edit_ib_tags)
      };
      delete metadata.seccion;

      const updatedData = {
        ...editingWord,
        metadata,
        usage_tags: textToTags(editingWord.edit_usage_tags),
        definiciones: {
          nivel1: (editingWord.def1_text || "").split('\n').filter(t => t.trim() !== ''),
          nivel2: (editingWord.def2_text || "").split('\n').filter(t => t.trim() !== ''),
          nivel3: (editingWord.def3_text || "").split('\n').filter(t => t.trim() !== ''),
        },
        lastUpdated: serverTimestamp()
      };
      delete updatedData.def1_text; delete updatedData.def2_text; delete updatedData.def3_text;
      delete updatedData.edit_textbook; delete updatedData.edit_section;
      delete updatedData.edit_tipo; delete updatedData.edit_evaluacion;
      delete updatedData.edit_ib_tags; delete updatedData.edit_usage_tags;
      delete updatedData.isNew;

      if (editingWord.isNew) {
        const newId = buildWordId(editingWord.edit_textbook, editingWord.palabra);
        if (fullVocab.some(w => w.id === newId)) {
          if (!window.confirm(`A word with id "${newId}" already exists. Overwrite it?`)) return;
        }
        updatedData.id = newId;
        await setDoc(doc(db, "vocabulary", newId), updatedData);
        setFullVocab(prev => [...prev.filter(w => w.id !== newId), { ...updatedData, id: newId }]);
        setEditingWord(null);
        alert("Word created!");
      } else {
        const docRef = doc(db, "vocabulary", editingWord.id);
        await updateDoc(docRef, updatedData);
        setFullVocab(fullVocab.map(w => w.id === editingWord.id ? { ...updatedData, id: editingWord.id } : w));
        setEditingWord(null);
        alert("Updated successfully!");
      }
    } catch (e) { console.error(e); alert("Error saving."); }
  };

  const deleteWord = async (wordId) => {
    if (!window.confirm("Delete this word permanently? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "vocabulary", wordId));
      setFullVocab(prev => prev.filter(w => w.id !== wordId));
      setEditingWord(null);
    } catch (e) { alert("Error deleting."); }
  };

  const applyBulkTags = async () => {
    if (selectedWords.length === 0) return alert("Select at least one word.");
    try {
      const batchPromises = selectedWords.map(async (wordId) => {
        const docRef = doc(db, "vocabulary", wordId);
        const word = fullVocab.find(v => v.id === wordId);
        const updatedMetadata = {
          ...word.metadata,
          textbook: bulkTextbook || word.metadata?.textbook || "",
          secciones: bulkSection ? bulkSection.split(',').map(s => s.trim()).filter(Boolean) : getSafeSectionsArray(word.metadata)
        };
        if (updatedMetadata.seccion !== undefined) delete updatedMetadata.seccion;
        await updateDoc(docRef, { metadata: updatedMetadata });
        return { id: wordId, updatedMetadata };
      });
      const results = await Promise.all(batchPromises);
      setFullVocab(prev => prev.map(w => {
        const up = results.find(r => r.id === w.id);
        return up ? { ...w, metadata: up.updatedMetadata } : w;
      }));
      setSelectedWords([]); setBulkTextbook(""); setBulkSection("");
      alert(`Updated ${results.length} words!`);
    } catch (e) { alert("Error bulk updating."); }
  };

  const toggleWordSelection = (id) => {
    if (selectedWords.includes(id)) setSelectedWords(selectedWords.filter(wId => wId !== id));
    else setSelectedWords([...selectedWords, id]);
  };

  // --- LOGIC: PATH BUILDER ---
  const createNewPath = () => setEditingPath({ id: `path_${Date.now()}`, name: "New Class Cohort", steps: [] });
  const addPathStep = () => setEditingPath({ ...editingPath, steps: [...editingPath.steps, { textbook: availableTextbooks[0] || "", section: "all", id: Date.now() }] });
  const updatePathStep = (stepId, field, value) => setEditingPath({ ...editingPath, steps: editingPath.steps.map(s => s.id === stepId ? { ...s, [field]: value, ...(field === 'textbook' ? {section: 'all'} : {}) } : s) });
  const removePathStep = (stepId) => setEditingPath({ ...editingPath, steps: editingPath.steps.filter(s => s.id !== stepId) });
  const moveStep = (index, direction) => {
    const newSteps = [...editingPath.steps];
    if (direction === 'up' && index > 0) [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
    else if (direction === 'down' && index < newSteps.length - 1) [newSteps[index + 1], newSteps[index]] = [newSteps[index], newSteps[index + 1]];
    setEditingPath({ ...editingPath, steps: newSteps });
  };
  const savePathToFirestore = async () => {
    if (!editingPath.name) return alert("Give the path a name.");
    try {
      await setDoc(doc(db, "vocabPaths", editingPath.id), { name: editingPath.name, steps: editingPath.steps, lastUpdated: serverTimestamp() });
      const updatedPaths = savedPaths.filter(p => p.id !== editingPath.id);
      setSavedPaths([...updatedPaths, editingPath]);
      setEditingPath(null);
      alert("Path Saved!");
    } catch (e) { alert("Error saving path."); }
  };

  // --- LOGIC: BAKING & SEQUENCES ---
  const shuffleArray = (array) => [...array].sort(() => Math.random() - 0.5);

  const performBakeLogic = (blocksToBake) => {
    let newSequence = [];
    for (const block of blocksToBake) {
      if (!block.textbook || block.count === 0) continue;
      let eligible = fullVocab.filter(v => (v?.metadata?.textbook || "").trim().toLowerCase() === block.textbook.trim().toLowerCase());
      eligible = eligible.filter(v => isWordInTargetSection(v, block.section));
      if (eligible.length === 0) continue;
      const shuffled = shuffleArray(eligible);
      const selected = shuffled.slice(0, block.count);
      const formatted = selected.map(w => ({
        vocabId: w.id, palabra: w?.palabra || w?.spanish || "Unknown", traduccion: w?.traduccion || w?.english || "Unknown",
        textbook: w?.metadata?.textbook || "Unknown", secciones: getSafeSectionsArray(w?.metadata).join(', ')
      }));
      newSequence.push(...formatted);
    }
    setSequence(shuffleArray(newSequence));
  };

  const addRecipeBlock = () => setRecipeBlocks([...recipeBlocks, { id: Date.now(), textbook: availableTextbooks[0] || "", section: "all", count: 10 }]);
  const removeRecipeBlock = (id) => {
    if (recipeBlocks.length === 1) return alert("You must have at least one block!");
    setRecipeBlocks(recipeBlocks.filter(block => block.id !== id));
  };
  const updateRecipeBlock = (id, field, value) => setRecipeBlocks(recipeBlocks.map(block => {
    if (block.id === id) return { ...block, [field]: value, ...(field === 'textbook' ? {section: 'all'} : {}) };
    return block;
  }));

  const executeManualBake = () => { performBakeLogic(recipeBlocks); setEditingWarmupId(null); };

  const executePathBake = () => {
    const path = savedPaths.find(p => p.id === selectedPathId);
    if (!path) return alert("Please select a valid path.");
    if (path.steps.length === 0) return alert("This path has no steps.");

    const pastSteps = path.steps.slice(0, parseInt(currentLocationIndex) + 1);
    if (pastSteps.length === 0) return alert("No previous steps to pull from.");

    const count = parseInt(targetWordCount) || 30;
    const baseAmount = Math.floor(count / pastSteps.length);
    let remainder = count % pastSteps.length;

    const autoBlocks = pastSteps.map(step => {
      let stepCount = baseAmount;
      if (remainder > 0) { stepCount++; remainder--; }
      return { textbook: step.textbook, section: step.section, count: stepCount };
    });

    performBakeLogic(autoBlocks);
    setEditingWarmupId(null); 
  };

  const replaceWord = (newWord) => {
    const updated = [...sequence];
    updated[isSearching] = {
      vocabId: newWord.id, palabra: newWord.palabra, traduccion: newWord.traduccion,
      textbook: newWord.metadata?.textbook || "", secciones: getSafeSectionsArray(newWord.metadata).join(', ')
    };
    setSequence(updated); setIsSearching(null); setReplaceSearch(""); 
  };

  // --- LOGIC: DRAG AND DROP REORDERING ---
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e, index) => {
    e.preventDefault();
  };
  const handleDrop = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newSeq = [...sequence];
    const draggedItem = newSeq.splice(draggedIndex, 1)[0];
    newSeq.splice(index, 0, draggedItem);
    
    setSequence(newSeq);
    setDraggedIndex(null);
  };

  // --- LOGIC: SAVING / UPDATING WARMUPS ---
  const saveWarmupToFirestore = async () => {
    if (!warmupName || sequence.length === 0) return alert("Name missing or empty sequence.");
    
    try {
      const warmupPayload = {
        dia: parseInt(diaNumber),
        name: warmupName,
        course: courseTag,           // 🚀 Stamped Course ('s2' or 's4')
        pathId: selectedPathId || '', // 🚀 Stamped Associated Path
        sequence,
        lastUpdated: serverTimestamp()
      };

      if (editingWarmupId) {
        await updateDoc(doc(db, "dailyVocabWarmups", editingWarmupId), warmupPayload);
        alert(`Updated ${warmupName}!`);
      } else {
        warmupPayload.createdAt = serverTimestamp();
        await addDoc(collection(db, "dailyVocabWarmups"), warmupPayload);
        alert(`Saved Día ${diaNumber} (${courseTag.toUpperCase()})!`);
      }
      await fetchData(); 
    } catch (e) {
      console.error(e);
      alert("Error saving practice.");
    }
  };

  const loadSavedPractice = (practice) => {
    setEditingWarmupId(practice.id);
    setDiaNumber(practice.dia);
    setWarmupName(practice.name);
    setCourseTag(practice.course || 's2');       // 🚀 Load stamped course
    setSelectedPathId(practice.pathId || '');  // 🚀 Load stamped path
    setSequence(practice.sequence);
    setActiveTab('bake');
  };

  const clearBakingStation = () => {
    setEditingWarmupId(null);
    setSequence([]);
    setWarmupName("");
  };

  if (isLoading) return <div style={s.centerScreen}><h2>Loading Vocab Vault...</h2></div>;

  const filteredVocabList = fullVocab.filter(v => {
    if (libraryTextbookFilter !== 'all' && (v?.metadata?.textbook || '') !== libraryTextbookFilter) return false;
    if (auditFilter === 'no_section') return getSafeSectionsArray(v?.metadata).length === 0;
    if (auditFilter === 'no_book') return !v?.metadata?.textbook;
    const term = librarySearch.toLowerCase();
    return (v?.palabra||"").toLowerCase().includes(term) || (v?.traduccion||"").toLowerCase().includes(term);
  });

  return (
    <div style={s.dashboard}>
      <header style={s.header}>
        <h1 style={s.title}>VOCAB <span style={{color: '#ff9a40'}}>VAULT</span></h1>
        <div style={s.tabs}>
          <button onClick={() => setActiveTab('upload')} style={activeTab === 'upload' ? s.tabActive : s.tab}>Importer</button>
          <button onClick={() => setActiveTab('library')} style={activeTab === 'library' ? s.tabActive : s.tab}>Library & Editor</button>
          <button onClick={() => setActiveTab('bake')} style={activeTab === 'bake' ? s.tabActive : s.tab}>Baking Station</button>
          <button onClick={() => setActiveTab('paths')} style={activeTab === 'paths' ? s.tabActive : s.tab}>Path Builder</button>
          <button onClick={() => setActiveTab('saved')} style={activeTab === 'saved' ? s.tabActive : s.tab}>Saved Practices</button>
        </div>
      </header>

      {/* --- TAB 1: UPLOADER --- */}
      {activeTab === 'upload' && (
        <div style={s.panel}>
          <h2 style={{color: '#ff9a40'}}>🚀 JSON Bulk Importer</h2>
          <p style={{color: '#888', fontSize: '13px', marginTop: '-5px'}}>
            Paste a JSON array of word objects below. Each word needs <code>palabra</code>, <code>traduccion</code>, <code>definiciones</code> (nivel1/nivel2/nivel3 arrays of strings), <code>usage_tags</code>, and <code>metadata</code> (textbook, secciones, tipo, evaluacion, ib_tags). Leave <code>secciones: []</code> if you don't have sections yet. Don't include <code>id</code> or <code>lastUpdated</code> — those are generated automatically.
          </p>
          <div style={{display: 'flex', gap: '10px', marginBottom: '10px'}}>
            <button onClick={() => setJsonInput(EXAMPLE_JSON)} style={{...s.primaryBtn, background: '#1a1a1a', border: '1px solid #ff9a40', color: '#ff9a40'}}>📋 Load Example Into Editor</button>
            <button onClick={() => setShowJsonExample(v => !v)} style={{...s.primaryBtn, background: 'none', border: '1px solid #333', color: '#888'}}>{showJsonExample ? 'Hide' : 'Show'} Format Reference</button>
          </div>
          {showJsonExample && (
            <pre style={s.exampleBlock}>{EXAMPLE_JSON}</pre>
          )}
          <textarea style={s.jsonTextarea} value={jsonInput} onChange={e => setJsonInput(e.target.value)} placeholder='Paste JSON array here, or click "Load Example Into Editor" above to start from a template...' />
          <button onClick={handleUpload} style={{...s.primaryBtn, marginTop: '15px'}}>Push to Firestore</button>
        </div>
      )}

      {/* --- TAB 2: LIBRARY --- */}
      {activeTab === 'library' && (
        <div style={{display: 'flex', gap: '30px', height: '75vh'}}>
          <div style={s.sidebar}>
            <div style={{marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
               <button onClick={createNewWord} style={{...s.primaryBtn, width: '100%'}}>+ New Word</button>
               <button onClick={publishChapters} style={{...s.primaryBtn, width: '100%', background: '#2a1a00', border: '1px solid #ff9a40', color: '#ff9a40'}}>🚀 Sync Chapter Bundles</button>
               {uploadStatus && <div style={{fontSize: '11px', color: '#ff9a40', marginTop: '5px', textAlign: 'center'}}>{uploadStatus}</div>}
            </div>

            <select value={libraryTextbookFilter} onChange={e => setLibraryTextbookFilter(e.target.value)} style={{...s.selectBox, marginBottom: '10px'}}>
              <option value="all">All Textbooks</option>
              {availableTextbooks.map(tb => <option key={tb} value={tb}>{tb}</option>)}
            </select>

            <div style={{display: 'flex', gap: '8px', marginBottom: '10px'}}>
              <button onClick={() => {setAuditFilter('all'); setSelectedWords([]);}} style={auditFilter === 'all' ? s.badgeActive : s.badge}>All</button>
              <button onClick={() => {setAuditFilter('no_section'); setSelectedWords([]);}} style={auditFilter === 'no_section' ? s.badgeAlertActive : s.badgeAlert}>⚠️ No Section</button>
            </div>
            <input type="text" placeholder="Search..." value={librarySearch} onChange={e => setLibrarySearch(e.target.value)} style={s.searchBar} />
            <label style={{display: 'block', marginBottom: '10px', color: '#ff9a40'}}><input type="checkbox" checked={isBulkMode} onChange={e => setIsBulkMode(e.target.checked)}/> Bulk Mode</label>
            
            <div style={s.scrollList}>
              {filteredVocabList.map(v => (
                <div key={v.id} style={selectedWords.includes(v.id) ? s.vocabItemBulkSelected : s.vocabItem} onClick={() => isBulkMode ? toggleWordSelection(v.id) : openEditor(v)}>
                  <div style={{fontWeight: 'bold', color: '#fff'}}>{v?.palabra}</div>
                  <div style={{fontSize: '11px', color: '#666'}}>{v.metadata?.textbook} • {getSafeSectionsArray(v.metadata).join(', ')}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={s.editorPanel}>
             {isBulkMode ? (
               <div style={s.editorForm}>
                 <h2 style={{color: '#ff9a40'}}>Bulk Tag {selectedWords.length} Words</h2>
                 <div style={s.inputBox}><label style={s.label}>Textbook</label><input type="text" value={bulkTextbook} onChange={e=>setBulkTextbook(e.target.value)} style={s.inputLarge} /></div>
                 <div style={s.inputBox}><label style={s.label}>Sections</label><input type="text" value={bulkSection} onChange={e=>setBulkSection(e.target.value)} style={s.inputLarge} /></div>
                 <button onClick={applyBulkTags} style={s.primaryBtn}>Apply</button>
               </div>
             ) : editingWord ? (
               <div style={s.editorForm}>
                 <div style={{display: 'flex', justifyContent: 'space-between'}}>
                   <h2 style={{color: '#ff9a40'}}>{editingWord.isNew ? 'New Word' : `Editing: ${editingWord.palabra}`}</h2>
                   <button onClick={()=>setEditingWord(null)} style={s.cancelBtn}>Close</button>
                 </div>
                 {!editingWord.edit_section && (
                   <div style={{fontSize: '12px', color: '#ffb3b3', background: '#2a1111', border: '1px solid #4a1111', padding: '8px 12px', borderRadius: '4px'}}>
                     ⚠️ No section assigned yet — this word won't appear on the student site until you tag a section (find it later via the "⚠️ No Section" filter) and Sync Chapter Bundles.
                   </div>
                 )}
                 <div style={{display: 'flex', gap: '10px'}}><div style={s.inputBox}><label style={s.label}>Textbook</label><input value={editingWord.edit_textbook} onChange={e=>setEditingWord({...editingWord, edit_textbook: e.target.value})} style={s.inputLarge}/></div><div style={s.inputBox}><label style={s.label}>Sections (optional)</label><input placeholder="e.g. 9.1 — leave blank for now" value={editingWord.edit_section} onChange={e=>setEditingWord({...editingWord, edit_section: e.target.value})} style={s.inputLarge}/></div></div>
                 <div style={{display: 'flex', gap: '10px'}}><div style={s.inputBox}><label style={s.label}>Spanish</label><input value={editingWord.palabra} onChange={e=>setEditingWord({...editingWord, palabra: e.target.value})} style={s.inputLarge}/></div><div style={s.inputBox}><label style={s.label}>English</label><input value={editingWord.traduccion} onChange={e=>setEditingWord({...editingWord, traduccion: e.target.value})} style={s.inputLarge}/></div></div>
                 <div style={{display: 'flex', gap: '10px'}}>
                   <div style={s.inputBox}><label style={s.label}>Tipo (verbo, adjetivo, etc.)</label><input value={editingWord.edit_tipo} onChange={e=>setEditingWord({...editingWord, edit_tipo: e.target.value})} style={s.inputLarge}/></div>
                   <div style={{...s.inputBox, flexGrow: 0, justifyContent: 'center'}}>
                     <label style={s.label}>Evaluación</label>
                     <label style={{color: '#ff9a40', display: 'flex', alignItems: 'center', gap: '6px', height: '38px'}}>
                       <input type="checkbox" checked={editingWord.edit_evaluacion} onChange={e=>setEditingWord({...editingWord, edit_evaluacion: e.target.checked})}/> Testable
                     </label>
                   </div>
                 </div>
                 <div style={{display: 'flex', gap: '10px'}}>
                   <div style={s.inputBox}><label style={s.label}>IB Tags (comma-separated)</label><input value={editingWord.edit_ib_tags} onChange={e=>setEditingWord({...editingWord, edit_ib_tags: e.target.value})} style={s.inputLarge}/></div>
                   <div style={s.inputBox}><label style={s.label}>Usage Tags (comma-separated)</label><input placeholder="tema:celebraciones, tema:acciones" value={editingWord.edit_usage_tags} onChange={e=>setEditingWord({...editingWord, edit_usage_tags: e.target.value})} style={s.inputLarge}/></div>
                 </div>
                 <div style={s.inputBox}><label style={s.label}>Nivel 1 — English (one per line)</label><textarea value={editingWord.def1_text} onChange={e=>setEditingWord({...editingWord, def1_text: e.target.value})} style={s.defTextarea}/></div>
                 <div style={s.inputBox}><label style={s.label}>Nivel 2 — Spanish básico (one per line)</label><textarea value={editingWord.def2_text} onChange={e=>setEditingWord({...editingWord, def2_text: e.target.value})} style={s.defTextarea}/></div>
                 <div style={s.inputBox}><label style={s.label}>Nivel 3 — Spanish avanzado (one per line)</label><textarea value={editingWord.def3_text} onChange={e=>setEditingWord({...editingWord, def3_text: e.target.value})} style={s.defTextarea}/></div>
                 <div style={{display: 'flex', gap: '10px'}}>
                   <button onClick={saveEditedWord} style={{...s.primaryBtn, flexGrow: 1}}>{editingWord.isNew ? 'Create Word' : 'Update'}</button>
                   {!editingWord.isNew && <button onClick={() => deleteWord(editingWord.id)} style={{...s.primaryBtn, background: '#4a1111', border: '1px solid #f44', color: '#ffb3b3'}}>Delete</button>}
                 </div>
               </div>
             ) : <div style={{color:'#666'}}>Select a word to edit, or click "+ New Word" to add one.</div>}
          </div>
        </div>
      )}

      {/* --- TAB 3: BAKING STATION --- */}
      {activeTab === 'bake' && (
        <div style={s.content}>
          {editingWarmupId && (
            <div style={{background: '#2a1a00', padding: '10px 20px', borderRadius: '8px', border: '1px solid #ff9a40', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <span style={{color: '#ff9a40', fontWeight: 'bold'}}>✏️ Currently Editing Saved Practice: {warmupName}</span>
              <button onClick={clearBakingStation} style={{background: 'none', border: '1px solid #ff9a40', color: '#ff9a40', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer'}}>Clear / Start Fresh</button>
            </div>
          )}

          {/* 🚀 COURSE STAMPING CONFIG HEADER */}
          <div style={s.configRow}>
            <div style={s.inputBox}>
              <label style={s.label}>Course</label>
              <select value={courseTag} onChange={e => setCourseTag(e.target.value)} style={s.selectBox}>
                <option value="s2">S2</option>
                <option value="s4">S4</option>
              </select>
            </div>
            <div style={s.inputBox}><label style={s.label}>Día #</label><input type="number" value={diaNumber} onChange={e => setDiaNumber(e.target.value)} style={s.inputSmall} /></div>
            <div style={s.inputBox}><label style={s.label}>Practice Name</label><input type="text" value={warmupName} onChange={e => setWarmupName(e.target.value)} style={s.inputLarge} /></div>
            <button style={{...s.primaryBtn, marginLeft: 'auto'}} onClick={saveWarmupToFirestore}>{editingWarmupId ? "Update Practice" : "Save Practice"}</button>
          </div>

          <div style={s.recipeArea}>
            <div style={{display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '10px'}}>
              <button onClick={() => setBakeMode('path')} style={bakeMode === 'path' ? s.tabActive : s.tab}>🚀 Auto-Pilot (Timeline)</button>
              <button onClick={() => setBakeMode('manual')} style={bakeMode === 'manual' ? s.tabActive : s.tab}>⚙️ Manual Builder</button>
            </div>

            {bakeMode === 'path' ? (
              <div style={{display: 'flex', gap: '20px', alignItems: 'flex-end', background: '#111', padding: '20px', borderRadius: '8px'}}>
                <div style={s.inputBox}>
                  <label style={s.label}>1. Select Curriculum Path</label>
                  <select value={selectedPathId} onChange={e => {setSelectedPathId(e.target.value); setCurrentLocationIndex(0);}} style={s.selectBox}>
                    <option value="">-- Choose Path --</option>
                    {savedPaths.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                {selectedPathId && (
                  <div style={s.inputBox}>
                    <label style={s.label}>2. We are currently on...</label>
                    <select value={currentLocationIndex} onChange={e => setCurrentLocationIndex(e.target.value)} style={s.selectBox}>
                      {savedPaths.find(p => p.id === selectedPathId)?.steps.map((step, idx) => (
                        <option key={idx} value={idx}>Step {idx + 1}: {step.textbook} ({formatSectionLabel(step.section)})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={s.inputBox}>
                  <label style={s.label}>3. Total Words</label>
                  <input type="number" value={targetWordCount} onChange={e => setTargetWordCount(e.target.value)} style={s.inputSmall} />
                </div>

                <button style={s.executeBtn} onClick={executePathBake}>Bake Historical Review</button>
              </div>
            ) : (
              <div>
                 <button style={s.addBlockBtn} onClick={addRecipeBlock}>+ Add Source Block</button>
                 <div style={{display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px'}}>
                   {recipeBlocks.map((block) => (
                      <div key={block.id} style={{display: 'flex', gap: '10px', background: '#111', padding: '10px', borderRadius: '6px', alignItems: 'center'}}>
                        <input type="number" value={block.count} onChange={e => updateRecipeBlock(block.id, 'count', e.target.value)} style={s.inputSmall} />
                        <select value={block.textbook} onChange={e => updateRecipeBlock(block.id, 'textbook', e.target.value)} style={s.selectBox}>
                          <option value="">- Select Book -</option>
                          {availableTextbooks.map(tb => <option key={tb}>{tb}</option>)}
                        </select>
                        {renderSectionDropdown(block.textbook, block.section, e => updateRecipeBlock(block.id, 'section', e.target.value))}
                        <button onClick={() => removeRecipeBlock(block.id)} style={{background: 'none', border: 'none', color: '#f44', cursor: 'pointer', fontSize: '18px'}}>×</button>
                      </div>
                   ))}
                 </div>
                 <button style={s.executeBtn} onClick={executeManualBake}>Bake Manual Sequence</button>
              </div>
            )}
          </div>

          {sequence.length > 0 && (
            <div style={s.grid}>
              {sequence.map((slot, i) => (
                <div 
                  key={`${slot.vocabId}_${i}`} 
                  draggable 
                  onDragStart={(e) => handleDragStart(e, i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDrop={(e) => handleDrop(e, i)}
                  style={{...s.slotCard, opacity: draggedIndex === i ? 0.5 : 1, cursor: 'grab'}}
                >
                  <div style={s.slotHeader}>
                    <span style={{color: '#666', cursor: 'grab', marginRight: '5px'}}>⋮⋮</span>
                    <span style={s.slotNum}>#{i+1}</span>
                    <span style={s.slotTense}>{slot.textbook} • {slot.secciones}</span>
                  </div>
                  <div style={s.slotBody}>
                    <strong style={s.verbText}>{slot.palabra}</strong>
                    <span style={s.subjectText}>{slot.traduccion}</span>
                  </div>
                  <button style={s.replaceBtn} onClick={() => setIsSearching(i)}>Override</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- TAB 4: PATH BUILDER --- */}
      {activeTab === 'paths' && (
        <div style={{display: 'flex', gap: '30px', height: '75vh'}}>
          <div style={s.sidebar}>
            <button onClick={createNewPath} style={{...s.primaryBtn, width: '100%', marginBottom: '15px'}}>+ Create New Path</button>
            <div style={s.scrollList}>
              {savedPaths.map(path => (
                <div key={path.id} style={s.vocabItem} onClick={() => setEditingPath({...path})}>
                  <div style={{fontWeight: 'bold', color: '#ff9a40'}}>{path.name}</div>
                  <div style={{fontSize: '12px', color: '#666'}}>{path.steps.length} Milestones</div>
                </div>
              ))}
            </div>
          </div>

          <div style={s.editorPanel}>
            {editingPath ? (
              <div style={s.editorForm}>
                <h2 style={{color: '#ff9a40'}}>Path Editor</h2>
                <div style={s.inputBox}><label style={s.label}>Path Name</label><input type="text" value={editingPath.name} onChange={e => setEditingPath({...editingPath, name: e.target.value})} style={s.inputLarge} /></div>

                <div style={{background: '#111', padding: '20px', borderRadius: '8px', marginTop: '10px'}}>
                  <h3 style={{marginTop: 0, color: '#aaa'}}>Chronological Timeline</h3>
                  {editingPath.steps.map((step, idx) => (
                    <div key={step.id} style={{display: 'flex', gap: '10px', alignItems: 'center', background: '#1a1a1a', padding: '10px', marginBottom: '10px', borderRadius: '4px'}}>
                      <div style={{display: 'flex', flexDirection: 'column'}}><button onClick={() => moveStep(idx, 'up')} style={s.moveBtn}>▲</button><button onClick={() => moveStep(idx, 'down')} style={s.moveBtn}>▼</button></div>
                      <span style={{color: '#ff9a40', fontWeight: 'bold', width: '30px'}}>#{idx + 1}</span>
                      <select value={step.textbook} onChange={e => updatePathStep(step.id, 'textbook', e.target.value)} style={s.selectBox}><option value="">- Select Book -</option>{availableTextbooks.map(tb => <option key={tb} value={tb}>{tb}</option>)}</select>
                      {renderSectionDropdown(step.textbook, step.section, e => updatePathStep(step.id, 'section', e.target.value))}
                      <button onClick={() => removePathStep(step.id)} style={{background: 'none', border: 'none', color: '#f44', cursor: 'pointer', fontSize: '18px'}}>×</button>
                    </div>
                  ))}
                  <button onClick={addPathStep} style={{...s.addBlockBtn, marginTop: '10px'}}>+ Add Milestone</button>
                </div>
                <div style={{display: 'flex', gap: '15px', marginTop: '20px'}}><button onClick={savePathToFirestore} style={s.primaryBtn}>Save Path</button><button onClick={() => setEditingPath(null)} style={{...s.cancelBtn, color: '#aaa'}}>Discard</button></div>
              </div>
            ) : <div style={{color: '#666'}}>Select a path to edit, or create a new one.</div>}
          </div>
        </div>
      )}

      {/* --- TAB 5: SAVED PRACTICES --- */}
      {activeTab === 'saved' && (
        <div style={s.content}>
          <h2 style={{color: '#ff9a40'}}>Saved Practices File Cabinet</h2>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px'}}>
            {savedWarmups.length === 0 ? <p style={{color: '#666'}}>No practices saved yet. Bake and save one in the Baking Station!</p> : null}
            {savedWarmups.map((practice) => (
              <div key={practice.id} style={{background: '#111', padding: '20px', borderRadius: '8px', border: '1px solid #333', cursor: 'pointer', transition: '0.2s'}} onClick={() => loadSavedPractice(practice)}>
                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                  <div style={{color: '#ff9a40', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px'}}>DÍA {practice.dia}</div>
                  <div style={{color: '#888', fontSize: '11px', textTransform: 'uppercase'}}>{practice.course || 's2'}</div>
                </div>
                <div style={{fontSize: '20px', fontWeight: 'bold', color: '#fff', marginBottom: '10px'}}>{practice.name}</div>
                <div style={{color: '#aaa', fontSize: '14px'}}>{practice.sequence?.length || 0} Words Total</div>
                <div style={{marginTop: '15px', color: '#666', fontSize: '12px', fontStyle: 'italic'}}>Click to view or edit in Baking Station ➔</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OVERRIDE MODAL */}
      {isSearching !== null && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h3>Replace Word #{isSearching + 1}</h3>
            <div style={{display: 'flex', gap: '10px', marginBottom: '10px'}}>
              <select value={replaceTextbook} onChange={e => {setReplaceTextbook(e.target.value); setReplaceSection("all");}} style={s.selectBox}><option value="">All Textbooks</option>{availableTextbooks.map(tb => <option key={tb} value={tb}>{tb}</option>)}</select>
              {renderSectionDropdown(replaceTextbook, replaceSection, e => setReplaceSection(e.target.value), !replaceTextbook)}
            </div>
            <input autoFocus style={s.searchBar} placeholder="Search word or translation..." value={replaceSearch} onChange={e => setReplaceSearch(e.target.value)} />
            <div style={s.modalResults}>
              {fullVocab.filter(v => {
                  if (replaceTextbook && v?.metadata?.textbook !== replaceTextbook) return false;
                  if (!isWordInTargetSection(v, replaceSection)) return false;
                  if (replaceSearch) {
                    const sp = (v?.palabra || "").toLowerCase();
                    const en = (v?.traduccion || "").toLowerCase();
                    const term = replaceSearch.toLowerCase();
                    if (!sp.includes(term) && !en.includes(term)) return false;
                  }
                  return true;
                }).slice(0, 150).map(v => (
                  <div key={v.id} style={s.resultItem} onClick={() => replaceWord(v)}>
                    <div style={{fontWeight: 'bold', color: '#ff9a40'}}>{v.palabra}</div><div style={{fontSize: '12px', color: '#aaa'}}>{v.traduccion}</div>
                  </div>
                ))}
            </div>
            <div style={{display: 'flex', justifyContent: 'flex-end'}}><button style={s.cancelBtnModal} onClick={() => { setIsSearching(null); setReplaceSearch(""); }}>Cancel</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- STYLES ---
const s = {
  dashboard: { backgroundColor: '#000', color: '#fff', minHeight: '100vh', padding: '40px', fontFamily: 'sans-serif' },
  centerScreen: { backgroundColor: '#000', color: '#ff9a40', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid #222', paddingBottom: '20px' },
  title: { margin: 0, fontSize: '28px', letterSpacing: '2px' },
  tabs: { display: 'flex', gap: '10px' },
  tab: { padding: '10px 20px', background: '#111', border: '1px solid #333', color: '#888', cursor: 'pointer', borderRadius: '4px' },
  tabActive: { padding: '10px 20px', background: '#ff9a40', border: '1px solid #ff9a40', color: '#000', cursor: 'pointer', borderRadius: '4px', fontWeight: 'bold' },
  content: { display: 'flex', flexDirection: 'column', gap: '20px' },
  panel: { background: '#0a0a0a', padding: '30px', borderRadius: '8px', border: '1px solid #222' },
  jsonTextarea: { width: '100%', height: '400px', background: '#000', border: '1px dashed #ff9a40', color: '#aaa', padding: '15px', fontFamily: 'monospace', borderRadius: '6px' },
  exampleBlock: { width: '100%', maxHeight: '350px', overflowY: 'auto', background: '#000', border: '1px solid #333', color: '#7fd97f', padding: '15px', fontFamily: 'monospace', fontSize: '12px', borderRadius: '6px', marginBottom: '15px', boxSizing: 'border-box', whiteSpace: 'pre-wrap' },
  primaryBtn: { background: '#ff9a40', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  sidebar: { width: '300px', background: '#0a0a0a', padding: '20px', borderRadius: '8px', border: '1px solid #222', display: 'flex', flexDirection: 'column' },
  badge: { background: '#1a1a1a', border: '1px solid #333', color: '#888', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', cursor: 'pointer' },
  badgeActive: { background: '#ff9a40', border: '1px solid #ff9a40', color: '#000', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' },
  badgeAlert: { background: '#4a1111', border: '1px solid #f44', color: '#ffb3b3', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', cursor: 'pointer' },
  badgeAlertActive: { background: '#f44', border: '1px solid #f44', color: '#fff', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' },
  searchBar: { background: '#000', border: '1px solid #555', color: '#fff', padding: '12px', borderRadius: '6px', width: '100%', boxSizing: 'border-box' },
  scrollList: { overflowY: 'auto', flexGrow: 1 },
  vocabItem: { padding: '10px', borderBottom: '1px solid #1a1a1a', cursor: 'pointer' },
  vocabItemBulkSelected: { padding: '10px', borderBottom: '1px solid #1a1a1a', cursor: 'pointer', background: '#2a1a00', borderLeft: '4px solid #ff9a40' },
  editorPanel: { flexGrow: 1, background: '#0a0a0a', padding: '30px', borderRadius: '8px', border: '1px solid #222', overflowY: 'auto' },
  editorForm: { display: 'flex', flexDirection: 'column', gap: '15px' },
  defTextarea: { width: '100%', height: '80px', background: '#000', border: '1px solid #333', color: '#fff', padding: '10px', borderRadius: '4px', resize: 'vertical', boxSizing: 'border-box' },
  cancelBtn: { background: 'none', border: 'none', color: '#f44', cursor: 'pointer' },
  configRow: { display: 'flex', gap: '20px', alignItems: 'flex-end', background: '#0a0a0a', padding: '20px', borderRadius: '8px', border: '1px solid #222', flexWrap: 'wrap' },
  inputBox: { display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1 },
  label: { fontSize: '12px', color: '#666', textTransform: 'uppercase' },
  inputSmall: { background: '#000', border: '1px solid #333', color: '#ff9a40', padding: '10px', borderRadius: '4px', width: '80px', boxSizing: 'border-box' },
  inputLarge: { background: '#000', border: '1px solid #333', color: '#ff9a40', padding: '10px', borderRadius: '4px', width: '100%', boxSizing: 'border-box' },
  selectBox: { background: '#000', border: '1px solid #333', color: '#ff9a40', padding: '10px', borderRadius: '4px', width: '100%', boxSizing: 'border-box' },
  recipeArea: { background: '#0a0a0a', padding: '20px', borderRadius: '8px', border: '1px solid #222' },
  addBlockBtn: { background: 'none', border: '1px dashed #ff9a40', color: '#ff9a40', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
  executeBtn: { width: '100%', background: '#ff9a40', color: '#000', padding: '15px', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' },
  slotCard: { background: '#0d0d0d', border: '1px solid #222', borderRadius: '8px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' },
  slotHeader: { display: 'flex', alignItems: 'center', borderBottom: '1px solid #1a1a1a', paddingBottom: '8px' },
  slotNum: { color: '#444', fontSize: '12px', fontWeight: 'bold', marginRight: 'auto' },
  slotTense: { color: '#ff9a40', fontSize: '10px', textTransform: 'uppercase' },
  verbText: { fontSize: '18px', color: '#fff' },
  subjectText: { color: '#666', fontSize: '14px' },
  replaceBtn: { background: '#1a1a1a', border: '1px solid #333', color: '#aaa', padding: '6px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', alignSelf: 'flex-start' },
  overlay: { position: 'fixed', top: '0', left: '0', right: '0', bottom: '0', background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  modal: { background: '#111', padding: '30px', borderRadius: '12px', border: '1px solid #333', width: '500px', display: 'flex', flexDirection: 'column', gap: '15px' },
  modalResults: { display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '300px', overflowY: 'auto', marginTop: '10px' },
  resultItem: { padding: '10px', background: '#1a1a1a', cursor: 'pointer', borderRadius: '4px', border: '1px solid #333' },
  cancelBtnModal: { background: '#f44', border: 'none', color: '#fff', cursor: 'pointer', marginTop: '15px', fontWeight: 'bold', padding: '8px 16px', borderRadius: '4px' },
  moveBtn: { background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '10px', padding: '2px' }
};

export default VocabVault;