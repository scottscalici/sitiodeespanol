import React, { useState, useEffect, useMemo } from 'react';
import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Link } from 'react-router-dom';

const todayStr = () => new Date().toLocaleDateString('en-CA');

const EXAMPLE = `Falsos amigos: embarazada, éxito, sensible, actualmente
Sinónimos de "feliz": contento, alegre, dichoso, jubiloso
Palabras con "ñ": niño, año, español, mañana
Verbos irregulares: ser, ir, tener, hacer`;

const parseCategories = (text) => {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) return { title: line, items: [] };
      const title = line.slice(0, colonIndex).trim();
      const items = line
        .slice(colonIndex + 1)
        .split(',')
        .map((w) => w.trim())
        .filter(Boolean);
      return { title, items };
    });
};

// Calendar-day arithmetic on a plain "YYYY-MM-DD" string (the same shape
// <input type="date"> and toLocaleDateString('en-CA') both use) — built from
// y/m/d parts via the LOCAL Date constructor so this never drifts a day from
// UTC/timezone parsing surprises, since we only ever care about the calendar
// date, never a real instant in time.
const addDays = (dateStr, days) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return dt.toLocaleDateString('en-CA');
};

// Bulk import: one puzzle (4 categories) is assigned to each date starting
// at `startDate`, walking forward a day at a time and skipping any date
// already in `occupiedDates` — so pasting over a day that already has a
// puzzle shifts everything after it forward instead of overwriting. Returns
// the list actually assigned, each annotated with any dates skipped
// immediately before it, so the preview can show exactly what happened.
const assignDatesSkippingOccupied = (startDate, count, occupiedDates) => {
  const assigned = [];
  let cursor = startDate;
  while (assigned.length < count) {
    const skipped = [];
    while (occupiedDates.has(cursor)) {
      skipped.push(cursor);
      cursor = addDays(cursor, 1);
    }
    assigned.push({ date: cursor, skipped });
    cursor = addDays(cursor, 1);
  }
  return assigned;
};

