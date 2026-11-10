import React, { useState, useEffect, useMemo } from 'react';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../firebase';
import { getCachedCollection, getCachedDoc, invalidateDocCache, invalidateCollectionCache } from '../utils/firestoreCache';
import { ROOM_PODS, ROOM_GRID_STYLE, podById } from '../utils/seatingLayout';
import RoomChrome from './RoomChrome';

const displayName = (s) =>
  s?.firstName || s?.lastName ? `${s.firstName || ''} ${s.lastName || ''}`.trim() : (s?.email || '').split('@')[0];

// A one-time full-screen prompt for the student an admin just granted a seat
// pick to (see SeatingChartManager.jsx's "Dejar elegir mesa" button). They
// pick ONE table and up to `grant.allowedFriends` classmates to sit with
// them there; submitting moves all of them into that table and clears the
// grant so this never shows again for it.
export default function SeatPickPrompt({ grant, uid, course, section }) {
  const [chart, setChart] = useState(null);
  const [roster, setRoster] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedPodId, setSelectedPodId] = useState(null);
  const [selectedFriendIds, setSelectedFriendIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [chartData, users] = await Promise.all([
          getCachedDoc('seating_charts', grant.chartId),
          getCachedCollection('users', { force: true }),
        ]);
        setChart(chartData || { assignments: {} });
        setRoster(users.filter((u) => u.role === 'student' && !u.independent && u.course === course && u.section === section));
      } catch (err) {
        console.error('Error loading seating chart for seat pick:', err);
      } finally {
        setLoaded(true);
      }
    };
    load();
  }, [grant.chartId, course, section]);

  const assignments = chart?.assignments || {};
  const classmates = useMemo(
    () => roster.filter((s) => s.id !== uid).sort((a, b) => displayName(a).localeCompare(displayName(b))),
    [roster, uid]
  );

  const neededSeats = 1 + selectedFriendIds.length;
  const podOpenCount = (podId) => {
    const pod = podById(podId);
    const occupants = (assignments[podId] || []).filter((id) => id !== uid && !selectedFriendIds.includes(id));
    return pod.capacity - occupants.length;
  };

  const toggleFriend = (id) => {
    setSelectedFriendIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= grant.allowedFriends) return prev;
      return [...prev, id];
    });
  };

  const handleSubmit = async () => {
    if (!selectedPodId) return;
    if (podOpenCount(selectedPodId) < neededSeats) {
      setError('Esa mesa ya no tiene suficiente espacio — elige otra.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const movingIds = new Set([uid, ...selectedFriendIds]);
      const nextAssignments = Object.fromEntries(
        ROOM_PODS.map((pod) => [pod.id, (assignments[pod.id] || []).filter((id) => !movingIds.has(id))])
      );
      nextAssignments[selectedPodId] = [...nextAssignments[selectedPodId], ...movingIds];

      await updateDoc(doc(db, 'seating_charts', grant.chartId), { assignments: nextAssignments });
      invalidateDocCache('seating_charts', grant.chartId);
      await updateDoc(doc(db, 'users', uid), { seatPickGrant: deleteField() });
      invalidateCollectionCache('users');
    } catch (err) {
      console.error('Error saving seat pick:', err);
      setError('Hubo un error al guardar — intenta de nuevo.');
      setSaving(false);
    }
  };

  if (!loaded) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[300] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-amber-600 via-orange-600 to-rose-600 rounded-3xl shadow-2xl p-6 max-w-2xl w-full text-white">
        <p className="text-xs font-black uppercase tracking-widest text-white/70 mb-1">🌟 ¡Tú ganaste más puntos este mes!</p>
        <h2 className="text-2xl font-black mb-3">Elige tu mesa{grant.allowedFriends > 0 ? ' y a quién invitar' : ''}</h2>

        <div
          className="grid gap-2 bg-slate-950/40 rounded-2xl p-3"
          style={{ ...ROOM_GRID_STYLE, minHeight: 380 }}
        >
          <RoomChrome />
          {ROOM_PODS.map((pod) => {
            const open = podOpenCount(pod.id);
            const isSelected = selectedPodId === pod.id;
            const canSelect = open >= neededSeats;
            return (
              <button
                key={pod.id}
                type="button"
                disabled={!canSelect}
                onClick={() => setSelectedPodId(pod.id)}
                style={{ gridArea: pod.area }}
                className={`rounded-xl border-2 p-2 text-left transition-all ${
                  isSelected
                    ? 'bg-white text-slate-900 border-white'
                    : canSelect
                    ? 'bg-slate-900/60 border-slate-600 hover:border-white/60'
                    : 'bg-slate-900/30 border-slate-700 opacity-40 cursor-not-allowed'
                }`}
              >
                <p className="text-[10px] font-black uppercase tracking-widest">{pod.label}</p>
                <p className="text-[9px]">{open} lugar(es) libres</p>
              </button>
            );
          })}
        </div>

        {grant.allowedFriends > 0 && (
          <div className="mt-4">
            <p className="text-xs font-black uppercase tracking-widest text-white/80 mb-2">
              Invita hasta {grant.allowedFriends} compañero(s) ({selectedFriendIds.length}/{grant.allowedFriends})
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {classmates.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleFriend(s.id)}
                  disabled={!selectedFriendIds.includes(s.id) && selectedFriendIds.length >= grant.allowedFriends}
                  className={`text-[10px] px-2 py-1 rounded-full ${
                    selectedFriendIds.includes(s.id) ? 'bg-white text-slate-900' : 'bg-slate-900/50 text-white/80'
                  } disabled:opacity-30`}
                >
                  {displayName(s)}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-xs font-bold text-white bg-rose-900/60 rounded px-2 py-1 mt-3">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={!selectedPodId || saving}
          className="mt-4 w-full bg-white text-orange-700 font-black uppercase tracking-widest text-xs py-3 rounded-xl shadow-lg hover:bg-white/90 active:scale-95 transition-all disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Confirmar mesa 🎉'}
        </button>
      </div>
    </div>
  );
}
