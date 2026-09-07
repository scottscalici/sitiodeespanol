import React, { useState, useEffect } from 'react';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase'; // Make sure this path is correct for your structure
import { useAuth } from '../context/AuthContext'; 

export default function WorkoutEngine({ segment, history = [], podIndex = 0, onClose, onComplete }) {
  const { currentUser } = useAuth(); // Grabs the logged-in student
  
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [masterPool, setMasterPool] = useState([]); 
  
  // Tracking & Score State
  const [initialCount, setInitialCount] = useState(0);
  const [retries, setRetries] = useState(0); 
  const [attempts, setAttempts] = useState(0); // Added to fix missing state variable!
  
  // Interaction State
  const [userAnswer, setUserAnswer] = useState(''); 
  const [selectedOption, setSelectedOption] = useState(null); 
  const [builtSentence, setBuiltSentence] = useState([]); 
  
  // Speech Recognition State
  const [isListening, setIsListening] = useState(false);

  // Matching Game State
  const [matchSelEs, setMatchSelEs] = useState(null);
  const [matchSelEn, setMatchSelEn] = useState(null);
  const [matchedPairs, setMatchedPairs] = useState([]);

  // Game State
  const [isChecked, setIsChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [missedArticle, setMissedArticle] = useState(false);

  const shuffle = (array) => [...array].sort(() => Math.random() - 0.5);

  // ========================================================================
  // LÓGICA DE CORRECCIÓN INTELIGENTE
  // ========================================================================
  const normalize = (s) => {
    let str = s.toLowerCase().trim();
    str = str.replace(/[()]/g, ''); 
    str = str.replace(/[.,!?¿¡]/g, '');
    str = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return str.replace(/\s+/g, ' ').trim();
  };

  const stripSpanishArticles = (s) => s.replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, '').trim();

  const generateAcceptedVariants = (correctStr) => {
    let variants = new Set();
    const parts = correctStr.split(/[;,]/).map(p => p.trim());
    
    parts.forEach(part => {
      let withParens = part.replace(/[()]/g, ''); 
      let withoutParens = part.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim(); 
      
      [withParens, withoutParens].forEach(base => {
         if (!base) return;
         let expandedArticles = [base];
         const articleReplacements = [
             { search: 'el/la ', replace: ['el ', 'la '] },
             { search: 'los/las ', replace: ['los ', 'las '] },
             { search: 'un/una ', replace: ['un ', 'una '] },
             { search: 'unos/unas ', replace: ['unos ', 'unas '] }
         ];

         articleReplacements.forEach(({search, replace}) => {
             if (base.toLowerCase().includes(search)) {
                 expandedArticles = [
                     base.replace(new RegExp(search, 'i'), replace[0]),
                     base.replace(new RegExp(search, 'i'), replace[1])
                 ];
             }
         });

         expandedArticles.forEach(expBase => {
             if (expBase.includes('/')) {
                 let masc = expBase.replace(/o\/a\b/gi, 'o').replace(/os\/as\b/gi, 'os');
                 let fem = expBase.replace(/o\/a\b/gi, 'a').replace(/os\/as\b/gi, 'as');
                 masc = masc.replace(/([a-zñáéíóú])\/a\b/gi, '$1');
                 fem = fem.replace(/([a-zñáéíóú])\/a\b/gi, '$1a');
                 masc = masc.replace(/es\/as\b/gi, 'es');
                 fem = fem.replace(/es\/as\b/gi, 'as');

                 variants.add(masc);
                 variants.add(fem);
                 expBase.split('/').forEach(w => variants.add(w.trim()));
             } else {
                 variants.add(expBase);
             }
         });
      });
    });
    return Array.from(variants);
  };

  const checkAnswerLeniently = (userStr, correctStr) => {
    if (userStr.trim().toLowerCase() === correctStr.trim().toLowerCase()) return { correct: true, missedArticle: false };
    const validVariants = generateAcceptedVariants(correctStr);
    const normUser = normalize(userStr);
    
    // 1. Coincidencia Exacta
    if (validVariants.some(ans => normUser === normalize(ans))) return { correct: true, missedArticle: false };

    // 2. NUEVO: Ignorar la "a " extra al principio (Arregla el bug del micrófono: "a aplaudir")
    const userStrippedA = userStr.replace(/^a\s+/i, '').trim();
    if (validVariants.some(ans => normalize(userStrippedA) === normalize(ans))) return { correct: true, missedArticle: false };

    // 3. Ignorar artículos perdidos
    const userStripped = stripSpanishArticles(userStr);
    const lenientMatch = validVariants.some(ans => {
      const ansStripped = stripSpanishArticles(ans);
      if (ansStripped.length === 0) return false; 
      return normalize(userStripped) === normalize(ansStripped);
    });

    if (lenientMatch) return { correct: true, missedArticle: true };
    return { correct: false, missedArticle: false };
  };

  // ========================================================================
  // FIRESTORE SAVE FUNCTION (NEW)
  // ========================================================================
  const savePointsToDatabase = async (pointsEarned) => {
    if (!currentUser) return; 

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        current_path_points: increment(pointsEarned)
      });
      console.log(`Successfully saved ${pointsEarned} points to the database!`);
    } catch (error) {
      console.error("Error saving points:", error);
    }
  };

  // ========================================================================
  // EL GENERADOR 
  // ========================================================================
  useEffect(() => {
    if (!segment) return;
    
    let generatedQueue = [];
    const totalQs = segment.total_questions || 15;
    const concepts = segment.introduced_concepts || [];
    const grammar = segment.pinned_sentences || [];
    const mods = segment.modalities || { read: true, write: true, listen: true, speak: true };
    
    if (concepts.length === 0 && grammar.length === 0) return;

    const validVocab = concepts.filter(c => c.translation || c.fullData?.translation);
    const validHistory = history.filter(c => c.translation || c.fullData?.translation);
    
    const masterPoolMap = new Map();
    validHistory.forEach(c => masterPoolMap.set(c.label.trim(), c));
    validVocab.forEach(c => masterPoolMap.set(c.label.trim(), c)); 
    const uniqueMasterPool = Array.from(masterPoolMap.values());
    setMasterPool(uniqueMasterPool); 

    for (let i = 0; i < totalQs; i++) {
      
      if (i > 0 && i % 4 === 0 && validHistory.length > 0) {
        const revConcept = validHistory[Math.floor(Math.random() * validHistory.length)];
        const ctx1 = revConcept.fullData?.context_1 || revConcept.fullData?.context_sentences?.[0];
        
        if (ctx1) {
            const spaSentence = typeof ctx1 === 'string' ? ctx1 : (ctx1.spanish || ctx1.es || revConcept.label);
            const engTrans = typeof ctx1 === 'string' ? "Traduce la oración" : (ctx1.english || ctx1.en || "Translation");
            let correctWords = spaSentence.replace(/[.,!?¿¡]/g, '').split(' ');
            let wordBank = shuffle([...correctWords, "el", "es", "no", "muy"]);
            
            generatedQueue.push({
                id: `q_rev_sent_${i}`, type: 'sentence_builder', prompt: engTrans, engTrans: engTrans,
                options: wordBank, correctAnswer: spaSentence, topic: `Repaso: ${revConcept.label}`
            });
            continue; 
        }
      }

      const isGrammarTurn = grammar.length > 0 && (i % 3 === 0 || concepts.length === 0);
      
      if (isGrammarTurn) {
        const target = grammar[i % grammar.length];
        const spaSentence = target.label;
        const engTrans = target.fullData?.translation || target.translation || "Traduce la oración";
        const bracketRegex = /\[\[(.*?)\]\]/;
        const match = spaSentence.match(bracketRegex);
        
        if (match) {
          const answer = match[1];
          let options = [answer];
          let distractors = ["para", "por", "ser", "estar", "a", "de", "en"];
          while (options.length < 4) {
             const r = uniqueMasterPool.length > 0 ? uniqueMasterPool[Math.floor(Math.random() * uniqueMasterPool.length)].label : distractors[Math.floor(Math.random() * distractors.length)];
             if (!options.includes(r)) options.push(r);
          }
          generatedQueue.push({
            id: `q_${i}`, type: 'mc', prompt: spaSentence.replace(bracketRegex, '________'), engTrans: engTrans,
            options: shuffle(options), correctAnswer: answer, topic: target.tags || 'Gramática'
          });
        } else {
          let wordBank = shuffle([...spaSentence.replace(/[.,!?¿¡]/g, '').split(' '), "el", "no", "a"]);
          generatedQueue.push({
            id: `q_${i}`, type: 'sentence_builder', prompt: engTrans, engTrans: engTrans, options: wordBank, 
            correctAnswer: spaSentence, topic: target.tags || 'Gramática'
          });
        }
      } 
      else {
        let target;
        const isHistoryTurn = validHistory.length > 0 && Math.random() < 0.25;
        
        if (isHistoryTurn) target = validHistory[Math.floor(Math.random() * validHistory.length)];
        else if (validVocab.length > 0) target = validVocab[i % validVocab.length];
        else target = concepts[i % concepts.length]; 

        const engTrans = (target.translation || target.fullData?.translation || "Translation").trim();
        const spaWord = target.label.trim();
        
        let availableFormats = [];
        if (mods.read) {
            availableFormats.push('mc');
            if (uniqueMasterPool.length >= 5) availableFormats.push('matching');
        }
        if (mods.write) availableFormats.push('write');
        if (mods.listen) availableFormats.push('listen');
        if (mods.speak) availableFormats.push('speak'); 
        
        const format = availableFormats.length > 0 ? availableFormats[Math.floor(Math.random() * availableFormats.length)] : 'write';

        if (format === 'matching') {
          const matchPool = shuffle([...uniqueMasterPool]).slice(0, 5);
          generatedQueue.push({
            id: `q_${i}`, type: 'matching', topic: 'Vocabulario (Conecta las palabras)',
            pairs: matchPool.map(c => ({ es: c.label.trim(), en: (c.translation || c.fullData?.translation).trim() })),
            esOptions: shuffle(matchPool.map(c => c.label.trim())), enOptions: shuffle(matchPool.map(c => (c.translation || c.fullData?.translation).trim())),
          });
        }
        else if (format === 'mc') {
          let options = [spaWord];
          while (options.length < Math.min(4, uniqueMasterPool.length)) {
            const r = uniqueMasterPool[Math.floor(Math.random() * uniqueMasterPool.length)].label.trim();
            if (!options.includes(r)) options.push(r);
          }
          generatedQueue.push({ id: `q_${i}`, type: 'mc', prompt: engTrans, engTrans: engTrans, options: shuffle(options), correctAnswer: spaWord, topic: isHistoryTurn ? `Repaso: Vocabulario` : (target.tags || 'Vocabulario') });
        } 
        else if (format === 'listen') {
          generatedQueue.push({ id: `q_${i}`, type: 'listen', prompt: spaWord, engTrans: engTrans, correctAnswer: spaWord, topic: isHistoryTurn ? `Repaso Auditivo` : (target.tags || 'Comprensión Auditiva') });
        }
        else if (format === 'speak') {
          generatedQueue.push({ id: `q_${i}`, type: 'speak', prompt: spaWord, engTrans: engTrans, correctAnswer: spaWord, topic: isHistoryTurn ? `Repaso: Pronunciación` : (target.tags || 'Pronunciación') });
        }
        else {
          generatedQueue.push({ id: `q_${i}`, type: 'write', prompt: engTrans, engTrans: engTrans, correctAnswer: spaWord, topic: isHistoryTurn ? `Repaso: Escritura` : (target.tags || 'Escritura') });
        }
      }
    }
    setQuestions(generatedQueue);
    setInitialCount(generatedQueue.length); 
  }, [segment, history]);

  // ========================================================================
  // RECONOCIMIENTO DE VOZ (SPEECH TO TEXT)
  // ========================================================================
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Tu navegador no soporta reconocimiento de voz. Usa Google Chrome o Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-US'; 
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setUserAnswer(transcript);
      
      const { correct, missedArticle } = checkAnswerLeniently(transcript, questions[currentIndex].correctAnswer);
      if (correct) {
          setIsCorrect(correct);
          setMissedArticle(missedArticle);
          setIsChecked(true);
          setAttempts(prev => prev + 1);
      }
    };

    recognition.onerror = (event) => {
      console.error("Error de voz:", event);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  // ========================================================================
  // LÓGICA DE OPT-OUT (NO PUEDO HABLAR/ESCUCHAR)
  // ========================================================================
  const handleOptOut = () => {
    const currentQ = questions[currentIndex];
    const spaWord = currentQ.correctAnswer;
    const engTrans = currentQ.engTrans || "Traducción";

    let options = [spaWord];
    while (options.length < Math.min(4, masterPool.length)) {
      const r = masterPool[Math.floor(Math.random() * masterPool.length)].label.trim();
      if (!options.includes(r)) options.push(r);
    }

    const rep1 = {
       id: currentQ.id + '_rep1_' + Date.now(),
       type: 'write',
       prompt: engTrans,
       correctAnswer: spaWord,
       topic: 'Reemplazo: Escritura'
    };

    const rep2 = {
       id: currentQ.id + '_rep2_' + Date.now(),
       type: 'mc',
       prompt: engTrans,
       options: shuffle(options),
       correctAnswer: spaWord,
       topic: 'Reemplazo: Vocabulario'
    };

    setQuestions(prev => [...prev, rep1, rep2]);
    setCurrentIndex(prev => prev + 1);
    resetInteractiveState();
  };

  // ========================================================================
  // LÓGICA DE MATCHING EN TIEMPO REAL
  // ========================================================================
  useEffect(() => {
    const currentQ = questions[currentIndex];
    if (currentQ?.type === 'matching' && matchSelEs && matchSelEn) {
      const isValid = currentQ.pairs.some(p => p.es === matchSelEs && p.en === matchSelEn);
      if (isValid) {
        setMatchedPairs(prev => [...prev, matchSelEs]);
      } else {
        setRetries(prev => prev + 1);
      }
      setTimeout(() => { setMatchSelEs(null); setMatchSelEn(null); }, 200);
    }
  }, [matchSelEs, matchSelEn, currentIndex, questions]);

  useEffect(() => {
    const currentQ = questions[currentIndex];
    if (currentQ?.type === 'matching' && matchedPairs.length === currentQ.pairs.length) {
       setIsChecked(true);
       setIsCorrect(true);
    }
  }, [matchedPairs, currentIndex, questions]);

  // ========================================================================
  // MOTOR DE AUDIO NATIVO
  // ========================================================================
  const playAudio = (text) => {
    let cleanText = text.replace(/\[\[|\]\]/g, '').replace(/_+/g, '').replace(/[()]/g, '').replace(/\/[a-z]{1,2}\b/gi, ''); 
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'es-US'; utterance.rate = 0.85; 

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.lang === 'es-US' || v.lang === 'es-MX');
      if (preferredVoice) utterance.voice = preferredVoice;

      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    if (questions[currentIndex]?.type === 'listen') playAudio(questions[currentIndex].prompt);
  }, [currentIndex, questions]);

  // ========================================================================
  // LÓGICA DEL BUCLE DE JUEGO & GUARDADO EN FIRESTORE
  // ========================================================================
  const resetInteractiveState = () => {
    setUserAnswer(''); setSelectedOption(null); setBuiltSentence([]);
    setMatchSelEs(null); setMatchSelEn(null); setMatchedPairs([]);
    setIsChecked(false); setIsCorrect(false); setMissedArticle(false);
  };

  const handleCheck = () => {
    const currentQ = questions[currentIndex];
    if (currentQ.type === 'matching') return; 

    let userString = '';
    if (currentQ.type === 'mc') userString = selectedOption || '';
    else if (currentQ.type === 'sentence_builder') userString = builtSentence.join(' ');
    else userString = userAnswer;
    
    if (!userString.trim()) return;

    const { correct, missedArticle } = checkAnswerLeniently(userString, currentQ.correctAnswer);
    setIsCorrect(correct);
    setMissedArticle(missedArticle);
    setIsChecked(true);

    if (!correct) {
      setRetries(prev => prev + 1); 
      setQuestions(prev => [...prev, { ...currentQ, id: currentQ.id + '_retry_' + Date.now() }]);
    } else {
      setAttempts(prev => prev + 1); 
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      resetInteractiveState();
    } else {
      // 1. Calculate percentage grade for the segment
      const finalScore = Math.round((initialCount / (initialCount + retries)) * 100);
      
      // 2. Calculate gamified points: 10 + Pod Number (Pod 1 = index 0 + 1)
      const pointsEarned = 10 + (podIndex + 1);
      
      // 3. Save points instantly to Firestore
      savePointsToDatabase(pointsEarned);

      // 4. Close the engine and return data to the parent path
      onComplete(segment.id, finalScore, initialCount);
    }
  };

  if (!segment || questions.length === 0) return null;
  const currentQ = questions[currentIndex];
  
  const progressPercent = Math.round(((currentIndex) / questions.length) * 100);
  
  const isButtonDisabled = (!isChecked && currentQ.type === 'matching') || 
                           (!selectedOption && !userAnswer.trim() && builtSentence.length === 0 && currentQ.type !== 'matching' && !isChecked) ||
                           isListening; 

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col font-sans">
      <div className="flex-none p-4 flex items-center justify-between gap-4 max-w-3xl mx-auto w-full bg-slate-50 z-10">
        <button onClick={onClose} className="text-slate-400 font-bold text-xl px-2">✕</button>
        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
          <div className="bg-emerald-500 h-3 transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
        </div>
        <span className="text-slate-500 font-black text-sm">{currentIndex + 1}/{questions.length}</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start md:justify-center overflow-y-auto p-4 md:p-6 w-full">
        <div className="w-full max-w-3xl mx-auto text-center pb-8">
          <span className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-6 block">{currentQ.topic}</span>
          
          {currentQ.type === 'matching' && (
            <>
              <div className="grid grid-cols-2 gap-3 md:gap-6 w-full max-w-2xl mx-auto mt-2">
                <div className="flex flex-col gap-2 md:gap-3">
                  {currentQ.esOptions.map((es, i) => {
                    const isMatched = matchedPairs.includes(es);
                    return (
                      <button key={`es-${i}`} onClick={() => setMatchSelEs(es)} disabled={isMatched}
                        className={`p-3 md:p-4 rounded-xl md:rounded-2xl border-2 text-sm md:text-base font-bold transition-all ${
                          isMatched ? 'opacity-0 cursor-default' :
                          matchSelEs === es ? 'bg-sky-100 border-sky-500 text-sky-800 ring-2' : 'bg-white border-slate-200 text-slate-700 hover:border-sky-300'
                        }`}
                      >{es}</button>
                    )
                  })}
                </div>
                <div className="flex flex-col gap-2 md:gap-3">
                  {currentQ.enOptions.map((en, i) => {
                    const isMatched = currentQ.pairs.some(p => p.en === en && matchedPairs.includes(p.es));
                    return (
                      <button key={`en-${i}`} onClick={() => setMatchSelEn(en)} disabled={isMatched}
                        className={`p-3 md:p-4 rounded-xl md:rounded-2xl border-2 border-dashed text-sm md:text-base font-bold transition-all ${
                          isMatched ? 'opacity-0 cursor-default' :
                          matchSelEn === en ? 'bg-indigo-50 border-indigo-500 text-indigo-800 ring-2' : 'bg-white border-slate-300 text-slate-600 hover:border-indigo-300'
                        }`}
                      >{en}</button>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {currentQ.type === 'mc' && (
            <>
              <h2 className="text-3xl md:text-4xl font-black text-slate-800 mb-8 capitalize">{currentQ.prompt}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                {currentQ.options.map((opt, i) => {
                  const { correct } = checkAnswerLeniently(opt, currentQ.correctAnswer);
                  return (
                    <button key={i} disabled={isChecked} onClick={() => setSelectedOption(opt)}
                      className={`p-4 rounded-2xl border-2 font-bold text-lg transition-all ${
                        isChecked && correct ? 'bg-emerald-100 border-emerald-500 text-emerald-800' :
                        isChecked && selectedOption === opt && !correct ? 'bg-red-100 border-red-500 text-red-800' :
                        selectedOption === opt ? 'bg-blue-100 border-blue-500 text-blue-800' : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >{opt}</button>
                  )
                })}
              </div>
            </>
          )}

          {currentQ.type === 'speak' && (
            <>
              <p className="text-slate-500 font-bold mb-2">Lee esta palabra en voz alta:</p>
              
              <div className="flex flex-col items-center justify-center mb-8">
                  <div className="flex items-center gap-4">
                      <h2 className="text-4xl md:text-5xl font-black text-slate-800 capitalize">{currentQ.prompt}</h2>
                      <button 
                        onClick={() => playAudio(currentQ.correctAnswer)} 
                        className="p-3 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-full transition-all active:scale-95"
                        title="Escuchar pronunciación"
                      >
                          🔊
                      </button>
                  </div>
                  {currentQ.engTrans && <p className="text-slate-400 font-medium mt-2 capitalize">{currentQ.engTrans}</p>}
              </div>

              <div className="flex flex-col items-center justify-center gap-4 w-full">
                  <button
                    onClick={startListening}
                    disabled={isChecked || isListening}
                    className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl shadow-lg transition-all active:scale-95 ${
                      isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    🎤
                  </button>
                  <p className="text-sm text-slate-400 font-bold">
                     {isListening ? 'Escuchando...' : 'Presiona el micrófono y habla'}
                  </p>

                  {userAnswer && !isChecked && (
                    <div className="mt-4 p-4 bg-white border-2 border-slate-200 rounded-2xl w-full max-w-md animate-fade-in">
                       <p className="text-slate-500 text-xs font-bold uppercase mb-1">El motor escuchó:</p>
                       <p className="text-lg font-bold text-slate-800">{userAnswer}</p>
                       <p className="text-xs text-slate-400 mt-2">Si no es correcto, presiona el micrófono para intentar de nuevo, o "Comprobar".</p>
                    </div>
                  )}

                  {!isChecked && !isListening && (
                    <button onClick={handleOptOut} className="mt-6 px-5 py-2 rounded-xl text-sm font-bold text-slate-400 border-2 border-slate-200 hover:bg-slate-100 transition-all active:scale-95">
                        🔇 No puedo hablar en este momento
                    </button>
                  )}
              </div>
            </>
          )}

          {currentQ.type === 'listen' && (
            <>
              <button onClick={() => playAudio(currentQ.prompt)} className="w-24 h-24 bg-blue-600 text-white rounded-full text-4xl shadow-lg mx-auto mb-8 active:scale-95">🔊</button>
              <input type="text" value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} disabled={isChecked} placeholder="Escribe en español..."
                className="w-full text-xl p-4 rounded-2xl border-2 text-center bg-white shadow-sm"
                onKeyDown={(e) => { if (e.key === 'Enter' && !isButtonDisabled) isChecked ? handleNext() : handleCheck(); }} autoFocus />
                
              {!isChecked && !isListening && (
                <button onClick={handleOptOut} className="mt-6 px-5 py-2 rounded-xl text-sm font-bold text-slate-400 border-2 border-slate-200 hover:bg-slate-100 transition-all active:scale-95">
                    🔇 No puedo escuchar en este momento
                </button>
              )}
            </>
          )}

          {currentQ.type === 'sentence_builder' && (
            <>
              <h2 className="text-3xl font-black text-slate-800 mb-8 capitalize">{currentQ.prompt}</h2>
              <div className="min-h-[80px] w-full p-4 rounded-2xl border-2 border-slate-300 bg-white mb-6 flex flex-wrap gap-2 justify-center">
                {builtSentence.map((word, i) => (
                  <button key={`ans-${i}`} onClick={() => { if(!isChecked) setBuiltSentence(prev => prev.filter((_, idx) => idx !== i)); }}
                    className="bg-blue-100 border border-blue-300 text-blue-900 font-bold px-4 py-2 rounded-xl shadow-sm">{word}</button>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 justify-center">
                {currentQ.options.map((word, i) => {
                  if (builtSentence.filter(w => w === word).length >= currentQ.options.filter(w => w === word).length) return null;
                  return (
                    <button key={`opt-${i}`} disabled={isChecked} onClick={() => setBuiltSentence([...builtSentence, word])}
                      className="bg-white border-2 border-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl shadow-sm">{word}</button>
                  );
                })}
              </div>
            </>
          )}

          {currentQ.type === 'write' && (
            <>
              <h2 className="text-3xl font-black text-slate-800 mb-8 capitalize">{currentQ.prompt}</h2>
              <input type="text" value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} disabled={isChecked} placeholder="Escribe en español..."
                className="w-full text-xl p-4 rounded-2xl border-2 text-center bg-white shadow-sm"
                onKeyDown={(e) => { if (e.key === 'Enter' && !isButtonDisabled) isChecked ? handleNext() : handleCheck(); }} autoFocus />
            </>
          )}
        </div>
      </div>

      <div className={`flex-none border-t-2 p-4 md:p-6 transition-colors z-10 ${isChecked ? isCorrect ? 'bg-emerald-100 border-emerald-200' : 'bg-red-100 border-red-200' : 'bg-white border-slate-200'}`}>
        <div className="max-w-3xl mx-auto w-full flex items-center justify-between">
          <div>
            {isChecked && (
              <div className="flex flex-col">
                <div className="flex items-center gap-3">
                  <span className={`text-xl md:text-2xl font-black ${isCorrect ? 'text-emerald-700' : 'text-red-700'}`}>{isCorrect ? '¡Excelente!' : 'Incorrecto'}</span>
                  {currentQ.type !== 'matching' && (
                    <button onClick={() => playAudio(currentQ.correctAnswer)} className={`p-2 rounded-full ${isCorrect ? 'bg-emerald-200 text-emerald-800' : 'bg-red-200 text-red-800'}`}>🔊</button>
                  )}
                </div>
                {!isCorrect && currentQ.type !== 'matching' && (
                  <span className="text-red-900 text-sm md:text-base font-medium mt-1">Respuesta correcta: <strong className="font-black">{currentQ.correctAnswer}</strong></span>
                )}
                {isCorrect && missedArticle && (
                  <span className="text-emerald-900 text-sm md:text-base font-medium mt-1">⚠️ No olvides el artículo: <strong className="font-black">{currentQ.correctAnswer}</strong></span>
                )}
              </div>
            )}
          </div>

          <button onClick={isChecked ? handleNext : handleCheck}
            disabled={isButtonDisabled}
            className={`px-6 py-3 md:px-8 md:py-3 rounded-2xl font-black text-base md:text-lg shadow-md transition-all active:scale-95 ${isChecked ? isCorrect ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white' : 'bg-blue-600 text-white disabled:opacity-50'}`}
          >
            {isChecked ? 'Continuar' : 'Comprobar'}
          </button>
        </div>
      </div>
    </div>
  );
}