import React from 'react';
import { Link } from 'react-router-dom';

const ActivityGrid = ({ activities = [], liveDia, course }) => {
  // 1. Filter the massive list down to ONLY today's activities for the current course
  const todaysActivities = activities.filter(act => {
    if (course === 's2') return act.s2_dias?.includes(liveDia);
    if (course === 's4') return act.s4_dias?.includes(liveDia);
    return false;
  });

  if (todaysActivities.length === 0) return null;

  return (
    <div className="mb-12">
      <h2 className="text-slate-400 font-black text-xl uppercase tracking-widest mb-6">
        Actividades de Hoy
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {todaysActivities.map((act) => (
          <ActivityCard key={act.id} activity={act} />
        ))}
      </div>
    </div>
  );
};

// 🃏 The Sub-Component: Knows how to style itself based on "type"
const ActivityCard = ({ activity }) => {
  const getTheme = (type) => {
    switch (type) {
      case 'musica': return { icon: "🎵", color: "text-pink-600", bg: "bg-pink-50", border: "border-pink-500" };
      case 'lectura': return { icon: "📖", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-500" };
      case 'conversacion': return { icon: "🗣️", color: "text-sky-600", bg: "bg-sky-50", border: "border-sky-500" };
      case 'video': return { icon: "🎬", color: "text-red-600", bg: "bg-red-50", border: "border-red-500" };
      case 'cultura': return { icon: "🌍", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-500" };
      case 'practica': return { icon: "📝", color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-500" };
      case 'extra': return { icon: "⚡", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-500" };
      default: return { icon: "🌟", color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-500" };
    }
  };

  const theme = getTheme(activity.type);

  // 🚀 THIS IS THE MAGIC FIX! 
  // It is now a <Link> using 'to=' instead of an <a> using 'href='
  return (
    <Link 
      to={`/actividad/${activity.type}/${activity.id}`} 
      className={`bg-white rounded-xl border-l-[4px] ${theme.border} p-4 shadow-sm border border-y-slate-200 border-r-slate-200 hover:shadow-md transition-all hover:-translate-y-1 flex items-center gap-4`}
    >
      <div className={`w-14 h-14 flex-shrink-0 flex items-center justify-center rounded-lg ${theme.bg} overflow-hidden`}>
        {activity.img ? (
          <img src={activity.img} alt={activity.title} className="w-full h-full object-cover opacity-90" />
        ) : (
          <span className="text-2xl">{theme.icon}</span>
        )}
      </div>
      <div className="min-w-0 flex flex-col justify-center"> 
        <h4 className={`text-[9px] font-black uppercase tracking-widest ${theme.color} mb-0.5 truncate`}>
          {activity.tag || activity.type}
        </h4>
        <p className="text-slate-800 font-bold text-sm leading-tight line-clamp-2">
          {activity.title}
        </p>
        {activity.subtitle && (
          <p className="text-[10px] font-medium text-slate-400 truncate mt-0.5">
            {activity.subtitle}
          </p>
        )}
      </div>
    </Link>
  );
};

export default ActivityGrid;