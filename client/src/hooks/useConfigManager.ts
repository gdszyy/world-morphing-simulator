import { useState, useEffect } from 'react';
import { SimulationParams, DEFAULT_PARAMS } from '@/lib/simulation/engine';

export interface ConfigVersion {
  id: string;
  name: string;
  timestamp: number;
  params: SimulationParams;
}

const STORAGE_KEY_DEFAULT = 'world-morphing-default-params';
const STORAGE_KEY_VERSIONS = 'world-morphing-config-versions';

export function useConfigManager() {
  const [savedVersions, setSavedVersions] = useState<ConfigVersion[]>([]);
  const [defaultConfig, setDefaultConfig] = useState<SimulationParams>(DEFAULT_PARAMS);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedDefault = localStorage.getItem(STORAGE_KEY_DEFAULT);
      if (savedDefault) {
        setDefaultConfig(JSON.parse(savedDefault));
      }

      const savedVers = localStorage.getItem(STORAGE_KEY_VERSIONS);
      if (savedVers) {
        setSavedVersions(JSON.parse(savedVers));
      }
    } catch (e) {
      console.error("Failed to load configs from localStorage", e);
    }
  }, []);

  const saveAsDefault = (params: SimulationParams) => {
    setDefaultConfig(params);
    localStorage.setItem(STORAGE_KEY_DEFAULT, JSON.stringify(params));
  };

  const saveVersion = (name: string, params: SimulationParams) => {
    const newVersion: ConfigVersion = {
      id: crypto.randomUUID(),
      name,
      timestamp: Date.now(),
      params
    };
    const newVersions = [newVersion, ...savedVersions];
    setSavedVersions(newVersions);
    localStorage.setItem(STORAGE_KEY_VERSIONS, JSON.stringify(newVersions));
  };

  const deleteVersion = (id: string) => {
    const newVersions = savedVersions.filter(v => v.id !== id);
    setSavedVersions(newVersions);
    localStorage.setItem(STORAGE_KEY_VERSIONS, JSON.stringify(newVersions));
  };

  const loadVersion = (id: string): SimulationParams | null => {
    const version = savedVersions.find(v => v.id === id);
    return version ? version.params : null;
  };

  const resetDefault = () => {
    setDefaultConfig(DEFAULT_PARAMS);
    localStorage.removeItem(STORAGE_KEY_DEFAULT);
    return DEFAULT_PARAMS;
  };

  return {
    defaultConfig,
    savedVersions,
    saveAsDefault,
    saveVersion,
    deleteVersion,
    loadVersion,
    resetDefault
  };
}
