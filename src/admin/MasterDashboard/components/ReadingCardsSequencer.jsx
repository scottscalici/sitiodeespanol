import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { invalidateCollectionCache } from '../../../utils/firestoreCache';

// Assigns an existing reading_cards document to a día/course (or clears it
// back to the 📦 banco) — unlike LecturasSequencer, there's no separate
// day→ids schedule doc to maintain: a reading card carries its own `dia`
// field directly, same as Practice Cards, so this just edits that field in
// place on each card rather than a master schedule document.
const ReadingCardsSequencer = () => {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [statusById, setStatusById] = useState({});

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const snap = await getDocs(collection(db, 'reading_cards'));
        setCards(
          snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.title || '').localeCompare(b.title || ''))
        );
      } catch (err) {
        console.error('Error loading reading cards:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCards();
  }, []);

  const updateLocal = (id, patch) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const handleSave = async (card) => {
    setSavingId(card.id);
    setStatusById((prev) => ({ ...prev, [card.id]: '' }));
    try {
      await updateDoc(doc(db, 'reading_cards', card.id), {
        course: card.course,
        dia: card.dia === '' || card.dia === null ? null : Number(card.dia),
      });
      invalidateCollectionCache('reading_cards');
      setStatusById((prev) => ({ ...prev, [card.id]: '✅ Guardado' }));
    } catch (err) {
      console.error('Error saving reading card assignment:', err);
      setStatusById((prev) => ({ ...prev, [card.id]: '❌ Error al guardar' }));
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <div className="text-white text-center p-10 font-bold animate-pulse uppercase tracking-widest">Cargando lecturas...</div>;
  }

  const q = filterText.trim().toLowerCase();
  const filteredCards = q ? cards.filter((c) => (c.title || '').toLowerCase().includes(q) || c.id.toLowerCase().includes(q)) : cards;

  // Group by course+día for a quick "what's assigned where" glance, same
  // spirit as LecturasSequencer's preview panel — a day with more than one
  // reading for the same course is worth flagging, since (unlike the old
  // Lecturas system) only one reading_cards doc is resolved per course+día
  // by the student-facing route.
  const assignedByCourseDay = {};
  cards.forEach((c) => {
    if (c.dia === null || c.dia === undefined) return;
    const key = `${c.course}:${c.dia}`;
    if (!assignedByCourseDay[key]) assignedByCourseDay[key] = [];
    assignedByCourseDay[key].push(c);
  });

  return (
    <div className="max-w-6xl mx-auto p-6 text-white font-sans">
      <div className="flex justify-between items-start mb-6">
        <h2 className="text-2xl font-black uppercase tracking-widest text-cyan-400 flex items-center gap-3">
          <span>📖</span> Lecturas Sequencer
        </h2>
        <Link to="/admin-reading-cards-upload" className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700">
          + Importar nuevas
        </Link>
      </div>

      <input
        type="text"
        value={filterText}
        onChange={(e) => setFilterText(e.target.value)}
        placeholder="Buscar por título..."
        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white mb-4 outline-none focus:border-cyan-500"
      />

      <div className="space-y-3">
        {cards.length === 0 ? (
          <p className="text-sm text-slate-500 italic text-center py-10">No hay lecturas creadas todavía — impórtalas primero.</p>
        ) : filteredCards.length === 0 ? (
          <p className="text-sm text-slate-500 italic text-center py-10">Sin resultados para "{filterText}".</p>
        ) : (
          filteredCards.map((card) => {
            const conflictKey = card.dia !== null && card.dia !== undefined ? `${card.course}:${card.dia}` : null;
            const hasConflict = conflictKey && assignedByCourseDay[conflictKey]?.length > 1;
            return (
              <div key={card.id} className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-white text-sm truncate">{card.title}</h3>
                  <p className="text-[10px] text-slate-500 font-mono">{card.id} · {card.questions?.length || 0} preguntas</p>
                </div>

                <div className="flex gap-1.5">
                  {['s2', 's4'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateLocal(card.id, { course: c })}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                        card.course === c ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      {c.toUpperCase()}
                    </button>
                  ))}
                </div>

                <input
                  type="number"
                  min="1"
                  max="80"
                  value={card.dia ?? ''}
                  onChange={(e) => updateLocal(card.id, { dia: e.target.value })}
                  placeholder="📦 banco"
                  className="w-24 bg-slate-800 border border-slate-700 rounded-lg p-2 text-center text-sm font-black focus:outline-none focus:border-cyan-500"
                />

                <button
                  type="button"
                  onClick={() => handleSave(card)}
                  disabled={savingId === card.id}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg disabled:opacity-50"
                >
                  {savingId === card.id ? '...' : 'Guardar'}
                </button>

                {statusById[card.id] && <span className="text-[10px] font-bold text-slate-400">{statusById[card.id]}</span>}
                {hasConflict && (
                  <span className="text-[10px] font-bold text-amber-400" title="Más de una lectura en este curso/día — solo una se abre desde el enlace por día.">
                    ⚠️ Conflicto con otra lectura en {card.course.toUpperCase()} Día {card.dia}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ReadingCardsSequencer;
