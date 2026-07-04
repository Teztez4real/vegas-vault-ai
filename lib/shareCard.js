/**
 * Generates a shareable PNG "pick card" image matching the Vegas Vault AI
 * dark / battery-green aesthetic — for sharing a play to social media, texts,
 * etc. Drawn entirely on an offscreen <canvas> (not a DOM screenshot) so the
 * output is crisp and consistent across every browser, with full control
 * over the gradients/glow effects that define the app's look.
 *
 * Card format: 1080x1350 (4:5) — the standard portrait ratio that displays
 * cleanly on Instagram, X/Twitter, iMessage, and most social feeds.
 */

const W = 1080;
const H = 1350;
const GREEN = '#39FF14';
const GREEN_DIM = '#22cc00';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth) {
  const words = (text || '').split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * data = {
 *   matchup: "Tampa Bay Rays @ Kansas City Royals",
 *   sport: "MLB",
 *   time: "7:10 PM CT",
 *   pick: "Tampa Bay Rays ML -125",         // pre-formatted via formatPickDisplay
 *   tier: "1" | "2",
 *   confidencePercent: 87,
 *   verdict: "one-sentence reasoning",
 *   resultStamp: "CASHED ✅" | "LOSS ❌" | null,
 *   isVegasSlot: true|false,
 * }
 */
export async function generateShareCardBlob(data) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // ── Background: dark radial gradient, matches the app/landing bg ──
  const bg = ctx.createRadialGradient(W * 0.3, H * 0.15, 0, W * 0.5, H * 0.5, H * 0.9);
  bg.addColorStop(0, '#0f2a0f');
  bg.addColorStop(0.55, '#081208');
  bg.addColorStop(1, '#030803');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid lines for the "tech" texture
  ctx.strokeStyle = 'rgba(57,255,20,0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 54) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 54) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Ambient glow blob (top-right), like the landing page hero aura
  const glow = ctx.createRadialGradient(W * 0.85, H * 0.08, 0, W * 0.85, H * 0.08, 420);
  glow.addColorStop(0, 'rgba(57,255,20,0.16)');
  glow.addColorStop(1, 'rgba(57,255,20,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // ── Logo mark (top left): circular V badge + wordmark ──
  const badgeCx = 96, badgeCy = 100, badgeR = 40;
  ctx.save();
  ctx.shadowColor = 'rgba(57,255,20,0.6)';
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.arc(badgeCx, badgeCy, badgeR, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(6,16,6,0.9)';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = GREEN;
  ctx.stroke();
  ctx.restore();
  // "V" mark
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 9;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  ctx.moveTo(badgeCx - 18, badgeCy - 16);
  ctx.lineTo(badgeCx, badgeCy + 20);
  ctx.lineTo(badgeCx + 18, badgeCy - 16);
  ctx.stroke();

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 30px Arial, sans-serif';
  ctx.fillText('VEGAS', badgeCx + badgeR + 20, badgeCy - 2);
  const vegasWidth = ctx.measureText('VEGAS ').width;
  ctx.fillStyle = GREEN;
  ctx.fillText('VAULT', badgeCx + badgeR + 20 + vegasWidth, badgeCy - 2);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '700 13px Arial, sans-serif';
  ctx.fillText('A I  ·  B E A T  T H E  L I N E', badgeCx + badgeR + 20, badgeCy + 22);

  // ── Live status pill (top right) ──
  const pillText = data.resultStamp ? data.resultStamp : 'AI PLAY';
  ctx.font = '800 20px Arial, sans-serif';
  const pillTextW = ctx.measureText(pillText).width;
  const pillW = pillTextW + 56, pillH = 44;
  const pillX = W - 64 - pillW, pillY = 64;
  const isLoss = data.resultStamp && data.resultStamp.includes('LOSS');
  const pillColor = isLoss ? '#ff6b6b' : GREEN;
  ctx.fillStyle = isLoss ? 'rgba(255,60,60,0.14)' : 'rgba(57,255,20,0.12)';
  roundRect(ctx, pillX, pillY, pillW, pillH, 22);
  ctx.fill();
  ctx.strokeStyle = isLoss ? 'rgba(255,60,60,0.4)' : 'rgba(57,255,20,0.4)';
  ctx.lineWidth = 2;
  roundRect(ctx, pillX, pillY, pillW, pillH, 22);
  ctx.stroke();
  if (!data.resultStamp) {
    ctx.fillStyle = GREEN;
    ctx.beginPath();
    ctx.arc(pillX + 24, pillY + pillH / 2, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = pillColor;
  ctx.font = '800 20px Arial, sans-serif';
  ctx.fillText(pillText, pillX + (data.resultStamp ? 20 : 42), pillY + 29);

  // ── Matchup row ──
  let y = 230;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '700 24px Arial, sans-serif';
  ctx.fillText(`${data.sport || ''}${data.time ? '  ·  ' + data.time : ''}`.trim(), 64, y);

  y += 52;
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 40px Arial, sans-serif';
  const matchupLines = wrapText(ctx, data.matchup || '', W - 128);
  matchupLines.forEach(line => { ctx.fillText(line, 64, y); y += 50; });

  // ── Main glass card: THE PICK ──
  y += 24;
  const cardX = 64, cardW = W - 128;
  const cardTop = y;
  const cardH = 300;
  const cardGrad = ctx.createLinearGradient(cardX, cardTop, cardX, cardTop + cardH);
  cardGrad.addColorStop(0, 'rgba(18,32,18,0.85)');
  cardGrad.addColorStop(1, 'rgba(8,16,8,0.9)');
  ctx.fillStyle = cardGrad;
  roundRect(ctx, cardX, cardTop, cardW, cardH, 28);
  ctx.fill();
  ctx.strokeStyle = 'rgba(57,255,20,0.25)';
  ctx.lineWidth = 2;
  roundRect(ctx, cardX, cardTop, cardW, cardH, 28);
  ctx.stroke();

  let cy = cardTop + 56;
  ctx.fillStyle = GREEN;
  ctx.font = '800 20px Arial, sans-serif';
  ctx.fillText(data.isVegasSlot ? 'VEGAS SLOT PICK' : 'THE PICK', cardX + 40, cy);

  cy += 56;
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 52px Arial, sans-serif';
  const pickLines = wrapText(ctx, data.pick || '', cardW - 80);
  pickLines.slice(0, 2).forEach(line => { ctx.fillText(line, cardX + 40, cy); cy += 60; });

  // Tier + confidence chips
  cy += 20;
  const tierLabel = data.tier === '1' ? '🔒 TIER 1 LOCK' : `TIER ${data.tier || '2'}`;
  ctx.font = '800 24px Arial, sans-serif';
  const tierW = ctx.measureText(tierLabel).width + 44;
  ctx.fillStyle = 'rgba(57,255,20,0.14)';
  roundRect(ctx, cardX + 40, cy - 30, tierW, 46, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(57,255,20,0.35)';
  ctx.lineWidth = 2;
  roundRect(ctx, cardX + 40, cy - 30, tierW, 46, 12);
  ctx.stroke();
  ctx.fillStyle = GREEN;
  ctx.fillText(tierLabel, cardX + 62, cy + 2);

  if (data.confidencePercent != null) {
    const confText = `${data.confidencePercent}% CONFIDENCE`;
    const confX = cardX + 40 + tierW + 20;
    const confW = ctx.measureText(confText).width + 44;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(ctx, confX, cy - 30, confW, 46, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    roundRect(ctx, confX, cy - 30, confW, 46, 12);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(confText, confX + 22, cy + 2);
  }

  // ── Verdict / reasoning snippet ──
  y = cardTop + cardH + 56;
  if (data.verdict) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '800 18px Arial, sans-serif';
    ctx.fillText('WHY', 64, y);
    y += 36;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '400 26px Arial, sans-serif';
    const verdictLines = wrapText(ctx, data.verdict, W - 128);
    verdictLines.slice(0, 4).forEach(line => { ctx.fillText(line, 64, y); y += 36; });
  }

  // ── Footer ──
  const footerY = H - 70;
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(64, footerY - 34);
  ctx.lineTo(W - 64, footerY - 34);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '700 20px Arial, sans-serif';
  ctx.fillText('vegasvaultai.com', 64, footerY);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '600 18px Arial, sans-serif';
  ctx.fillText('The AI that beats the line.', W - 64, footerY);
  ctx.textAlign = 'left';

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1));
}

/**
 * Shares or downloads the generated card. Uses the native Web Share API
 * (with file support) on mobile so it opens the OS share sheet directly;
 * falls back to triggering a PNG download on desktop/unsupported browsers.
 */
export async function shareOrDownloadCard(data, filenameBase = 'vegas-vault-pick') {
  const blob = await generateShareCardBlob(data);
  const filename = `${filenameBase}.png`;

  if (navigator.canShare) {
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Vegas Vault AI Pick',
          text: data.pick ? `${data.pick} — via Vegas Vault AI` : 'Vegas Vault AI Pick',
        });
        return { method: 'share' };
      } catch (e) {
        if (e?.name === 'AbortError') return { method: 'cancelled' };
        // fall through to download on other share errors
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { method: 'download' };
}
