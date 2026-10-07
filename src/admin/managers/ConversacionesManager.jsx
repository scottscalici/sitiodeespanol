import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import ImageUploadField from '../shared/ImageUploadField';
import ConversacionContentModal from './ConversacionContentModal';

const MAX_DAYS = 80;

const emptyConversacion = (prefill = {}) => ({
  id: `new_${Date.now()}`,
  titulo: '',
  subtitulo: '',
  imagen: '',
  tag: '',
  courses: [],
  dias: [],
  ...prefill,
});

// A small "type a day, press Enter, it becomes a removable chip" input —
// there's no existing precedent for multi-day assignment nicer than a
// comma-separated text field anywhere else in this app, so this is new.
const DiaChipsInput = ({ dias, calendarMap, onChange }) => {
  const [draft, setDraft] = useState('');

  const addDia = () => {
    const num = parseInt(draft, 10);
    if (!isNaN(num) && num > 0 && !dias.includes(num)) {
      onChange([...dias, num].sort((a, b) => a - b));
    }
    setDraft('');
  };

  const removeDia = (num) => onChange(dias.filter((d) => d !== num));

  return (
    <div className="flex flex-wrap items-center gap-1">
      {dias.map((d) => {
        const dates = calendarMap[d] || [];
        return (
          <span
            key={d}
            title={dates.join(' & ') || 'Fecha por confirmar'}
            className="inline-flex items-center gap-1 bg-teal-50 border border-teal-200 text-teal-700 text-[10px] font-black rounded-full pl-2 pr-1 py-0.5"
          >
            Día {d}
            <button type="button" onClick={() => removeDia(d)} className="text-teal-400 hover:text-teal-700 leading-none">
              ×
            </button>
          </span>
        );
      })}
      <input
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addDia();
          }
        }}
        onBlur={addDia}
        placeholder="+ día"
        className="w-14 bg-white border border-slate-200 rounded-md p-1 text-center text-[10px] font-bold outline-none focus:ring-1 focus:ring-teal-500"
      />
    </div>
  );
};

const CourseCheckboxes = ({ courses, onToggle }) => (
  <div className="flex flex-col gap-1">
    {[{ key: 's2', label: 'S2' }, { key: 's4', label: 'S4' }].map(({ key, label }) => (
      <label key={key} className="flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={courses.includes(key)}
          onChange={() => onToggle(key)}
          className="accent-teal-600 w-3.5 h-3.5"
        />
        <span className="text-[10px] font-black text-slate-500">{label}</span>
      </label>
    ))}
  </div>
);

const ConversacionRow = ({ item, calendarMap, onChange, onCourseToggle, onDiasChange, onOpenContent, onRemove }) => (
  <div className="grid grid-cols-[2fr_2fr_2.5fr_1fr_1.6fr_auto_auto] gap-3 p-3 items-center border-b border-slate-100 hover:bg-slate-50 transition-colors">
    <input
      type="text"
      value={item.titulo || ''}
      onChange={(e) => onChange(item.id, 'titulo', e.target.value)}
      placeholder="Título"
      className="w-full bg-white border border-slate-200 rounded-md p-2 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-teal-500"
    />
    <input
      type="text"
      value={item.subtitulo || ''}
      onChange={(e) => onChange(item.id, 'subtitulo', e.target.value)}
      placeholder="Subtítulo / Tema"
      className="w-full bg-white border border-slate-200 rounded-md p-2 text-xs text-slate-600 outline-none focus:ring-1 focus:ring-teal-500"
    />
    <div className="flex items-center gap-2">
      <div className="shrink-0 w-10 h-10 bg-slate-100 rounded-md overflow-hidden border border-slate-200 flex items-center justify-center">
        {item.imagen ? (
          <img
            src={item.imagen}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        ) : (
          <span className="text-[8px] font-black text-slate-400">N/A</span>
        )}
      </div>
      <ImageUploadField
        value={item.imagen}
        onChange={(url) => onChange(item.id, 'imagen', url)}
        folder="conversaciones"
        inputClassName="w-full bg-white border border-slate-200 rounded-md p-1.5 text-[10px] font-mono outline-none focus:ring-1 focus:ring-teal-500"
      />
    </div>
    <CourseCheckboxes courses={item.courses || []} onToggle={(key) => onCourseToggle(item.id, key)} />
    <DiaChipsInput dias={item.dias || []} calendarMap={calendarMap} onChange={(dias) => onDiasChange(item.id, dias)} />
    <button
      type="button"
      onClick={() => onOpenContent(item)}
      className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg px-2 py-1.5 border border-indigo-200 transition-colors whitespace-nowrap"
      title="Editar escenario, preguntas, contenido extendido..."
    >
      ✏️ Contenido
    </button>
    <button
      type="button"
      onClick={() => onRemove(item)}
      className="text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg px-2 py-1.5 border border-rose-200 transition-colors"
    >
      🗑️
    </button>
  </div>
);

