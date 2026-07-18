"use client";

import { useCallback, useRef, useState } from "react";

interface Props {
  onFile: (file: File) => void;
  busy?: boolean;
  /** Kompakt mod: çalışma ekranındaki "zip ekle" düğmesi için */
  compact?: boolean;
}

export default function UploadDropzone({ onFile, busy, compact }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      if (!file.name.toLowerCase().endsWith(".zip")) {
        alert("Lütfen .zip uzantılı bir dosya seçin.");
        return;
      }
      onFile(file);
    },
    [onFile],
  );

  if (compact) {
    return (
      <>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          {busy ? "İşleniyor…" : "+ Zip ekle"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-14 text-center transition-colors ${
        dragOver
          ? "border-blue-500 bg-blue-50"
          : "border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50"
      } ${busy ? "pointer-events-none opacity-60" : ""}`}
    >
      <div className="text-4xl">🗂️</div>
      <p className="mt-3 text-lg font-semibold text-slate-800">
        {busy ? "Faturalar işleniyor…" : "e-Fatura zip dosyasını buraya bırakın"}
      </p>
      <p className="mt-1 text-sm text-slate-500">
        veya tıklayıp seçin — iç içe zip'ler (yıl/ay klasörleri) otomatik açılır
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
