"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  FilterFn,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowDown, ArrowUp, ChevronsUpDown, Filter, Search, X, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/AuthContext"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"


// A custom filter function for multi-select
export const multiSelectFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  if (!value || value.length === 0) return true;
  const rowValue = row.getValue(columnId);
  return value.includes(rowValue);
};

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchKey?: string
  searchPlaceholder?: string
  persistKey?: string
}


export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Buscar...",
  persistKey,
}: DataTableProps<TData, TValue>) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Load state from DB
  const { data: dbPreferences, isLoading: isLoadingPrefs } = useQuery({
    queryKey: ["user_preferences", persistKey, user?.id],
    enabled: !!persistKey && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("value")
        .eq("user_id", user!.id)
        .eq("key", `dt_${persistKey}`)
        .maybeSingle();
      
      if (error) throw error;
      return data?.value as any || null;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (newValue: any) => {
      if (!persistKey || !user?.id) return;
      
      const { error } = await supabase
        .from("user_preferences")
        .upsert({
          user_id: user.id,
          key: `dt_${persistKey}`,
          value: newValue,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,key' });

      if (error) throw error;
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      if (!persistKey || !user?.id) return;
      const { error } = await supabase
        .from("user_preferences")
        .delete()
        .eq("user_id", user.id)
        .eq("key", `dt_${persistKey}`);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_preferences", persistKey] });
      setSorting([]);
      setColumnFilters([]);
      setPagination({ pageIndex: 0, pageSize: 10 });
      toast.success("Filtros e ordenação resetados");
    },
  });

  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 })

  // Synchronize state when DB data arrives
  React.useEffect(() => {
    if (dbPreferences) {
      if (dbPreferences.sorting) setSorting(dbPreferences.sorting);
      if (dbPreferences.filters) setColumnFilters(dbPreferences.filters);
      if (dbPreferences.pagination) setPagination(dbPreferences.pagination);
    }
  }, [dbPreferences]);

  // Debounced save
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  const saveState = React.useCallback((newState: any) => {
    if (!persistKey) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      saveMutation.mutate(newState);
    }, 1000);
  }, [persistKey, saveMutation]);

  React.useEffect(() => {
    if (!persistKey || isLoadingPrefs) return;
    saveState({ sorting, filters: columnFilters, pagination });
  }, [sorting, columnFilters, pagination, persistKey, isLoadingPrefs, saveState]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onPaginationChange: setPagination,
    state: {
      sorting,
      columnFilters,
      pagination,
    },
  })

  const hasChanges = sorting.length > 0 || columnFilters.length > 0 || pagination.pageIndex !== 0 || pagination.pageSize !== 10;


  return (
    <div>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
        {searchKey && (
          <div className="flex items-center w-full sm:max-w-sm">
            <Input
              placeholder={searchPlaceholder}
              value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
              onChange={(event) =>
                table.getColumn(searchKey)?.setFilterValue(event.target.value)
              }
              className="w-full"
            />
          </div>
        )}
        
        {persistKey && (
          <Button 
            variant="ghost" 
            size="sm" 
            className={cn("h-8 px-2 lg:px-3 text-muted-foreground hover:text-foreground transition-colors", !hasChanges && "opacity-50 cursor-not-allowed")}
            onClick={() => clearMutation.mutate()}
            disabled={!hasChanges || clearMutation.isPending}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Limpar Visão
          </Button>
        )}
      </div>

      <div className="rounded-md border bg-card text-card-foreground shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2 px-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  Nenhum resultado encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Pagination controls */}
      <div className="flex items-center justify-between px-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} registro(s) encontrado(s).
        </div>
        <div className="flex items-center space-x-6 lg:space-x-8">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Linhas por página</p>
            <select
              className="h-8 w-[70px] rounded-md border border-input bg-transparent px-2 py-1 text-sm"
              value={table.getState().pagination.pageSize}
              onChange={(e) => {
                table.setPageSize(Number(e.target.value))
              }}
            >
              {[10, 20, 30, 40, 50].map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  {pageSize}
                </option>
              ))}
            </select>
          </div>
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
            Página {table.getState().pagination.pageIndex + 1} de{" "}
            {table.getPageCount()}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Ir para a primeira página</span>
              {"<<"}
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Ir para a página anterior</span>
              {"<"}
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Ir para a próxima página</span>
              {">"}
            </Button>
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Ir para a última página</span>
              {">>"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Custom Header with Sorting
export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: {
  column: any
  title: string
  className?: string
}) {
  if (!column.getCanSort()) {
    return <div className={cn("text-xs font-semibold tracking-wider uppercase", className)}>{title}</div>
  }

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 data-[state=open]:bg-accent text-xs font-semibold tracking-wider uppercase"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        <span>{title}</span>
        {column.getIsSorted() === "desc" ? (
          <ArrowDown className="ml-2 h-3.5 w-3.5" />
        ) : column.getIsSorted() === "asc" ? (
          <ArrowUp className="ml-2 h-3.5 w-3.5" />
        ) : (
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 text-muted-foreground/50" />
        )}
      </Button>
    </div>
  )
}

// Custom Multi-select Filter for Column
export function DataTableColumnFilter<TData, TValue>({
  column,
  title,
  options,
}: {
  column: any
  title: string
  options: { label: string; value: string; icon?: React.ComponentType<{ className?: string }> }[]
}) {
  const selectedValues = new Set(column?.getFilterValue() as string[])
  const [searchValue, setSearchValue] = React.useState("")

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchValue.toLowerCase())
  )

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 border-dashed flex items-center text-xs font-semibold tracking-wider uppercase hover:bg-muted">
          <Filter className="mr-2 h-3.5 w-3.5" />
          {title}
          {selectedValues?.size > 0 && (
            <>
              <div className="mx-2 h-4 w-[1px] bg-border" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
                {selectedValues.size}
              </Badge>
              <div className="hidden space-x-1 lg:flex">
                {selectedValues.size > 2 ? (
                  <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                    {selectedValues.size} selec.
                  </Badge>
                ) : (
                  options
                    .filter((option) => selectedValues.has(option.value))
                    .map((option) => (
                      <Badge variant="secondary" key={option.value} className="rounded-sm px-1 font-normal">
                        {option.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <div className="flex items-center p-2 border-b">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input 
            className="flex h-8 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            placeholder={title}
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto p-1">
          {filteredOptions.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Nenhum encontrado.</div>
          ) : (
            filteredOptions.map((option) => {
              const isSelected = selectedValues.has(option.value)
              return (
                <div
                  key={option.value}
                  className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                  onClick={() => {
                    if (isSelected) {
                      selectedValues.delete(option.value)
                    } else {
                      selectedValues.add(option.value)
                    }
                    const filterValues = Array.from(selectedValues)
                    column?.setFilterValue(
                      filterValues.length ? filterValues : undefined
                    )
                  }}
                >
                  <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  {option.icon && (
                    <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  )}
                  <span>{option.label}</span>
                </div>
              )
            })
          )}
        </div>
        {selectedValues.size > 0 && (
          <div className="border-t p-1">
            <Button
              variant="ghost"
              className="w-full justify-center text-center text-sm"
              onClick={() => column?.setFilterValue(undefined)}
            >
              Limpar filtros
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
