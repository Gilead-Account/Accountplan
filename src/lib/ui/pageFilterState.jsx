import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

const PageFilterStateContext = createContext(null);

export function PageFilterStateProvider({ children }) {
  const [filterState, setFilterState] = useState({});
  const value = useMemo(
    () => ({ filterState, setFilterState }),
    [filterState]
  );

  return (
    <PageFilterStateContext.Provider value={value}>
      {children}
    </PageFilterStateContext.Provider>
  );
}

const usePageFilterStateContext = () => {
  const context = useContext(PageFilterStateContext);
  if (!context) {
    throw new Error('Page filter state must be used within PageFilterStateProvider.');
  }
  return context;
};

export function usePageFilterState(pageKey, defaultValue) {
  const { filterState, setFilterState } = usePageFilterStateContext();
  const value = Object.prototype.hasOwnProperty.call(filterState, pageKey)
    ? filterState[pageKey]
    : defaultValue;

  const setValue = useCallback(
    (nextValue) => {
      setFilterState((current) => {
        const currentValue = Object.prototype.hasOwnProperty.call(current, pageKey)
          ? current[pageKey]
          : defaultValue;
        const resolvedValue = typeof nextValue === 'function'
          ? nextValue(currentValue)
          : nextValue;

        if (Object.is(resolvedValue, currentValue)) return current;
        return { ...current, [pageKey]: resolvedValue };
      });
    },
    [defaultValue, pageKey, setFilterState]
  );

  return [value, setValue];
}

export function useResetPageFilterState() {
  const { setFilterState } = usePageFilterStateContext();
  return useCallback(() => {
    setFilterState({});
  }, [setFilterState]);
}