export default function ConversacionesManager() {
  const [items, setItems] = useState([]);
  const [calendarMap, setCalendarMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [course, setCourse] = useState('s2');
  const [selectedDay, setSelectedDay] = useState(1);
  const [contentModalItem, setContentModalItem] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const configSnap = await getDoc(doc(db, 'config', 'academic_year_2026_2027'));
        const mapping = {};
        if (configSnap.exists()) {
          (configSnap.data().map || []).forEach((entry) => {
            if (entry.dia === null || entry.dia === undefined) return;
            const dayNum = Number(entry.dia);
            if (!mapping[dayNum]) mapping[dayNum] = [];
            let formatted = entry.fecha;
            if (entry.fecha && entry.fecha.includes('-')) {
              const parts = entry.fecha.split('-');
              if (parts.length === 3) formatted = `${parts[1]}/${parts[2]}`;
            }
            mapping[dayNum].push(`${formatted}${entry.ciclo ? ` (${entry.ciclo})` : ''}`);
          });
        }
        setCalendarMap(mapping);

        const snap = await getDocs(collection(db, 'conversaciones'));
        const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        fetched.sort((a, b) => (Math.min(...(a.dias?.length ? a.dias : [999])) - Math.min(...(b.dias?.length ? b.dias : [999]))));
        setItems(fetched);
      } catch (err) {
        console.error('Error loading conversaciones:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const updateItem = (id, patch) => setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const handleInputChange = (id, field, value) => updateItem(id, { [field]: value });

  const handleCourseToggle = (id, key) =>
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const current = item.courses || [];
        const next = current.includes(key) ? current.filter((c) => c !== key) : [...current, key];
        return { ...item, courses: next };
      })
    );

  const handleDiasChange = (id, dias) => updateItem(id, { dias });

  const handleAddNew = (prefillToday) => {
    const prefill = prefillToday ? { dias: [selectedDay], courses: [course] } : {};
    setItems((prev) => [emptyConversacion(prefill), ...prev]);
  };

  const handleRemove = (item) => {
    if (!window.confirm(`¿Quitar "${item.titulo || 'esta conversación'}"? Esto no se guarda hasta hacer clic en "Guardar Cambios".`)) return;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  // Grid-level batch save — same shape as VideosManager/CuriosidadesManager:
  // every row's simple fields (título, imagen, courses, días, etc.) commit
  // together, new rows (temp "new_" id) get a real auto-generated doc.
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      const idUpdates = [];
      items.forEach((item) => {
        const { id, ...data } = item;
        if (id.startsWith('new_')) {
          const ref = doc(collection(db, 'conversaciones'));
          batch.set(ref, data);
          idUpdates.push([id, ref.id]);
        } else {
          batch.set(doc(db, 'conversaciones', id), data, { merge: true });
        }
      });
      await batch.commit();
      if (idUpdates.length > 0) {
        setItems((prev) =>
          prev.map((item) => {
            const found = idUpdates.find(([oldId]) => oldId === item.id);
            return found ? { ...item, id: found[1] } : item;
          })
        );
      }
      alert('¡Conversaciones guardadas exitosamente!');
    } catch (err) {
      console.error('Error saving conversaciones:', err);
      alert('Error al guardar.');
    } finally {
      setIsSaving(false);
    }
  };

  // The content modal writes immediately (same posture as Curiosidad's
  // question modal) rather than waiting for the grid's batch save — a new,
  // not-yet-created row gets created here too, since opening the rich
  // content editor on it is a perfectly normal first step.
  const handleSaveContent = async (fullItem) => {
    const { id, ...data } = fullItem;
    if (id.startsWith('new_')) {
      const ref = doc(collection(db, 'conversaciones'));
      await setDoc(ref, data);
      setItems((prev) => prev.map((item) => (item.id === id ? { ...fullItem, id: ref.id } : item)));
    } else {
      await setDoc(doc(db, 'conversaciones', id), data, { merge: true });
      setItems((prev) => prev.map((item) => (item.id === id ? fullItem : item)));
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-400 font-bold uppercase tracking-widest animate-pulse">Cargando Conversaciones...</div>;
  }

  const todaysItems = items.filter((item) => (item.courses || []).includes(course) && (item.dias || []).includes(selectedDay));

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8 font-sans">
      <div className="max-w-[1400px] mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center z-10 shadow-sm gap-4">
          <div>
            <Link to="/admin-daily-plan-hub" className="text-slate-400 hover:text-slate-700 text-xs font-bold">← Hub</Link>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight mt-1">🗣️ Conversación Manager</h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
              <button onClick={() => setCourse('s2')} className={`px-4 py-2 text-xs font-black uppercase ${course === 's2' ? 'bg-teal-600 text-white' : 'text-slate-500'}`}>S2</button>
              <button onClick={() => setCourse('s4')} className={`px-4 py-2 text-xs font-black uppercase ${course === 's4' ? 'bg-teal-600 text-white' : 'text-slate-500'}`}>S4</button>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1">
              <button onClick={() => setSelectedDay((d) => Math.max(1, d - 1))} className="w-6 h-6 bg-white rounded font-bold text-slate-600 text-xs">-</button>
              <select value={selectedDay} onChange={(e) => setSelectedDay(Number(e.target.value))} className="text-xs font-black bg-transparent outline-none">
                {Array.from({ length: MAX_DAYS }, (_, i) => i + 1).map((d) => <option key={d} value={d}>Día {d}</option>)}
              </select>
              <button onClick={() => setSelectedDay((d) => Math.min(MAX_DAYS, d + 1))} className="w-6 h-6 bg-white rounded font-bold text-slate-600 text-xs">+</button>
            </div>
            <button onClick={() => handleAddNew(true)} className="bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 px-4 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px]">
              + Para Hoy
            </button>
            <button onClick={() => handleAddNew(false)} className="bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px]">
              + Nueva
            </button>
            <button onClick={handleSave} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs disabled:opacity-50">
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>

        {/* Today's conversaciones — the "plan for today" surface */}
        <div className="p-4 bg-teal-50/50 border-b-2 border-teal-100">
          <h2 className="text-xs font-black uppercase tracking-widest text-teal-700 mb-2">
            Hoy — Día {selectedDay} ({course.toUpperCase()}) · {todaysItems.length}
          </h2>
          {todaysItems.length === 0 ? (
            <p className="text-xs italic text-teal-900/50 font-bold px-3">Sin conversación asignada para hoy todavía.</p>
          ) : (
            <div className="bg-white rounded-lg border border-teal-100 overflow-hidden">
              {todaysItems.map((item) => (
                <ConversacionRow
                  key={item.id}
                  item={item}
                  calendarMap={calendarMap}
                  onChange={handleInputChange}
                  onCourseToggle={handleCourseToggle}
                  onDiasChange={handleDiasChange}
                  onOpenContent={setContentModalItem}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          )}
        </div>

        {/* Every conversación, for managing other days */}
        <div>
          <div className="grid grid-cols-[2fr_2fr_2.5fr_1fr_1.6fr_auto_auto] gap-3 p-3 bg-slate-100 border-b border-slate-200 font-black text-[10px] uppercase tracking-widest text-slate-500">
            <div>Título</div>
            <div>Subtítulo</div>
            <div>Imagen</div>
            <div>Cursos</div>
            <div>Días</div>
            <div>Contenido</div>
            <div>Quitar</div>
          </div>
          {items.map((item) => (
            <ConversacionRow
              key={item.id}
              item={item}
              calendarMap={calendarMap}
              onChange={handleInputChange}
              onCourseToggle={handleCourseToggle}
              onDiasChange={handleDiasChange}
              onOpenContent={setContentModalItem}
              onRemove={handleRemove}
            />
          ))}
        </div>
      </div>

      {contentModalItem && (
        <ConversacionContentModal
          conversacion={contentModalItem}
          onClose={() => setContentModalItem(null)}
          onSave={handleSaveContent}
        />
      )}
    </div>
  );
}
