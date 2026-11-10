import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  getCachedCollection,
  invalidateCollectionCache,
  getCachedDoc,
  invalidateDocCache,
} from '../../utils/firestoreCache';
import RoomChrome from '../../components/RoomChrome';
import { ROOM_PODS, FRONT_POD_IDS, ROOM_GRID_STYLE, chartIdFor, emptyAssignments, podById } from '../../utils/seatingLayout';

const displayName = (s) =>
  s?.firstName || s?.lastName ? `${s.firstName || ''} ${s.lastName || ''}`.trim() : (s?.email || '').split('@')[0];

export default function SeatingChartManager() {
  const [allUsers, setAllUsers] = useState([]);
  const [notesById, setNotesById] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedPairOverride, setSelectedPairOverride] = useState(null); // { course, section } once the user picks one
  const [assignments, setAssignments] = useState(emptyAssignments());
  const [status, setStatus] = useState('');
  const [editingNoteFor, setEditingNoteFor] = useState(null);
  const [addingToPod, setAddingToPod] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [users, notes] = await Promise.all([
          getCachedCollection('users', { force: true }),
          getCachedCollection('seating_notes'),
        ]);
        setAllUsers(users);
        setNotesById(Object.fromEntries(notes.map((n) => [n.id, n])));
      } catch (err) {
        console.error('Error loading roster for seating chart:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const students = useMemo(() => allUsers.filter((u) => u.role === 'student' && !u.independent), [allUsers]);

  const coursePairs = useMemo(() => {
    const set = new Set(students.filter((s) => s.course && s.section).map((s) => `${s.course}|${s.section}`));
    return [...set].sort().map((key) => {
      const [course, section] = key.split('|');
      return { course, section };
    });
  }, [students]);

  // Defaults to the first course/section once the roster loads, without a
  // setState-in-effect sync — the user's own pick (once made) always wins.
  const selectedPair = selectedPairOverride || coursePairs[0] || null;

  const chartId = selectedPair ? chartIdFor(selectedPair.course, selectedPair.section) : null;

  useEffect(() => {
    if (!chartId) return;
    let cancelled = false;
    getCachedDoc('seating_charts', chartId).then((data) => {
      if (!cancelled) setAssignments(data?.assignments || emptyAssignments());
    });
    return () => {
      cancelled = true;
    };
  }, [chartId]);

  const roster = useMemo(
    () => (selectedPair ? students.filter((s) => s.course === selectedPair.course && s.section === selectedPair.section) : []),
    [students, selectedPair]
  );

  const studentsById = useMemo(() => Object.fromEntries(roster.map((s) => [s.id, s])), [roster]);

  const assignedIdSet = useMemo(() => new Set(Object.values(assignments).flat()), [assignments]);
  const unassigned = useMemo(
    () => roster.filter((s) => !assignedIdSet.has(s.id)).sort((a, b) => displayName(a).localeCompare(displayName(b))),
    [roster, assignedIdSet]
  );

  const persist = async (next) => {
    setAssignments(next);
    try {
      await setDoc(doc(db, 'seating_charts', chartId), {
        course: selectedPair.course,
        section: selectedPair.section,
        assignments: next,
        updatedAt: new Date().toISOString(),
      });
      invalidateDocCache('seating_charts', chartId);
    } catch (err) {
      console.error('Error saving seating chart:', err);
      setStatus('❌ Error al guardar.');
    }
  };

  // Adds a student to a table — if they're already seated somewhere else,
  // this moves them (pulls them out of their old table first) so switching
  // two students' tables is a single pick per student instead of a
  // remove-then-re-add round trip.
  const moveToPod = async (podId, studentId) => {
    const pod = podById(podId);
    const withoutStudent = Object.fromEntries(
      Object.entries(assignments).map(([id, occupants]) => [id, occupants.filter((o) => o !== studentId)])
    );
    if ((withoutStudent[podId] || []).length >= pod.capacity) {
      setStatus(`❌ ${pod.label} ya está lleno.`);
      return;
    }
    await persist({ ...withoutStudent, [podId]: [...(withoutStudent[podId] || []), studentId] });
    setAddingToPod(null);
  };

  const removeFromPod = async (podId, studentId) => {
    await persist({ ...assignments, [podId]: (assignments[podId] || []).filter((id) => id !== studentId) });
  };

  const randomize = async () => {
    if (!window.confirm('¿Volver a mezclar todas las mesas? Esto reemplaza las asignaciones actuales.')) return;

    const next = emptyAssignments();
    const countsOf = (podId) => next[podId].length;
    const capacityOf = (podId) => podById(podId).capacity;
    const conflictsWith = (podId, studentId) => {
      const avoidIds = notesById[studentId]?.avoidIds || [];
      return next[podId].some(
        (occId) => avoidIds.includes(occId) || (notesById[occId]?.avoidIds || []).includes(studentId)
      );
    };
    const placeInBestPod = (studentId, preferredPodIds) => {
      const order = [...preferredPodIds, ...ROOM_PODS.map((p) => p.id).filter((id) => !preferredPodIds.includes(id))];
      const openOrder = order.filter((id) => countsOf(id) < capacityOf(id));
      if (openOrder.length === 0) return 'overflow';
      const noConflict = openOrder.find((id) => !conflictsWith(id, studentId));
      const podId = noConflict || openOrder[0];
      next[podId] = [...next[podId], studentId];
      return noConflict ? 'ok' : 'conflict';
    };

    const shuffled = roster.map((s) => s.id).sort(() => Math.random() - 0.5);
    const frontWanters = shuffled.filter((id) => notesById[id]?.preferFront);
    const rest = shuffled.filter((id) => !notesById[id]?.preferFront);

    let hadConflict = false;
    let hadOverflow = false;
    frontWanters.forEach((id) => {
      const result = placeInBestPod(id, FRONT_POD_IDS);
      if (result === 'conflict') hadConflict = true;
      if (result === 'overflow') hadOverflow = true;
    });
    rest.forEach((id) => {
      const byLoad = [...ROOM_PODS].sort((a, b) => countsOf(a.id) - countsOf(b.id)).map((p) => p.id);
      const result = placeInBestPod(id, byLoad);
      if (result === 'conflict') hadConflict = true;
      if (result === 'overflow') hadOverflow = true;
    });

    await persist(next);
    setStatus(
      hadOverflow
        ? '⚠️ Mezclado — hay más estudiantes que lugares en las mesas; algunos quedaron sin mesa.'
        : hadConflict
        ? '🎲 Mezclado — algunas restricciones de "evitar" no se pudieron respetar del todo.'
        : '🎲 Mezclado.'
    );
  };

  const saveNote = async (studentId, data) => {
    try {
      await setDoc(doc(db, 'seating_notes', studentId), data);
      invalidateCollectionCache('seating_notes');
      setNotesById((prev) => ({ ...prev, [studentId]: { id: studentId, ...data } }));
      setEditingNoteFor(null);
    } catch (err) {
      console.error('Error saving seating note:', err);
      setStatus('❌ Error al guardar la nota.');
    }
  };

  const topEarners = useMemo(
    () => [...roster].sort((a, b) => (b.monthly_points || 0) - (a.monthly_points || 0)).slice(0, 3),
    [roster]
  );

  const grantSeatPick = async (studentId) => {
    const student = studentsById[studentId];
    if (!window.confirm(`¿Darle a ${displayName(student)} la oportunidad de elegir su mesa (y traer hasta 2 amigos)?`)) return;
    try {
      await updateDoc(doc(db, 'users', studentId), {
        seatPickGrant: { chartId, allowedFriends: 2, grantedAt: new Date().toISOString() },
      });
      invalidateCollectionCache('users');
      setStatus(`✅ ${displayName(student)} verá la invitación la próxima vez que entre.`);
    } catch (err) {
      console.error('Error granting seat pick:', err);
      setStatus('❌ Error al enviar la invitación.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest">
        Cargando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <h2 className="text-2xl font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
            <span>🪑</span> Mapa de Asientos
          </h2>
          <Link to="/admin-daily-plan-hub" className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700">
            ← Hub
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedPair ? `${selectedPair.course}|${selectedPair.section}` : ''}
            onChange={(e) => {
              const [course, section] = e.target.value.split('|');
              setSelectedPairOverride({ course, section });
            }}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm font-bold"
          >
            {coursePairs.map((p) => (
              <option key={`${p.course}|${p.section}`} value={`${p.course}|${p.section}`}>
                {p.course} · {p.section}
              </option>
            ))}
          </select>

          <button
            onClick={randomize}
            disabled={!chartId}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black uppercase tracking-widest text-xs px-4 py-2.5 rounded-xl"
          >
            🎲 Mezclar
          </button>

          {status && <p className="text-xs font-bold text-amber-300">{status}</p>}
        </div>

        {topEarners.length > 0 && (
          <div className="bg-slate-900 border border-amber-700/40 rounded-xl p-4 flex flex-wrap items-center gap-4">
            <p className="text-xs font-black text-amber-400 uppercase tracking-widest">🌟 Más puntos este mes</p>
            {topEarners.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-1.5">
                <span className="text-xs font-bold text-white">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} {displayName(s)} — {s.monthly_points || 0} pts
                </span>
                {i === 0 && (
                  <button
                    onClick={() => grantSeatPick(s.id)}
                    className="text-[10px] font-black uppercase bg-amber-600 hover:bg-amber-500 text-white px-2 py-1 rounded"
                  >
                    Dejar elegir mesa
                  </button>
                )}
              </div>
            ))}
            <p className="text-[10px] text-slate-500 italic">
              (calculado en vivo con los puntos del mes actuales — no es un registro oficial)
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr,280px] gap-5">
          <div
            className="grid gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4"
            style={{ ...ROOM_GRID_STYLE, minHeight: 520 }}
          >
            <RoomChrome idLabel={selectedPair?.section} bannerText="" />
            {ROOM_PODS.map((pod) => {
              const occupantIds = assignments[pod.id] || [];
              return (
                <div
                  key={pod.id}
                  style={{ gridArea: pod.area }}
                  className="bg-slate-800 border-2 border-slate-700 rounded-xl p-2 flex flex-col"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">{pod.label}</span>
                    <span className="text-[9px] text-slate-500 font-bold">
                      {occupantIds.length}/{pod.capacity}
                    </span>
                  </div>
                  <div className="flex-1 space-y-1 overflow-y-auto">
                    {occupantIds.map((id) => (
                      <div key={id} className="flex justify-between items-center bg-slate-900/70 rounded px-1.5 py-0.5">
                        <span className="text-[11px] text-white truncate">
                          {displayName(studentsById[id])}
                          {notesById[id] && <span title={notesById[id].note || ''}> 📝</span>}
                        </span>
                        <button onClick={() => removeFromPod(pod.id, id)} className="text-rose-400 hover:text-rose-300 text-[10px] px-1">
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  {occupantIds.length < pod.capacity &&
                    (addingToPod === pod.id ? (
                      <select
                        autoFocus
                        defaultValue=""
                        onChange={(e) => e.target.value && moveToPod(pod.id, e.target.value)}
                        onBlur={() => setAddingToPod(null)}
                        className="mt-1 bg-slate-700 text-white text-[10px] rounded px-1 py-1"
                      >
                        <option value="" disabled>
                          + agregar / mover...
                        </option>
                        {roster
                          .filter((s) => !occupantIds.includes(s.id))
                          .sort((a, b) => displayName(a).localeCompare(displayName(b)))
                          .map((s) => {
                            const currentPodId = ROOM_PODS.find((p) => (assignments[p.id] || []).includes(s.id))?.id;
                            return (
                              <option key={s.id} value={s.id}>
                                {displayName(s)}
                                {currentPodId ? ` (en ${podById(currentPodId).label})` : ''}
                              </option>
                            );
                          })}
                      </select>
                    ) : (
                      <button
                        onClick={() => setAddingToPod(pod.id)}
                        className="mt-1 text-[10px] text-slate-500 hover:text-cyan-400 text-left"
                      >
                        + agregar
                      </button>
                    ))}
                </div>
              );
            })}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 max-h-[600px] overflow-y-auto">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Sin mesa ({unassigned.length})
            </p>
            {unassigned.map((s) => (
              <div key={s.id} className="text-xs text-slate-300 bg-slate-800 rounded px-2 py-1">
                {displayName(s)}
              </div>
            ))}

            <div className="border-t border-slate-800 pt-3">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Notas / Preferencias</p>
              {roster
                .slice()
                .sort((a, b) => displayName(a).localeCompare(displayName(b)))
                .map((s) => (
                  <div key={s.id} className="mb-2">
                    <button
                      onClick={() => setEditingNoteFor(editingNoteFor === s.id ? null : s.id)}
                      className="text-[11px] text-left w-full text-slate-300 hover:text-white flex justify-between"
                    >
                      <span>{displayName(s)}</span>
                      {notesById[s.id] && <span>📝</span>}
                    </button>
                    {editingNoteFor === s.id && (
                      <NoteEditor
                        student={s}
                        note={notesById[s.id]}
                        roster={roster}
                        onSave={(data) => saveNote(s.id, data)}
                        onCancel={() => setEditingNoteFor(null)}
                      />
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NoteEditor({ student, note, roster, onSave, onCancel }) {
  const [text, setText] = useState(note?.note || '');
  const [preferFront, setPreferFront] = useState(!!note?.preferFront);
  const [avoidIds, setAvoidIds] = useState(note?.avoidIds || []);

  const toggleAvoid = (id) => {
    setAvoidIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 mt-1 space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Nota (ej. pidió el frente de la clase)"
        rows={2}
        className="w-full bg-slate-900 border border-slate-700 text-white rounded px-2 py-1 text-[11px]"
      />
      <label className="flex items-center gap-1.5 text-[10px] text-slate-300">
        <input type="checkbox" checked={preferFront} onChange={(e) => setPreferFront(e.target.checked)} />
        Prefiere el frente de la clase
      </label>
      <div>
        <p className="text-[10px] text-slate-500 mb-1">Evitar sentarse con:</p>
        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
          {roster
            .filter((r) => r.id !== student.id)
            .map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => toggleAvoid(r.id)}
                className={`text-[9px] px-1.5 py-0.5 rounded ${
                  avoidIds.includes(r.id) ? 'bg-rose-700 text-white' : 'bg-slate-900 text-slate-400'
                }`}
              >
                {displayName(r)}
              </button>
            ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSave({ note: text.trim(), preferFront, avoidIds })}
          className="text-[10px] font-black uppercase bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded"
        >
          Guardar
        </button>
        <button onClick={onCancel} className="text-[10px] text-slate-500 hover:text-white px-2 py-1">
          Cancelar
        </button>
      </div>
    </div>
  );
}
