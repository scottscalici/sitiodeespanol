export default function ThemeHeroBanner({ hero, accent }) {
  if (!hero?.active) return null;

  return (
    <div
      className="rounded-xl overflow-hidden shadow-md flex flex-col md:flex-row bg-white"
      style={{ borderTop: `8px solid ${accent || '#6366f1'}` }}
    >
      {hero.img && (
        <div className="md:w-1/3 h-48 bg-slate-100">
          <img src={hero.img} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-8 flex items-center justify-center flex-grow text-center">
        <h2 className="text-2xl font-black italic text-slate-800 whitespace-pre-line">{hero.msg}</h2>
      </div>
    </div>
  );
}
