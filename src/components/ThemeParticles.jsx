import { useEffect, useRef } from 'react';

// Full-screen falling/rising emoji particle overlay, driven by a theme's
// `particles` array — each entry is its own independent species
// ({ char, color, direction, speed, count, sizeRange }), so a theme can float
// bats AND ghosts at once instead of being limited to one character. Kept on
// the same ~30ms tick as the original single-species version so already-tuned
// speed values still look the same.
export default function ThemeParticles({ particles: speciesList }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const activeSpecies = (speciesList || []).filter((s) => s?.count > 0);
    if (activeSpecies.length === 0) return undefined;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const makeParticle = (species) => {
      const [minSize, maxSize] = species.sizeRange?.length === 2 ? species.sizeRange : [12, 27];
      return {
        species,
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * (maxSize - minSize) + minSize,
        drift: Math.random() * 2 - 1,
        opacity: Math.random() * 0.5 + 0.4,
      };
    };

    const particles = activeSpecies.flatMap((species) =>
      Array.from({ length: species.count }, () => makeParticle(species))
    );

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        const { species } = p;
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = species.color || 'white';
        ctx.font = `${p.size}px serif`;
        ctx.fillText(species.char || '✨', p.x, p.y);

        const speed = (species.speed || 1) + p.size / 20;
        if (species.direction === 'up') {
          p.y -= speed;
          if (p.y < -30) {
            p.y = canvas.height + 20;
            p.x = Math.random() * canvas.width;
          }
        } else {
          p.y += speed;
          if (p.y > canvas.height + 30) {
            p.y = -30;
            p.x = Math.random() * canvas.width;
          }
        }
        p.x += p.drift;
      });
    };

    const interval = setInterval(draw, 30);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', resize);
    };
  }, [speciesList]);

  if (!(speciesList || []).some((s) => s?.count > 0)) return null;

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-50" />;
}
