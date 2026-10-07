import { BasketballMatchEngine, Particle, FloatingText } from './physics';
import { CourtSurface, InGamePlayer } from '../types/game';

export class CourtRenderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private cachedCourtCanvas: HTMLCanvasElement | null = null;
  private currentSurface: CourtSurface = 'maple';
  private crowdFlashes: Array<{ x: number; y: number; life: number }> = [];

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  public resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.cachedCourtCanvas = null; // Rebuild cache
  }

  // Pre-render court lines to offscreen canvas for zero-overhead 60 FPS (Gopi Mode)
  private getCourtBackground(isHalfCourt: boolean, surface: CourtSurface): HTMLCanvasElement {
    if (this.cachedCourtCanvas && this.currentSurface === surface) {
      return this.cachedCourtCanvas;
    }

    const c = document.createElement('canvas');
    c.width = this.width;
    c.height = this.height;
    const g = c.getContext('2d')!;

    this.currentSurface = surface;

    // Base surface color
    let floorBase = '#D97706'; // Maple
    let lineColor = '#FFFFFF';
    let apronColor = 'rgba(15, 23, 42, 0.85)';
    let keyPaintHome = 'rgba(220, 38, 38, 0.7)';
    let keyPaintAway = 'rgba(30, 58, 138, 0.7)';
    let keyInnerWood = 'rgba(245, 158, 11, 0.25)';

    if (surface === 'parquet') {
      floorBase = '#C27803';
      apronColor = 'rgba(4, 120, 87, 0.85)'; // Classic Boston Green apron
      keyPaintHome = 'rgba(4, 120, 87, 0.75)';
      keyPaintAway = 'rgba(180, 83, 9, 0.75)';
    } else if (surface === 'oak') {
      floorBase = '#B45309';
      apronColor = 'rgba(69, 26, 3, 0.9)'; // Dark walnut apron
      keyPaintHome = 'rgba(146, 64, 14, 0.8)';
      keyPaintAway = 'rgba(30, 58, 138, 0.8)';
    } else if (surface === 'asphalt') {
      floorBase = '#27272A';
      apronColor = 'rgba(24, 24, 27, 0.95)';
      lineColor = '#FACC15'; // Street yellow lines
      keyPaintHome = 'rgba(234, 88, 12, 0.5)';
      keyPaintAway = 'rgba(234, 88, 12, 0.5)';
    } else if (surface === 'neon') {
      floorBase = '#090D16';
      apronColor = 'rgba(15, 23, 42, 0.95)';
      lineColor = '#06B6D4';
      keyPaintHome = 'rgba(6, 182, 212, 0.35)';
      keyPaintAway = 'rgba(147, 51, 234, 0.35)';
    }

    // 1. Draw Arena Outer Perimeter & Floor Base
    g.fillStyle = floorBase;
    g.fillRect(0, 0, this.width, this.height);

    // Court Boundary Margins
    const left = isHalfCourt ? 220 : 60;
    const right = this.width - 60;
    const top = 82;
    const bottom = this.height - 58;
    const courtW = right - left;
    const courtH = bottom - top;
    const midX = left + courtW / 2;
    const midY = top + courtH / 2;

    // 2. High-Detail Wood Grain / Floor Pattern
    if (surface === 'parquet') {
      // Legendary alternating 20x20 parquet wood tiles
      const tileSize = 22;
      for (let py = top; py < bottom; py += tileSize) {
        for (let px = left; px < right; px += tileSize) {
          const isHoriz = Math.floor((px - left) / tileSize + (py - top) / tileSize) % 2 === 0;
          const w = Math.min(tileSize, right - px);
          const h = Math.min(tileSize, bottom - py);

          // Tile base shade variation
          g.fillStyle = isHoriz ? '#D97706' : '#B45309';
          g.fillRect(px, py, w, h);

          // Wood grain lines within the tile
          g.fillStyle = isHoriz ? 'rgba(180, 83, 9, 0.35)' : 'rgba(217, 119, 6, 0.35)';
          if (isHoriz) {
            for (let gy = 4; gy < h; gy += 5) {
              g.fillRect(px, py + gy, w, 1);
            }
          } else {
            for (let gx = 4; gx < w; gx += 5) {
              g.fillRect(px + gx, py, 1, h);
            }
          }

          // Tile seam
          g.strokeStyle = 'rgba(0, 0, 0, 0.15)';
          g.lineWidth = 1;
          g.strokeRect(px, py, w, h);
        }
      }
    } else if (surface === 'maple' || surface === 'oak') {
      // Staggered interlocking maple hardwood planks
      const plankH = 11;
      const plankTones = surface === 'maple' 
        ? ['#E59B3C', '#DC892A', '#CF7D1C', '#EBB058']
        : ['#B45309', '#9A3412', '#78350F', '#A16207'];

      for (let py = top; py < bottom; py += plankH) {
        const rowIdx = Math.floor((py - top) / plankH);
        const h = Math.min(plankH, bottom - py);
        let px = left;
        let pOffset = (rowIdx * 53) % 90;

        while (px < right) {
          const pWidth = 70 + ((px * 17 + rowIdx * 31) % 60);
          const w = Math.min(pWidth, right - px);
          const tone = plankTones[(rowIdx + Math.floor(px / 70)) % plankTones.length];

          g.fillStyle = tone;
          g.fillRect(px, py, w, h);

          // Subtle wood fiber streak
          g.fillStyle = 'rgba(0, 0, 0, 0.08)';
          g.fillRect(px, py + Math.floor(h / 2), w, 1);

          // Butt joint seam
          g.fillStyle = 'rgba(0, 0, 0, 0.2)';
          g.fillRect(px + w - 1, py, 1, h);

          px += w;
        }

        // Horizontal plank seam
        g.fillStyle = 'rgba(0, 0, 0, 0.12)';
        g.fillRect(left, py + h - 1, courtW, 1);
      }

      // Specular High-Gloss Lacquer Reflection Sheen (Diagonally across the hardwood)
      const sheenGrad = g.createLinearGradient(left, top, right, bottom);
      sheenGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
      sheenGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.06)');
      sheenGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.12)');
      sheenGrad.addColorStop(0.65, 'rgba(255, 255, 255, 0.05)');
      sheenGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
      g.fillStyle = sheenGrad;
      g.fillRect(left, top, courtW, courtH);
    } else if (surface === 'asphalt') {
      // Concrete & asphalt court texture
      g.fillStyle = '#27272A';
      g.fillRect(left, top, courtW, courtH);

      // Concrete expansion seams
      g.strokeStyle = 'rgba(0, 0, 0, 0.4)';
      g.lineWidth = 2;
      for (let px = left + 140; px < right; px += 140) {
        g.beginPath();
        g.moveTo(px, top);
        g.lineTo(px, bottom);
        g.stroke();
      }
      for (let py = top + 110; py < bottom; py += 110) {
        g.beginPath();
        g.moveTo(left, py);
        g.lineTo(right, py);
        g.stroke();
      }

      // Hairline pavement cracks & speckles
      g.fillStyle = 'rgba(255, 255, 255, 0.05)';
      for (let i = 0; i < 350; i++) {
        const sx = left + Math.random() * courtW;
        const sy = top + Math.random() * courtH;
        g.fillRect(sx, sy, 2, 2);
      }
    } else if (surface === 'neon') {
      // Cyber Neon Glass Grid
      g.fillStyle = '#090D16';
      g.fillRect(left, top, courtW, courtH);

      g.strokeStyle = 'rgba(6, 182, 212, 0.12)';
      g.lineWidth = 1;
      const grid = 28;
      for (let x = left; x <= right; x += grid) {
        g.beginPath();
        g.moveTo(x, top);
        g.lineTo(x, bottom);
        g.stroke();
      }
      for (let y = top; y <= bottom; y += grid) {
        g.beginPath();
        g.moveTo(left, y);
        g.lineTo(right, y);
        g.stroke();
      }
    }

    // 3. Stained Perimeter Apron (Out-Of-Bounds)
    g.fillStyle = apronColor;
    // Top apron
    g.fillRect(0, 0, this.width, top);
    // Bottom apron
    g.fillRect(0, bottom, this.width, this.height - bottom);
    // Left apron
    g.fillRect(0, 0, left, this.height);
    // Right apron
    g.fillRect(right, 0, this.width - right, this.height);

    // 4. Baseline Out-Of-Bounds Lettering & Branding
    g.save();
    g.font = 'bold 11px "Press Start 2P", monospace';
    g.textAlign = 'center';
    g.fillStyle = 'rgba(255, 255, 255, 0.85)';
    g.shadowColor = '#000000';
    g.shadowBlur = 4;

    if (!isHalfCourt) {
      // Left baseline text (rotated vertical)
      g.save();
      g.translate(left - 24, midY);
      g.rotate(-Math.PI / 2);
      g.fillText('★ RETRO HOOPS ’95 ★', 0, 0);
      g.restore();

      // Right baseline text
      g.save();
      g.translate(right + 24, midY);
      g.rotate(Math.PI / 2);
      g.fillText('★ TUXEDO ARENA ★', 0, 0);
      g.restore();

      // Sideline coaching boxes & scorer's table
      g.fillStyle = 'rgba(255, 255, 255, 0.6)';
      g.font = '8px "Press Start 2P", monospace';
      g.fillText('BROADCAST SCORER’S TABLE', midX, top - 10);
    } else {
      g.fillText('★ 3v3 STREETBALL TOURNAMENT ★', midX, bottom + 24);
    }
    g.restore();

    // 5. Main Court Boundary Line (Thick outer stripe)
    g.strokeStyle = lineColor;
    g.lineWidth = 4;
    g.strokeRect(left, top, courtW, courtH);

    // 6. Center Court Markings
    if (!isHalfCourt) {
      // Half-court line
      g.beginPath();
      g.moveTo(midX, top);
      g.lineTo(midX, bottom);
      g.stroke();

      // Outer dashed restraining circle
      g.save();
      g.setLineDash([8, 8]);
      g.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(midX, midY, 68, 0, Math.PI * 2);
      g.stroke();
      g.restore();

      // Inner solid jump circle with logo fill
      g.fillStyle = 'rgba(255, 255, 255, 0.15)';
      g.beginPath();
      g.arc(midX, midY, 44, 0, Math.PI * 2);
      g.fill();
      g.stroke();

      // Center Court 16-Bit Basketball Emblem
      g.save();
      g.translate(midX, midY);
      g.strokeStyle = lineColor;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, 0, 24, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.moveTo(-24, 0);
      g.lineTo(24, 0);
      g.moveTo(0, -24);
      g.lineTo(0, 24);
      g.stroke();
      g.restore();
    }

    // 7. Paint Keys (Free Throw Lanes) with Hash Marks & Charge Arcs
    const keyWidth = 150;
    const keyHeight = 126;

    // LEFT KEY (Home)
    if (!isHalfCourt) {
      // Painted key background
      g.fillStyle = keyPaintHome;
      g.fillRect(left, midY - keyHeight / 2, keyWidth, keyHeight);
      g.strokeStyle = lineColor;
      g.lineWidth = 3;
      g.strokeRect(left, midY - keyHeight / 2, keyWidth, keyHeight);

      // Rebound block hash marks along lane
      g.fillStyle = lineColor;
      const hashYTop = midY - keyHeight / 2;
      const hashYBot = midY + keyHeight / 2;
      [36, 68, 96, 120].forEach(hx => {
        g.fillRect(left + hx, hashYTop - 6, 4, 8);
        g.fillRect(left + hx, hashYBot - 2, 4, 8);
      });

      // Free throw circle
      g.beginPath();
      g.arc(left + keyWidth, midY, 48, -Math.PI / 2, Math.PI / 2);
      g.stroke();
      // Dashed back half of free throw circle
      g.save();
      g.setLineDash([6, 6]);
      g.beginPath();
      g.arc(left + keyWidth, midY, 48, Math.PI / 2, -Math.PI / 2);
      g.stroke();
      g.restore();

      // Restricted Area Charge Arc (4-foot arc under hoop)
      g.beginPath();
      g.arc(80, midY, 26, -Math.PI / 2, Math.PI / 2);
      g.stroke();

      // 3-Point Line (with NBA straight corner lines)
      const cornerYTop = midY - 172;
      const cornerYBot = midY + 172;
      g.beginPath();
      g.moveTo(left, cornerYTop);
      g.lineTo(left + 64, cornerYTop);
      g.arc(80, midY, 215, -Math.PI / 2.9, Math.PI / 2.9);
      g.lineTo(left, cornerYBot);
      g.stroke();
    }

    // RIGHT KEY (Away / 3v3 Hoop)
    const keyLeft = right - keyWidth;
    g.fillStyle = keyPaintAway;
    g.fillRect(keyLeft, midY - keyHeight / 2, keyWidth, keyHeight);
    g.strokeStyle = lineColor;
    g.lineWidth = 3;
    g.strokeRect(keyLeft, midY - keyHeight / 2, keyWidth, keyHeight);

    // Rebound block hash marks
    g.fillStyle = lineColor;
    const rHashYTop = midY - keyHeight / 2;
    const rHashYBot = midY + keyHeight / 2;
    [36, 68, 96, 120].forEach(hx => {
      g.fillRect(right - hx, rHashYTop - 6, 4, 8);
      g.fillRect(right - hx, rHashYBot - 2, 4, 8);
    });

    // Free throw circle
    g.beginPath();
    g.arc(keyLeft, midY, 48, Math.PI / 2, -Math.PI / 2);
    g.stroke();
    // Dashed back half
    g.save();
    g.setLineDash([6, 6]);
    g.beginPath();
    g.arc(keyLeft, midY, 48, -Math.PI / 2, Math.PI / 2);
    g.stroke();
    g.restore();

    // Restricted Area Charge Arc
    const rightBasketX = right - 20;
    g.beginPath();
    g.arc(rightBasketX, midY, 26, Math.PI / 2, -Math.PI / 2);
    g.stroke();

    // 3-Point Line (Right side)
    const rCornerYTop = midY - 172;
    const rCornerYBot = midY + 172;
    g.beginPath();
    g.moveTo(right, rCornerYTop);
    g.lineTo(right - 64, rCornerYTop);
    g.arc(rightBasketX, midY, 215, Math.PI - Math.PI / 2.9, Math.PI + Math.PI / 2.9);
    g.lineTo(right, rCornerYBot);
    g.stroke();

    this.cachedCourtCanvas = c;
    return c;
  }

  // Main Render Frame
  public render(engine: BasketballMatchEngine, surface: CourtSurface, gopiMode: boolean) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Draw Grandstand Crowd at top
    this.renderCrowd(ctx, gopiMode);

    // 2. Draw Cached Court Surface & Lines
    const courtImg = this.getCourtBackground(engine.court.isHalfCourt, surface);
    ctx.drawImage(courtImg, 0, 0);

    // 2b. Draw Sideline Benches & Scorer's Table
    this.renderSidelineBenches(ctx, engine.court.isHalfCourt);

    // 3. Draw Floor Gloss Reflections (Polished Wood & Cyber Neon)
    if (surface === 'maple' || surface === 'parquet' || surface === 'oak' || surface === 'neon') {
      this.renderFloorReflections(ctx, engine);
    }

    // 4. Draw Shadows (projected on floor)
    this.renderShadows(ctx, engine);

    // 5. Draw Tip-Off Tuxedo Penguin Referee if active
    if (engine.tipOffActive) {
      this.renderTipOffPenguin(ctx, engine.court.width / 2, engine.court.height / 2);
    }

    // 6. Draw Players (Y-sorted for proper 2.5D isometric depth)
    const sortedPlayers = [...engine.players].sort((a, b) => (a.y + a.z) - (b.y + b.z));
    for (const p of sortedPlayers) {
      this.renderPlayerSprite(ctx, p, engine);
    }

    // 6. Draw Basketball in air
    this.renderBall(ctx, engine);

    // 7. Draw Rims & Backboards with spring flex
    this.renderRims(ctx, engine);

    // 8. Draw Particles (Fire & Net celebration)
    this.renderParticles(ctx, engine.particles);

    // 9. Floating Arcade Texts ("BOOMSHAKALAKA!", "SWISH!")
    this.renderFloatingTexts(ctx, engine.floatingTexts);

    // 10. Draw Jumbotron Broadcast Scoreboard
    this.renderJumbotronHUD(ctx, engine);
  }

  private renderSidelineBenches(ctx: CanvasRenderingContext2D, isHalfCourt: boolean) {
    if (isHalfCourt) return;

    ctx.save();
    // 1. Scorer's Table at Midcourt (Top Sideline)
    const midX = this.width / 2;
    const benchY = 66;

    // Scorer table box
    ctx.fillStyle = '#18181B';
    ctx.fillRect(midX - 44, benchY - 8, 88, 18);
    ctx.strokeStyle = '#3F3F46';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(midX - 44, benchY - 8, 88, 18);

    // Table signage
    ctx.fillStyle = '#FACC15';
    ctx.font = 'bold 6px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PRESS / TV', midX, benchY + 3);

    // TV Camera with red broadcast light
    ctx.fillStyle = '#27272A';
    ctx.fillRect(midX - 32, benchY - 18, 10, 8);
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(midX - 30, benchY - 16, 3, 3); // Red Tally Light

    // Commentators with headsets
    ctx.fillStyle = '#FED7AA';
    ctx.fillRect(midX - 12, benchY - 14, 6, 6);
    ctx.fillRect(midX + 8, benchY - 14, 6, 6);
    ctx.fillStyle = '#18181B'; // Headset band
    ctx.fillRect(midX - 13, benchY - 16, 8, 2);
    ctx.fillRect(midX + 7, benchY - 16, 8, 2);

    // 2. Home Team Bench (Left Side, Upper Sideline)
    const homeBenchX = 140;
    // Gatorade / Water cooler
    ctx.fillStyle = '#F97316';
    ctx.fillRect(homeBenchX - 22, benchY - 8, 10, 14);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(homeBenchX - 20, benchY - 6, 6, 3);

    // 4 Bench Players in Home Warmups
    for (let i = 0; i < 4; i++) {
      const bx = homeBenchX + i * 16;
      // Chair
      ctx.fillStyle = '#52525B';
      ctx.fillRect(bx - 4, benchY - 2, 8, 8);
      // Sitting Player (Head & Red Warmup)
      ctx.fillStyle = '#9A3412';
      ctx.fillRect(bx - 3, benchY - 14, 6, 6);
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(bx - 4, benchY - 8, 8, 10);
      // Towel on shoulder
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(bx - 3, benchY - 8, 3, 5);
    }
    // Home Coach standing with suit & clipboard
    ctx.fillStyle = '#FED7AA';
    ctx.fillRect(homeBenchX + 72, benchY - 16, 6, 6);
    ctx.fillStyle = '#1E293B'; // Dark suit
    ctx.fillRect(homeBenchX + 71, benchY - 10, 8, 14);
    ctx.fillStyle = '#FEF08A'; // Clipboard
    ctx.fillRect(homeBenchX + 76, benchY - 6, 4, 6);

    // 3. Away Team Bench (Right Side, Upper Sideline)
    const awayBenchX = this.width - 240;
    // Away Coach standing
    ctx.fillStyle = '#FED7AA';
    ctx.fillRect(awayBenchX - 16, benchY - 16, 6, 6);
    ctx.fillStyle = '#0F172A'; // Navy suit
    ctx.fillRect(awayBenchX - 17, benchY - 10, 8, 14);

    // 4 Bench Players in Away Warmups
    for (let i = 0; i < 4; i++) {
      const bx = awayBenchX + i * 16;
      ctx.fillStyle = '#52525B';
      ctx.fillRect(bx - 4, benchY - 2, 8, 8);
      ctx.fillStyle = '#FB923C';
      ctx.fillRect(bx - 3, benchY - 14, 6, 6);
      ctx.fillStyle = '#2563EB'; // Blue Warmup
      ctx.fillRect(bx - 4, benchY - 8, 8, 10);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(bx - 3, benchY - 8, 3, 5);
    }

    ctx.restore();
  }

  // Draw Subtle Inverted Player Floor Reflections for Polished Wood Court
  private renderFloorReflections(ctx: CanvasRenderingContext2D, engine: BasketballMatchEngine) {
    ctx.save();
    for (const p of engine.players) {
      if (p.z > 6) continue; // Don't draw reflections if airborne dunking high

      ctx.save();
      // Translate to ground plane right below player's feet
      ctx.translate(p.x, p.y + 14);
      // Flip vertically and compress for isometric perspective
      ctx.scale(p.facing === 'left' ? -0.8 : 0.8, -0.32);
      ctx.globalAlpha = 0.12;

      // Draw stylized player silhouette reflection
      const jerseyColor = p.team === 'home' ? '#DC2626' : '#2563EB';
      ctx.fillStyle = jerseyColor;
      ctx.fillRect(-8, -15, 16, 16);
      ctx.fillStyle = p.team === 'home' ? '#991B1B' : '#1D4ED8';
      ctx.fillRect(-7, 1, 14, 8);
      ctx.fillStyle = '#9A3412';
      ctx.fillRect(-6, -26, 12, 10);

      ctx.restore();
    }
    ctx.restore();
  }

  private renderCrowd(ctx: CanvasRenderingContext2D, gopiMode: boolean) {
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, this.width, 76);

    const step = 14;
    const now = Date.now() / 250;
    for (let x = 10; x < this.width; x += step) {
      const bob = Math.sin(now + x * 0.2) * 3;
      // Head
      ctx.fillStyle = (x % 3 === 0) ? '#DC2626' : (x % 5 === 0) ? '#2563EB' : '#F59E0B';
      ctx.fillRect(x, 42 + bob, 8, 8);
      // Torso
      ctx.fillStyle = '#334155';
      ctx.fillRect(x - 1, 50 + bob, 10, 18);
    }

    // Camera flash effect occasionally (skip in Gopi mode for low power)
    if (!gopiMode && Math.random() < 0.05) {
      this.crowdFlashes.push({
        x: 40 + Math.random() * (this.width - 80),
        y: 20 + Math.random() * 40,
        life: 0.15,
      });
    }

    this.crowdFlashes = this.crowdFlashes.filter(f => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.arc(f.x, f.y, 8, 0, Math.PI * 2);
      ctx.fill();
      f.life -= 0.016;
      return f.life > 0;
    });
  }

  // Tuxedo Penguin Referee tossing the basketball
  private renderTipOffPenguin(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.translate(x, y - 25);

    // Penguin Body (Tuxedo Black)
    ctx.fillStyle = '#09090B';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    // White Referee Shirt / Chest
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(0, 2, 10, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Black Referee Stripes
    ctx.strokeStyle = '#09090B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-5, -10);
    ctx.lineTo(-5, 14);
    ctx.moveTo(0, -12);
    ctx.lineTo(0, 16);
    ctx.moveTo(5, -10);
    ctx.lineTo(5, 14);
    ctx.stroke();

    // Whistle around neck
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(-2, -3, 4, 6);

    // Orange Beak
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.moveTo(-4, -14);
    ctx.lineTo(4, -14);
    ctx.lineTo(0, -9);
    ctx.closePath();
    ctx.fill();

    // Orange Feet
    ctx.fillStyle = '#F97316';
    ctx.fillRect(-10, 20, 8, 4);
    ctx.fillRect(2, 20, 8, 4);

    // Arms up tossing ball
    ctx.strokeStyle = '#09090B';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-12, -4);
    ctx.lineTo(-18, -22);
    ctx.moveTo(12, -4);
    ctx.lineTo(18, -22);
    ctx.stroke();

    ctx.restore();
  }

  private renderShadows(ctx: CanvasRenderingContext2D, engine: BasketballMatchEngine) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';

    // Players shadow
    for (const p of engine.players) {
      ctx.beginPath();
      const radius = 12 * Math.max(0.6, 1 - p.z / 14);
      ctx.ellipse(p.x, p.y + 12, radius, radius * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ball shadow
    const b = engine.ball;
    ctx.beginPath();
    const ballShadowRadius = Math.max(3, 8 * (1 - Math.min(1, b.z / 18)));
    ctx.ellipse(b.x, b.y + 12, ballShadowRadius, ballShadowRadius * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pixel Art Character Sprite Renderer
  private renderPlayerSprite(ctx: CanvasRenderingContext2D, p: InGamePlayer, engine: BasketballMatchEngine) {
    ctx.save();
    const renderY = p.y - p.z * 6; // Lift upward when leaping/dunking
    ctx.translate(p.x, renderY);

    const isLeft = p.facing === 'left';
    if (isLeft) {
      ctx.scale(-1, 1);
    }

    // Height ratio based on player height (70" = 1.0, 85" = 1.25)
    const heightScale = p.card.heightInches / 76;
    ctx.scale(heightScale, heightScale);

    // Skin Tone
    let skinColor = '#FDBA74';
    if (p.card.skinTone === 'light') skinColor = '#FED7AA';
    else if (p.card.skinTone === 'tan') skinColor = '#FB923C';
    else if (p.card.skinTone === 'dark') skinColor = '#9A3412';
    else if (p.card.skinTone === 'deep') skinColor = '#57220B';

    // Team colors
    const jerseyColor = p.team === 'home' ? '#DC2626' : '#2563EB';
    const shortsColor = p.team === 'home' ? '#991B1B' : '#1D4ED8';

    // "On Fire" player glow aura
    const isTeamOnFire = (p.team === 'home' && engine.homeOnFireTimer > 0) || (p.team === 'away' && engine.awayOnFireTimer > 0);
    if (isTeamOnFire) {
      ctx.fillStyle = 'rgba(249, 115, 22, 0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 20, 28, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Action pose modifications
    const isDunking = p.actionState === 'dunking';
    const isShooting = p.actionState === 'shooting';
    const isBlocking = p.actionState === 'blocking';

    // Legs / Running cycle
    const runFrame = Math.sin(Date.now() / 120) * 8 * (Math.abs(p.vx) + Math.abs(p.vy) > 10 ? 1 : 0);
    ctx.fillStyle = skinColor;
    // Left leg
    ctx.fillRect(-6 + runFrame * 0.4, 6, 5, 12);
    // Right leg
    ctx.fillRect(1 - runFrame * 0.4, 6, 5, 12);

    // Signature High-Top Sneakers
    ctx.fillStyle = p.card.sneakerColor;
    ctx.fillRect(-8 + runFrame * 0.4, 15, 7, 5);
    ctx.fillRect(-1 - runFrame * 0.4, 15, 7, 5);

    // White socks
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-6 + runFrame * 0.4, 12, 5, 3);
    ctx.fillRect(1 - runFrame * 0.4, 12, 5, 3);

    // Shorts
    ctx.fillStyle = shortsColor;
    ctx.fillRect(-8, 1, 16, 9);
    // Shorts side stripes
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(6, 1, 2, 9);

    // Jersey / Torso
    ctx.fillStyle = jerseyColor;
    ctx.fillRect(-9, -15, 18, 17);

    // Jersey Number
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 8px monospace';
    ctx.fillText(`${p.card.number}`, -5, -4);

    // Head
    ctx.fillStyle = skinColor;
    ctx.fillRect(-7, -27, 14, 12);

    // Headband (if equipped)
    if (p.card.hasHeadband) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-8, -26, 16, 3);
    }

    // Retro Goggles (if equipped)
    if (p.card.hasGoggles) {
      ctx.fillStyle = '#F59E0B';
      ctx.strokeRect(-5, -23, 10, 4);
      ctx.fillStyle = '#0284C7';
      ctx.fillRect(-4, -22, 3, 2);
      ctx.fillRect(1, -22, 3, 2);
    }

    // Hair
    if (p.card.hairColor !== 'bald') {
      ctx.fillStyle = p.card.hairColor === 'blonde' ? '#FBBF24' : p.card.hairColor === 'brown' ? '#78350F' : '#18181B';
      ctx.fillRect(-8, -29, 16, 4);
    }

    // Arms
    ctx.fillStyle = skinColor;
    if (isDunking || isShooting || isBlocking) {
      // Arms raised high
      ctx.fillRect(-10, -28, 4, 15);
      ctx.fillRect(6, -28, 4, 15);
    } else {
      // Normal / Dribbling arms
      ctx.fillRect(-12, -14, 4, 12);
      ctx.fillRect(8, -14, 4, 12);
    }

    // User controlled arrow indicator
    if (p.isUserControlled) {
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.moveTo(0, -35);
      ctx.lineTo(-6, -43);
      ctx.lineTo(6, -43);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  // Draw Basketball
  private renderBall(ctx: CanvasRenderingContext2D, engine: BasketballMatchEngine) {
    const b = engine.ball;
    if (b.state === 'held' && b.carrierId) {
      // Carrier will handle position
    }

    const renderY = b.y - b.z * 6;
    ctx.save();
    ctx.translate(b.x, renderY);

    // Ball Base
    ctx.fillStyle = '#EA580C';
    ctx.beginPath();
    ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
    ctx.fill();

    // Black Seams
    ctx.strokeStyle = '#7C2D12';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.lineTo(7, 0);
    ctx.moveTo(0, -7);
    ctx.lineTo(0, 7);
    ctx.stroke();

    // Ball Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(-2, -2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // Draw Rims with spring flex animation
  private renderRims(ctx: CanvasRenderingContext2D, engine: BasketballMatchEngine) {
    const court = engine.court;

    if (!court.isHalfCourt) {
      this.drawSingleRim(ctx, court.leftRim.x, court.leftRim.y, court.leftRim.z, engine.rimFlexAngleLeft, 'left');
    }
    this.drawSingleRim(ctx, court.rightRim.x, court.rightRim.y, court.rightRim.z, engine.rimFlexAngleRight, 'right');
  }

  private drawSingleRim(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    z: number,
    flexAngle: number,
    side: 'left' | 'right'
  ) {
    ctx.save();
    const renderY = y - z * 6;
    ctx.translate(x, renderY);

    // Glass Backboard
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 3;
    const bbX = side === 'left' ? -22 : 8;
    ctx.strokeRect(bbX, -30, 14, 52);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(bbX, -30, 14, 52);

    // Inner Target Square
    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 2;
    ctx.strokeRect(bbX + 3, -12, 8, 16);

    // Orange Breakaway Rim with flex angle
    ctx.rotate(flexAngle);
    ctx.fillStyle = '#EA580C';
    ctx.fillRect(-14, 0, 28, 4);

    // Woven Cord Net
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-12, 4);
    ctx.lineTo(-4, 20);
    ctx.lineTo(4, 20);
    ctx.lineTo(12, 4);
    ctx.stroke();

    ctx.restore();
  }

  private renderParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
    for (const p of particles) {
      ctx.fillStyle = p.color;
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillRect(p.x, p.y - p.z * 6, p.size, p.size);
    }
    ctx.globalAlpha = 1.0;
  }

  private renderFloatingTexts(ctx: CanvasRenderingContext2D, texts: FloatingText[]) {
    ctx.textAlign = 'center';
    for (const t of texts) {
      ctx.save();
      ctx.fillStyle = t.color;
      ctx.font = 'bold 15px "Press Start 2P", monospace';
      ctx.globalAlpha = t.opacity;
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 6;
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }
  }

  // 16-Bit Jumbotron HUD
  private renderJumbotronHUD(ctx: CanvasRenderingContext2D, engine: BasketballMatchEngine) {
    ctx.save();
    // Top Bar Container
    const hudW = 460;
    const hudH = 48;
    const hudX = (this.width - hudW) / 2;
    const hudY = 8;

    // HUD Background
    ctx.fillStyle = '#18181B';
    ctx.fillRect(hudX, hudY, hudW, hudH);
    ctx.strokeStyle = '#3F3F46';
    ctx.lineWidth = 2;
    ctx.strokeRect(hudX, hudY, hudW, hudH);

    // Home Team Score (Left)
    ctx.fillStyle = '#DC2626';
    ctx.fillRect(hudX + 6, hudY + 6, 80, hudH - 12);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('HOME', hudX + 46, hudY + 22);
    ctx.font = 'bold 16px "Press Start 2P", monospace';
    ctx.fillText(`${engine.homeScore}`, hudX + 46, hudY + 40);

    // Game Clock & Period (Center)
    ctx.fillStyle = '#09090B';
    ctx.fillRect(hudX + 100, hudY + 6, 260, hudH - 12);

    const mins = Math.floor(Math.max(0, engine.timeRemaining) / 60);
    const secs = Math.floor(Math.max(0, engine.timeRemaining) % 60);
    const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    ctx.fillStyle = '#FACC15';
    ctx.font = 'bold 14px "Press Start 2P", monospace';
    ctx.fillText(timeStr, hudX + 175, hudY + 28);

    // Shot Clock (Red digits)
    ctx.fillStyle = engine.shotClock < 5 ? '#EF4444' : '#F97316';
    ctx.font = 'bold 12px "Press Start 2P", monospace';
    ctx.fillText(`:${Math.ceil(Math.max(0, engine.shotClock))}`, hudX + 250, hudY + 28);

    // Period / Format badge
    ctx.fillStyle = '#94A3B8';
    ctx.font = '8px "Press Start 2P", monospace';
    const periodText = engine.format === '3v3' ? `3v3 to ${engine.targetScore}` : `Q${engine.quarter}`;
    ctx.fillText(periodText, hudX + 315, hudY + 28);

    // Away Team Score (Right)
    ctx.fillStyle = '#2563EB';
    ctx.fillRect(hudX + 374, hudY + 6, 80, hudH - 12);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px "Press Start 2P", monospace';
    ctx.fillText('AWAY', hudX + 414, hudY + 22);
    ctx.font = 'bold 16px "Press Start 2P", monospace';
    ctx.fillText(`${engine.awayScore}`, hudX + 414, hudY + 40);

    // Fire Mode Indicator if active
    if (engine.homeOnFireTimer > 0) {
      ctx.fillStyle = '#EA580C';
      ctx.font = '9px "Press Start 2P", monospace';
      ctx.fillText('🔥 ON FIRE!', hudX + 46, hudY + hudH + 16);
    }
    if (engine.awayOnFireTimer > 0) {
      ctx.fillStyle = '#EA580C';
      ctx.font = '9px "Press Start 2P", monospace';
      ctx.fillText('🔥 ON FIRE!', hudX + 414, hudY + hudH + 16);
    }

    ctx.restore();
  }
}
