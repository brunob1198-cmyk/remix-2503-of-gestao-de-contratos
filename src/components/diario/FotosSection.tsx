import React, { useRef, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SmartImage } from "@/components/ui/SmartImage";
import { Camera, Plus, Trash2, Upload, GripVertical, Trash } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface DeleteAllButtonProps {
  label: string;
  count: number;
  onConfirm: () => void;
}

function DeleteAllButton({ label, count, onConfirm }: DeleteAllButtonProps) {
  if (count === 0) return null;
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" type="button">
          <Trash className="h-3.5 w-3.5 mr-1" /> Excluir todas
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir todas as fotos?</AlertDialogTitle>
          <AlertDialogDescription>
            {count} foto(s) do grupo "{label}" serão excluídas permanentemente. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Excluir todas</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface FotosSectionProps {
  fotos: any[];
  photoGroups: string[];
  setPhotoGroups: React.Dispatch<React.SetStateAction<string[]>>;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>, classificacao: string) => void;
  onRemove: (id: string) => void;
  setPhotoView: (foto: any) => void;
  producoes?: any[];
  onReorder?: (ordens: Array<{ id: string; ordem: number }>) => void;
}

/** Normaliza acentos/caixa para casar classificações como "Execução" e "execucao". */
const norm = (v?: string | null) =>
  (v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

interface PhotoGridProps {
  photos: any[];
  groupKey: string;
  dragActive: boolean;
  onDragEnter: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDropFiles: (e: React.DragEvent) => void;
  onRemove: (id: string) => void;
  setPhotoView: (foto: any) => void;
  onReorder?: (ordens: Array<{ id: string; ordem: number }>) => void;
  emptyHint?: boolean;
}

function PhotoGrid({
  photos,
  groupKey,
  dragActive,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDropFiles,
  onRemove,
  setPhotoView,
  onReorder,
  emptyHint = true,
}: PhotoGridProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  const resetDrag = () => {
    dragIndexRef.current = null;
    setDragIndex(null);
    setOverIndex(null);
  };

  const handlePhotoDrop = (targetIndex: number) => {
    const from = dragIndexRef.current;
    if (from === null || from === targetIndex || !onReorder) {
      resetDrag();
      return;
    }
    const next = [...photos];
    const [moved] = next.splice(from, 1);
    next.splice(targetIndex, 0, moved);
    onReorder(next.map((p, i) => ({ id: p.id, ordem: i })));
    resetDrag();
  };

  return (
    <div
      className={cn(
        "grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg border-2 border-transparent transition-all",
        dragActive ? "border-dashed border-primary bg-primary/5" : "border-transparent",
      )}
      onDragEnter={e => {
        if (dragIndexRef.current !== null) return;
        onDragEnter(e);
      }}
      onDragOver={e => {
        if (dragIndexRef.current !== null) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          return;
        }
        onDragOver(e);
      }}
      onDragLeave={e => {
        if (dragIndexRef.current !== null) return;
        onDragLeave(e);
      }}
      onDrop={e => {
        if (dragIndexRef.current !== null) {
          e.preventDefault();
          e.stopPropagation();
          // soltou fora de uma foto: manda para o fim da lista
          handlePhotoDrop(photos.length - 1);
          return;
        }
        onDropFiles(e);
      }}
    >
      {photos.map((f, index) => (
        <div
          key={f.id}
          draggable={!!onReorder}
          onDragStart={e => {
            if (!onReorder) return;
            e.stopPropagation();
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", `${groupKey}:${f.id}`);
            dragIndexRef.current = index;
            setDragIndex(index);
          }}
          onDragEnter={e => {
            if (dragIndexRef.current === null) return;
            e.preventDefault();
            e.stopPropagation();
            setOverIndex(index);
          }}
          onDragOver={e => {
            if (dragIndexRef.current === null) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "move";
            if (overIndex !== index) setOverIndex(index);
          }}
          onDrop={e => {
            if (dragIndexRef.current === null) return;
            e.preventDefault();
            e.stopPropagation();
            handlePhotoDrop(index);
          }}
          onDragEnd={resetDrag}
          className={cn(
            "relative group rounded overflow-hidden border bg-background transition-all",
            dragIndex === index && "opacity-40",
            overIndex === index && dragIndex !== null && dragIndex !== index && "ring-2 ring-primary",
          )}
        >
          <SmartImage
            src={f.thumb_url || f.url}
            context="diario_fotos"
            fallbackUrls={[f.thumb_600_url, f.url]}
            draggable={false}
            className="w-full h-32 object-cover cursor-pointer hover:scale-105 transition-transform"
            onClick={() => setPhotoView(f)}
          />
          <span className="absolute bottom-1 left-1 z-10 rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-semibold">
            #{index + 1}
          </span>
          {onReorder && (
            <span className="absolute top-1 left-1 z-10 rounded bg-background/85 p-1 cursor-grab active:cursor-grabbing">
              <GripVertical className="h-3 w-3 text-muted-foreground" />
            </span>
          )}
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={e => {
              e.stopPropagation();
              onRemove(f.id);
            }}
            type="button"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}

      {photos.length === 0 && emptyHint && (
        <div className="col-span-2 md:col-span-4 py-8 text-center text-sm text-muted-foreground border border-dashed rounded-lg bg-muted/30 flex flex-col items-center gap-2">
          <Upload className="h-8 w-8 text-muted-foreground/50" />
          <p>Arraste fotos aqui ou use o botão adicionar</p>
        </div>
      )}
    </div>
  );
}

function FotosSection({
  fotos,
  photoGroups,
  setPhotoGroups,
  onUpload,
  onRemove,
  setPhotoView,
  producoes = [],
  onReorder,
}: FotosSectionProps) {
  const [newGroupName, setNewGroupName] = useState("");
  const [dragActiveGroup, setDragActiveGroup] = useState<string | null>(null);
  const photoGroupUploadRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleDrag = useCallback((e: React.DragEvent, group: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActiveGroup(group);
    } else if (e.type === "dragleave") {
      setDragActiveGroup(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, group: string) => {
      setDragActiveGroup(null);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        e.preventDefault();
        e.stopPropagation();
        const syntheticEvent = {
          target: { files: e.dataTransfer.files },
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        onUpload(syntheticEvent, group);
      }
    },
    [onUpload],
  );

  const gerais = useMemo(() => fotos.filter(f => !f.diario_producao_id), [fotos]);
  const normGroups = useMemo(() => photoGroups.map(norm), [photoGroups]);

  const unlistedPhotos = useMemo(
    () => gerais.filter(f => !normGroups.includes(norm(f.classificacao))),
    [gerais, normGroups],
  );

  // Fotos vinculadas a itens de produção — antes ficavam invisíveis na tela.
  const fotosPorProducao = useMemo(() => {
    const map = new Map<string, any[]>();
    fotos.forEach(f => {
      if (!f.diario_producao_id) return;
      const arr = map.get(f.diario_producao_id) || [];
      arr.push(f);
      map.set(f.diario_producao_id, arr);
    });
    return Array.from(map.entries()).map(([producaoId, list]) => {
      const prod = producoes.find((p: any) => p.id === producaoId);
      const label = prod
        ? `${prod.item_lpu?.codigo ? `${prod.item_lpu.codigo} — ` : ""}${prod.item_lpu?.descricao || "Item de produção"}`
        : "Item de produção removido";
      return { producaoId, label, list };
    });
  }, [fotos, producoes]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Fotos Gerais</CardTitle>
        <div className="flex gap-2">
          <Input
            placeholder="Novo grupo..."
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            className="h-8 w-32"
            onKeyDown={e => {
              if (e.key === "Enter" && newGroupName.trim()) {
                setPhotoGroups(prev => [...prev, newGroupName.trim()]);
                setNewGroupName("");
              }
            }}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => {
              if (newGroupName.trim()) {
                setPhotoGroups(prev => [...prev, newGroupName.trim()]);
                setNewGroupName("");
              }
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {photoGroups.map(group => {
          const groupPhotos = gerais.filter(f => norm(f.classificacao) === norm(group));
          return (
            <div key={group} className="space-y-3">
              <div className="flex items-center justify-between border-b pb-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">{group}</h3>
                  <Badge variant="outline" className="text-[10px]">{groupPhotos.length}</Badge>
                </div>
                <div className="flex gap-1">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    id={`foto-${group}`}
                    ref={el => (photoGroupUploadRefs.current[group] = el)}
                    onChange={e => onUpload(e, group)}
                  />
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => photoGroupUploadRefs.current[group]?.click()}>
                    <Camera className="h-3.5 w-3.5 mr-1" /> Add Fotos
                  </Button>
                  <DeleteAllButton
                    label={group}
                    count={groupPhotos.length}
                    onConfirm={() => groupPhotos.forEach(f => onRemove(f.id))}
                  />

                  {!["Execução", "Vistoria"].includes(group) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => setPhotoGroups(prev => prev.filter(g => g !== group))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              <PhotoGrid
                photos={groupPhotos}
                groupKey={`grupo-${group}`}
                dragActive={dragActiveGroup === group}
                onDragEnter={e => handleDrag(e, group)}
                onDragOver={e => handleDrag(e, group)}
                onDragLeave={e => handleDrag(e, null)}
                onDropFiles={e => handleDrop(e, group)}
                onRemove={onRemove}
                setPhotoView={setPhotoView}
                onReorder={onReorder}
              />
            </div>
          );
        })}

        {fotosPorProducao.map(({ producaoId, label, list }) => (
          <div key={producaoId} className="space-y-3">
            <div className="flex items-center justify-between border-b pb-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">Produção: {label}</h3>
                <Badge variant="outline" className="text-[10px]">{list.length}</Badge>
              </div>
              <DeleteAllButton
                label={`Produção: ${label}`}
                count={list.length}
                onConfirm={() => list.forEach(f => onRemove(f.id))}
              />
            </div>
            <PhotoGrid
              photos={list}
              groupKey={`producao-${producaoId}`}
              dragActive={false}
              onDragEnter={() => {}}
              onDragOver={() => {}}
              onDragLeave={() => {}}
              onDropFiles={() => {}}
              onRemove={onRemove}
              setPhotoView={setPhotoView}
              onReorder={onReorder}
              emptyHint={false}
            />
          </div>
        ))}

        {unlistedPhotos.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b pb-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">Outras / Geral</h3>
                <Badge variant="outline" className="text-[10px]">{unlistedPhotos.length}</Badge>
              </div>
              <DeleteAllButton
                label="Outras / Geral"
                count={unlistedPhotos.length}
                onConfirm={() => unlistedPhotos.forEach(f => onRemove(f.id))}
              />
            </div>
            <PhotoGrid
              photos={unlistedPhotos}
              groupKey="outras"
              dragActive={false}
              onDragEnter={() => {}}
              onDragOver={() => {}}
              onDragLeave={() => {}}
              onDropFiles={() => {}}
              onRemove={onRemove}
              setPhotoView={setPhotoView}
              onReorder={onReorder}
              emptyHint={false}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default React.memo(FotosSection);
