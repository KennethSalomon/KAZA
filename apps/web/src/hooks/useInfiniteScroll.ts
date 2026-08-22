'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseInfiniteScrollOptions<T> {
  fetchFn: (page: number, pageSize: number) => Promise<T[]>;
  pageSize?: number;
  enabled?: boolean;
  onError?: (error: Error) => void;
}

interface UseInfiniteScrollResult<T> {
  items: T[];
  loading: boolean;
  loadingMore: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
}

export function useInfiniteScroll<T>(options: UseInfiniteScrollOptions<T>): UseInfiniteScrollResult<T> {
  const { fetchFn, pageSize = 20, enabled = true, onError } = options;

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const loadingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadPage = useCallback(
    async (pageNum: number, isRefresh = false) => {
      if (loadingRef.current) return;

      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (isRefresh) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      try {
        const newItems = await fetchFn(pageNum, pageSize);
        const fetchedCount = newItems.length;

        if (isRefresh) {
          setItems(newItems);
        } else {
          setItems((prev) => [...prev, ...newItems]);
        }

        setHasMore(fetchedCount >= pageSize);
        setPage(pageNum);
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err);
          onError?.(err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [fetchFn, pageSize, onError]
  );

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    await loadPage(page + 1);
    loadingRef.current = false;
  }, [loadPage, page, hasMore]);

  const refresh = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setPage(0);
    await loadPage(0, true);
    loadingRef.current = false;
  }, [loadPage]);

  // Initial load
  useEffect(() => {
    if (enabled) {
      loadPage(0, true);
    }
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [enabled, loadPage]);

  return {
    items,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    refresh,
    setItems,
  };
}