import { useCallback, useEffect, useMemo, useState } from 'react';
import { countUnreadActivity, loadDueFosterTasks, loadFosterDirectory, loadFosterOverview, loadFosterRegistry, loadFosterRequests, loadMyAnimalsElsewhere } from '../services/fosterApi';

const emptyData = { homes: [], team: [], saved: [], organizations: [], spaces: [], incoming: [], outgoing: [],
  placements: [], finished: [], dueTasks: [], myCases: [], consents: [], elsewhere: [], unreadActivity: 0 };

// A rescue can have more than one page (25 rows) of animals, requests or
// placements. Read every page, up to 500 rows, so none silently go missing.
export async function allPages(load, maxPages = 20) {
  const first = await load(0);
  const rows = [...first.rows];
  for (let page = 1; page < maxPages && rows.length < (first.count ?? 0); page += 1) {
    const next = await load(page);
    if (!next.rows.length) break;
    rows.push(...next.rows);
  }
  return { rows, count: first.count };
}

// Everything the Foster screens show about the signed-in person, loaded once
// and refreshed after each change or when the app comes back to the front.
export function useFosterData(user, live) {
  const [data, setData] = useState(emptyData);
  const [state, setState] = useState({ loading: live, error: null });
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    if (!live) return undefined;
    let cancelled = false;
    setState(current => ({ ...current, loading: true }));
    (async () => {
      const [overview, incoming, outgoing, myCases, consents] = await Promise.all([
        loadFosterOverview(user.id),
        allPages(page => loadFosterRequests(user.id, 'incoming', page)),
        allPages(page => loadFosterRequests(user.id, 'outgoing', page)),
        allPages(page => loadFosterDirectory({ type: 'animals', ownerId: user.id, page })),
        allPages(page => loadFosterRequests(user.id, 'consent', page)),
      ]);
      const unreadActivity = await countUnreadActivity().catch(() => 0);
      const elsewhere = await loadMyAnimalsElsewhere(user.id, overview.homes.map(home => home.id));
      const perHome = await Promise.all(overview.homes.map(home => Promise.all([
        allPages(page => loadFosterRegistry({ homeId: home.id, page })),
        loadFosterRegistry({ homeId: home.id, status: 'COMPLETED' }),
      ])));
      const placements = perHome.flatMap(([active]) => active.rows);
      const finished = perHome.flatMap(([, done]) => done.rows);
      const dueTasks = await loadDueFosterTasks(placements.filter(p => p.status === 'IN_CARE').map(p => p.id));
      return { ...overview, incoming: incoming.rows, outgoing: outgoing.rows, myCases: myCases.rows, placements, finished, dueTasks,
        consents: consents.rows, elsewhere, unreadActivity };
    })().then(next => {
      if (cancelled) return;
      setData(next);
      setState({ loading: false, error: null });
    }).catch(error => {
      if (!cancelled) setState({ loading: false, error });
    });
    return () => { cancelled = true; };
  }, [live, user.id, revision]);

  useEffect(() => {
    if (!live) return undefined;
    const onFocus = () => { if (document.visibilityState !== 'hidden') refresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, [live, refresh]);

  const derived = useMemo(() => {
    const ownHomes = data.homes.filter(home => home.my_role === 'OWNER');
    const offersByCase = data.incoming.filter(r => r.status === 'PENDING').reduce((map, r) => {
      map[r.case_id] = (map[r.case_id] || 0) + 1;
      return map;
    }, {});
    // My animals living with someone else's foster home.
    // My animals living with someone else's foster home, shaped like requests for the shared rows.
    const asRow = p => ({ id: p.id, placement_id: p.id, animal_name: p.name, photo: p.photo, species: p.species,
      home_name: p.home_name, placement_status: p.status, placement_outcome: p.outcome, ended_at: p.ended_at });
    const placedElsewhere = data.elsewhere.filter(p => ['RESERVED', 'IN_CARE'].includes(p.status)).map(asRow);
    const finishedElsewhere = data.elsewhere.filter(p => p.status === 'COMPLETED').map(asRow);
    // Transfers of my animal waiting for my answer.
    const consentsWaiting = data.consents.filter(r => r.owner_consent === 'PENDING' && ['PENDING', 'ACCEPTED'].includes(r.status));
    return { ownHomes, offersByCase, placedElsewhere, finishedElsewhere, consentsWaiting };
  }, [data]);

  return { ...data, ...derived, ...state, refresh };
}
