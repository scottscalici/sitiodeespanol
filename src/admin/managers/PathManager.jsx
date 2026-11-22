import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getCachedCollection, getCachedDoc, invalidateCollectionCache } from '../../utils/firestoreCache';

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
export default function PathManager() {
  const [rows, setRows] = useState([]);
  const [tareasData, setTareasData] = useState({});
  const [reassessmentConfigs, setReassessmentConfigs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'updated_at', dir: 'desc' });

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
          <span className="text-xs text-slate-500 font-bold self-center">
            {sortedRows.length} de {rows.length}
          </span>
        </div>

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
              {sortedRows.map((row) => (
                <tr key={`${row._type}_${row.path_id}`} className="hover:bg-slate-900/40">
                  <td className="p-3 whitespace-nowrap">
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${row._type === 'learning_path' ? 'bg-indigo-900/50 text-indigo-300' : 'bg-emerald-900/50 text-emerald-300'}`}>
                      {row._type === 'learning_path' ? 'Ruta' : 'Círculo'}
                    </span>
                  </td>
                  <td className="p-3 text-white font-semibold">
                    {row.title || <span className="italic text-slate-500">Sin título</span>}
                    {isReferenced(row) && (
                      <span title="Referenciado en vivo — ver advertencia al eliminar" className="ml-1.5 text-amber-400">⚠️</span>
                    )}
                  </td>
                  <td className="p-3 text-slate-400 font-mono text-xs">{row.path_id}</td>
                  <td className="p-3 text-slate-300 uppercase text-xs font-bold">{row.course || '—'}</td>
                  <td className="p-3 text-slate-300 text-xs">{row.textbook || '—'}</td>
                  <td className="p-3 text-slate-300 text-xs">{row.chapter || '—'}</td>
                  <td className="p-3 text-slate-300 text-xs">{row.total_pods ?? (row.pods?.length || 0)}</td>
                  <td className="p-3 text-slate-500 text-xs whitespace-nowrap">
                    {row.updated_at ? new Date(row.updated_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <Link
                        to={row._type === 'learning_path' ? '/admin-secret-portal-learning-path' : '/admin-secret-portal-practice-hub'}
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
                  </td>
                </tr>
              ))}
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-slate-500 italic">Nada coincide con este filtro.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
