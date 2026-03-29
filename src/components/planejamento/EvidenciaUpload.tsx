import { useState, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { extractExifGeoData, ExifGeoData } from "@/lib/exifExtractor";
import { toast } from "sonner";
import { Upload, MapPin, Camera, Loader2, CheckCircle, AlertTriangle, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface EvidenciaUploadProps {
  projetoId: string;
  onEventoCreated: () => void;
}

interface UploadState {
  id: string; // unique ID per upload
  file: File;
  preview: string;
  exifData: ExifGeoData | null;
  ocrResult: any | null;
  status: "extracting" | "exif_found" | "ocr_running" | "ocr_done" | "ready" | "uploading" | "done" | "error";
  finalLat: number | null;
  finalLng: number | null;
  finalDate: string | null;
  geoValidado: boolean;
  geoMetodo: string;
  geoConfianca: string;
  geoDescricao: string;
}

const TIPO_OPTIONS = [
  { value: "producao", label: "Produção" },
  { value: "medicao", label: "Medição" },
  { value: "foto", label: "Foto" },
  { value: "problema", label: "Problema" },
];

let uploadCounter = 0;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function EvidenciaUpload({ projetoId, onEventoCreated }: EvidenciaUploadProps) {
  const [open, setOpen] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [tipo, setTipo] = useState("foto");
  const [item, setItem] = useState("");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);

  const updateUploadById = useCallback((id: string, patch: Partial<UploadState>) => {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }, []);

  const processFile = useCallback(async (file: File) => {
    const preview = URL.createObjectURL(file);
    const id = `upload_${++uploadCounter}_${Date.now()}`;
    const state: UploadState = {
      id,
      file,
      preview,
      exifData: null,
      ocrResult: null,
      status: "extracting",
      finalLat: null,
      finalLng: null,
      finalDate: null,
      geoValidado: true,
      geoMetodo: "exif",
      geoConfianca: "high",
      geoDescricao: "",
    };

    setUploads((prev) => [...prev, state]);

    try {
      // Step 1: Extract EXIF
      const exifData = await extractExifGeoData(file);

      if (exifData.hasGps) {
        updateUploadById(id, {
          exifData,
          status: "exif_found",
          finalLat: exifData.latitude,
          finalLng: exifData.longitude,
          finalDate: exifData.dateTime || new Date().toISOString().split("T")[0],
          geoValidado: true,
          geoMetodo: "exif",
          geoConfianca: "high",
          geoDescricao: "GPS extraído dos metadados EXIF da imagem",
        });
        return;
      }

      // Step 2: No EXIF GPS → OCR fallback
      updateUploadById(id, { exifData, status: "ocr_running" });

      try {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = arrayBufferToBase64(arrayBuffer);

        const { data: ocrResult, error } = await supabase.functions.invoke(
          "extract-geolocation",
          { body: { imageBase64: base64 } }
        );

        if (error) throw error;

        updateUploadById(id, {
          ocrResult,
          status: "ocr_done",
          finalLat: ocrResult?.latitude || null,
          finalLng: ocrResult?.longitude || null,
          finalDate: exifData.dateTime || new Date().toISOString().split("T")[0],
          geoValidado: false,
          geoMetodo: ocrResult?.method || "ocr",
          geoConfianca: ocrResult?.confidence || "low",
          geoDescricao: ocrResult?.location_description || "Localização estimada via IA",
        });
      } catch (err) {
        console.error("OCR fallback failed:", err);
        updateUploadById(id, {
          status: "ocr_done",
          finalDate: exifData.dateTime || new Date().toISOString().split("T")[0],
          geoValidado: false,
          geoMetodo: "none",
          geoConfianca: "none",
          geoDescricao: "Não foi possível extrair localização",
        });
      }
    } catch (err) {
      console.error("File processing failed:", err);
      updateUploadById(id, {
        status: "error",
        geoDescricao: "Erro ao processar arquivo",
      });
    }
  }, [updateUploadById]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      acceptedFiles.forEach((file) => processFile(file));
    },
    [processFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".heic", ".webp"] },
    maxFiles: 10,
  });

  const handleSave = async () => {
    if (uploads.length === 0) return;
    setSaving(true);

    try {
      for (const upload of uploads) {
        if (upload.status === "error") continue;

        // Upload image to storage
        const ext = upload.file.name.split(".").pop() || "jpg";
        const fileName = `${projetoId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("timeline-evidencias")
          .upload(fileName, upload.file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("timeline-evidencias")
          .getPublicUrl(fileName);

        // Create timeline event
        const { error: insertError } = await supabase
          .from("timeline_eventos")
          .insert({
            projeto_id: projetoId,
            data: upload.finalDate || new Date().toISOString().split("T")[0],
            tipo,
            item: item || null,
            latitude: upload.finalLat,
            longitude: upload.finalLng,
            imagem_url: urlData.publicUrl,
            status: upload.geoValidado ? "ok" : "nao_validado",
            observacao: observacao || null,
            geo_validado: upload.geoValidado,
            geo_metodo: upload.geoMetodo,
            geo_confianca: upload.geoConfianca,
            geo_descricao: upload.geoDescricao,
          } as any);

        if (insertError) throw insertError;
      }

      toast.success(`${uploads.length} evidência(s) salva(s) com sucesso`);
      // Clean up object URLs
      uploads.forEach((u) => URL.revokeObjectURL(u.preview));
      setUploads([]);
      setItem("");
      setObservacao("");
      setOpen(false);
      onEventoCreated();
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error(err.message || "Erro ao salvar evidências");
    } finally {
      setSaving(false);
    }
  };

  const allReady = uploads.length > 0 && uploads.every(
    (u) => u.status === "exif_found" || u.status === "ocr_done" || u.status === "error"
  );

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v) {
        uploads.forEach((u) => URL.revokeObjectURL(u.preview));
        setUploads([]);
      }
      setOpen(v);
    }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Camera className="h-4 w-4" /> Upload Evidência
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Upload de Evidência com Geolocalização
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
              isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"
            )}
          >
            <input {...getInputProps()} />
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Arraste fotos aqui ou clique para selecionar
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              GPS será extraído automaticamente dos metadados EXIF
            </p>
          </div>

          {/* Upload items */}
          {uploads.map((upload) => (
            <Card key={upload.id} className="overflow-hidden">
              <CardContent className="p-3">
                <div className="flex gap-3">
                  <img
                    src={upload.preview}
                    alt="Preview"
                    className="w-20 h-20 object-cover rounded-md flex-shrink-0"
                  />
                  <div className="flex-1 space-y-1.5">
                    <p className="text-sm font-medium truncate">{upload.file.name}</p>

                    {upload.status === "extracting" && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Extraindo metadados EXIF...
                      </div>
                    )}

                    {upload.status === "exif_found" && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                          <CheckCircle className="h-3.5 w-3.5" />
                          GPS encontrado via EXIF
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {upload.finalLat?.toFixed(6)}, {upload.finalLng?.toFixed(6)}
                        </div>
                      </div>
                    )}

                    {upload.status === "ocr_running" && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs text-amber-600">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Sem GPS no EXIF — analisando imagem via IA...
                        </div>
                        <Progress value={60} className="h-1.5" />
                      </div>
                    )}

                    {upload.status === "ocr_done" && (
                      <div className="space-y-1">
                        {upload.finalLat && upload.finalLng ? (
                          <>
                            <div className="flex items-center gap-1.5 text-xs text-amber-600">
                              <Eye className="h-3.5 w-3.5" />
                              Localização estimada via IA
                              <Badge variant="outline" className="text-[10px] ml-1">
                                {upload.geoConfianca}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {upload.finalLat?.toFixed(6)}, {upload.finalLng?.toFixed(6)}
                            </div>
                            <p className="text-[11px] text-muted-foreground">{upload.geoDescricao}</p>
                            <Badge variant="secondary" className="text-[10px]">Não validado</Badge>
                          </>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Sem coordenadas — evento será salvo sem localização
                          </div>
                        )}
                      </div>
                    )}

                    {upload.status === "error" && (
                      <div className="flex items-center gap-1.5 text-xs text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Erro ao processar arquivo
                      </div>
                    )}

                    {upload.finalDate && (
                      <p className="text-[11px] text-muted-foreground">
                        Data: {upload.finalDate}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Metadata form */}
          {uploads.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Tipo</label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPO_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Item</label>
                <Input
                  placeholder="Ex: Implantação de poste"
                  value={item}
                  onChange={(e) => setItem(e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium mb-1 block">Observação</label>
                <Textarea
                  placeholder="Detalhes da execução..."
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              uploads.forEach((u) => URL.revokeObjectURL(u.preview));
              setUploads([]);
              setOpen(false);
            }}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!allReady || saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Salvar {uploads.length > 0 ? `(${uploads.length})` : ""}
            </Button>
          </div>

          {/* Info */}
          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium">Como funciona:</p>
            <p>1. <strong>EXIF GPS</strong> — Se a foto tem coordenadas GPS nos metadados, são usadas automaticamente ✓</p>
            <p>2. <strong>OCR/IA</strong> — Se não há GPS, a IA analisa a imagem buscando placas, endereços e referências</p>
            <p>3. Fotos sem localização são salvas como <Badge variant="secondary" className="text-[10px]">não validado</Badge></p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}