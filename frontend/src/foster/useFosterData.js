import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadDueFosterTasks, loadFosterDirectory, loadFosterOverview, loadFosterRegistry, loadFosterRequests } from '../services/fosterApi';

const emptyData = { homes: [], team: [], saved: [], organizations: [], spaces: [], incoming: [], outgoing: [],
  placements: [], finished: [], dueTasks: [], myCases: [] };

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
      const [overview, incoming, outgoing, myCases] = await Promise.all([
        loadFosterOverview(user.id),
        loadFosterRequests(user.id, 'incoming'),
        loadFosterRequests(user.id, 'outgoing'),
        loadFosterDirectory({ type: 'animals', ownerId: user.id }),
      ]);
      const perHome = await Promise.all(overview.homes.map(home => Promise.all([
        loadFosterRegistry({ homeId: home.id }),
        loadFosterRegistry({ homeId: home.id, status: 'COMPLETED' }),
      ])));
      const placements = perHome.flatMap(([active]) => active.rows);
      const finished = perHome.flatMap(([, done]) => done.rows);
      const dueTasks = await loadDueFosterTasks(placements.filter(p => p.status === 'IN_CARE').map(p => p.id));
      return { ...overview, incoming: incoming.rows, outgoing: outgoing.rows, myCases: myCases.rows, placements, finished, dueTasks };
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
    const placedElsewhere = [...data.incoming, ...data.outgoing].filter(r => r.placement_id && !r.receiving_home_is_mine
      && ['RESERVED', 'IN_CARE'].includes(r.placement_status) && r.case_owner_id === user.id);
    return { ownHomes, offersByCase, placedElsewhere };
  }, [data, user.id]);

  return { ...data, ...derived, ...state, refresh };
}
