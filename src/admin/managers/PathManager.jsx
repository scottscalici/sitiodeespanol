import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getCachedCollection, getCachedDoc, invalidateCollectionCache } from '../../utils/firestoreCache';
import { TEXTBOOK_ORDER } from '../../utils/textbookAccess';

// One combined, sortable/filterable list over BOTH learning_paths (graded
// Dominio pods) and practice_pods (ungated Práctica circles) — these two
// collections have grown numerous enough across both that the only way to
// find or clean one up used to be FormLearningPath's own "Load Path"
// dropdown: a single unsorted <select> with no search, no filter, and no
// delete at all.
//
// Older practice_pods docs (ones CircleGeneratorModal.jsx writes directly)
// never got textbook/chapter fields — only FormLearningPath's own save and
// ChapterLearningPathImporter.jsx set those — so both columns render "—"
// for a circle that simply never had them, rather than assuming they exist.
// Grammar/verb paths never get a textbook/chapter at all (nothing ever sets
// one for them) — Libro/Cap. is editable inline here for exactly that case:
// assigning a book+chapter is purely for ordering/categorizing, it doesn't
// have to mean "this is actually from that vocab chapter."
export default function PathManager() {
  const [rows, setRows] = useState([]);
  const [tareasData, setTareasData] = useState({});
  const [reassessmentConfigs, setReassessmentConfigs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'updated_at', dir: 'desc' });
  // 'table': the original flat, fully-sortable list. 'grouped': rows with
  // the exact same title collapse onto one card with separate S2/S4
  // sub-columns — built for the common case of the same lesson existing as
  // a path and/or circle once per course, so they're not scattered across
  // unrelated rows of the flat list.
  const [viewMode, setViewMode] = useState('table');

  // Inline Libro/Cap. editor — one row editable at a time, keyed by
  // "<_type>_<path_id>" (same key the table/cards already use).
  const [editingKey, setEditingKey] = useState(null);
  const [editDraft, setEditDraft] = useState({ textbook: '', chapter: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [learningPaths, circles, tareasDoc, configs] = await Promise.all([
        getCachedCollection('learning_paths'),
        getCachedCollection('practice_pods'),
        getCachedDoc('curriculum_tracks', 'tareas_master'),
        getCachedCollection('reassessment_configs'),
      ]);
      setRows([
        ...learningPaths.map((p) => ({ ...p, _type: 'learning_path' })),
        ...circles.map((p) => ({ ...p, _type: 'circle' })),
      ]);
      setTareasData(tareasDoc || {});
      setReassessmentConfigs(configs || []);
    } catch (err) {
      console.error('Error loading paths/circles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // A learning_paths doc is "referenced" when some course's Dominio tarea
  // list still points at its path_id — deleting it would leave that
  // gradebook column with nothing behind it. A practice_pods (circle) doc
  // is "referenced" when any of its pods has a live reassessment_configs
  // doc (circleId is "<pathId>__<podId>") — deleting it breaks that
  // recuperación. Either way this is shown as a warning, never a hard
  // block — the teacher may still want to delete it, just with eyes open.
  const isReferenced = (row) => {
    if (row._type === 'learning_path') {
      const allTasks = [...(tareasData.s2 || []), ...(tareasData.s4 || [])];
      return allTasks.some((t) => t.path_id === row.path_id);
    }
    return reassessmentConfigs.some((c) => c.circleId?.startsWith(`${row.path_id}__`));
  };

  const rowKey = (row) => `${row._type}_${row.path_id}`;

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== 'all' && r._type !== typeFilter) return false;
      if (courseFilter !== 'all' && r.course !== courseFilter) return false;
      if (term && !`${r.title || ''} ${r.path_id || ''}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [rows, search, courseFilter, typeFilter]);

  const sortedRows = useMemo(() => {
    const { key, dir } = sortConfig;
    const mult = dir === 'asc' ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      const av = a[key] ?? '';
      const bv = b[key] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mult;
      return String(av).localeCompare(String(bv)) * mult;
    });
  }, [filteredRows, sortConfig]);

  // Grouped view: every row sharing an exact title lands on one card, split
  // into an S2 column and an S4 column (a course that isn't s2/s4, or
  // missing entirely, falls into "Otro" so nothing silently disappears).
  // More than one row in the SAME course+title (e.g. a Ruta and a Círculo
  // both named "Subjuntivo...") just stack within that course's column
  // instead of needing a 1:1 slot — each keeps its own type badge.
  const titleGroups = useMemo(() => {
    const map = new Map();
    sortedRows.forEach((row) => {
      const key = row.title || '(Sin título)';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    });
    return Array.from(map.entries()).map(([title, groupRows]) => ({
      title,
      s2: groupRows.filter((r) => r.course === 's2'),
      s4: groupRows.filter((r) => r.course === 's4'),
      other: groupRows.filter((r) => r.course !== 's2' && r.course !== 's4'),
      latestUpdate: Math.max(0, ...groupRows.map((r) => (r.updated_at ? new Date(r.updated_at).getTime() : 0))),
    })).sort((a, b) => b.latestUpdate - a.latestUpdate);
  }, [sortedRows]);

  const toggleSort = (key) => {
    setSortConfig((prev) => (
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    ));
  };

  const sortArrow = (key) => (sortConfig.key === key ? (sortConfig.dir === 'asc' ? ' ▲' : ' ▼') : '');

  const handleDelete = async (row) => {
    const collectionName = row._type === 'learning_path' ? 'learning_paths' : 'practice_pods';
    const warning = isReferenced(row)
      ? row._type === 'learning_path'
        ? '\n\n⚠️ Esta ruta está asignada actualmente como una Tarea de Dominio — eliminarla deja esa columna del gradebook sin datos.'
        : '\n\n⚠️ Este círculo tiene una recuperación configurada — eliminarlo rompe esa reevaluación.'
      : '';
    if (!window.confirm(`¿Eliminar "${row.title || row.path_id}" (${row.path_id})? Esto no se puede deshacer.${warning}`)) return;
    try {
      await deleteDoc(doc(db, collectionName, row.path_id));
      invalidateCollectionCache(collectionName);
      setRows((prev) => prev.filter((r) => !(r.path_id === row.path_id && r._type === row._type)));
    } catch (err) {
      console.error('Error deleting path/circle:', err);
      alert('❌ Error al eliminar. Revisa la consola.');
    }
  };

  const startEdit = (row) => {
    setEditingKey(rowKey(row));
    setEditDraft({ textbook: row.textbook || '', chapter: row.chapter || '' });
  };
  const cancelEdit = () => setEditingKey(null);

  const saveEdit = async (row) => {
    const collectionName = row._type === 'learning_path' ? 'learning_paths' : 'practice_pods';
    try {
      await updateDoc(doc(db, collectionName, row.path_id), { textbook: editDraft.textbook, chapter: editDraft.chapter });
      invalidateCollectionCache(collectionName);
      setRows((prev) => prev.map((r) => (
        r.path_id === row.path_id && r._type === row._type
          ? { ...r, textbook: editDraft.textbook, chapter: editDraft.chapter }
          : r
      )));
      setEditingKey(null);
    } catch (err) {
      console.error('Error updating textbook/chapter:', err);
      alert('❌ Error al guardar. Revisa la consola.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest">
        Cargando...
      </div>
    );
  }

  const headerCell = (label, key) => (
    <th
      onClick={() => toggleSort(key)}
      className="p-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400 cursor-pointer hover:text-white select-none whitespace-nowrap"
    >
      {label}{sortArrow(key)}
    </th>
  );

  const typeBadge = (row) => (
    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${row._type === 'learning_path' ? 'bg-indigo-900/50 text-indigo-300' : 'bg-emerald-900/50 text-emerald-300'}`}>
      {row._type === 'learning_path' ? 'Ruta' : 'Círculo'}
    </span>
  );

  const actionButtons = (row) => (
    <div className="flex gap-2">
      <Link
        to={`${row._type === 'learning_path' ? '/admin-secret-portal-learning-path' : '/admin-secret-portal-practice-hub'}?path=${encodeURIComponent(row.path_id)}`}
        className="text-[10px] font-black uppercase bg-sky-900/40 hover:bg-sky-700 text-sky-300 hover:text-white border border-sky-700/50 px-2.5 py-1.5 rounded-lg transition-all"
      >
        ✏️ Abrir
      </Link>
      <button
        onClick={() => handleDelete(row)}
        className="text-[10px] font-black uppercase bg-rose-900/40 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-700/50 px-2.5 py-1.5 rounded-lg transition-all"
      >
        🗑️ Eliminar
      </button>
    </div>
  );

  // Libro select + the editing chrome (✓/✕) that lives in the Cap. cell —
  // shared by both the table's two <td>s and the grouped view's one-line
  // version, so the edit flow behaves identically either way.
  const bookSelect = (
    <select
      value={editDraft.textbook}
      onChange={(e) => setEditDraft((d) => ({ ...d, textbook: e.target.value }))}
      className="bg-slate-950 border border-slate-600 text-white rounded px-1.5 py-1 text-[11px] max-w-[110px]"
    >
      <option value="">Sin libro</option>
      {TEXTBOOK_ORDER.map((t) => <option key={t} value={t}>{t}</option>)}
    </select>
  );
  const chapterInputWithControls = (row) => (
    <div className="flex items-center gap-1">
      <input
        type="text"
        value={editDraft.chapter}
        onChange={(e) => setEditDraft((d) => ({ ...d, chapter: e.target.value }))}
        placeholder="Cap."
        className="w-12 bg-slate-950 border border-slate-600 text-white rounded px-1.5 py-1 text-[11px]"
      />
      <button onClick={() => saveEdit(row)} title="Guardar" className="text-emerald-400 hover:text-emerald-300 text-sm">✓</button>
      <button onClick={cancelEdit} title="Cancelar" className="text-slate-500 hover:text-slate-300 text-sm">✕</button>
    </div>
  );

  // One compact line for the grouped view's S2/S4 sub-columns — same info
  // as a table row, stacked instead of in fixed-width cells.
  const renderGroupedRow = (row) => {
    const editing = editingKey === rowKey(row);
    return (
      <div key={rowKey(row)} className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          {typeBadge(row)}
          {isReferenced(row) && (
            <span title="Referenciado en vivo — ver advertencia al eliminar" className="text-amber-400">⚠️</span>
          )}
        </div>
        <p className="text-slate-400 font-mono text-[11px] truncate" title={row.path_id}>{row.path_id}</p>
        {editing ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {bookSelect}
            {chapterInputWithControls(row)}
          </div>
        ) : (
          <button
            onClick={() => startEdit(row)}
            title="Clic para asignar libro/capítulo"
            className="text-left text-xs text-slate-300 hover:text-sky-400 transition-colors"
          >
            {row.textbook || <span className="italic text-slate-600">sin libro</span>}
            {row.chapter ? ` · Cap. ${row.chapter}` : ''}
          </button>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-slate-500">
            {row.total_pods ?? (row.pods?.length || 0)} pods · {row.updated_at ? new Date(row.updated_at).toLocaleDateString() : '—'}
          </span>
          {actionButtons(row)}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
            <span>🗂️</span> Gestor de Rutas y Círculos
          </h2>
          <div className="flex items-center gap-2">
            <Link
              to="/admin-secret-portal-circle-field-backfill"
              className="bg-amber-700 hover:bg-amber-600 text-white border border-amber-600 px-3 py-1.5 rounded-lg text-xs font-bold"
            >
              🔧 Reparar Textbook/Capítulo
            </Link>
            <Link
              to="/admin-daily-plan-hub"
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold"
            >
              ← Volver
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 bg-slate-800 border border-slate-700 rounded-xl p-4">
          <input
            type="text"
            placeholder="Buscar por título o Path ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs font-bold"
          >
            <option value="all">Todos los tipos</option>
            <option value="learning_path">Solo Rutas de Aprendizaje</option>
            <option value="circle">Solo Círculos de Práctica</option>
          </select>
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs font-bold"
          >
            <option value="all">Todos los cursos</option>
            <option value="s2">S2</option>
            <option value="s4">S4</option>
          </select>
          <div className="flex bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-2 text-xs font-black uppercase ${viewMode === 'table' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Tabla
            </button>
            <button
              onClick={() => setViewMode('grouped')}
              className={`px-3 py-2 text-xs font-black uppercase ${viewMode === 'grouped' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Agrupado (S2/S4)
            </button>
          </div>
          <span className="text-xs text-slate-500 font-bold self-center">
            {sortedRows.length} de {rows.length}
          </span>
        </div>

        {viewMode === 'table' ? (
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/60 border-b border-slate-700">
                <tr>
                  {headerCell('Tipo', '_type')}
                  {headerCell('Título', 'title')}
                  {headerCell('Path ID', 'path_id')}
                  {headerCell('Curso', 'course')}
                  {headerCell('Libro', 'textbook')}
                  {headerCell('Cap.', 'chapter')}
                  {headerCell('Pods', 'total_pods')}
                  {headerCell('Actualizado', 'updated_at')}
                  <th className="p-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {sortedRows.map((row) => {
                  const editing = editingKey === rowKey(row);
                  return (
                    <tr key={rowKey(row)} className="hover:bg-slate-900/40">
                      <td className="p-3 whitespace-nowrap">{typeBadge(row)}</td>
                      <td className="p-3 text-white font-semibold">
                        {row.title || <span className="italic text-slate-500">Sin título</span>}
                        {isReferenced(row) && (
                          <span title="Referenciado en vivo — ver advertencia al eliminar" className="ml-1.5 text-amber-400">⚠️</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-400 font-mono text-xs">{row.path_id}</td>
                      <td className="p-3 text-slate-300 uppercase text-xs font-bold">{row.course || '—'}</td>
                      <td className="p-3 text-slate-300 text-xs">
                        {editing ? bookSelect : (
                          <button onClick={() => startEdit(row)} className="hover:text-sky-400 transition-colors" title="Clic para asignar libro/capítulo">
                            {row.textbook || <span className="italic text-slate-600">sin libro</span>}
                          </button>
                        )}
                      </td>
                      <td className="p-3 text-slate-300 text-xs">
                        {editing ? chapterInputWithControls(row) : (
                          <button onClick={() => startEdit(row)} className="hover:text-sky-400 transition-colors" title="Clic para asignar libro/capítulo">
                            {row.chapter || '—'}
                          </button>
                        )}
                      </td>
                      <td className="p-3 text-slate-300 text-xs">{row.total_pods ?? (row.pods?.length || 0)}</td>
                      <td className="p-3 text-slate-500 text-xs whitespace-nowrap">
                        {row.updated_at ? new Date(row.updated_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="p-3">{actionButtons(row)}</td>
                    </tr>
                  );
                })}
                {sortedRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-slate-500 italic">Nada coincide con este filtro.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-3">
            {titleGroups.map((g) => (
              <div key={g.title} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <h3 className="text-white font-bold mb-3">{g.title}</h3>
                <div className={`grid gap-4 ${g.other.length > 0 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-500 mb-2">S2</p>
                    <div className="space-y-2">
                      {g.s2.length === 0 ? <p className="text-xs text-slate-600 italic">—</p> : g.s2.map(renderGroupedRow)}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-500 mb-2">S4</p>
                    <div className="space-y-2">
                      {g.s4.length === 0 ? <p className="text-xs text-slate-600 italic">—</p> : g.s4.map(renderGroupedRow)}
                    </div>
                  </div>
                  {g.other.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-500 mb-2">Otro</p>
                      <div className="space-y-2">{g.other.map(renderGroupedRow)}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {titleGroups.length === 0 && (
              <p className="text-center text-slate-500 italic py-6">Nada coincide con este filtro.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
