import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/presentation/components/ui/button";

/** Finger / mouse signature capture. Calls onChange with a PNG blob (or null when cleared). */
export function SignaturePad({ onChange }: { onChange: (png: Blob | null) => void }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = ref.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111D18";
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  const start = (e: React.PointerEvent) => {
    drawing.current = true;
    ref.current!.setPointerCapture(e.pointerId);
    const ctx = ref.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(...pos(e));
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = ref.current!.getContext("2d")!;
    ctx.lineTo(...pos(e));
    ctx.stroke();
    setEmpty(false);
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    ref.current!.toBlob((b) => onChange(b), "image/png");
  };
  const clear = () => {
    const c = ref.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
    onChange(null);
  };
  return (
    <div className="space-y-2">
      <div className="relative">
        <canvas
          ref={ref}
          className="h-36 w-full touch-none rounded-xl border-2 border-dashed bg-white"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          aria-label={t("wo.signHere")}
          role="img"
        />
        {empty && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">{t("wo.signHere")}</span>}
      </div>
      <Button type="button" size="sm" variant="ghost" onClick={clear}>
        <Eraser /> {t("wo.clearSignature")}
      </Button>
    </div>
  );
}
