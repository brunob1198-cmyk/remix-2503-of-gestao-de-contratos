import { useState, useMemo, useCallback, useEffect } from "react";
import { SortDir } from "@/components/medicoes/ColumnHeader";

function loadPersisted<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function savePersisted<T>(key: string, value: T, fallback: T) {
  try {
    if (JSON.stringify(value) === JSON.stringify(fallback)) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch { /* quota */ }
}

export function useTableFilters<T, ColKey extends string>(
  items: T[], 
  columns: readonly ColKey[], 
  getColValue: (item: T, col: ColKey) => string,
  persistKey?: string
) {
  const emptySearchTexts = useMemo(() => columns.reduce((acc, col) => ({ ...acc, [col]: "" }), {} as Record<ColKey, string>), [columns]);
  const emptySelectedArrays = useMemo(() => columns.reduce((acc, col) => ({ ...acc, [col]: [] as string[] }), {} as Record<ColKey, string[]>), [columns]);

  // Persisted or plain state
  const [sortColumn, setSortColumn] = useState<ColKey | null>(() =>
    persistKey ? loadPersisted<ColKey | null>(`${persistKey}_sortCol`, null) : null
  );
  const [sortDir, setSortDir] = useState<SortDir>(() =>
    persistKey ? loadPersisted<SortDir>(`${persistKey}_sortDir`, null) : null
  );
  const [searchTexts, setSearchTexts] = useState<Record<ColKey, string>>(() =>
    persistKey ? loadPersisted(`${persistKey}_search`, emptySearchTexts) : emptySearchTexts
  );
  // Store selected filters as arrays for serialization, convert to Sets for use
  const [selectedFilterArrays, setSelectedFilterArrays] = useState<Record<ColKey, string[]>>(() =>
    persistKey ? loadPersisted(`${persistKey}_filters`, emptySelectedArrays) : emptySelectedArrays
  );

  const selectedFilters = useMemo(() => {
    const result = {} as Record<ColKey, Set<string>>;
    for (const col of columns) {
      result[col] = new Set(selectedFilterArrays[col] || []);
    }
    return result;
  }, [selectedFilterArrays, columns]);

  // Persist on change
  useEffect(() => {
    if (!persistKey) return;
    savePersisted(`${persistKey}_sortCol`, sortColumn, null);
    savePersisted(`${persistKey}_sortDir`, sortDir, null);
    savePersisted(`${persistKey}_search`, searchTexts, emptySearchTexts);
    savePersisted(`${persistKey}_filters`, selectedFilterArrays, emptySelectedArrays);
  }, [persistKey, sortColumn, sortDir, searchTexts, selectedFilterArrays, emptySearchTexts, emptySelectedArrays]);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const handleSortSafe = (col: ColKey) => {
    if (sortColumn === col) {
      if (sortDir === "asc") {
        setSortDir("desc");
      } else if (sortDir === "desc") {
        setSortDir(null);
        setSortColumn(null);
      } else {
        setSortDir("asc");
      }
    } else {
      setSortColumn(col);
      setSortDir("asc");
    }
  };

  const setSearchText = (col: ColKey, v: string) => setSearchTexts(prev => ({ ...prev, [col]: v }));
  const toggleValue = (col: ColKey, v: string) => {
    setSelectedFilterArrays(prev => {
      const current = prev[col] || [];
      const set = new Set(current);
      set.has(v) ? set.delete(v) : set.add(v);
      return { ...prev, [col]: Array.from(set) };
    });
  };
  const selectAll = (col: ColKey, values: string[]) => setSelectedFilterArrays(prev => ({ ...prev, [col]: [...values] }));
  const clearAll = (col: ColKey) => setSelectedFilterArrays(prev => ({ ...prev, [col]: [] }));

  const clearAllFilters = () => {
    setSearchTexts(emptySearchTexts);
    setSelectedFilterArrays(emptySelectedArrays);
    setSortColumn(null);
    setSortDir(null);
    setCurrentPage(1);
  };

  const hasActiveFilters = columns.some(c => searchTexts[c] !== "" || (selectedFilterArrays[c]?.length || 0) > 0);

  const processedItems = useMemo(() => {
    let result = [...items];
    for (const col of columns) {
      const search = searchTexts[col].toLowerCase();
      const selected = selectedFilters[col];
      if (search) result = result.filter(s => getColValue(s, col).toLowerCase().includes(search));
      if (selected.size > 0) result = result.filter(s => selected.has(getColValue(s, col)));
    }
    if (sortColumn && sortDir) {
      result.sort((a, b) => {
        const va = getColValue(a, sortColumn).toLowerCase();
        const vb = getColValue(b, sortColumn).toLowerCase();
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
    return result;
  }, [items, searchTexts, selectedFilters, sortColumn, sortDir, columns, getColValue]);

  const uniqueValues = useMemo(() => {
    const result = {} as Record<ColKey, string[]>;
    for (const col of columns) {
      result[col] = Array.from(new Set(items.map(s => getColValue(s, col)))).sort();
    }
    return result;
  }, [items, columns, getColValue]);

  const totalPages = Math.max(1, Math.ceil(processedItems.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (safeCurrentPage - 1) * itemsPerPage;
    return processedItems.slice(start, start + itemsPerPage);
  }, [processedItems, safeCurrentPage, itemsPerPage]);

  return {
    sortColumn, sortDir, searchTexts, selectedFilters,
    handleSort: handleSortSafe, setSearchText, toggleValue, selectAll, clearAll, clearAllFilters,
    hasActiveFilters, processedItems, uniqueValues,
    currentPage: safeCurrentPage, setCurrentPage, itemsPerPage, setItemsPerPage, totalPages, paginatedItems
  };
}
