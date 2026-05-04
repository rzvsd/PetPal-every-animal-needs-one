import { useCallback, useEffect, useState } from 'react';
import { fetchDiscoveryListings } from '../api/petpalApi';
import { demoListings } from '../data/demoListings';
import { isSupabaseConfigured } from '../lib/supabase';
import { DiscoveryListing } from '../types/petpal';

export type DataSource = 'demo' | 'supabase';

export function useDiscovery() {
  const [listings, setListings] = useState<DiscoveryListing[]>(demoListings);
  const [dataSource, setDataSource] = useState<DataSource>('demo');
  const [loadMessage, setLoadMessage] = useState('Using built-in demo listings.');
  const [isLoading, setIsLoading] = useState(false);

  const refreshListings = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setListings(demoListings);
      setDataSource('demo');
      setLoadMessage('Supabase env is not configured, so the app is using demo listings.');
      return;
    }

    setIsLoading(true);
    try {
      const nextListings = await fetchDiscoveryListings();
      setListings(nextListings.length > 0 ? nextListings : demoListings);
      setDataSource(nextListings.length > 0 ? 'supabase' : 'demo');
      setLoadMessage(
        nextListings.length > 0
          ? `Loaded ${nextListings.length} approved listings from local Supabase.`
          : 'Supabase returned no active listings, so demo listings are shown.',
      );
    } catch (error) {
      setListings(demoListings);
      setDataSource('demo');
      setLoadMessage('Live local feed is unavailable, so polished demo listings are shown.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshListings();
  }, [refreshListings]);

  return {
    listings,
    dataSource,
    loadMessage,
    isLoading,
    refreshListings,
  };
}
