import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase.js'; 
import { collection, addDoc, getDocs, serverTimestamp, doc, updateDoc } from 'firebase/firestore';

const VerbVault = () => {
  const [activeTab, setActiveTab] = useState('curate'); 
  
  // --- DATA STATES ---
  const [fullLibrary, setFullLibrary] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // --- GROUP BUILDER (CURATE) STATE ---
  const [draftGroup, setDraftGroup] = useState(null); 
  const [librarySearch, setLibrarySearch] = useState(""); 

  // --- RECIPE BUILDER (BAKE) STATE ---
  const [diaNumber, setDiaNumber] = useState(1);
  const [warmupName, setWarmupName] = useState("");
  const [sequence, setSequence] = useState([]);
  const [includeVosotros, setIncludeVosotros] = useState(false);
  const [smartBlend, setSmartBlend] = useState(true);
  
  const [recipeBlocks, setRecipeBlocks] = useState([
    { id: Date.now(), groupId: "", tense: "presente", count: 10 }
  ]);
  
  // --- SEARCH/OVERRIDE STATE ---
  const [isSearching, setIsSearching] = useState(null); 
  const [searchTerm, setSearchTerm] = useState("");

  // All Available Tenses for Tagging & Baking
  const AVAILABLE_TENSES = [
    { id: 'presente', label: 'Presente' },
    { id: 'pretérito', label: 'Pretérito' },
    { id: 'imperfecto', label: 'Imperfecto' },
    { id: 'futuro', label: 'Futuro' },
    { id: 'condicional', label: 'Condicional' },
    { id: 'pretérito_perfecto', label: 'Pretérito Perfecto' },
    { id: 'pluscuamperfecto', label: 'Pluscuamperfecto' },
    { id: 'futuro_perfecto', label: 'Futuro Perfecto' },
    { id: 'condicional_perfecto', label: 'Condicional Perfecto' },
    { id: 'presente_progresivo', label: 'Presente Progresivo' },
    { id: 'imperfecto_progresivo', label: 'Imperfecto Progresivo' },
    { id: 'subjuntivo_presente', label: 'Presente de Subjuntivo' },
    { id: 'subjuntivo_imperfecto_ra', label: 'Imperfecto de Subjuntivo (-ra)' },
    { id: 'subjuntivo_imperfecto_se', label: 'Subjuntivo Imperfecto de Subjuntivo (-se)' },
    { id: 'subjuntivo_perfecto', label: 'Pretérito Perfecto de Subjuntivo' },
    { id: 'pluscuamperfecto_subjuntivo_ra', label: 'Pluscuamperfecto de Subjuntivo (hubiera)' },
    { id: 'pluscuamperfecto_subjuntivo_se', label: 'Pluscuamperfecto de Subjuntivo (hubiese)' },
    { id: 'imperativo_afirmativo', label: 'Mandatos (+)' },
    { id: 'imperativo_negativo', label: 'Mandatos (-)' }
  ];

  // Load EVERYTHING from Firestore on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const verbSnapshot = await getDocs(collection(db, "verbs"));
        const verbData = verbSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const groupSnapshot = await getDocs(collection(db, "verbGroups"));
        const groupData = groupSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        setFullLibrary(verbData); 
        setGroups(groupData);
        
        if (groupData.length > 0) {
          const sorted = [...groupData].sort((a, b) => a.name.localeCompare(b.name));
          setRecipeBlocks([{ id: Date.now(), groupId: sorted[0].id, tense: "presente", count: 20 }]);
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error("Database connection failed:", err);
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- HELPER: Sorted Groups ---
  const sortedGroups = [...groups].sort((a, b) => {
    const nameA = a.name || "";
    const nameB = b.name || "";
    return nameA.localeCompare(nameB);
  });

  // --- LOGIC: GROUP BUILDER ---
  const startNewGroup = () => {
    setDraftGroup({ name: "", hint: "", level: "Spanish II", verbIds: [], tenses: [] });
  };

  const addVerbToDraft = (palabra) => {
    if (!draftGroup) return alert("Click 'Create New Group' first!");
    if (draftGroup.verbIds.includes(palabra)) return; 
    setDraftGroup({ ...draftGroup, verbIds: [...draftGroup.verbIds, palabra] });
  };

  const removeVerbFromDraft = (palabra) => {
    setDraftGroup({ ...draftGroup, verbIds: draftGroup.verbIds.filter(id => id !== palabra) });
  };

  const toggleTenseTag = (tenseId) => {
    const currentTenses = draftGroup.tenses || [];
    if (currentTenses.includes(tenseId)) {
      setDraftGroup({ ...draftGroup, tenses: currentTenses.filter(t => t !== tenseId) });
    } else {
      setDraftGroup({ ...draftGroup, tenses: [...currentTenses, tenseId] });
    }
  };

  const saveGroupToFirestore = async () => {
    if (!draftGroup.name) return alert("Please give your group a name.");
    if (draftGroup.verbIds.length === 0) return alert("Add at least one verb to the group.");

    try {
      if (draftGroup.id) {
        const docRef = doc(db, "verbGroups", draftGroup.id);
        const { id, ...dataToSave } = draftGroup; 
        await updateDoc(docRef, dataToSave);
        
        setGroups(groups.map(g => g.id === draftGroup.id ? { id: draftGroup.id, ...dataToSave } : g));
        alert("Group updated successfully!");
      } else {
        const docRef = await addDoc(collection(db, "verbGroups"), draftGroup);
        const newGroupWithId = { id: docRef.id, ...draftGroup };
        setGroups([...groups, newGroupWithId]);
        alert("New group created successfully!");
      }

      setDraftGroup(null); 
    } catch (e) {
      console.error("Error saving group:", e);
      alert("Failed to save group.");
    }
  };

  // --- LOGIC: RECIPE BUILDER (BAKING) ---
  const addRecipeBlock = () => {
    setRecipeBlocks([...recipeBlocks, { id: Date.now(), groupId: sortedGroups[0]?.id || "", tense: "presente", count: 5 }]);
  };

  const removeRecipeBlock = (id) => {
    if (recipeBlocks.length === 1) return alert("You must have at least one block!");
    setRecipeBlocks(recipeBlocks.filter(block => block.id !== id));
  };

  const updateRecipeBlock = (id, field, value) => {
    setRecipeBlocks(recipeBlocks.map(block => block.id === id ? { ...block, [field]: value } : block));
  };

  const getRandomSubject = (allowVosotros) => {
    const weights = ['yo', 'tú', 'él_ella_ud', 'nosotros', 'ellos_ellas_uds'];
    if (allowVosotros) weights.push('vosotros');
    return weights[Math.floor(Math.random() * weights.length)];
  };

  const shuffleArray = (array) => {
    let shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const executeBake = () => {
    let rawSequence = [];
    
    for (const block of recipeBlocks) {
      if (!block.groupId) {
        alert("One of your blocks is missing a group selection.");
        return;
      }

      const group = groups.find(g => g.id === block.groupId);
      if (!group || !group.verbIds || group.verbIds.length === 0) continue;

      let blockVerbs = [];
      for (let i = 0; i < block.count; i++) {
        const randomVerbId = group.verbIds[Math.floor(Math.random() * group.verbIds.length)];
        const verbData = fullLibrary.find(v => v.palabra === randomVerbId);
        
        if (!verbData) continue;

        const subject = getRandomSubject(includeVosotros);
        const infinitiveTarget = verbData.translations?.infinitivo?.target || verbData.palabra;
        const infinitiveEnglish = verbData.translations?.infinitivo?.english || `to ${verbData.palabra}`;
        
        blockVerbs.push({
          verbId: verbData.palabra,
          infinitive: infinitiveTarget,
          english: infinitiveEnglish,
          tense: block.tense,
          subject: subject,
          target: verbData.tenses?.[block.tense]?.[subject]?.target || "ERROR",
          hint: group.hint || ""
        });
      }
      rawSequence.push(...blockVerbs);
    }

    if (smartBlend) {
      const chronologicalTenses = [...new Set(rawSequence.map(v => v.tense))];
      let blendedSequence = [];
      chronologicalTenses.forEach(tense => {
        const verbsInTenseBucket = rawSequence.filter(v => v.tense === tense);
        blendedSequence.push(...shuffleArray(verbsInTenseBucket));
      });
      setSequence(blendedSequence);
    } else {
      setSequence(rawSequence);
    }
  };

  // --- LOGIC: REPLACE VERB ---
  const replaceVerb = (newVerb) => {
    const index = isSearching;
    const updated = [...sequence];
    const currentSlot = updated[index];
    
    const infinitiveTarget = newVerb.translations?.infinitivo?.target || newVerb.palabra;
    const infinitiveEnglish = newVerb.translations?.infinitivo?.english || `to ${newVerb.palabra}`;

    updated[index] = {
      ...currentSlot,
      verbId: newVerb.palabra,
      infinitive: infinitiveTarget,
      english: infinitiveEnglish,
      target: newVerb.tenses?.[currentSlot.tense]?.[currentSlot.subject]?.target || "ERROR"
    };
    
    setSequence(updated);
    setIsSearching(null);
    setSearchTerm("");
  };

  // --- LOGIC: SAVE TO FIRESTORE ---
  const saveWarmupToFirestore = async () => {
    if (!warmupName) return alert("Please name this practice (e.g. Presente 1)");
    if (sequence.length === 0) return alert("You must bake a sequence first!");
    
    try {
      await addDoc(collection(db, "dailyWarmups"), {
        dia: parseInt(diaNumber),
        name: warmupName,
        sequence: sequence,
        createdAt: serverTimestamp()
      });
      alert(`Día ${diaNumber} Saved!`);
    } catch (e) { 
      console.error(e); 
      alert("Error saving practice.");
    }
  };

  if (isLoading) return <div style={{...s.dashboard, display: 'flex', justifyContent: 'center', alignItems: 'center'}}><h2>Loading Vault Data...</h2></div>;

  const totalBakeCount = recipeBlocks.reduce((sum, block) => sum + (parseInt(block.count) || 0), 0);

  return (
    <div style={s.dashboard}>
      <header style={s.header}>
        <h1 style={s.title}>VERB <span style={{color: '#deff9a'}}>VAULT</span></h1>
        <div style={s.tabs}>
          <button onClick={() => setActiveTab('curate')} style={activeTab === 'curate' ? s.tabActive : s.tab}>Group Manager</button>
          <button onClick={() => setActiveTab('bake')} style={activeTab === 'bake' ? s.tabActive : s.tab}>Baking Station</button>
        </div>
      </header>

      {/* --- CURATE TAB --- */}
      {activeTab === 'curate' && (
        <div style={s.managerLayout}>
          
          <div style={s.sidebar}>
            <h3 style={s.label}>Master Library ({fullLibrary.length})</h3>
            
            <input 
              type="text" 
              placeholder="Filter verbs (e.g., 'ger')..." 
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              style={{...s.searchBar, width: '100%', marginBottom: '15px'}}
            />

            <div style={s.scrollList}>
              {fullLibrary
                .filter(v => v.palabra.toLowerCase().includes(librarySearch.toLowerCase()))
                .map(v => (
                <div key={v.palabra} style={s.verbItem}>
                  <span>{v.palabra}</span>
                  <button 
                    style={draftGroup ? s.addBtnActive : s.addBtnDisabled}
                    onClick={() => addVerbToDraft(v.palabra)}
                  >
                    + Add
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={s.mainPanel}>
            {draftGroup ? (
              <div style={s.draftBuilder}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                  <h2 style={{margin: 0, color: '#deff9a'}}>
                    {draftGroup.id ? "Editing Group" : "Building New Group"}
                  </h2>
                  <button style={s.cancelBtn} onClick={() => setDraftGroup(null)}>Cancel</button>
                </div>
                
                <div style={s.draftForm}>
                  <div style={s.inputBox}>
                    <label style={s.label}>Group Name</label>
                    <input type="text" value={draftGroup.name} onChange={e => setDraftGroup({...draftGroup, name: e.target.value})} placeholder="e.g. GER/GIR Present" style={s.inputLarge} />
                  </div>
                  <div style={s.inputBox}>
                    <label style={s.label}>Universal Hint (Optional)</label>
                    <input type="text" value={draftGroup.hint} onChange={e => setDraftGroup({...draftGroup, hint: e.target.value})} placeholder="e.g. G changes to J in the yo form" style={{...s.inputLarge, width: '100%'}} />
                  </div>
                </div>

                <div style={{marginBottom: '20px', background: '#000', padding: '15px', borderRadius: '6px', border: '1px solid #333'}}>
                  <h4 style={{marginBottom: '10px', fontSize: '12px', color: '#666', textTransform: 'uppercase'}}>Applies to Tenses (Used for filtering)</h4>
                  <div style={{display: 'flex', flexWrap: 'wrap', gap: '15px'}}>
                    {AVAILABLE_TENSES.map(tense => {
                      const isChecked = (draftGroup.tenses || []).includes(tense.id);
                      return (
                        <label key={tense.id} style={{display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', cursor: 'pointer', color: isChecked ? '#deff9a' : '#aaa'}}>
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={() => toggleTenseTag(tense.id)}
                          />
                          {tense.label}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div style={s.draftVerbsArea}>
                  <h4 style={{marginBottom: '10px'}}>Selected Verbs ({draftGroup.verbIds.length})</h4>
                  {draftGroup.verbIds.length === 0 ? (
                    <p style={s.hintText}>Search and click "+ Add" on verbs in the left panel to include them.</p>
                  ) : (
                    <div style={s.pillContainer}>
                      {draftGroup.verbIds.map(vid => (
                        <span key={vid} style={s.pill}>
                          {vid} <button style={s.removePillBtn} onClick={() => removeVerbFromDraft(vid)}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button style={s.saveBtn} onClick={saveGroupToFirestore}>
                  {draftGroup.id ? "Update Existing Group" : "Save New Group"}
                </button>
              </div>
            ) : (
              <>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                  <h3 style={s.label}>Your Curated Groups</h3>
                  <button style={s.saveBtn} onClick={startNewGroup}>+ Create New Group</button>
                </div>
                <div style={s.groupGrid}>
                  {sortedGroups.length > 0 ? sortedGroups.map(g => (
                    <div key={g.id} onClick={() => setDraftGroup({...g})} style={{...s.groupCard, cursor: 'pointer'}}>
                      <h4 style={{margin: '0 0 10px 0', color: '#deff9a'}}>{g.name}</h4>
                      <div style={s.groupMeta}>
                        <span>{g.verbIds?.length || 0} verbs</span>
                        {g.tenses && g.tenses.length > 0 && (
                          <span style={{marginLeft: '10px', color: '#888'}}>({g.tenses.length} Tenses)</span>
                        )}
                      </div>
                      <p style={s.hintText}>{g.hint ? `Hint: ${g.hint}` : 'No hint added.'}</p>
                    </div>
                  )) : (
                    <div style={s.emptyState}>No groups yet. Click 'Create New Group' to start.</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* --- BAKE TAB --- */}
      {activeTab === 'bake' && (
        <div style={s.content}>
          <div style={s.configRow}>
            <div style={s.inputBox}>
              <label style={s.label}>Día #</label>
              <input type="number" value={diaNumber} onChange={e => setDiaNumber(e.target.value)} style={s.inputSmall} />
            </div>
            <div style={s.inputBox}>
              <label style={s.label}>Practice Name</label>
              <input type="text" placeholder="e.g. Presente y Pretérito 1" value={warmupName} onChange={e => setWarmupName(e.target.value)} style={s.inputLarge} />
            </div>
            <div style={{...s.inputBox, justifyContent: 'center'}}>
              <label style={s.label}>Include Vosotros?</label>
              <input type="checkbox" checked={includeVosotros} onChange={e => setIncludeVosotros(e.target.checked)} style={{transform: 'scale(1.5)', marginTop: '5px'}} />
            </div>
            <button style={{...s.saveBtn, marginLeft: 'auto'}} onClick={saveWarmupToFirestore}>Save Practice to Firestore</button>
          </div>

          <div style={s.recipeArea}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
              <h3 style={{...s.label, margin: 0, fontSize: '14px', color: '#deff9a'}}>Recipe Builder</h3>
              <button style={s.addBlockBtn} onClick={addRecipeBlock}>+ Add Tense Block</button>
            </div>
            
            <div style={s.recipeList}>
              {recipeBlocks.map((block, idx) => {
                
                // NEW: Sort groups into Match vs Other for the select dropdown
                const recommendedGroups = sortedGroups.filter(g => 
                  !g.tenses || g.tenses.length === 0 || g.tenses.includes(block.tense)
                );
                const otherGroups = sortedGroups.filter(g => 
                  g.tenses && g.tenses.length > 0 && !g.tenses.includes(block.tense)
                );

                return (
                  <div key={block.id} style={s.recipeRow}>
                    <div style={s.blockNum}>Block {idx + 1}</div>
                    
                    <div style={s.inputBox}>
                      <label style={s.label}>Amount</label>
                      <input type="number" value={block.count} onChange={e => updateRecipeBlock(block.id, 'count', parseInt(e.target.value) || 0)} style={s.inputSmall} />
                    </div>
                    
                    <div style={s.inputBox}>
                      <label style={s.label}>Tense</label>
                      <select value={block.tense} onChange={e => updateRecipeBlock(block.id, 'tense', e.target.value)} style={s.selectBox}>
                        {AVAILABLE_TENSES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                    </div>

                    <div style={s.inputBox}>
                      <label style={s.label}>From Group</label>
                      <select value={block.groupId} onChange={e => updateRecipeBlock(block.id, 'groupId', e.target.value)} style={{...s.selectBox, width: '250px'}}>
                        <option value="">-- Select a Group --</option>
                        
                        {/* The grouped options */}
                        {recommendedGroups.length > 0 && (
                          <optgroup label="✅ Target Tense Match">
                            {recommendedGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                          </optgroup>
                        )}
                        
                        {otherGroups.length > 0 && (
                          <optgroup label="⚠️ Other Groups">
                            {otherGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                          </optgroup>
                        )}

                      </select>
                    </div>

                    <button style={s.removeBlockBtn} onClick={() => removeRecipeBlock(block.id)}>×</button>
                  </div>
                );
              })}
            </div>

            <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginTop: '15px', marginBottom: '15px'}}>
              <input 
                type="checkbox" 
                checked={smartBlend} 
                onChange={e => setSmartBlend(e.target.checked)} 
                style={{transform: 'scale(1.2)', cursor: 'pointer'}} 
              />
              <label style={{color: '#aaa', fontSize: '14px'}}>
                <strong>Smart Blend:</strong> Shuffle blocks together if they share the same tense (keeps tenses chronologically separated).
              </label>
            </div>

            <button style={s.executeBtn} onClick={executeBake}>
              <i className="fa-solid fa-fire"></i> Bake Sequence ({totalBakeCount} Verbs)
            </button>
          </div>

          {sequence.length > 0 && (
            <div style={s.grid}>
              {sequence.map((slot, i) => (
                <div key={i} style={s.slotCard}>
                  <div style={s.slotHeader}>
                    <span style={s.slotNum}>#{i+1}</span>
                    <span style={s.slotTense}>{slot.tense}</span>
                  </div>
                  <div style={s.slotBody}>
                    <strong style={s.verbText}>{slot.infinitive}</strong>
                    <span style={s.subjectText}>{slot.subject}</span>
                  </div>
                  <button style={s.replaceBtn} onClick={() => setIsSearching(i)}>Override Verb</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isSearching !== null && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h3>Replace Verb in Slot #{isSearching + 1}</h3>
            <input 
              autoFocus
              style={s.searchBar} 
              placeholder="Search global library..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
            />
            <div style={s.results}>
              {fullLibrary
                .filter(v => v.palabra.toLowerCase().includes(searchTerm.toLowerCase()))
                .slice(0, 8)
                .map(v => {
                  const infEnglish = v.translations?.infinitivo?.english || `to ${v.palabra}`;
                  return (
                    <div key={v.palabra} style={s.resultItem} onClick={() => replaceVerb(v)}>
                      {v.palabra} <span style={s.englishSub}>{infEnglish}</span>
                    </div>
                  )
                })}
            </div>
            <button style={s.cancelBtn} onClick={() => setIsSearching(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

const s = {
  dashboard: { backgroundColor: '#000', color: '#fff', minHeight: '100vh', padding: '40px', fontFamily: 'sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', borderBottom: '1px solid #222', paddingBottom: '20px' },
  title: { margin: 0, fontSize: '28px', letterSpacing: '2px' },
  tabs: { display: 'flex', gap: '10px' },
  tab: { padding: '10px 20px', background: '#111', border: '1px solid #333', color: '#888', cursor: 'pointer', borderRadius: '4px' },
  tabActive: { padding: '10px 20px', background: '#deff9a', border: '1px solid #deff9a', color: '#000', cursor: 'pointer', borderRadius: '4px', fontWeight: 'bold' },
  content: { display: 'flex', flexDirection: 'column', gap: '20px' },
  configRow: { display: 'flex', gap: '20px', alignItems: 'flex-end', background: '#0a0a0a', padding: '20px', borderRadius: '8px', border: '1px solid #222', flexWrap: 'wrap' },
  inputBox: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '12px', color: '#666', textTransform: 'uppercase' },
  inputSmall: { background: '#000', border: '1px solid #333', color: '#deff9a', padding: '10px', borderRadius: '4px', width: '60px' },
  inputLarge: { background: '#000', border: '1px solid #333', color: '#deff9a', padding: '10px', borderRadius: '4px', width: '200px' },
  selectBox: { background: '#000', border: '1px solid #333', color: '#deff9a', padding: '10px', borderRadius: '4px', width: '150px' },
  saveBtn: { background: '#deff9a', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', height: '40px' },
  recipeArea: { background: '#0a0a0a', padding: '20px', borderRadius: '8px', border: '1px solid #222' },
  recipeList: { display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' },
  recipeRow: { display: 'flex', gap: '15px', alignItems: 'flex-end', background: '#111', padding: '15px', borderRadius: '6px', border: '1px solid #333' },
  blockNum: { background: '#333', color: '#aaa', padding: '5px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', alignSelf: 'center' },
  addBlockBtn: { background: 'none', border: '1px dashed #deff9a', color: '#deff9a', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
  removeBlockBtn: { background: 'none', border: 'none', color: '#f44', cursor: 'pointer', fontSize: '20px', fontWeight: 'bold', padding: '0 10px', height: '40px' },
  executeBtn: { width: '100%', background: '#deff9a', color: '#000', padding: '15px', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' },
  slotCard: { background: '#0d0d0d', border: '1px solid #222', borderRadius: '8px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' },
  slotHeader: { display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1a1a1a', paddingBottom: '8px' },
  slotNum: { color: '#444', fontSize: '12px', fontWeight: 'bold' },
  slotTense: { color: '#deff9a', fontSize: '10px', textTransform: 'uppercase' },
  verbText: { fontSize: '18px', color: '#fff' },
  subjectText: { color: '#666', fontSize: '14px' },
  replaceBtn: { background: 'none', border: '1px solid #333', color: '#555', fontSize: '11px', cursor: 'pointer', alignSelf: 'flex-start', padding: '4px 8px', borderRadius: '4px' },
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  modal: { background: '#111', padding: '30px', borderRadius: '12px', border: '1px solid #333', width: '400px', display: 'flex', flexDirection: 'column', gap: '15px' },
  searchBar: { background: '#000', border: '1px solid #deff9a', color: '#fff', padding: '12px', borderRadius: '6px' },
  results: { display: 'flex', flexDirection: 'column', gap: '5px' },
  resultItem: { padding: '10px', background: '#1a1a1a', cursor: 'pointer', borderRadius: '4px', border: '1px solid transparent' },
  englishSub: { color: '#444', fontSize: '12px', marginLeft: '10px' },
  cancelBtn: { background: 'none', border: 'none', color: '#f44', cursor: 'pointer', marginTop: '10px' },
  managerLayout: { display: 'grid', gridTemplateColumns: '300px 1fr', gap: '30px' },
  sidebar: { background: '#0a0a0a', padding: '20px', borderRadius: '8px', border: '1px solid #222', height: '70vh', display: 'flex', flexDirection: 'column' },
  scrollList: { overflowY: 'auto', flexGrow: 1, marginTop: '10px' },
  verbItem: { display: 'flex', justifyContent: 'space-between', padding: '8px', borderBottom: '1px solid #1a1a1a', fontSize: '14px' },
  addBtnActive: { background: 'none', border: 'none', color: '#deff9a', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  addBtnDisabled: { background: 'none', border: 'none', color: '#444', cursor: 'not-allowed', fontSize: '12px' },
  mainPanel: { background: '#0a0a0a', padding: '20px', borderRadius: '8px', border: '1px solid #222' },
  groupGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px', marginTop: '20px' },
  groupCard: { background: '#111', padding: '15px', borderRadius: '8px', border: '1px solid #333', cursor: 'pointer' },
  groupMeta: { fontSize: '12px', color: '#666' },
  hintText: { fontSize: '12px', color: '#aaa', fontStyle: 'italic', marginTop: '10px' },
  emptyState: { color: '#444', textAlign: 'center', marginTop: '40px' },
  draftBuilder: { background: '#111', padding: '25px', borderRadius: '8px', border: '1px dashed #deff9a' },
  draftForm: { display: 'flex', gap: '20px', marginBottom: '20px' },
  draftVerbsArea: { background: '#000', padding: '15px', borderRadius: '6px', minHeight: '100px', marginBottom: '20px' },
  pillContainer: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
  pill: { background: '#1a1a1a', color: '#deff9a', padding: '5px 10px', borderRadius: '15px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #333' },
  removePillBtn: { background: 'none', border: 'none', color: '#f44', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', padding: 0 }
};

export default VerbVault;