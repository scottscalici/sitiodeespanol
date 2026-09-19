import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase'; // Ensure your firebase config is imported
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import Senordle from '../components/Senordle';
import PointsIndicator from '../components/PointsIndicator';
import { awardPoints } from '../utils/pointsHelper';
const SENORDLE_POINTS_BY_TRY = [25, 22, 20, 17, 15, 12];

const SenordlePage = () => {
  const { currentUser } = useAuth();
  const [targetWord, setTargetWord] = useState("LIBRO");
  const [validWords, setValidWords] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 🧠 1. STICKY START: Persist S2 or S4 selection
  const [course, setCourse] = useState(localStorage.getItem('preferredCourse') || 's2'); 
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [pointsFlash, setPointsFlash] = useState(null);                
// URL for the dictionaries (Base Spanish + Custom Class Vocab)
const dictUrl1 = "https://raw.githubusercontent.com/scottscalici/imagenes/main/juegos/senordle/diccionario.json";
// Add your second dictionary URL here:
const dictUrl2 = "https://raw.githubusercontent.com/scottscalici/imagenes/main/juegos/senordle/diccionario_extra.json"; 

// EFFECT: Fetch the daily word from Firestore and the validation dictionaries from GitHub
useEffect(() => {
  const fetchGameData = async () => {
    setLoading(true);
    try {
      // A. Get Target Word from Firestore
      const docId = `${course}_${selectedDate}`;
      const docRef = doc(db, "juego_senordle", docId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setTargetWord(docSnap.data().word.toUpperCase());
      } else {
        setTargetWord("LIBRO"); // Fallback
      }

      // B. Get Validation Dictionaries (Using Promise.all to fetch both at the exact same time)
      const [dictResponse1, dictResponse2] = await Promise.all([
        fetch(dictUrl1).catch(() => ({ json: () => [] })), 
        fetch(dictUrl2).catch(() => ({ json: () => [] }))
      ]);

      // Parse the JSON (Fallback to empty arrays if one fails)
      const dictData1 = dictResponse1.ok ? await dictResponse1.json() : [];
      const dictData2 = dictResponse2.ok ? await dictResponse2.json() : [];

      // C. Combine, Convert to Uppercase (Crucial!), and Remove Duplicates
      const combinedWords = [...dictData1, ...dictData2].map(word => word.toUpperCase());
      const uniqueValidWords = [...new Set(combinedWords)]; // Set removes any duplicates

      setValidWords(uniqueValidWords);
      setLoading(false);
    } catch (error) {
      console.error("Error loading game data:", error);
      setLoading(false);
    }
  };

  fetchGameData();
}, [course, selectedDate]);

  // 🧠 2. STICKY SAVE: Save preferred course
  useEffect(() => {
    localStorage.setItem('preferredCourse', course);
  }, [course]);

  const handleGameEnd = async (tries, won) => {
    if (!currentUser) return;
    const points = won ? (SENORDLE_POINTS_BY_TRY[tries - 1] ?? 10) : 10;
    try {
      await awardPoints(currentUser.uid, points);
      setPointsFlash({ amount: points });
    } catch (error) {
      console.error('Error saving Señordle points:', error);
    }
  };

  const getArchiveDates = () => {
    const dates = [];
    for (let i = 0; i < 15; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toLocaleDateString('en-CA'));
    }
    return dates;
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-emerald-500 font-black animate-pulse uppercase tracking-widest">
        Sincronizando Firestore...
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 py-8 px-4 font-sans">
      <PointsIndicator flash={pointsFlash} />
      <div className="max-w-2xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-12">
          <Link to="/recreo" className="text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-full font-bold transition-all text-sm flex items-center gap-2">
            ← Arcade
          </Link>

          <div className="flex items-center gap-3">
            <select 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-800 text-white text-xs font-bold border border-slate-700 rounded-full px-4 py-2 outline-none hover:border-emerald-500 transition-colors cursor-pointer"
            >
              {getArchiveDates().map(date => (
                <option key={date} value={date}>
                  {date === new Date().toLocaleDateString('en-CA') ? "📅 Hoy" : date}
                </option>
              ))}
            </select>

            <div className="flex bg-slate-800 p-1 rounded-full border border-slate-700 shadow-inner">
              <button 
                onClick={() => setCourse('s2')}
                className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${course === 's2' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              >
                S2
              </button>
              <button 
                onClick={() => setCourse('s4')}
                className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${course === 's4' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              >
                S4
              </button>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 p-4 md:p-8 rounded-[2.5rem] border-2 border-slate-700 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 blur-[60px] rounded-full"></div>
          
          <h1 className="text-white text-4xl font-black text-center mb-2 tracking-tighter uppercase">Señordle</h1>
          <p className="text-emerald-500/50 text-center text-[10px] font-black uppercase tracking-[0.3em] mb-10">
            {selectedDate === new Date().toLocaleDateString('en-CA') ? "Desafío Diario" : "Archivo Histórico"}
          </p>
          
          <Senordle
            key={`${selectedDate}-${course}`}
            gameId={`${course}-${selectedDate}`}
            targetWord={targetWord}
            validWords={validWords}
            onGameEnd={handleGameEnd}
          />
        </div>
      </div>
    </div>
  );
};

export default SenordlePage;