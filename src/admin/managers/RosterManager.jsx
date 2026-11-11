import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getCachedCollection, invalidateCollectionCache } from '../../utils/firestoreCache';
import { getDisplayName } from '../../utils/studentDisplay';

// Deliberately shows EVERY student doc, regardless of course/section/
// independent status — every other roster in this app (Gradebook, Seating
// Chart, leaderboards) filters by course+section, so a student with a
// mismatched or missing one (e.g. picked course s2 with section 4A at
// signup, or the "I'm not in one of Sr. Scalici's classes" checkbox
// ticked by mistake) is invisible everywhere else. This is the one place
// to find and fix that without going into Firestore directly.
// Deliberately NOT keyed by course — this tool exists to fix a student
// whose course and section don't match each other, so restricting the
// section options to whatever the (possibly wrong) course currently says
// would make the actual mismatch impossible to correct in one step.
const ALL_SECTIONS = ['1B', '4A', '4B'];

export default function RosterManager() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const load = async () => {
    try {
      const users = await getCachedCollection('users', { force: true });
      setStudents(users.filter((u) => u.role === 'student'));
    } catch (err) {
      console.error('Error loading roster:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? students.filter(
          (s) =>
            getDisplayName(s).toLowerCase().includes(q) ||
            (s.email || '').toLowerCase().includes(q) ||
            (s.course || '').toLowerCase().includes(q) ||
            (s.section || '').toLowerCase().includes(q)
        )
      : students;
    return [...list].sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)));
  }, [students, search]);

  const updateField = async (studentId, field, value) => {
    try {
      await updateDoc(doc(db, 'users', studentId), { [field]: value });
      invalidateCollectionCache('users');
      setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, [field]: value } : s)));
      setStatus('✅ Guardado.');
    } catch (err) {
      console.error(`Error updating ${field}:`, err);
      setStatus(`❌ Error al guardar.`);
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
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <h2 className="text-2xl font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
            <span>🗂️</span> Roster
          </h2>
          <Link to="/admin-daily-plan-hub" className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700">
            ← Hub
          </Link>
        </div>

        <p className="text-xs text-slate-500">
          Todos los estudiantes, sin importar curso/sección — útil para encontrar a alguien que se registró con un
          curso/sección que no combinan, o que marcó "no estoy en una de las clases" por error.
        </p>

        <div className="flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo..."
            className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
          />
          {status && <p className="text-xs font-bold text-amber-300 shrink-0">{status}</p>}
        </div>

        <div className="space-y-2">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center gap-3 bg-slate-900 border border-slate-700 rounded-lg p-3"
            >
              <div className="flex-1 min-w-[160px]">
                <p className="text-white font-bold text-sm">{getDisplayName(s)}</p>
                <p className="text-slate-500 text-[10px] font-mono">{s.email}</p>
              </div>

              <select
                value={s.course || ''}
                onChange={(e) => updateField(s.id, 'course', e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white rounded-md px-2 py-1.5 text-xs"
              >
                <option value="">— curso —</option>
                <option value="s2">s2</option>
                <option value="s4">s4</option>
              </select>

              <select
                value={s.section || ''}
                onChange={(e) => updateField(s.id, 'section', e.target.value || null)}
                className="bg-slate-800 border border-slate-700 text-white rounded-md px-2 py-1.5 text-xs"
              >
                <option value="">— sección —</option>
                {ALL_SECTIONS.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                <input
                  type="checkbox"
                  checked={!!s.independent}
                  onChange={(e) => updateField(s.id, 'independent', e.target.checked)}
                />
                Independiente
              </label>

              <input
                type="text"
                defaultValue={s.preferredName || ''}
                placeholder="Nombre preferido"
                onBlur={(e) => {
                  if (e.target.value !== (s.preferredName || '')) updateField(s.id, 'preferredName', e.target.value.trim());
                }}
                className="w-40 bg-slate-800 border border-slate-700 text-white rounded-md px-2 py-1.5 text-xs"
              />
            </div>
          ))}
          {filtered.length === 0 && <p className="text-slate-500 text-sm italic">Sin resultados.</p>}
        </div>
      </div>
    </div>
  );
}
