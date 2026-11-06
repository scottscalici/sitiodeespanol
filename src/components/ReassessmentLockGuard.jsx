import { useLayoutEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Site-wide lockout while a reassessment is in progress (Phase D). Modeled
// directly on ScrollToTop.jsx's pattern — a invisible sibling of <Routes>
// inside <BrowserRouter> that reacts to every navigation via useLocation.
//
// `userData.activeReassessment` (set by startReassessmentAttempt, cleared
// by finishReassessmentAttempt — see reassessmentData.js) is read through
// useAuth(), which is backed by a LIVE onSnapshot on the user's own doc —
// so a reassessment that starts in one tab locks every other open tab the
// instant Firestore delivers the update, not just the tab that started it.
// A typed URL or a fresh tab both re-mount this same component tree and
// re-fetch userData live, so neither escapes it either.
//
// useLayoutEffect (not useEffect) matters here: it fires synchronously
// after the newly-routed page commits to the DOM but before the browser
// paints, so the redirect happens before the student ever sees the page
// they tried to reach — not a React Router rendering decision (this
// component doesn't know what <Routes> is about to render, so it can only
// correct course after the fact, same as ScrollToTop correcting scroll
// position after the fact), just early enough to avoid a visible flash.
export default function ReassessmentLockGuard() {
  const { userData } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useLayoutEffect(() => {
    const lock = userData?.activeReassessment;
    if (!lock?.circleId || userData?.role === 'admin') return;
    const targetPath = `/reevaluacion/${lock.circleId}`;
    if (location.pathname !== targetPath) {
      navigate(targetPath, { replace: true });
    }
  }, [userData, location.pathname, navigate]);

  return null;
}
