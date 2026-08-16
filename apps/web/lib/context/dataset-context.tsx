'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useTransition } from 'react';

export type DatasetMode = 'SAMPLE' | 'IMPORTED_REAL' | 'LIVE';

export interface Dataset {
  id: string;
  name: string;
  mode: DatasetMode;
  description?: string | null;
  created_at?: string;
}

interface DatasetContextValue {
  datasets: Dataset[];
  activeDataset: Dataset | null;
  activeDatasetId: string;
  setActiveDatasetId: (id: string) => void;
  isLoading: boolean;
  refetchDatasets: () => Promise<void>;
}

const DatasetContext = createContext<DatasetContextValue | null>(null);

const STORAGE_KEY = 'cluster_active_dataset_id';

export function DatasetProvider({ children }: { children: React.ReactNode }) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [activeDatasetId, setActiveDatasetIdState] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [, startTransition] = useTransition();

  const fetchDatasets = useCallback(async () => {
    try {
      const res = await fetch('/api/datasets');
      if (!res.ok) throw new Error('Failed to fetch datasets');
      const data = await res.json();
      const list: Dataset[] = data.datasets ?? [];
      setDatasets(list);

      setActiveDatasetIdState((current) => {
        if (current && list.some((d) => d.id === current)) {
          return current;
        }
        const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
        if (saved && list.some((d) => d.id === saved)) {
          return saved;
        }
        // Fresh sessions should open the intentional full Founder Demo, not a
        // transient SAMPLE integration-test dataset.
        const founderDemo = list.find(
          (d) => d.mode === 'SAMPLE' && d.name === 'Cluster Resolve · Founder Demo'
        );
        const sample = list.find((d) => d.mode === 'SAMPLE');
        const nextId = founderDemo?.id ?? sample?.id ?? list[0]?.id ?? '';
        if (typeof window !== 'undefined' && nextId) {
          localStorage.setItem(STORAGE_KEY, nextId);
        }
        return nextId;
      });
    } catch {
      // keep existing
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (active) await fetchDatasets();
    })();
    return () => {
      active = false;
    };
  }, [fetchDatasets]);

  const setActiveDatasetId = useCallback((id: string) => {
    startTransition(() => {
      setActiveDatasetIdState(id);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, id);
      }
    });
  }, []);

  const activeDataset = datasets.find((d) => d.id === activeDatasetId) ?? null;

  return (
    <DatasetContext.Provider
      value={{
        datasets,
        activeDataset,
        activeDatasetId,
        setActiveDatasetId,
        isLoading,
        refetchDatasets: fetchDatasets,
      }}
    >
      {children}
    </DatasetContext.Provider>
  );
}

export function useDataset(): DatasetContextValue {
  const ctx = useContext(DatasetContext);
  if (!ctx) {
    throw new Error('useDataset must be used within a DatasetProvider');
  }
  return ctx;
}
