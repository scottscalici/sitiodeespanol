import { useMemo } from 'react';
import { generateAvatarSvgMarkup } from '../utils/avatarCatalog';

// Shared everywhere a student's own avatar renders (Header, Leaderboard, the
// Avatar Builder's own live preview, ...). `avatarConfig` is the
// `users/{uid}.avatarConfig` field — `{ options, accessoryImageUrl }` — or
// null/undefined for a student who hasn't customized anything yet, in which
// case a deterministic default avatar is generated from `uid` as the seed
// so nobody ever shows a broken/missing avatar.
export default function StudentAvatar({ avatarConfig, uid, size = 40, className = '' }) {
  const optionsKey = JSON.stringify(avatarConfig?.options || {});
  const svgMarkup = useMemo(
    () => generateAvatarSvgMarkup(avatarConfig?.options, uid),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [optionsKey, uid]
  );

  return (
    <div
      className={`relative shrink-0 rounded-full overflow-hidden bg-slate-700 ${className}`}
      style={{ width: size, height: size }}
    >
      <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: svgMarkup }} />
      {avatarConfig?.accessoryImageUrl && (
        <img
          src={avatarConfig.accessoryImageUrl}
          alt=""
          aria-hidden="true"
          className="absolute pointer-events-none"
          style={{ width: size * 0.45, height: size * 0.45, bottom: 0, right: 0 }}
        />
      )}
    </div>
  );
}
