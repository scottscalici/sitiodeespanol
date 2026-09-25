import React, { useState, useEffect } from 'react';
import { doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { PAIR_MAP, POOL_MAP } from '../utils/distractorConfig';
import { checkAnswerLeniently } from '../utils/checkAnswer';
import { playAudio } from '../utils/playAudio';

export default function WorkoutEngine({ segment, history = [], podIndex = 0, onClose, onComplete }) {
  const { currentUser } = useAuth();

  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [masterPool, setMasterPool] = useState([]);
  const [isGenerating, setIsGenerating] = useState(true);

  // Tracking & Score State
  const [initialCount, setInitialCount] = useState(0);
  const [initialRegularCount, setInitialRegularCount] = useState(0);
  const [initialSentenceCount, setInitialSentenceCount] = useState(0);
  const [retries, setRetries] = useState(0);
  const [attempts, setAttempts] = useState(0);

  // Interaction State
  const [userAnswer, setUserAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState(null);
  const [builtSentence, setBuiltSentence] = useState([]);
  const [complexPhase, setComplexPhase] = useState('build');

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
  const [missedAccent, setMissedAccent] = useState(false);

  // ========================================================================
  // ⏱️ SPEED ROUND (BOSS BATTLE)
  // ========================================================================
  const isSpeedRound = segment?.isSpeedRound || segment?.preset === 'speed_round';
  const [timeLeft, setTimeLeft] = useState(segment?.timeLimit || 60);

  useEffect(() => {
    if (!isSpeedRound || timeLeft <= 0 || isGenerating) return;
    const timerId = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timerId);
  }, [isSpeedRound, timeLeft, isGenerating]);

  useEffect(() => {
    if (isSpeedRound && timeLeft === 0) handleTimeUp();
  }, [timeLeft, isSpeedRound]);

  const handleTimeUp = () => {
    const finalScore = Math.round((currentIndex / (initialCount || 1)) * 100);
    alert(`¡Tiempo! ⏱️ Lograste completar ${currentIndex} de ${initialCount} preguntas.`);
    onComplete(segment.id, finalScore, initialCount, initialRegularCount, initialSentenceCount);
  };

  const shuffle = (array) => [...array].sort(() => Math.random() - 0.5);

  // ========================================================================
  // MOTOR DE DISTRACTORES INTELIGENTES (Sentence Bank)
  // ========================================================================
  const buildGrammarOptions = async (target, answer, distractorFallback) => {
    const meta = target.fullData || {};
    const mode = meta.distractorMode;

    if ((mode === 'binary_verb' || mode === 'quad_verb') && meta.targetLemma && meta.targetTense && meta.targetSubject) {
      const pair = PAIR_MAP[meta.pairTag];
      if (pair) {
        try {
          const verbSnap = await getDoc(doc(db, 'verbs', meta.targetLemma));
          if (verbSnap.exists()) {
            const verbData = verbSnap.data();
            const otherTense = pair.a === meta.targetTense ? pair.b : pair.a;
            const counterpart = verbData.tenses?.[otherTense]?.[meta.targetSubject]?.target;
            let options = [answer];
            if (counterpart && counterpart !== answer) options.push(counterpart);

            if (mode === 'binary_verb') {
              if (options.length < 2) options.push(...distractorFallback(2 - options.length, options));
              return shuffle(options.slice(0, 2));
            }
            if (options.length < 4) options.push(...distractorFallback(4 - options.length, options));
            return shuffle(options);
          }
        } catch (err) {
          console.error('Error fetching verb for distractor engine:', err);
        }
      }
    }

    if (mode === 'fixed_pool' && meta.poolTag && POOL_MAP[meta.poolTag]) {
      const poolWords = POOL_MAP[meta.poolTag].words.filter((w) => w !== answer);
      let options = [answer];
      while (options.length < 4 && poolWords.length > 0) {
        const idx = Math.floor(Math.random() * poolWords.length);
        options.push(poolWords.splice(idx, 1)[0]);
      }
      return shuffle(options);
    }

    return shuffle([answer, ...distractorFallback(3, [answer])]);
  };

  // 🚀 HELPER: Safely extract English from DB Object
  const getEnglishTrans = (obj) => {
    if (!obj) return null;
    return obj.english || obj.en || obj.translation || obj.fullData?.english || obj.fullData?.en || obj.fullData?.translation || null;
  };

  // ========================================================================
  // EL GENERADOR
  // ========================================================================
  useEffect(() => {
    const generateQuestions = async () => {
      if (!segment) return;
      setIsGenerating(true);

      let generatedQueue = [];
      const totalQs = segment.total_questions || 15;
      const rawConcepts = segment.introduced_concepts || [];
      const grammar = segment.pinned_sentences || [];
      const targetTense = segment.targetTense || 'ALL';

      // Admin-set quota (e.g. { recall: 5, mc: 3, matching: 1, listen: 1,
      // speak: 0, sentence: 0 }) replaces the old random pick among allowed
      // "modalities" — expand it into one shuffled slot per question, then
      // pop one per loop iteration below. `recall` renders as "conjugate" for
      // a verb target or "write" for a vocab target, decided per-question
      // once we know what kind of concept got drawn. A segment saved before
      // this existed (segment.modalities instead of questionMix) falls back
      // to plain recall for every slot.
      let typeQueue = [];
      if (segment.questionMix) {
        Object.entries(segment.questionMix).forEach(([type, count]) => {
          for (let n = 0; n < count; n++) typeQueue.push(type);
        });
      }
      typeQueue = shuffle(typeQueue);
      while (typeQueue.length < totalQs) typeQueue.push('recall');

      // ASYNC UNPACK CURRENT CONCEPTS
      let concepts = [];
      for (const c of rawConcepts) {
        if (c.isGroup && c.verbIds) {
          for (const vid of c.verbIds) {
            try {
              const vDoc = await getDoc(doc(db, 'verbs', vid));
              if (vDoc.exists()) concepts.push({ id: vDoc.id, label: vDoc.id, tags: c.tags, fullData: vDoc.data(), isVerbObj: true });
            } catch (err) {}
          }
        } else {
          concepts.push(c);
        }
      }

      // ASYNC UNPACK HISTORY
      let unpackedHistory = [];
      for (const h of history) {
        if (h.isGroup && h.verbIds) {
          for (const vid of h.verbIds) {
            try {
              const vDoc = await getDoc(doc(db, 'verbs', vid));
              if (vDoc.exists()) unpackedHistory.push({ id: vDoc.id, label: vDoc.id, tags: h.tags, fullData: vDoc.data(), isVerbObj: true });
            } catch (err) {}
          }
        } else {
          unpackedHistory.push(h);
        }
      }

      // Categorize
      const validVocab = concepts.filter(c => !c.isVerbObj && getEnglishTrans(c));
      const validVerbs = concepts.filter(c => c.isVerbObj || (c.fullData && c.fullData.tenses));

      const validHistoryVocab = unpackedHistory.filter(c => !c.isVerbObj && getEnglishTrans(c));
      const validHistoryVerbs = unpackedHistory.filter(c => c.isVerbObj || (c.fullData && c.fullData.tenses));
      const validHistory = [...validHistoryVocab, ...validHistoryVerbs];

      if (concepts.length === 0 && grammar.length === 0 && validHistory.length === 0) {
        setIsGenerating(false); return;
      }

      const masterPoolMap = new Map();
      validHistoryVocab.forEach(c => masterPoolMap.set(c.label.trim(), c));
      validVocab.forEach(c => masterPoolMap.set(c.label.trim(), c));
      const uniqueMasterPool = Array.from(masterPoolMap.values());
      setMasterPool(uniqueMasterPool);

      // Recuperación gate mode: instead of the normal per-question random
      // draw (with replacement — fine for endless practice, but doesn't
      // guarantee every concept gets asked), pre-build a shuffled queue that
      // covers every concept at least once, then pads with extra random
      // draws if totalQs asks for more than the concept count. The caller is
      // responsible for bumping totalQs up to at least the concept count so
      // "full coverage" is a real guarantee, not just a best effort.
      const fullCoverage = !!segment.fullCoverage;
      let conceptQueue = [];
      if (fullCoverage) {
        const allTargets = shuffle([...validVocab, ...validVerbs]);
        conceptQueue = [...allTargets];
        for (let n = 0; allTargets.length > 0 && conceptQueue.length < totalQs; n++) {
          conceptQueue.push(allTargets[n % allTargets.length]);
        }
      }

      // 🚀 SMART DISTRACTOR GENERATOR
      // truncateToFirstWord=true (default) is for sentence-builder word banks,
      // where each option becomes a single draggable word tile. Vocab
      // multiple-choice passes false so a multi-word term like "Las Bellas
      // Artes" stays whole instead of showing up as a bare "las" option.
      const getWordDistractors = (count, excludeWordsArray = [], { truncateToFirstWord = true } = {}) => {
          let options = [];
          const excludeLower = excludeWordsArray.map(w => w.trim().toLowerCase());

          // 1. Try to pull from valid vocab first
          const shuffledPool = shuffle(uniqueMasterPool);
          for (const item of shuffledPool) {
              // Exclude on the FULL cleaned label first — otherwise the
              // correct answer's own truncated fragment (e.g. "las" from
              // "Las Bellas Artes") won't string-match the untruncated
              // exclude list and sneaks back in as a fake distractor.
              const fullLabel = item.label.trim().replace(/[.,!?¿¡]/g, '').toLowerCase();
              if (!fullLabel || excludeLower.includes(fullLabel)) continue;

              let candidate = fullLabel;
              if (truncateToFirstWord && candidate.includes(' ')) candidate = candidate.split(' ')[0]; // Grabs first word of a phrase

              if (candidate && !options.includes(candidate) && !excludeLower.includes(candidate)) {
                  options.push(candidate);
              }
              if (options.length === count) break;
          }

          // 2. Fallbacks if the master pool is too small
          const fallbacks = shuffle(["el", "no", "yo", "a", "por", "para", "muy", "siempre", "nunca", "de", "con", "sin", "estar", "ser", "tener", "hacer", "y", "o", "que"]);
          for (const f of fallbacks) {
              if (options.length === count) break;
              if (!options.includes(f) && !excludeLower.includes(f)) {
                  options.push(f);
              }
          }
          return options;
      };

      for (let i = 0; i < totalQs; i++) {

        // --- 1. REPASO DE ORACIONES (HISTORY) ---
        const historyWithContext = validHistoryVocab.filter(c => c.fullData?.context_1 || c.fullData?.context_sentences?.[0]);
        if (i > 0 && i % 4 === 0 && historyWithContext.length > 0 && !isSpeedRound) {
          const revConcept = historyWithContext[Math.floor(Math.random() * historyWithContext.length)];
          const ctx1 = revConcept.fullData?.context_1 || revConcept.fullData?.context_sentences?.[0];

          if (ctx1) {
              const spaSentence = typeof ctx1 === 'string' ? ctx1 : (ctx1.spanish || ctx1.es || revConcept.label);
              const engTrans = typeof ctx1 === 'string' ? "⚠️ Falta traducción (English) en BD" : (ctx1.english || ctx1.en || "⚠️ Falta traducción (English) en BD");
              const correctWords = spaSentence.replace(/[.,!?¿¡]/g, '').split(' ');

              generatedQueue.push({
                  id: `q_rev_${i}`, type: 'sentence_builder', prompt: engTrans, engTrans: engTrans,
                  options: shuffle([...correctWords, ...getWordDistractors(2, correctWords)]),
                  correctAnswer: spaSentence.replace(/[.,!?¿¡]/g, '').trim(), topic: `Repaso: ${revConcept.label}`,
                  _pointCategory: 'regular'
              });
              continue;
          }
        }

        // --- 2. GRAMÁTICA Y ORACIONES ---
        const forceHistory = concepts.length === 0;
        const requestedType = typeQueue[i] || 'recall';
        const isGrammarTurn = grammar.length > 0 && (requestedType === 'sentence' || (concepts.length === 0 && validHistory.length === 0));

        if (isGrammarTurn) {
          const target = grammar[Math.floor(Math.random() * grammar.length)];
          const spaSentence = target.label;
          const engTrans = getEnglishTrans(target) || "⚠️ Agrega la traducción en la base de datos";

          const twoPartMatch = spaSentence.match(/\[\[(.*?)\|(.*?)\]\]/);
          const onePartMatch = spaSentence.match(/\[\[(.*?)\]\]/);

          if (twoPartMatch) {
              const targetVerb = twoPartMatch[1].trim();
              const infinitive = twoPartMatch[2].trim();

              let cleanDisplay = spaSentence.replace(twoPartMatch[0], infinitive).replace(/[.,!?¿¡]/g, '');
              let cleanCorrect = spaSentence.replace(twoPartMatch[0], targetVerb).replace(/[.,!?¿¡]/g, '');

              if (isSpeedRound) {
                  generatedQueue.push({
                      id: `q_${i}`, type: 'conjugate',
                      subject: cleanDisplay.replace(infinitive, '________'),
                      infinitive: infinitive, tense: 'Gramática', engTrans: engTrans,
                      correctAnswer: targetVerb, topic: 'Gramática (Velocidad)', isVerb: true,
                      _pointCategory: 'sentence'
                  });
              } else {
                  let correctWords = cleanDisplay.split(' ');
                  let wordBank = shuffle([...correctWords, ...getWordDistractors(3, correctWords)]);
                  generatedQueue.push({
                      id: `q_${i}`, type: 'sentence_builder_complex',
                      prompt: engTrans, engTrans: engTrans, options: wordBank,
                      correctSyntax: cleanDisplay.trim(), targetVerb: targetVerb, infinitive: infinitive,
                      correctAnswer: cleanCorrect.trim(), topic: target.tags || 'Gramática (Ordena y Conjuga)', isVerb: true,
                      _pointCategory: 'sentence'
                  });
              }
          } else if (onePartMatch && !isSpeedRound) {
              const answer = onePartMatch[1];
              const options = await buildGrammarOptions(target, answer, getWordDistractors);
              generatedQueue.push({ id: `q_${i}`, type: 'mc', prompt: spaSentence.replace(/\[\[(.*?)\]\]/, '________'), engTrans: engTrans, options: options, correctAnswer: answer, topic: target.tags || 'Gramática', _pointCategory: 'sentence' });
          } else {
              let cleanDisplay = spaSentence.replace(/[.,!?¿¡]/g, '').trim();
              if (isSpeedRound) {
                  generatedQueue.push({ id: `q_${i}`, type: 'write', prompt: engTrans, engTrans: engTrans, correctAnswer: cleanDisplay, topic: target.tags || 'Gramática (Velocidad)', _pointCategory: 'sentence' });
              } else {
                  let correctWords = cleanDisplay.split(' ');
                  generatedQueue.push({ id: `q_${i}`, type: 'sentence_builder', prompt: engTrans, engTrans: engTrans, options: shuffle([...correctWords, ...getWordDistractors(2, correctWords)]), correctAnswer: cleanDisplay, topic: target.tags || 'Gramática', _pointCategory: 'sentence' });
              }
          }
        }

        // --- 3. VOCABULARIO Y VERBOS ---
        else {
          let target;
          if (fullCoverage) {
            target = conceptQueue[i];
            if (!target) continue;
          } else {
            const isHistoryTurn = forceHistory || (validHistory.length > 0 && Math.random() < 0.20);

            if (isHistoryTurn && validHistory.length > 0) target = validHistory[Math.floor(Math.random() * validHistory.length)];
            else if (validVerbs.length > 0 && Math.random() < 0.6) target = validVerbs[Math.floor(Math.random() * validVerbs.length)];
            else if (validVocab.length > 0) target = validVocab[Math.floor(Math.random() * validVocab.length)];
            else if (validVerbs.length > 0) target = validVerbs[Math.floor(Math.random() * validVerbs.length)];
            else continue;
          }

          if (target.fullData && target.fullData.tenses) {
            let availableTenses = Object.keys(target.fullData.tenses).filter(t => typeof target.fullData.tenses[t] === 'object');

            if (targetTense !== 'ALL' && availableTenses.includes(targetTense)) {
              availableTenses = [targetTense];
            }

            if (availableTenses.length > 0) {
              const randomTenseKey = availableTenses[Math.floor(Math.random() * availableTenses.length)];
              const tenseData = target.fullData.tenses[randomTenseKey];
              const displaySubjects = { 'yo': 'yo', 'tú': 'tú', 'él_ella_ud': 'él/ella/Ud.', 'nosotros': 'nosotros', 'ellos_ellas_uds': 'ellos/ellas/Uds.', 'vosotros': 'vosotros' };

              let availableSubjects = Object.keys(tenseData).filter(k => displaySubjects[k] && tenseData[k]?.target);
              if (Math.random() > 0.03) availableSubjects = availableSubjects.filter(s => s !== 'vosotros');

              if (availableSubjects.length > 0) {
                const randomSubject = availableSubjects[Math.floor(Math.random() * availableSubjects.length)];
                let conjugationData = tenseData[randomSubject];
                let engTrans = conjugationData.english;
                let spaTarget = conjugationData.target;

                // A student who doesn't already recognize this infinitive has no way
                // to know what it means from engTrans alone (that's the CONJUGATED
                // phrase, e.g. "you take advantage of" — stripping the subject and
                // reconstructing "to ___" isn't always obvious, especially for a less
                // common regular verb). translations.infinitivo.english is the bare
                // "to VERB" gloss already stored on the verb doc for exactly this
                // purpose. Carried on every format (including listen/speak) so a
                // listen/speak opt-out's 'write' replacement question can show it too.
                const infinitiveEnglish = target.fullData.translations?.infinitivo?.english || `to ${target.fullData.palabra}`;

                let format = 'conjugate';

                if (isSpeedRound) {
                  format = 'conjugate';
                } else if (requestedType === 'mc') {
                  format = 'mc_verb';
                } else if (requestedType === 'matching' && availableSubjects.length >= 2) {
                  format = 'matching_verb';
                } else if (requestedType === 'listen') {
                  format = 'listen_verb';
                } else if (requestedType === 'speak') {
                  format = 'speak_verb';
                } else {
                  format = 'conjugate'; // 'recall', or 'matching' with too few subjects to pair up
                }

                if (format === 'matching_verb') {
                    let pairs = [];
                    const subjs = shuffle(availableSubjects).slice(0, 5);
                    subjs.forEach(subj => {
                        pairs.push({
                            es: tenseData[subj].target,
                            en: `${target.fullData.palabra} (${displaySubjects[subj]})`
                        });
                    });

                    if (pairs.length >= 2) {
                        generatedQueue.push({
                            id: `q_${i}`, type: 'matching', topic: `Conecta las Conjugaciones: ${randomTenseKey.replace(/_/g, ' ')}`,
                            pairs: pairs, esOptions: shuffle(pairs.map(p=>p.es)), enOptions: shuffle(pairs.map(p=>p.en)), isVerb: true,
                            _pointCategory: 'regular'
                        });
                        continue;
                    }
                }

                if (format === 'mc_verb') {
                     let options = [spaTarget];
                     let otherSubjects = shuffle(availableSubjects.filter(s => s !== randomSubject));
                     for (let s of otherSubjects) {
                         if (options.length < 4 && tenseData[s]?.target) options.push(tenseData[s].target);
                     }
                     // The options here are all conjugations of the SAME verb (different
                     // subjects), so a student who doesn't already recognize the infinitive
                     // has no way to tell them apart from engTrans alone — same reasoning
                     // as the 'conjugate' recall format below.
                     generatedQueue.push({ id: `q_${i}`, type: 'mc', prompt: engTrans, engTrans: engTrans, options: shuffle(options), correctAnswer: spaTarget, topic: `Conjugación: ${randomTenseKey.replace(/_/g, ' ')}`, isVerb: true, infinitive: target.fullData.palabra, infinitiveEnglish, _pointCategory: 'regular' });
                } else if (format === 'listen_verb') {
                     generatedQueue.push({ id: `q_${i}`, type: 'listen', prompt: spaTarget, engTrans: engTrans, correctAnswer: spaTarget, topic: `Comprensión Auditiva: ${randomTenseKey.replace(/_/g, ' ')}`, isVerb: true, infinitive: target.fullData.palabra, infinitiveEnglish, _pointCategory: 'regular' });
                } else if (format === 'speak_verb') {
                     generatedQueue.push({ id: `q_${i}`, type: 'speak', prompt: spaTarget, engTrans: engTrans, correctAnswer: spaTarget, topic: `Pronunciación: ${randomTenseKey.replace(/_/g, ' ')}`, isVerb: true, infinitive: target.fullData.palabra, infinitiveEnglish, _pointCategory: 'regular' });
                } else {
                     generatedQueue.push({ id: `q_${i}`, type: 'conjugate', subject: displaySubjects[randomSubject], infinitive: target.fullData.palabra, infinitiveEnglish, tense: randomTenseKey.replace(/_/g, ' '), engTrans: engTrans, correctAnswer: spaTarget, topic: `Conjugación: ${randomTenseKey.replace(/_/g, ' ')}`, isVerb: true, _pointCategory: 'regular' });
                }
                continue;
              }
            }
          }

          // --- STANDARD VOCAB GENERATOR ---
          const engTrans = getEnglishTrans(target) || "⚠️ Falta traducción (English) en BD";
          const spaWord = target.label.trim();

          let format = 'write';

          if (isSpeedRound) {
            format = 'write';
          } else if (requestedType === 'mc') {
            format = 'mc';
          } else if (requestedType === 'matching' && uniqueMasterPool.length >= 5) {
            format = 'matching';
          } else if (requestedType === 'listen') {
            format = 'listen';
          } else if (requestedType === 'speak') {
            format = 'speak';
          } else {
            format = 'write'; // 'recall', or 'matching' with too small a pool
          }

          if (format === 'matching') {
            const matchPool = shuffle([...uniqueMasterPool]).slice(0, 5);
            generatedQueue.push({ id: `q_${i}`, type: 'matching', topic: 'Vocabulario (Conecta las palabras)', pairs: matchPool.map(c => ({ es: c.label.trim(), en: (getEnglishTrans(c) || "Translation").trim() })), esOptions: shuffle(matchPool.map(c => c.label.trim())), enOptions: shuffle(matchPool.map(c => (getEnglishTrans(c) || "Translation").trim())), _pointCategory: 'regular' });
          } else if (format === 'mc') {
            let options = [spaWord, ...getWordDistractors(3, [spaWord], { truncateToFirstWord: false })];
            generatedQueue.push({ id: `q_${i}`, type: 'mc', prompt: engTrans, engTrans: engTrans, options: shuffle(options), correctAnswer: spaWord, topic: target.tags || 'Vocabulario', _pointCategory: 'regular' });
          } else if (format === 'listen') {
            generatedQueue.push({ id: `q_${i}`, type: 'listen', prompt: spaWord, engTrans: engTrans, correctAnswer: spaWord, topic: target.tags || 'Comprensión Auditiva', _pointCategory: 'regular' });
          } else if (format === 'speak') {
            generatedQueue.push({ id: `q_${i}`, type: 'speak', prompt: spaWord, engTrans: engTrans, correctAnswer: spaWord, topic: target.tags || 'Pronunciación', _pointCategory: 'regular' });
          } else {
            generatedQueue.push({ id: `q_${i}`, type: 'write', prompt: engTrans, engTrans: engTrans, correctAnswer: spaWord, topic: target.tags || 'Escritura', _pointCategory: 'regular' });
          }
        }
      }
      setQuestions(generatedQueue);
      setInitialCount(generatedQueue.length);
      setInitialSentenceCount(generatedQueue.filter((q) => q._pointCategory === 'sentence').length);
      setInitialRegularCount(generatedQueue.filter((q) => q._pointCategory !== 'sentence').length);
      setIsGenerating(false);
    };

    generateQuestions();
  }, [segment, history]);

  // ========================================================================
  // RECONOCIMIENTO DE VOZ Y OPT-OUT
  // ========================================================================
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Tu navegador no soporta reconocimiento de voz.");

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-US'; recognition.interimResults = false; recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setUserAnswer(transcript);

      const { correct, missedArticle, missedAccent } = checkAnswerLeniently(transcript, questions[currentIndex].correctAnswer, questions[currentIndex].isVerb);
      if (correct) {
          setIsCorrect(correct); setMissedArticle(missedArticle); setMissedAccent(missedAccent); setIsChecked(true); setAttempts(prev => prev + 1);
      } else if (missedAccent) {
          setIsCorrect(false); setMissedAccent(true); setIsChecked(true);
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const handleOptOut = () => {
    const currentQ = questions[currentIndex];
    const spaWord = currentQ.correctAnswer;
    const engTrans = currentQ.engTrans || "Traducción";
    const rep1 = {
      id: currentQ.id + '_rep1_' + Date.now(), type: 'write', prompt: engTrans, correctAnswer: spaWord,
      topic: 'Reemplazo: Escritura', isVerb: currentQ.isVerb,
      infinitive: currentQ.infinitive, infinitiveEnglish: currentQ.infinitiveEnglish,
    };
    setQuestions(prev => [...prev, rep1]);
    setCurrentIndex(prev => prev + 1);
    resetInteractiveState();
  };

  // ========================================================================
  // MATCHING & AUDIO ENGINE
  // ========================================================================
  useEffect(() => {
    const currentQ = questions[currentIndex];
    if (currentQ?.type === 'matching' && matchSelEs && matchSelEn) {
      const isValid = currentQ.pairs.some(p => p.es === matchSelEs && p.en === matchSelEn);
      if (isValid) setMatchedPairs(prev => [...prev, matchSelEs]);
      else setRetries(prev => prev + 1);
      setTimeout(() => { setMatchSelEs(null); setMatchSelEn(null); }, 200);
    }
  }, [matchSelEs, matchSelEn, currentIndex, questions]);

  useEffect(() => {
    const currentQ = questions[currentIndex];
    if (currentQ?.type === 'matching' && matchedPairs.length === currentQ.pairs.length) {
       setIsChecked(true); setIsCorrect(true);
    }
  }, [matchedPairs, currentIndex, questions]);

  useEffect(() => {
    if (questions[currentIndex]?.type === 'listen') playAudio(questions[currentIndex].prompt);
  }, [currentIndex, questions]);

  // ========================================================================
  // LÓGICA DEL BUCLE DE JUEGO
  // ========================================================================
  const resetInteractiveState = (fallbackPhase = 'build') => {
    setUserAnswer(''); setSelectedOption(null); setBuiltSentence([]);
    setMatchSelEs(null); setMatchSelEn(null); setMatchedPairs([]);
    setIsChecked(false); setIsCorrect(false); setMissedArticle(false); setMissedAccent(false);
    setComplexPhase(fallbackPhase);
  };

  const handleCheck = () => {
    const currentQ = questions[currentIndex];
    if (currentQ.type === 'matching') return;

    // 🚀 COMPLEX 2-PART CHECK LOGIC
    if (currentQ.type === 'sentence_builder_complex') {
        if (complexPhase === 'build') {
            const isSyntaxCorrect = builtSentence.join(' ').toLowerCase() === currentQ.correctSyntax.toLowerCase();
            if (isSyntaxCorrect) {
                setComplexPhase('conjugate');
                return;
            } else {
                setIsCorrect(false); setIsChecked(true); setRetries(prev => prev + 1);
                setQuestions(prev => [...prev, { ...currentQ, id: currentQ.id + '_retry_' + Date.now() }]);
                return;
            }
        } else {
            if (!userAnswer.trim()) return;
            const { correct, missedArticle, missedAccent } = checkAnswerLeniently(userAnswer, currentQ.targetVerb, true);
            setIsCorrect(correct); setMissedArticle(missedArticle); setMissedAccent(missedAccent); setIsChecked(true);
            if (!correct) {
                setRetries(prev => prev + 1);
                setQuestions(prev => [...prev, { ...currentQ, id: currentQ.id + '_retry_' + Date.now(), complexPhaseFallback: 'conjugate' }]);
            } else {
                setAttempts(prev => prev + 1);
            }
            return;
        }
    }

    let userString = '';
    if (currentQ.type === 'mc') userString = selectedOption || '';
    else if (currentQ.type === 'sentence_builder') userString = builtSentence.join(' ');
    else userString = userAnswer;

    if (!userString.trim()) return;

    const { correct, missedArticle, missedAccent } = checkAnswerLeniently(userString, currentQ.correctAnswer, currentQ.isVerb);
    setIsCorrect(correct); setMissedArticle(missedArticle); setMissedAccent(missedAccent); setIsChecked(true);

    if (!correct) {
      setRetries(prev => prev + 1);
      setQuestions(prev => [...prev, { ...currentQ, id: currentQ.id + '_retry_' + Date.now() }]);
    } else {
      setAttempts(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      const nextQ = questions[currentIndex + 1];
      setCurrentIndex(currentIndex + 1);
      resetInteractiveState(nextQ.complexPhaseFallback || 'build');
    } else {
      const finalScore = Math.round((initialCount / (initialCount + retries)) * 100);
      onComplete(segment.id, finalScore, initialCount, initialRegularCount, initialSentenceCount);
    }
  };

  if (isGenerating) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-50 flex items-center justify-center">
        <div className="text-xl font-bold text-slate-500 animate-pulse">Generando la ruta...</div>
      </div>
    );
  }

  if (!segment || questions.length === 0) return null;
  const currentQ = questions[currentIndex];
  const progressPercent = Math.round(((currentIndex) / questions.length) * 100);

  const isButtonDisabled = (!isChecked && currentQ.type === 'matching') ||
                           (currentQ.type === 'sentence_builder_complex' && complexPhase === 'build' && builtSentence.length === 0 && !isChecked) ||
                           (currentQ.type === 'sentence_builder_complex' && complexPhase === 'conjugate' && !userAnswer.trim() && !isChecked) ||
                           (!selectedOption && !userAnswer.trim() && builtSentence.length === 0 && currentQ.type !== 'matching' && currentQ.type !== 'sentence_builder_complex' && !isChecked) ||
                           isListening;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col font-sans">
      <div className="flex-none p-4 flex items-center justify-between gap-4 max-w-3xl mx-auto w-full bg-slate-50 z-10">
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-xl px-2 transition-colors">✕</button>

        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden shadow-inner">
          <div className="bg-emerald-500 h-3 transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
        </div>

        <span className="text-slate-500 font-black text-sm">{currentIndex + 1}/{questions.length}</span>

        {isSpeedRound && (
          <div className={`font-mono text-xl font-black flex items-center gap-1 transition-colors duration-300 ${
            timeLeft <= 10 ? 'text-rose-600 animate-pulse drop-shadow-md' : 'text-slate-700'
          }`}>
            ⏱️ {timeLeft}s
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-start md:justify-center overflow-y-auto p-4 md:p-6 w-full">
        <div className="w-full max-w-3xl mx-auto text-center pb-8">
          <span className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-6 block">
            {isSpeedRound && <span className="text-rose-600 mr-2">🔥 RETO DE VELOCIDAD</span>}
            {currentQ.topic}
          </span>

          {/* 🚀 COMPLEX 2-PART SENTENCE BUILDER UI */}
          {currentQ.type === 'sentence_builder_complex' && (
            <div className="animate-fade-in w-full max-w-2xl mx-auto text-center">
              <h2 className="text-2xl md:text-3xl font-black text-slate-800 mb-8">{currentQ.prompt}</h2>

              <div className="flex items-center justify-center gap-4 mb-6">
                 <div className={`px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest transition-all ${complexPhase === 'build' ? 'bg-blue-600 text-white shadow-md scale-105' : 'bg-emerald-100 text-emerald-800'}`}>1. Ordena</div>
                 <div className={`px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest transition-all ${complexPhase === 'conjugate' ? 'bg-blue-600 text-white shadow-md scale-105' : 'bg-slate-200 text-slate-500'}`}>2. Conjuga</div>
              </div>

              {complexPhase === 'build' ? (
                <>
                   <div className="min-h-[80px] w-full p-4 rounded-2xl border-2 border-slate-300 bg-white mb-6 flex flex-wrap gap-2 justify-center">
                     {builtSentence.map((word, i) => (
                       <button key={`ans-${i}`} onClick={() => setBuiltSentence(prev => prev.filter((_, idx) => idx !== i))}
                         className="bg-blue-100 border border-blue-300 text-blue-900 font-bold px-4 py-2 rounded-xl shadow-sm transition-transform active:scale-95">{word}</button>
                     ))}
                   </div>
                   <div className="flex flex-wrap gap-3 justify-center">
                     {currentQ.options.map((word, i) => {
                       if (builtSentence.filter(w => w === word).length >= currentQ.options.filter(w => w === word).length) return null;
                       return (
                         <button key={`opt-${i}`} onClick={() => setBuiltSentence([...builtSentence, word])}
                           className="bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2 rounded-xl shadow-sm transition-transform active:scale-95">{word}</button>
                       );
                     })}
                   </div>
                </>
              ) : (
                <div className="bg-white p-6 md:p-8 rounded-2xl border-2 border-slate-200 shadow-sm animate-fade-in">
                   <div className="flex flex-wrap items-center justify-center gap-3 text-2xl md:text-3xl font-bold text-slate-800">
                      {currentQ.correctSyntax.split(' ').map((w, idx) => {
                          if (w.toLowerCase() === currentQ.infinitive.toLowerCase()) {
                             return <input key={idx} autoFocus type="text" value={userAnswer} onChange={e => setUserAnswer(e.target.value)} readOnly={isChecked}
                                 className="w-32 md:w-40 text-center border-b-4 border-blue-500 bg-blue-50 focus:bg-blue-100 text-blue-900 rounded-t-lg outline-none px-2 py-1 mx-1"
                                 onKeyDown={(e) => { if (e.key === 'Enter' && !isButtonDisabled) isChecked ? handleNext() : handleCheck(); }} />
                          }
                          return <span key={idx}>{w}</span>
                      })}
                   </div>
                   <p className="text-xs font-bold text-emerald-600 mt-6 uppercase tracking-widest">Conjuga el verbo: <span className="font-black text-emerald-800">{currentQ.infinitive}</span></p>
                </div>
              )}
            </div>
          )}

          {currentQ.type === 'conjugate' && (
            <div className="animate-fade-in">
              <div className="flex flex-wrap items-center justify-center gap-3 mb-1">
                <span className="bg-emerald-100 text-emerald-800 font-black px-4 py-2 rounded-xl border border-emerald-300 shadow-sm text-lg">
                    {currentQ.infinitive}
                </span>
                <span className="bg-slate-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs uppercase tracking-widest shadow-sm">
                    {currentQ.tense}
                </span>
              </div>
              {currentQ.infinitiveEnglish && (
                <p className="text-center text-slate-400 text-sm font-medium mb-5">{currentQ.infinitiveEnglish}</p>
              )}

              <div className="flex items-end justify-center gap-4 mb-8">
                 <h2 className="text-3xl md:text-4xl font-black text-slate-800">{currentQ.subject}</h2>
                 <div className="w-48 border-b-4 border-slate-300 pb-1"></div>
              </div>

              <input type="text" value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} readOnly={isChecked} placeholder="Conjuga el verbo..."
                className="w-full max-w-md text-xl p-4 rounded-2xl border-2 text-center bg-white shadow-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all font-bold text-slate-700"
                onKeyDown={(e) => { if (e.key === 'Enter' && !isButtonDisabled) isChecked ? handleNext() : handleCheck(); }} autoFocus />

              {currentQ.engTrans && <p className="text-slate-400 font-medium mt-6">{currentQ.engTrans}</p>}
            </div>
          )}

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
              {currentQ.infinitive && (
                <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
                  <span className="bg-emerald-100 text-emerald-800 font-black px-4 py-2 rounded-xl border border-emerald-300 shadow-sm text-lg">
                    {currentQ.infinitive}
                  </span>
                  {currentQ.infinitiveEnglish && (
                    <span className="text-slate-400 text-sm font-medium">{currentQ.infinitiveEnglish}</span>
                  )}
                </div>
              )}
              <h2 className="text-3xl md:text-4xl font-black text-slate-800 mb-8">{currentQ.prompt}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                {currentQ.options.map((opt, i) => {
                  const { correct } = checkAnswerLeniently(opt, currentQ.correctAnswer, currentQ.isVerb);
                  return (
                    <button key={i} disabled={isChecked} onClick={() => setSelectedOption(opt)}
                      className={`p-4 rounded-2xl border-2 font-bold text-lg transition-all ${
                        isChecked && correct ? 'bg-emerald-100 border-emerald-500 text-emerald-800' :
                        isChecked && selectedOption === opt && !correct ? 'bg-red-100 border-red-500 text-red-800' :
                        selectedOption === opt ? 'bg-blue-100 border-blue-500 text-blue-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >{opt}</button>
                  )
                })}
              </div>
            </>
          )}

          {currentQ.type === 'speak' && (
            <>
              <p className="text-slate-500 font-bold mb-2">Lee en voz alta:</p>

              <div className="flex flex-col items-center justify-center mb-8">
                  <div className="flex items-center gap-4">
                      <h2 className="text-4xl md:text-5xl font-black text-slate-800">{currentQ.prompt}</h2>
                      <button
                        onClick={() => playAudio(currentQ.correctAnswer)}
                        className="p-3 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-full transition-all active:scale-95"
                        title="Escuchar pronunciación"
                      >
                          🔊
                      </button>
                  </div>
                  {currentQ.engTrans && <p className="text-slate-400 font-medium mt-2">{currentQ.engTrans}</p>}
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
              <button onClick={() => playAudio(currentQ.prompt)} className="w-24 h-24 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-4xl shadow-lg mx-auto mb-8 transition-transform active:scale-95">🔊</button>
              <input type="text" value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} readOnly={isChecked} placeholder="Escribe en español..."
                className="w-full text-xl p-4 rounded-2xl border-2 text-center bg-white shadow-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all"
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
              <h2 className="text-3xl font-black text-slate-800 mb-8">{currentQ.prompt}</h2>
              <div className="min-h-[80px] w-full p-4 rounded-2xl border-2 border-slate-300 bg-white mb-6 flex flex-wrap gap-2 justify-center">
                {builtSentence.map((word, i) => (
                  <button key={`ans-${i}`} onClick={() => { if(!isChecked) setBuiltSentence(prev => prev.filter((_, idx) => idx !== i)); }}
                    className="bg-blue-100 border border-blue-300 text-blue-900 font-bold px-4 py-2 rounded-xl shadow-sm transition-transform active:scale-95">{word}</button>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 justify-center">
                {currentQ.options.map((word, i) => {
                  if (builtSentence.filter(w => w === word).length >= currentQ.options.filter(w => w === word).length) return null;
                  return (
                    <button key={`opt-${i}`} disabled={isChecked} onClick={() => setBuiltSentence([...builtSentence, word])}
                      className="bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2 rounded-xl shadow-sm transition-transform active:scale-95">{word}</button>
                  );
                })}
              </div>
            </>
          )}

          {currentQ.type === 'write' && (
            <>
              {currentQ.infinitive && (
                <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
                  <span className="bg-emerald-100 text-emerald-800 font-black px-4 py-2 rounded-xl border border-emerald-300 shadow-sm text-lg">
                    {currentQ.infinitive}
                  </span>
                  {currentQ.infinitiveEnglish && (
                    <span className="text-slate-400 text-sm font-medium">{currentQ.infinitiveEnglish}</span>
                  )}
                </div>
              )}
              <h2 className="text-3xl font-black text-slate-800 mb-8">{currentQ.prompt}</h2>
              <input type="text" value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} readOnly={isChecked} placeholder="Escribe en español..."
                className="w-full text-xl p-4 rounded-2xl border-2 text-center bg-white shadow-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all"
                onKeyDown={(e) => { if (e.key === 'Enter' && !isButtonDisabled) isChecked ? handleNext() : handleCheck(); }} autoFocus />
            </>
          )}
        </div>
      </div>

      <div className={`flex-none border-t-2 p-4 md:p-6 transition-colors z-10 ${isChecked ? isCorrect ? 'bg-emerald-100 border-emerald-200' : 'bg-red-100 border-red-200' : 'bg-white border-slate-200'}`}>
        <div className="max-w-3xl mx-auto w-full flex items-center justify-between">
          <div>
            {isChecked && (
              <div className="flex flex-col animate-fade-in">
                <div className="flex items-center gap-3">
                  <span className={`text-xl md:text-2xl font-black ${isCorrect ? 'text-emerald-700' : 'text-red-700'}`}>{isCorrect ? '¡Excelente!' : 'Incorrecto'}</span>
                  {currentQ.type !== 'matching' && (
                    <button onClick={() => playAudio(currentQ.correctAnswer)} className={`p-2 rounded-full transition-transform active:scale-95 ${isCorrect ? 'bg-emerald-200 text-emerald-800 hover:bg-emerald-300' : 'bg-red-200 text-red-800 hover:bg-red-300'}`}>🔊</button>
                  )}
                </div>
                {!isCorrect && currentQ.type !== 'matching' && (
                  <>
                    <span className="text-red-900 text-sm md:text-base font-medium mt-1">Respuesta correcta: <strong className="font-black">{currentQ.correctAnswer}</strong></span>
                    {missedAccent && (
                      <span className="text-red-700 text-sm md:text-base font-bold mt-1">¡Cuidado! Te faltó un acento o lo pusiste donde no iba.</span>
                    )}
                  </>
                )}
                {isCorrect && missedArticle && (
                  <span className="text-emerald-900 text-sm md:text-base font-medium mt-1">⚠️ No olvides el artículo: <strong className="font-black">{currentQ.correctAnswer}</strong></span>
                )}
              </div>
            )}
          </div>

          <button onClick={isChecked ? handleNext : handleCheck}
            disabled={isButtonDisabled}
            className={`px-6 py-3 md:px-8 md:py-3 rounded-2xl font-black text-base md:text-lg shadow-md transition-all active:scale-95 ${isChecked ? isCorrect ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'}`}
          >
            {isChecked ? 'Continuar' : 'Comprobar'}
          </button>
        </div>
      </div>
    </div>
  );
}
