import { useEffect, useRef } from 'react';

// Full-screen falling/rising emoji particle overlay, driven by a theme's
// effectConfig ({ char, color, direction, speed, count }). Ported from the
// original vanilla-JS canvas engine — kept on the same ~30ms tick so the
// speed values already tuned per-theme still look the same.
export default function ThemeParticles({ config }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!config || !config.count) return undefined;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: config.count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 15 + 12,
      drift: Math.random() * 2 - 1,
      opacity: Math.random() * 0.5 + 0.4,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = config.color || 'white';
      particles.forEach((p) => {
        ctx.globalAlpha = p.opacity;
        ctx.font = `${p.size}px serif`;
        ctx.fillText(config.char || '✨', p.x, p.y);

        const speed = (config.speed || 1) + p.size / 20;
        if (config.direction === 'up') {
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
  }, [config]);

  if (!config || !config.count) return null;

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-50" />;
}
