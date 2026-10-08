import React, { useState } from 'react';

// A quick one-off photo share — a small thumbnail card on the Dashboard,
// click to open a full-size lightbox that steps through every image
// attached to that card (the "sequencer") with the optional caption/text
// alongside. Distinct from Curiosidad (interactive questions) and
// Destacado (one themed daily highlight) — this is just "look at this
// picture," nothing graded or scored.
const ImageCards = ({ cards = [] }) => {
  const [openCard, setOpenCard] = useState(null); // { card, index } | null

  if (!cards || cards.length === 0) return null;

  const images = openCard?.card.images || [];
  const showPrev = () => setOpenCard((prev) => prev && { ...prev, index: (prev.index - 1 + images.length) % images.length });
  const showNext = () => setOpenCard((prev) => prev && { ...prev, index: (prev.index + 1) % images.length });

  return (
    <>
      <div className="space-y-4">
        {cards.map((card) => {
          const cardImages = card.images || [];
          if (cardImages.length === 0) return null;
          return (
            <button
              key={card.id}
              onClick={() => setOpenCard({ card, index: 0 })}
              className="block w-full text-left bg-white rounded-2xl border-2 border-slate-200 hover:border-indigo-300 hover:shadow-md shadow-sm overflow-hidden transition-all"
            >
              <div className="flex items-center gap-4 p-3">
                <div className="shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-slate-100 relative">
                  <img src={cardImages[0]} alt="" className="w-full h-full object-cover" />
                  {cardImages.length > 1 && (
                    <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md">
                      +{cardImages.length - 1}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  {card.caption && <p className="font-bold text-slate-800 text-sm truncate">{card.caption}</p>}
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mt-1">
                    📸 Toca para ver {cardImages.length > 1 ? 'las fotos' : 'más'}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {openCard && (
        <div
          className="fixed inset-0 z-[200] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setOpenCard(null)}
        >
          <button
            onClick={() => setOpenCard(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl font-bold leading-none"
          >
            ×
          </button>

          <div className="max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <img
                src={images[openCard.index]}
                alt=""
                className="w-full max-h-[70vh] object-contain rounded-xl bg-black"
              />
              {images.length > 1 && (
                <>
                  <button
                    onClick={showPrev}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white w-9 h-9 rounded-full text-lg font-bold"
                  >
                    ‹
                  </button>
                  <button
                    onClick={showNext}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white w-9 h-9 rounded-full text-lg font-bold"
                  >
                    ›
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {images.map((_, i) => (
                      <span
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full ${i === openCard.index ? 'bg-white' : 'bg-white/40'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {(openCard.card.caption || openCard.card.text) && (
              <div className="bg-white rounded-xl mt-3 p-4">
                {openCard.card.caption && <p className="font-black text-slate-800">{openCard.card.caption}</p>}
                {openCard.card.text && <p className="text-sm text-slate-600 mt-1">{openCard.card.text}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ImageCards;
