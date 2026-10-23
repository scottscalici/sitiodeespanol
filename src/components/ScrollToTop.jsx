import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// This app uses plain BrowserRouter (not the data router), so React Router's
// own <ScrollRestoration> isn't available — nothing resets scroll position on
// navigation otherwise, so a new page renders wherever the previous page
// happened to be scrolled to (e.g. landing near the bottom of Grammar Notes
// after clicking its link from partway down the Dashboard).
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
