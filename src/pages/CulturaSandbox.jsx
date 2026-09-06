import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

const CulturaSandbox = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImg, setSelectedImg] = useState(null); // Para el Lightbox

  const currentCourse = localStorage.getItem('preferredCourse') || 's2';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const q = query(collection(db, "cultura"), where("courses", "array-contains", currentCourse));
        const snap = await getDocs(q);
        setItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      } catch (err) { console.error(err); setLoading(false); }
    };
    fetchData();
  }, [currentCourse]);

  if (loading) return <div className="p-10 text-center font-black animate-pulse">CARGANDO CULTURA...</div>;

  return (
    <div className="font-sans bg-gray-100 min-h-screen p-6">
      <div className="max-w-5xl mx-auto space-y-12">
        
        {items.map((pais) => (
          <section key={pais.id} className="bg-white shadow-lg rounded-2xl overflow-hidden border-l-8 border-red-500">
            {/* CABECERA DINÁMICA */}
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-blue-600 font-black text-3xl uppercase tracking-tighter">{pais.subtitulo}</h2>
              <div className="mt-4 text-gray-700 bg-gray-50 p-6 rounded-xl border border-gray-200">
                <p className="whitespace-pre-line leading-relaxed font-medium">
                  {pais.cifras}
                </p>
              </div>
            </div>

            {/* GALERÍA DINÁMICA (El corazón de tu diseño) */}
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 p-6 bg-white">
              {pais.galeria?.map((card, idx) => (
                <figure key={idx} className="group flex flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                  <div className="relative overflow-hidden aspect-video">
                    <img 
                      src={card.imagen} 
                      alt={card.caption}
                      onClick={() => setSelectedImg(card.imagen)}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 cursor-zoom-in"
                    />
                    <figcaption className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-2 uppercase tracking-widest">
                      {card.caption}
                    </figcaption>
                  </div>
                  <div className="p-4 flex-grow">
                    <p className="text-xs text-gray-600 leading-relaxed italic">
                      {card.texto}
                    </p>
                  </div>
                </figure>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* LIGHTBOX (Versión React) */}
      {selectedImg && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImg(null)}
        >
          <img src={selectedImg} className="max-h-full max-w-full rounded-lg shadow-2xl animate-in zoom-in-95 duration-200" />
          <button className="absolute top-6 right-6 text-white font-black text-2xl">✕</button>
        </div>
      )}
    </div>
  );
};

export default CulturaSandbox;