export default function FormAtandoCabos() {
  const [course, setCourse] = useState('s2');
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [categoriesText, setCategoriesText] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  // SCHEDULE PREVIEW — same idea as Señordle's "Calendario Programado", so
  // it's just as easy to check whether a puzzle already exists for a given
  // day here as it is there.
  const [scheduleItems, setScheduleItems] = useState(null);
  const [scheduleCourse, setScheduleCourse] = useState('s2');
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const loadSchedule = async () => {
    setScheduleLoading(true);
    try {
      const snap = await getDocs(collection(db, 'juego_atandocabos'));
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
      setScheduleItems(items);
    } catch (error) {
      console.error('Error loading Atando Cabos schedule:', error);
    } finally {
      setScheduleLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule();
  }, []);

  const scheduleForCourse = useMemo(
    () => (scheduleItems || []).filter((item) => item.course === scheduleCourse),
    [scheduleItems, scheduleCourse]
  );
  const todayScheduled = scheduleForCourse.some((item) => item.fecha === todayStr());

  const parsedCategories = useMemo(() => parseCategories(categoriesText), [categoriesText]);

  // Bulk import: every 4 categories is one puzzle. 4 total = today's single-
  // puzzle behavior, unchanged. More than 4 (and a multiple of 4) switches
  // into bulk mode — one puzzle per group, dates assigned starting at the
  // selected date and walking forward, skipping any date this course
  // already has a puzzle for.
  const puzzleGroups = useMemo(() => {
    const groups = [];
    for (let i = 0; i < parsedCategories.length; i += 4) {
      groups.push(parsedCategories.slice(i, i + 4));
    }
    return groups;
  }, [parsedCategories]);
  const isBulk = puzzleGroups.length > 1;
  const hasIncompleteGroup = parsedCategories.length % 4 !== 0;

  const occupiedDatesForCourse = useMemo(
    () => new Set((scheduleItems || []).filter((item) => item.course === course).map((item) => item.fecha)),
    [scheduleItems, course]
  );

  const assignedPuzzles = useMemo(() => {
    if (puzzleGroups.length === 0 || hasIncompleteGroup) return [];
    const assignments = assignDatesSkippingOccupied(date, puzzleGroups.length, occupiedDatesForCourse);
    return puzzleGroups.map((categories, i) => ({ categories, ...assignments[i] }));
  }, [puzzleGroups, hasIncompleteGroup, date, occupiedDatesForCourse]);

  const handleSave = async (e) => {
    e.preventDefault();

    if (parsedCategories.length === 0) {
      setStatus('❌ Pega al menos 4 categorías (un puzzle completo).');
      return;
    }
    if (hasIncompleteGroup) {
      setStatus(`❌ El total de líneas debe ser múltiplo de 4 — una categoría por línea, 4 por puzzle (tienes ${parsedCategories.length}).`);
      return;
    }
    const badCategory = parsedCategories.find((c) => c.items.length !== 4);
    if (badCategory) {
      setStatus(`❌ "${badCategory.title || '(sin título)'}" tiene ${badCategory.items.length} palabras — necesita exactamente 4.`);
      return;
    }

    setSaving(true);
    setStatus('');
    try {
      for (const puzzle of assignedPuzzles) {
        const docId = `ac-${course}-${puzzle.date}`;
        await setDoc(doc(db, 'juego_atandocabos', docId), {
          id: docId,
          course,
          fecha: puzzle.date,
          categories: puzzle.categories,
          createdAt: new Date().toISOString(),
        });
      }
      setStatus(
        isBulk
          ? `✅ ¡Éxito! ${assignedPuzzles.length} puzzles programados para ${course.toUpperCase()} (${assignedPuzzles[0].date} → ${assignedPuzzles[assignedPuzzles.length - 1].date}).`
          : `✅ ¡Éxito! Puzzle programado para ${course.toUpperCase()} el ${assignedPuzzles[0].date}.`
      );
      setCategoriesText('');
      await loadSchedule();
    } catch (error) {
      console.error('Error saving Atando Cabos puzzle:', error);
      setStatus('❌ Error al guardar en Firebase.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-start justify-center p-4 sm:p-8">
      <div className="max-w-2xl w-full bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
            <span>🧶</span> Creador de Atando Cabos
          </h2>
          <Link to="/admin-daily-plan-hub" className="text-slate-400 hover:text-white text-xs font-bold border border-slate-700 px-3 py-1.5 rounded-lg">
            ← Hub
          </Link>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex gap-4">
            <label className="flex-1 cursor-pointer">
              <input type="radio" name="course" value="s2" checked={course === 's2'} onChange={(e) => setCourse(e.target.value)} className="peer sr-only" />
              <div className="text-center py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 font-bold peer-checked:bg-fuchsia-600 peer-checked:text-white peer-checked:border-fuchsia-500 transition-all uppercase tracking-widest text-xs">S2</div>
            </label>
            <label className="flex-1 cursor-pointer">
              <input type="radio" name="course" value="s4" checked={course === 's4'} onChange={(e) => setCourse(e.target.value)} className="peer sr-only" />
              <div className="text-center py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 font-bold peer-checked:bg-fuchsia-600 peer-checked:text-white peer-checked:border-fuchsia-500 transition-all uppercase tracking-widest text-xs">S4</div>
            </label>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
              {isBulk ? 'Fecha de Inicio (Lote)' : 'Fecha Programada'}
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-3 font-mono focus:outline-none focus:border-fuchsia-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
              Categorías (una por línea: Título: palabra1, palabra2, palabra3, palabra4)
            </label>
            <p className="text-[10px] text-slate-500 mb-1">
              4 líneas = un puzzle en la fecha de arriba. Pega más (múltiplo de 4) para importar varios días seguidos —
              cada 4 líneas es el siguiente puzzle, empezando en esa fecha. Si un día ya tiene puzzle, se salta automáticamente.
            </p>
            <textarea
              value={categoriesText}
              onChange={(e) => setCategoriesText(e.target.value)}
              placeholder={EXAMPLE}
              rows={isBulk ? 14 : 6}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-3 font-mono text-sm focus:outline-none focus:border-fuchsia-500 transition-colors"
            />
          </div>

          {categoriesText.trim() && !isBulk && (
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 space-y-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Vista Previa</p>
              {parsedCategories.map((cat, i) => (
                <div key={i} className={`text-xs flex flex-wrap gap-2 items-center ${cat.items.length === 4 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  <span className="font-bold">{cat.title || '(sin título)'}:</span>
                  <span>{cat.items.join(', ') || '(sin palabras)'}</span>
                  <span className="text-slate-500">({cat.items.length}/4)</span>
                </div>
              ))}
            </div>
          )}

          {categoriesText.trim() && isBulk && (
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 space-y-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Vista Previa — {assignedPuzzles.length} Puzzles
              </p>
              {assignedPuzzles.map((puzzle, i) => (
                <div key={i} className="border-t border-slate-800 first:border-t-0 first:pt-0 pt-3 space-y-1">
                  {puzzle.skipped.length > 0 && (
                    <p className="text-[10px] font-bold text-amber-400">
                      ⏭️ Se {puzzle.skipped.length === 1 ? 'omitió' : 'omitieron'} {puzzle.skipped.join(', ')} — ya {puzzle.skipped.length === 1 ? 'tiene' : 'tienen'} puzzle.
                    </p>
                  )}
                  <p className="text-xs font-black text-fuchsia-400">Puzzle {i + 1} → {puzzle.date}</p>
                  {puzzle.categories.map((cat, j) => (
                    <div key={j} className={`text-xs flex flex-wrap gap-2 items-center pl-3 ${cat.items.length === 4 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      <span className="font-bold">{cat.title || '(sin título)'}:</span>
                      <span>{cat.items.join(', ') || '(sin palabras)'}</span>
                      <span className="text-slate-500">({cat.items.length}/4)</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {categoriesText.trim() && hasIncompleteGroup && (
            <p className="text-xs font-bold text-rose-400">
              ❌ El total de líneas debe ser múltiplo de 4 (tienes {parsedCategories.length}).
            </p>
          )}

          {status && (
            <p className={`text-xs font-bold text-center ${status.includes('❌') ? 'text-rose-400' : 'text-emerald-400'}`}>{status}</p>
          )}

          <button
            type="submit"
            disabled={saving || hasIncompleteGroup}
            className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 text-white font-black uppercase tracking-widest py-3 rounded-lg transition-colors shadow-lg"
          >
            {saving ? 'Guardando...' : isBulk ? `Guardar ${puzzleGroups.length} Puzzles` : 'Guardar Puzzle'}
          </button>
        </form>

        {/* SCHEDULE PREVIEW — always on, so you can check whether a puzzle
            is already scheduled for a given day before/after saving. */}
        <div className="mt-8 pt-6 border-t border-slate-700">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-black text-fuchsia-400 uppercase tracking-widest">
              📅 Calendario Programado
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
                {['s2', 's4'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setScheduleCourse(c)}
                    className={`px-3 py-1.5 text-xs font-black uppercase ${
                      scheduleCourse === c ? 'bg-fuchsia-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={loadSchedule}
                disabled={scheduleLoading}
                className="text-xs font-bold text-slate-400 hover:text-white disabled:opacity-50"
              >
                {scheduleLoading ? 'Cargando...' : '🔄 Actualizar'}
              </button>
            </div>
          </div>

          {!todayScheduled && scheduleItems && (
            <p className="text-xs font-bold text-rose-400 bg-rose-950/40 border border-rose-800 rounded-lg px-3 py-2 mb-3">
              ⚠️ No hay puzzle programado para hoy ({todayStr()}, {scheduleCourse.toUpperCase()}).
            </p>
          )}

          <div className="max-h-64 overflow-y-auto bg-slate-900 border border-slate-700 rounded-lg divide-y divide-slate-700/60">
            {scheduleForCourse.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3">
                {scheduleItems ? `Sin puzzles programados para ${scheduleCourse.toUpperCase()}.` : 'Cargando...'}
              </p>
            ) : (
              scheduleForCourse.map((item) => (
                <div
                  key={item.id}
                  className={`flex justify-between items-center px-3 py-1.5 text-xs ${
                    item.fecha === todayStr() ? 'bg-fuchsia-950/50' : ''
                  }`}
                >
                  <span className={`font-mono ${item.fecha === todayStr() ? 'text-fuchsia-300 font-bold' : 'text-slate-400'}`}>
                    {item.fecha} {item.fecha === todayStr() ? '(Hoy)' : ''}
                  </span>
                  <span className="font-bold text-white truncate max-w-[60%] text-right">
                    {(item.categories || []).map((c) => c.title).filter(Boolean).join(', ') || '(sin categorías)'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
