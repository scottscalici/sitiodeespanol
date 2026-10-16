import React, { useState, useEffect, useMemo } from 'react';
import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Link } from 'react-router-dom';

const todayStr = () => new Date().toLocaleDateString('en-CA');

const EXAMPLE = `PAN
PANADERO
PANADERÍA
CERCANÍA
CERCA`;

const parseChain = (text) =>
  text
    .split('\n')
    .map((w) => w.trim().toUpperCase())
    .filter(Boolean);

export default function FormEslabones() {
  const [course, setCourse] = useState('s2');
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [chainText, setChainText] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  // SCHEDULE PREVIEW — same idea as Señordle's "Calendario Programado", so
  // it's just as easy to check whether a chain already exists for a given
  // day here as it is there.
  const [scheduleItems, setScheduleItems] = useState(null);
  const [scheduleCourse, setScheduleCourse] = useState('s2');
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const loadSchedule = async () => {
    setScheduleLoading(true);
    try {
      const snap = await getDocs(collection(db, 'juego_eslabones'));
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
      setScheduleItems(items);
    } catch (error) {
      console.error('Error loading Eslabones schedule:', error);
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

  const parsedChain = parseChain(chainText);

  const handleSave = async (e) => {
    e.preventDefault();

    if (parsedChain.length < 2) {
      setStatus('❌ La cadena necesita al menos 2 palabras.');
      return;
    }

    const docId = `es-${course}-${date}`;
    setSaving(true);
    setStatus('');
    try {
      await setDoc(doc(db, 'juego_eslabones', docId), {
        id: docId,
        course,
        fecha: date,
        chain: parsedChain,
        createdAt: new Date().toISOString(),
      });
      setStatus(`✅ ¡Éxito! Cadena programada para ${course.toUpperCase()} el ${date}.`);
      setChainText('');
      await loadSchedule();
    } catch (error) {
      console.error('Error saving Eslabones chain:', error);
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
            <span>🔗</span> Creador de Eslabones
          </h2>
          <Link to="/admin-daily-plan-hub" className="text-slate-400 hover:text-white text-xs font-bold border border-slate-700 px-3 py-1.5 rounded-lg">
            ← Hub
          </Link>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex gap-4">
            <label className="flex-1 cursor-pointer">
              <input type="radio" name="course" value="s2" checked={course === 's2'} onChange={(e) => setCourse(e.target.value)} className="peer sr-only" />
              <div className="text-center py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 font-bold peer-checked:bg-cyan-600 peer-checked:text-white peer-checked:border-cyan-500 transition-all uppercase tracking-widest text-xs">S2</div>
            </label>
            <label className="flex-1 cursor-pointer">
              <input type="radio" name="course" value="s4" checked={course === 's4'} onChange={(e) => setCourse(e.target.value)} className="peer sr-only" />
              <div className="text-center py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 font-bold peer-checked:bg-cyan-600 peer-checked:text-white peer-checked:border-cyan-500 transition-all uppercase tracking-widest text-xs">S4</div>
            </label>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Fecha Programada</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-3 font-mono focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
              Cadena de Palabras (una por línea, en orden)
            </label>
            <textarea
              value={chainText}
              onChange={(e) => setChainText(e.target.value)}
              placeholder={EXAMPLE}
              rows={6}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-3 font-mono text-sm uppercase focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {chainText.trim() && (
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Vista Previa ({parsedChain.length} palabras)</p>
              <div className="flex flex-wrap gap-2">
                {parsedChain.map((word, i) => (
                  <span key={i} className="text-xs font-bold text-cyan-400 bg-slate-950 border border-slate-700 px-2 py-1 rounded">
                    {i + 1}. {word}
                  </span>
                ))}
              </div>
            </div>
          )}

          {status && (
            <p className={`text-xs font-bold text-center ${status.includes('❌') ? 'text-rose-400' : 'text-emerald-400'}`}>{status}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-black uppercase tracking-widest py-3 rounded-lg transition-colors shadow-lg"
          >
            {saving ? 'Guardando...' : 'Guardar Cadena'}
          </button>
        </form>

        {/* SCHEDULE PREVIEW — always on, so you can check whether a chain
            is already scheduled for a given day before/after saving. */}
        <div className="mt-8 pt-6 border-t border-slate-700">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-black text-cyan-400 uppercase tracking-widest">
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
                      scheduleCourse === c ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
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
              ⚠️ No hay cadena programada para hoy ({todayStr()}, {scheduleCourse.toUpperCase()}).
            </p>
          )}

          <div className="max-h-64 overflow-y-auto bg-slate-900 border border-slate-700 rounded-lg divide-y divide-slate-700/60">
            {scheduleForCourse.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3">
                {scheduleItems ? `Sin cadenas programadas para ${scheduleCourse.toUpperCase()}.` : 'Cargando...'}
              </p>
            ) : (
              scheduleForCourse.map((item) => {
                const chain = item.chain || [];
                return (
                  <div
                    key={item.id}
                    className={`flex justify-between items-center px-3 py-1.5 text-xs ${
                      item.fecha === todayStr() ? 'bg-cyan-950/50' : ''
                    }`}
                  >
                    <span className={`font-mono ${item.fecha === todayStr() ? 'text-cyan-300 font-bold' : 'text-slate-400'}`}>
                      {item.fecha} {item.fecha === todayStr() ? '(Hoy)' : ''}
                    </span>
                    <span className="font-bold text-white truncate max-w-[60%] text-right">
                      {chain.length > 0 ? `${chain[0]} → ${chain[chain.length - 1]} (${chain.length})` : '(sin palabras)'}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
