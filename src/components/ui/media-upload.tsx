"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, X, ImageIcon } from "lucide-react";

type Props = {
  value?: string | null;
  onChange: (url: string | null) => void;
  bucket?: string;
  folder?: string;
  accept?: string;
  disabled?: boolean;
};

export function MediaUpload({
  value,
  onChange,
  bucket = "student-photos",
  folder = "photos",
  accept = "image/*",
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("請選擇圖片文件");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("圖片大小不能超過 5MB");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      // Generate unique filename
      const ext = file.name.split(".").pop() ?? "jpg";
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const filepath = `${folder}/${filename}`;

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filepath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("[MediaUpload] Upload failed:", uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filepath);
      onChange(urlData.publicUrl);
    } catch (err) {
      console.error("[MediaUpload] Error:", err);
      setError(err instanceof Error ? err.message : "上傳失敗");
    } finally {
      setUploading(false);
      // Reset input
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  async function handleRemove() {
    if (!value) return;

    try {
      // Extract filepath from URL
      const urlObj = new URL(value);
      const pathParts = urlObj.pathname.split("/");
      const filepath = pathParts.slice(pathParts.indexOf(bucket) + 1).join("/");

      // Delete from storage
      await supabase.storage.from(bucket).remove([filepath]);
      onChange(null);
    } catch (err) {
      console.error("[MediaUpload] Remove failed:", err);
      // Still clear the value even if delete fails
      onChange(null);
    }
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative inline-block w-full">
          <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="學生照片"
              className="max-h-40 w-full object-cover"
            />
          </div>
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled || uploading}
            className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => !disabled && !uploading && inputRef.current?.click()}
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-6 transition-colors ${
            disabled || uploading
              ? "cursor-not-allowed opacity-50"
              : "cursor-pointer hover:border-slate-300 hover:bg-slate-100"
          }`}
        >
          <ImageIcon className="mb-2 h-8 w-8 text-slate-400" />
          <p className="text-xs text-slate-500">
            {uploading ? "上傳中…" : "點擊上傳照片"}
          </p>
          <p className="mt-1 text-xs text-slate-400">JPG、PNG，最大 5MB</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        disabled={disabled || uploading}
        className="hidden"
      />

      {!value && !uploading && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="w-full"
        >
          <Upload className="mr-2 h-4 w-4" />
          選擇照片
        </Button>
      )}

      {uploading && (
        <div className="flex items-center justify-center text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          上傳中…
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
