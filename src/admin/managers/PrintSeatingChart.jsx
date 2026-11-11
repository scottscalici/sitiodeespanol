import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getCachedCollection } from '../../utils/firestoreCache';
import RoomChrome from '../../components/RoomChrome';
import { ROOM_PODS, ROOM_GRID_STYLE } from '../../utils/seatingLayout';
import { getDisplayName as displayName } from '../../utils/studentDisplay';

export default function PrintSeatingChart() {
  const { chartId } = useParams();
  const [chart, setChart] = useState(null);
  const [studentsById, setStudentsById] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [chartSnap, users] = await Promise.all([getDoc(doc(db, 'seating_charts', chartId)), getCachedCollection('users')]);
        setChart(chartSnap.exists() ? chartSnap.data() : null);
        setStudentsById(Object.fromEntries(users.map((u) => [u.id, u])));
      } catch (err) {
        console.error('Error loading seating chart for print:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [chartId]);

  if (loading) return <div className="p-10 font-bold text-black bg-white min-h-screen">Cargando...</div>;
  if (!chart) return <div className="p-10 font-bold text-red-600 bg-white min-h-screen">Mapa de asientos no encontrado.</div>;

  const assignments = chart.assignments || {};

  return (
    <div className="min-h-screen bg-white text-black p-8 print:p-4">
      <div className="print:hidden fixed top-6 right-6 flex gap-3 bg-slate-100 p-3 rounded-xl shadow-lg border border-slate-300 z-50">
        <button
          onClick={() => window.print()}
          className="bg-sky-600 hover:bg-sky-700 text-white px-5 py-2 rounded-lg font-black text-xs uppercase tracking-widest"
        >
          🖨️ Imprimir
        </button>
      </div>

      <h1 className="text-xl font-black uppercase tracking-widest mb-4">
        Mapa de Asientos — {chart.course} · {chart.section}
      </h1>

      <div className="grid gap-3" style={{ ...ROOM_GRID_STYLE, minHeight: 600 }}>
        <RoomChrome idLabel={chart.section} printMode />
        {ROOM_PODS.map((pod) => {
          const occupantIds = assignments[pod.id] || [];
          return (
            <div key={pod.id} style={{ gridArea: pod.area }} className="border-2 border-black p-2 flex flex-col">
              <p className="text-[11px] font-black uppercase tracking-wide text-center border-b border-black pb-1 mb-1">
                {pod.label}
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
                {occupantIds.map((id) => (
                  <p key={id}>{displayName(studentsById[id])}</p>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
