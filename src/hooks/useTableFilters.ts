import { useState, useMemo, useCallback } from "react";
import { SortDir } from "@/components/medicoes/ColumnHeader";

export function useTableFilters<T, ColKey extends string>(
  items: T[], 
  columns: readonly ColKey[], 
  getColValue: (item: T, col: ColKey) => string
) {
  const [sortColumn, setSortColumn] = useState<ColKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  
  const initialSearchTexts = useMemo(() => columns.reduce((acc, col) => ({ ...acc, [col]: "" }), {} as Record<ColKey, string>), [columns]);
  const initialSelectedFilters = useMemo(() => columns.reduce((acc, col) => ({ ...acc, [col]: new Set<string>() }), {} as Record<ColKey, Set<string>>), [columns]);
  
  const [searchTexts, setSearchTexts] = useState<Record<ColKey, string>>(initialSearchTexts);
  const [selectedFilters, setSelectedFilters] = useState<Record<ColKey, Set<string>>>(initialSelectedFilters);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const handleSort = useCallback((col: ColKey) => {
    setSortColumn(prevCol => {
      if (prevCol === col) {
        setSortDir(prevDir => {
          if (prevDir === "asc") return "desc";
          if (prevDir === "desc") return null;
          return "asc";
        });
        return sortDir === "desc" ? null : col; // keep col unless going back to null
      }
      setSortDir("asc");
      return col;
    });
  }, [sortDir]);

  // Handle case where we click again and it zeroes:
  // wait, the above handleSort has a closure trap if it uses state without functional updates.
  // We can do it linearly:
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
    setSelectedFilters(prev => {
      const next = new Set(prev[col]);
      next.has(v) ? next.delete(v) : next.add(v);
      return { ...prev, [col]: next };
    });
  };
  const selectAll = (col: ColKey, values: string[]) => setSelectedFilters(prev => ({ ...prev, [col]: new Set(values) }));
  const clearAll = (col: ColKey) => setSelectedFilters(prev => ({ ...prev, [col]: new Set() }));

  const clearAllFilters = () => {
    setSearchTexts(initialSearchTexts);
    setSelectedFilters(initialSelectedFilters);
    setSortColumn(null);
    setSortDir(null);
    setCurrentPage(1);
  };

  const hasActiveFilters = columns.some(c => searchTexts[c] !== "" || selectedFilters[c].size > 0);

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
