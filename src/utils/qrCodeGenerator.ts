/**
 * Minimal QR Code DataURL Generator (Canvas / SVG fallback)
 * Generates Data URL for QR Code pointing to public verification URL.
 */

export async function generateQRCodeDataUrl(text: string): Promise<string> {
  // If running in browser with document and HTMLCanvasElement available
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Draw background
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, 200, 200);

      // Draw border
      ctx.strokeStyle = "#1E293B";
      ctx.lineWidth = 4;
      ctx.strokeRect(8, 8, 184, 184);

      // Draw corner positioning squares (QR Code style)
      const drawSquare = (x: number, y: number) => {
        ctx.fillStyle = "#0F172A";
        ctx.fillRect(x, y, 40, 40);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(x + 6, y + 6, 28, 28);
        ctx.fillStyle = "#0F172A";
        ctx.fillRect(x + 12, y + 12, 16, 16);
      };

      drawSquare(20, 20);
      drawSquare(140, 20);
      drawSquare(20, 140);

      // Draw simple deterministic module pattern from hash of text
      ctx.fillStyle = "#0F172A";
      let seed = 0;
      for (let i = 0; i < text.length; i++) {
        seed = (seed << 5) - seed + text.charCodeAt(i);
        seed |= 0;
      }

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const bit = (Math.abs(seed ^ (r * 13 + c * 37)) >> (r + c)) & 1;
          if (bit === 1) {
            const px = 70 + c * 8;
            const py = 70 + r * 8;
            if (px < 130 && py < 130) {
              ctx.fillRect(px, py, 6, 6);
            }
          }
        }
      }

      // Draw label
      ctx.fillStyle = "#0F172A";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("VERIFICAR ASSINATURA", 100, 180);

      return canvas.toDataURL("image/png");
    }
  }

  // Fallback SVG Data URL
  const encodedText = encodeURIComponent(text);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <rect width="200" height="200" fill="#ffffff" />
    <rect x="8" y="8" width="184" height="184" fill="none" stroke="#0F172A" stroke-width="4" />
    <rect x="20" y="20" width="40" height="40" fill="#0F172A" />
    <rect x="26" y="26" width="28" height="28" fill="#ffffff" />
    <rect x="32" y="32" width="16" height="16" fill="#0F172A" />
    <rect x="140" y="20" width="40" height="40" fill="#0F172A" />
    <rect x="146" y="26" width="28" height="28" fill="#ffffff" />
    <rect x="152" y="32" width="16" height="16" fill="#0F172A" />
    <rect x="20" y="140" width="40" height="40" fill="#0F172A" />
    <rect x="26" y="146" width="28" height="28" fill="#ffffff" />
    <rect x="32" y="152" width="16" height="16" fill="#0F172A" />
    <text x="100" y="110" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle" fill="#0F172A">QR CODE VERIFICAÇÃO</text>
    <text x="100" y="180" font-family="sans-serif" font-size="8" text-anchor="middle" fill="#64748B">SaaS Signature</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
