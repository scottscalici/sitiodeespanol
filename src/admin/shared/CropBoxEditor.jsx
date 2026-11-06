import { useRef } from 'react';

const MIN_SIZE = 0.02; // smallest a box can be, as a fraction of the photo

// One photo with one or more named crop boxes drawn over it, each
// draggable (grab the body) and resizable (grab the bottom-right handle).
// Boxes are stored and reported in NORMALIZED 0-1 coordinates (fraction of
// the photo's own width/height) so they're independent of how big the
// photo happens to render on screen — the same coordinates a cropping
// skill would output from looking at the original image.
const CropBoxEditor = ({ photoUrl, boxes, onChange }) => {
  const containerRef = useRef(null);
  const dragRef = useRef(null); // { id, mode: 'move' | 'resize', startX, startY, startBox }

  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  const updateBox = (id, patch) => {
    onChange(boxes.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const handlePointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = (e.clientX - drag.startX) / rect.width;
    const dy = (e.clientY - drag.startY) / rect.height;
    const { startBox } = drag;

    if (drag.mode === 'move') {
      const x = clamp(startBox.x + dx, 0, 1 - startBox.width);
      const y = clamp(startBox.y + dy, 0, 1 - startBox.height);
      updateBox(drag.id, { x, y });
    } else {
      const width = clamp(startBox.width + dx, MIN_SIZE, 1 - startBox.x);
      const height = clamp(startBox.height + dy, MIN_SIZE, 1 - startBox.y);
      updateBox(drag.id, { width, height });
    }
  };

  const stopDrag = () => {
    dragRef.current = null;
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', stopDrag);
  };

  const startDrag = (e, box, mode) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { id: box.id, mode, startX: e.clientX, startY: e.clientY, startBox: box };
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', stopDrag);
  };

  return (
    <div ref={containerRef} className="relative inline-block max-w-full select-none" style={{ touchAction: 'none' }}>
      <img src={photoUrl} alt="" className="max-w-full h-auto block rounded-lg border border-slate-300" draggable={false} />
      {boxes.map((box) => (
        <div
          key={box.id}
          onPointerDown={(e) => startDrag(e, box, 'move')}
          className="absolute border-2 border-amber-400 bg-amber-400/10 cursor-move"
          style={{
            left: `${box.x * 100}%`,
            top: `${box.y * 100}%`,
            width: `${box.width * 100}%`,
            height: `${box.height * 100}%`,
          }}
        >
          <span className="absolute -top-5 left-0 text-[10px] font-black text-amber-700 bg-white/90 px-1 rounded whitespace-nowrap">
            {box.targetFilename}
          </span>
          <div
            onPointerDown={(e) => startDrag(e, box, 'resize')}
            className="absolute -right-1.5 -bottom-1.5 w-3.5 h-3.5 bg-amber-500 border border-white rounded-full cursor-nwse-resize"
          />
        </div>
      ))}
    </div>
  );
};

export default CropBoxEditor;
