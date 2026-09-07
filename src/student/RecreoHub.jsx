import React from 'react';
import { Link } from 'react-router-dom';

const RecreoHub = () => {
  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans overflow-hidden">
      
      {/* HEADER SECTION */}
      <div className="w-full max-w-[1400px] mx-auto px-4 py-8">
        <Link to="/" className="text-indigo-400 font-bold mb-8 inline-flex items-center gap-2 hover:text-indigo-300 transition-colors group">
          <span className="text-xl leading-none group-hover:-translate-x-1 transition-transform">←</span> 
          Volver al Gym
        </Link>

        <div className="text-center mb-16 mt-8">
          <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 via-indigo-500 to-cyan-500 tracking-tighter uppercase mb-4 animate-pulse">
            El Recreo
          </h1>
          <p className="text-slate-400 font-medium tracking-widest uppercase text-sm md:text-base">
            Salón de Juegos • Alto Voltaje
          </p>
        </div>

        {/* ARCADE CABINETS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          
          {/* 1. SEÑORDLE */}
          <Link to="/juegos/senordle" className="group relative bg-slate-800 border-2 border-slate-700 rounded-2xl p-6 hover:border-emerald-500 transition-all duration-300 hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:-translate-y-2">
            <div className="absolute top-4 right-4 z-20 bg-emerald-500/20 text-emerald-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-500/50">
              Diario
            </div>
            <div className="w-full h-48 mb-6 flex items-center justify-center overflow-hidden rounded-xl">
               <img 
                 src="https://raw.githubusercontent.com/scottscalici/imagenes/main/juegos/senordle.png" 
                 alt="Señordle" 
                 className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
               />
            </div>
            <h2 className="text-3xl font-black uppercase tracking-tight mb-2 group-hover:text-emerald-400 transition-colors">Señordle</h2>
            <p className="text-slate-400 text-sm font-medium mb-8">El clásico rompecabezas de 5 letras. Adivina la palabra secreta de hoy.</p>
            <div className="text-emerald-500 font-black uppercase text-xs tracking-widest flex items-center gap-2">
              ADIVINAR <span className="group-hover:translate-x-2 transition-transform">→</span>
            </div>
          </Link>

          {/* 2. ESLABONES */}
          <Link to="/juegos/eslabones" className="group relative bg-slate-800 border-2 border-slate-700 rounded-2xl p-6 hover:border-cyan-500 transition-all duration-300 hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] hover:-translate-y-2">
            <div className="w-full h-48 mb-6 flex items-center justify-center overflow-hidden rounded-xl">
               <img 
                 src="https://raw.githubusercontent.com/scottscalici/imagenes/main/juegos/eslabon.png" 
                 alt="Eslabones" 
                 className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
               />
            </div>
            <h2 className="text-3xl font-black uppercase tracking-tight mb-2 group-hover:text-cyan-400 transition-colors">Eslabones</h2>
            <p className="text-slate-400 text-sm font-medium mb-8">Encuentra la conexión. Crea cadenas de palabras que comparten un eslabón.</p>
            <div className="text-cyan-500 font-black uppercase text-xs tracking-widest flex items-center gap-2">
              ENLAZAR <span className="group-hover:translate-x-2 transition-transform">→</span>
            </div>
          </Link>

          {/* 3. ATANDO CABOS */}
          <Link to="/juegos/atandocabos" className="group relative bg-slate-800 border-2 border-slate-700 rounded-2xl p-6 hover:border-fuchsia-500 transition-all duration-300 hover:shadow-[0_0_30px_rgba(217,70,239,0.3)] hover:-translate-y-2">
            <div className="w-full h-48 mb-6 flex items-center justify-center overflow-hidden rounded-xl">
               <img 
                 src="https://raw.githubusercontent.com/scottscalici/imagenes/main/juegos/atando_cabos.png" 
                 alt="Atando Cabos" 
                 className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
               />
            </div>
            <h2 className="text-3xl font-black uppercase tracking-tight mb-2 group-hover:text-fuchsia-400 transition-colors">Atando Cabos</h2>
            <p className="text-slate-400 text-sm font-medium mb-8">Une los conceptos correctos. Un desafío de lógica y vocabulario cruzado.</p>
            <div className="text-fuchsia-500 font-black uppercase text-xs tracking-widest flex items-center gap-2">
              CONECTAR <span className="group-hover:translate-x-2 transition-transform">→</span>
            </div>
          </Link>

          {/* 4. TICO TALK */}
          <Link to="/recreo/ticotalk" className="group relative bg-slate-800 border-2 border-slate-700 rounded-2xl p-6 hover:border-rose-500 transition-all duration-300 hover:shadow-[0_0_30px_rgba(244,63,94,0.3)] hover:-translate-y-2 overflow-hidden">
            <div className="absolute top-4 right-4 z-20 bg-rose-500/20 text-rose-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-rose-500/50">
              Nuevo
            </div>
            <div className="w-full h-48 mb-6 flex items-center justify-center overflow-hidden rounded-xl">
               <img 
                 src="https://raw.githubusercontent.com/scottscalici/imagenes/main/juegos/tico_talk.png" 
                 alt="Tico Talk" 
                 className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
               />
            </div>
            <h2 className="text-3xl font-black uppercase tracking-tight mb-2 group-hover:text-rose-400 transition-colors">Tico Talk</h2>
            <p className="text-slate-400 text-sm font-medium mb-8">Pura Vida. Puros Videos. Tu feed diario de cultura y humor en español.</p>
            <div className="text-rose-500 font-black uppercase text-xs tracking-widest flex items-center gap-2">
              EXPLORAR <span className="group-hover:translate-x-2 transition-transform">→</span>
            </div>
          </Link>

        </div>
      </div>
    </div>
  );
};

export default RecreoHub;