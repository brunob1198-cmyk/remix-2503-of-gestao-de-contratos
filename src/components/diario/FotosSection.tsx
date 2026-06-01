import React, { useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SmartImage } from "@/components/ui/SmartImage";
import { Camera, Plus, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface FotosSectionProps {
  fotos: any[];
  photoGroups: string[];
  setPhotoGroups: React.Dispatch<React.SetStateAction<string[]>>;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>, classificacao: string) => void;
  onRemove: (id: string) => void;
  setPhotoView: (foto: any) => void;
}

function FotosSection({
  fotos,
  photoGroups,
  setPhotoGroups,
  onUpload,
  onRemove,
  setPhotoView,
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

  const handleDrop = useCallback((e: React.DragEvent, group: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveGroup(null);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const syntheticEvent = {
        target: {
          files: e.dataTransfer.files
        }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      onUpload(syntheticEvent, group);
    }
  }, [onUpload]);

  const unlistedPhotos = fotos.filter(
    f => !f.diario_producao_id && (!f.classificacao || !photoGroups.includes(f.classificacao)),
  );

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
          const groupPhotos = fotos.filter(f => !f.diario_producao_id && f.classificacao === group);
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
              <div className="grid grid-cols-4 gap-4">
                {groupPhotos.map(f => (
                  <div key={f.id} className="relative group rounded overflow-hidden border">
                    <SmartImage
                      src={f.thumb_url || f.url}
                      context="diario_fotos"
                      fallbackUrls={[f.thumb_600_url, f.url]}
                      className="w-full h-32 object-cover cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => setPhotoView(f)}
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(f.id);
                      }}
                      type="button"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {groupPhotos.length === 0 && (
                  <div className="col-span-4 py-4 text-center text-xs text-muted-foreground border border-dashed rounded italic">
                    Nenhuma foto neste grupo
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {unlistedPhotos.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b pb-1">
              <h3 className="font-semibold text-sm">Outras / Geral</h3>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {unlistedPhotos.map(f => (
                <div key={f.id} className="relative group rounded overflow-hidden border">
                  <SmartImage
                    src={f.thumb_url || f.url}
                    context="diario_fotos"
                    fallbackUrls={[f.thumb_600_url, f.url]}
                    className="w-full h-32 object-cover cursor-pointer hover:scale-105 transition-transform"
                    onClick={() => setPhotoView(f)}
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(f.id);
                    }}
                    type="button"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default React.memo(FotosSection);
