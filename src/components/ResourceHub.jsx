import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function ResourceHub({ course = 's2' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResources = async () => {
      try {
        const docRef = doc(db, 'config', 'resource_hub');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setResources(docSnap.data().items || []);
        }
      } catch (err) {
        console.error("Error fetching resources:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchResources();
  }, []);

  // Safe course string extraction
  let courseStr = 's2';
  if (typeof course === 'string') {
    courseStr = course;
  } else if (course && typeof course === 'object') {
    courseStr = course.course || course.activeCourse || course.name || 's2';
  }
  const currentCourse = String(courseStr).toLowerCase();

  // Filter links based on active course
  const filteredResources = resources.filter(item => {
    if (!item.courses || !Array.isArray(item.courses)) return false;
    return item.courses.map(c => String(c).toLowerCase()).includes(currentCourse);
  });

  const courseDisplayName = currentCourse === 's4' ? 'Español 4 / IB' : 'Español II';

  return (
    <div className="rounded-2xl shadow-sm overflow-hidden transition-all bg-white">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="group relative w-full p-5 flex items-center justify-between overflow-hidden bg-gradient-to-br from-violet-600 via-fuchsia-700 to-slate-900 hover:brightness-110 transition-all cursor-pointer text-left shadow-xl"
      >
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative flex items-center gap-4">
          <div className="w-11 h-11 shrink-0 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-xl shadow-inner">
            🧰
          </div>
          <div>
            <h3 className="font-black text-sm text-white uppercase tracking-widest">
              Panel de Recursos ({courseDisplayName})
            </h3>
            <p className="text-xs text-violet-200 font-medium">Trip details, support links & course materials</p>
          </div>
        </div>
        <span className={`relative transform transition-transform duration-300 text-white font-bold ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div className="p-6 border-t border-slate-100 space-y-4 animate-fadeIn bg-slate-50/30">
          {loading ? (
            <p className="text-xs text-slate-400 text-center animate-pulse py-8">Cargando recursos...</p>
          ) : filteredResources.length === 0 ? (
            <p className="text-xs text-slate-400 text-center italic py-8">No hay recursos disponibles para este curso.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredResources.map((link, idx) => {
                const imgUrl = link.image || link.imageUrl || link.img || link.thumbnail_url || link.imagen;
                const isExternal = link.url && link.url.startsWith('http');

                return (
                  <div key={idx} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col group hover:shadow-md transition-all">

                    {/* Banner Image */}
                    <div className="w-full h-32 bg-slate-100 overflow-hidden relative border-b border-slate-100 flex items-center justify-center shrink-0">
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt={link.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.innerHTML = '<span class="text-3xl">📌</span>';
                          }}
                        />
                      ) : (
                        <span className="text-3xl">📌</span>
                      )}
                    </div>

                    {/* Content (Strictly renders link.title) */}
                    <div className="p-4 flex flex-col gap-3">

                      <h4 className="font-black text-slate-800 text-sm leading-snug">
                        {link.title || 'Sin título'}
                      </h4>

                      <a
                        href={link.url || '#'}
                        target={isExternal ? "_blank" : "_self"}
                        rel={isExternal ? "noopener noreferrer" : ""}
                        className="bg-slate-900 hover:bg-cyan-600 text-white font-black text-xs px-4 py-2.5 rounded-lg text-center uppercase tracking-wider transition-colors shadow-sm w-full"
                      >
                        {isExternal ? 'Abrir Enlace ↗' : 'Ver Detalles →'}
                      </a>

                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}