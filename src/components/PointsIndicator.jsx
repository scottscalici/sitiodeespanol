import React, { useEffect, useState } from 'react';

// Renders a floating "+N puntos" badge whenever `flash` changes to a new object.
// Pass flash={{ amount: 25 }} (a fresh object each time, even for repeat amounts).
const PointsIndicator = ({ flash }) => {
  const [shown, setShown] = useState(null);
  const [lastFlash, setLastFlash] = useState(null);

  if (flash && flash !== lastFlash) {
    setLastFlash(flash);
    setShown(flash);
  }

  useEffect(() => {
    if (!shown) return;
    const timeout = setTimeout(() => setShown(null), 2200);
    return () => clearTimeout(timeout);
  }, [shown]);

  if (!shown) return null;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999]">
      <div className="bg-emerald-500 text-white font-black text-lg px-6 py-3 rounded-full shadow-2xl border-2 border-emerald-300 flex items-center gap-2 whitespace-nowrap">
        <span>⭐</span> +{shown.amount} puntos
      </div>
    </div>
  );
};

export default PointsIndicator;
