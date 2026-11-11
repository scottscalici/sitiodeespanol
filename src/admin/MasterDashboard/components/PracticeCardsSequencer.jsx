import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDocs, collection, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { invalidateCollectionCache } from '../../../utils/firestoreCache';

// Day-first companion to PracticeCardAdmin's own "Asignaciones Adicionales"
// panel (card-first: open a card, add occurrences to it). Here it's the
// other direction — pick a día/course, pick an existing card, pick its
// sections, save — matching the same día-by-día "Sequencer" pattern
// ReadingCardsSequencer/TareasSequencer already use for their own content
// types. Both write to the exact same place (a card's own `dia`/`course`
// fields for its one implicit occurrence, or its `assignments` array for
// anything beyond that), so either tool can edit what the other created.
const slug = () => `asg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const distinctSectionsOf = (card) => {
  const out = [];
  (card.questions || []).forEach((q) => {
    const s = (q.section || '').trim();
    if (s && !out.includes(s)) out.push(s);
  });
  return out;
};

export default function PracticeCardsSequencer() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [courseTab, setCourseTab] = useState('s2');

  // Quick-add form state
  const [newDia, setNewDia] = useState('');
  const [cardSearch, setCardSearch] = useState('');
  const [selectedCardId, setSelectedCardId] = useState('');
  const [selectedSections, setSelectedSections] = useState(null); // null = whole card
  const [adding, setAdding] = useState(false);
  const [addStatus, setAddStatus] = useState('');

  const [removingKey, setRemovingKey] = useState(null);

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const snap = await getDocs(collection(db, 'practice_cards'));
        setCards(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Error loading practice cards:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCards();
  }, []);

  if (loading) {
    return <div className="text-white text-center p-10 font-bold animate-pulse uppercase tracking-widest">Cargando tarjetas de práctica...</div>;
  }

  const q = cardSearch.trim().toLowerCase();
  const matchingCards = (
    q ? cards.filter((c) => (c.title || '').toLowerCase().includes(q) || (c.topic || '').toLowerCase().includes(q)) : cards
  ).sort((a, b) => (a.title || '').localeCompare(b.title || ''));

  const selectedCard = cards.find((c) => c.id === selectedCardId) || null;
  const selectedCardSections = selectedCard ? distinctSectionsOf(selectedCard) : [];

  const toggleNewSection = (section) => {
    setSelectedSections((prev) => {
      const current = prev ?? selectedCardSections;
      const next = current.includes(section) ? current.filter((s) => s !== section) : [...current, section];
      return next.length === selectedCardSections.length ? null : next;
    });
  };

  const resetAddForm = () => {
    setNewDia('');
    setCardSearch('');
    setSelectedCardId('');
    setSelectedSections(null);
  };

  const handleAdd = async () => {
    if (!selectedCard || newDia === '' || Number.isNaN(Number(newDia))) {
      setAddStatus('❌ Elige una tarjeta y un día válido.');
      return;
    }
    setAdding(true);
    setAddStatus('');
    try {
      const newAssignment = { id: slug(), course: courseTab, dia: Number(newDia), sections: selectedSections };
      const updatedAssignments = [...(selectedCard.assignments || []), newAssignment];
      await updateDoc(doc(db, 'practice_cards', selectedCard.id), { assignments: updatedAssignments });
      invalidateCollectionCache('practice_cards');
      setCards((prev) => prev.map((c) => (c.id === selectedCard.id ? { ...c, assignments: updatedAssignments } : c)));
      setAddStatus(`✅ Agregada — ${selectedCard.title} en ${courseTab.toUpperCase()} Día ${newDia}.`);
      resetAddForm();
    } catch (err) {
      console.error('Error adding practice card assignment:', err);
      setAddStatus(`❌ Error: ${err.message}`);
    } finally {
      setAdding(false);
    }
  };

  // Every occurrence across every card — the card's own legacy dia/course
  // (if set) counts as one, plus one per entry in its assignments array —
  // same expansion PracticeCardEngine/warmupBreakdown use, just shaped for
  // display/removal here instead of grading.
  const occurrences = [];
  cards.forEach((card) => {
    if (card.dia != null) {
      occurrences.push({ key: card.id, cardId: card.id, cardTitle: card.title, course: card.course, dia: card.dia, sections: null, assignmentId: null });
    }
    (card.assignments || []).forEach((a) => {
      occurrences.push({ key: `${card.id}__${a.id}`, cardId: card.id, cardTitle: card.title, course: a.course, dia: a.dia, sections: a.sections ?? null, assignmentId: a.id });
    });
  });
  const visibleOccurrences = occurrences.filter((o) => o.course === courseTab).sort((a, b) => (a.dia || 0) - (b.dia || 0));

  const conflictCounts = {};
  visibleOccurrences.forEach((o) => {
    conflictCounts[o.dia] = (conflictCounts[o.dia] || 0) + 1;
  });

  const handleRemove = async (occ) => {
    if (!window.confirm(`¿Quitar "${occ.cardTitle}" del día ${occ.dia}?`)) return;
    setRemovingKey(occ.key);
    try {
      const card = cards.find((c) => c.id === occ.cardId);
      if (!card) return;
      if (occ.assignmentId == null) {
        await updateDoc(doc(db, 'practice_cards', occ.cardId), { dia: null });
        setCards((prev) => prev.map((c) => (c.id === occ.cardId ? { ...c, dia: null } : c)));
      } else {
        const updatedAssignments = (card.assignments || []).filter((a) => a.id !== occ.assignmentId);
        await updateDoc(doc(db, 'practice_cards', occ.cardId), { assignments: updatedAssignments });
        setCards((prev) => prev.map((c) => (c.id === occ.cardId ? { ...c, assignments: updatedAssignments } : c)));
      }
      invalidateCollectionCache('practice_cards');
    } catch (err) {
      console.error('Error removing practice card assignment:', err);
      alert(`Error al quitar: ${err.message}`);
    } finally {
      setRemovingKey(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 text-white font-sans">
      <div className="flex justify-between items-start mb-6">
        <h2 className="text-2xl font-black uppercase tracking-widest text-emerald-400 flex items-center gap-3">
          <span>🗓️</span> Practice Cards Sequencer
        </h2>
        <Link to="/admin-secret-portal-practice-cards" className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700">
          ← Creador
        </Link>
      </div>

      <div className="flex gap-1.5 mb-6">
        {['s2', 's4'].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCourseTab(c)}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest border ${
              courseTab === c ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            {c.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 mb-6 space-y-3">
        <h3 className="font-bold text-white text-sm">+ Agregar asignación</h3>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            value={newDia}
            onChange={(e) => setNewDia(e.target.value)}
            placeholder="Día"
            className="w-24 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-center text-sm font-black"
          />
          <input
            type="text"
            value={cardSearch}
            onChange={(e) => {
              setCardSearch(e.target.value);
              setSelectedCardId('');
            }}
            placeholder="Buscar tarjeta por título o tema..."
            className="flex-1 min-w-[220px] bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm"
          />
        </div>

        {cardSearch.trim() && (
          <select
            value={selectedCardId}
            onChange={(e) => {
              setSelectedCardId(e.target.value);
              setSelectedSections(null);
            }}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs"
          >
            <option value="">
              {matchingCards.length === 0 ? 'Sin resultados...' : `Elige una tarjeta (${matchingCards.length})...`}
            </option>
            {matchingCards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
                {c.topic ? ` — ${c.topic}` : ''} ({c.questions?.length || 0} preguntas)
              </option>
            ))}
          </select>
        )}

        {selectedCard && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            {selectedCardSections.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Esta tarjeta no tiene secciones etiquetadas — se asignará completa.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedCardSections.map((s) => {
                  const checked = selectedSections == null || selectedSections.includes(s);
                  return (
                    <label key={s} className="flex items-center gap-1.5 text-xs font-bold text-slate-200 cursor-pointer bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700">
                      <input type="checkbox" checked={checked} onChange={() => toggleNewSection(s)} className="rounded text-emerald-500" />
                      <span>{s}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding || !selectedCard}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-lg disabled:opacity-50"
          >
            {adding ? 'Guardando...' : 'Guardar'}
          </button>
          {addStatus && <span className="text-xs font-bold text-slate-300">{addStatus}</span>}
        </div>
      </div>

      <h3 className="font-bold text-white text-sm mb-3">Horario {courseTab.toUpperCase()}</h3>
      {visibleOccurrences.length === 0 ? (
        <p className="text-sm text-slate-500 italic text-center py-10">Ninguna tarjeta asignada todavía para {courseTab.toUpperCase()}.</p>
      ) : (
        <div className="space-y-2">
          {visibleOccurrences.map((occ) => (
            <div key={occ.key} className="bg-slate-900 border border-slate-700 rounded-xl p-3 flex flex-wrap items-center gap-3">
              <span className="font-black text-emerald-400 text-sm w-20 shrink-0">Día {occ.dia}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-white text-sm truncate">{occ.cardTitle}</p>
                <p className="text-[10px] text-slate-500 font-mono">
                  {occ.sections ? `Secciones: ${occ.sections.join(', ')}` : 'Tarjeta completa'}
                </p>
              </div>
              {conflictCounts[occ.dia] > 1 && (
                <span className="text-[10px] font-bold text-amber-400" title="Más de una asignación este día">
                  ⚠️ {conflictCounts[occ.dia]} este día
                </span>
              )}
              <button
                type="button"
                onClick={() => handleRemove(occ)}
                disabled={removingKey === occ.key}
                className="p-1.5 text-rose-400 hover:text-rose-300 font-bold text-sm disabled:opacity-50"
                title="Quitar esta asignación"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
