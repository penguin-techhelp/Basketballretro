import { Ball, InGamePlayer, PlayerCard } from '../types/game';
import { sound } from '../services/soundEngine';

export interface Rim {
  x: number;
  y: number;
  z: number; // 10 ft
  radius: number;
  flexY: number;
  flexVelocity: number;
}

export interface CourtBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface CourtConfig {
  width: number;
  height: number;
  isHalfCourt: boolean;
  leftRim: Rim;
  rightRim: Rim;
  threePointRadius: number;
  bounds: CourtBounds;
}

export function createCourtConfig(isHalfCourt: boolean): CourtConfig {
  const width = isHalfCourt ? 680 : 960;
  const height = 500;

  if (isHalfCourt) {
    return {
      width,
      height,
      isHalfCourt: true,
      leftRim: { x: 580, y: height / 2, z: 10, radius: 14, flexY: 0, flexVelocity: 0 },
      rightRim: { x: 580, y: height / 2, z: 10, radius: 14, flexY: 0, flexVelocity: 0 },
      threePointRadius: 210,
      bounds: { left: 220, right: 620, top: 82, bottom: 442 },
    };
  }

  return {
    width,
    height,
    isHalfCourt: false,
    leftRim: { x: 80, y: height / 2, z: 10, radius: 14, flexY: 0, flexVelocity: 0 },
    rightRim: { x: width - 80, y: height / 2, z: 10, radius: 14, flexY: 0, flexVelocity: 0 },
    threePointRadius: 215,
    bounds: { left: 60, right: 900, top: 82, bottom: 442 },
  };
}

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  opacity: number;
  scale: number;
  duration: number;
}

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export class BasketballMatchEngine {
  public court: CourtConfig;
  public ball: Ball;
  public players: InGamePlayer[];
  public homeScore: number = 0;
  public awayScore: number = 0;
  public quarter: number = 1;
  public timeRemaining: number = 60; // seconds
  public shotClock: number = 24.0;
  public possession: 'home' | 'away' = 'home';
  public isPaused: boolean = false;
  public isGameOver: boolean = false;
  public format: '3v3' | '5v5';
  public targetScore: number = 21; // For 3v3

  // Heat Meter & Fire Mode
  public homeConsecutiveMakes: number = 0;
  public awayConsecutiveMakes: number = 0;
  public homeOnFireTimer: number = 0;
  public awayOnFireTimer: number = 0;

  // Effects & Particles
  public particles: Particle[] = [];
  public floatingTexts: FloatingText[] = [];
  public rimFlexAngleLeft: number = 0;
  public rimFlexAngleRight: number = 0;

  // Tip-off Sequence
  public tipOffActive: boolean = true;
  public tipOffTimer: number = 2.0;

  // Turnover State Machine (Zero setTimeout race conditions)
  public turnoverPendingTimer: number = 0;
  public pendingTurnoverTeam: 'home' | 'away' = 'away';

  // 3v3 Streetball Half-Court Clear Possession Rule (No cheap free points under rim)
  public possessionCleared: boolean = true;

  // Replay Buffer
  public replayFrames: Array<{
    ball: { x: number; y: number; z: number };
    players: Array<{ x: number; y: number; z: number; state: string; facing: string }>;
  }> = [];

  // User input states
  public keys: { [key: string]: boolean } = {};
  public autoModeActive: boolean = false;

  // Commentary
  public lastCommentary: string = 'Welcome to Retro Hoops \'95!';
  public announcerCooldown: number = 0;

  constructor(
    homeRoster: PlayerCard[],
    awayRoster: PlayerCard[],
    format: '3v3' | '5v5',
    quarterMinutes: number = 1
  ) {
    this.format = format;
    this.court = createCourtConfig(format === '3v3');
    this.timeRemaining = quarterMinutes * 60;

    const count = format === '3v3' ? 3 : 5;
    this.players = [];

    const midX = this.court.width / 2;
    const midY = this.court.height / 2;

    // Initialize Home Players
    for (let i = 0; i < count; i++) {
      const card = homeRoster[i] || homeRoster[0];
      let startX: number;
      let startY: number;

      if (this.court.isHalfCourt) {
        // 3v3 Streetball Spacing: PG at top of key, wings spread wide to the perimeters
        if (i === 0) {
          startX = 290;
          startY = midY;
        } else if (i === 1) {
          startX = 360;
          startY = midY - 110;
        } else {
          startX = 360;
          startY = midY + 110;
        }
      } else {
        // 5v5 Full-court Spacing: Spread across backcourt and frontcourt, wings wide
        if (i === 0) {
          startX = midX - 55;
          startY = midY;
        } else if (i === 1) {
          startX = midX - 165;
          startY = midY - 115;
        } else if (i === 2) {
          startX = midX - 165;
          startY = midY + 115;
        } else if (i === 3) {
          startX = midX - 260;
          startY = midY - 65;
        } else {
          startX = midX - 260;
          startY = midY + 65;
        }
      }

      this.players.push({
        id: `home-${card.id}-${i}`,
        card,
        team: 'home',
        x: startX,
        y: startY,
        z: 0,
        vx: 0,
        vy: 0,
        facing: 'right',
        hasBall: false,
        stamina: card.stats.stamina,
        maxStamina: card.stats.stamina,
        isSprinting: false,
        actionState: 'idle',
        actionTimer: 0,
        shotHoldTime: 0,
        isUserControlled: i === 0,
        consecutiveMakes: 0,
      });
    }

    // Initialize Away Players
    for (let i = 0; i < count; i++) {
      const card = awayRoster[i] || awayRoster[0];
      let startX: number;
      let startY: number;

      if (this.court.isHalfCourt) {
        // 3v3 Away Defenders spaced opposite their individual matchups
        if (i === 0) {
          startX = 360;
          startY = midY;
        } else if (i === 1) {
          startX = 425;
          startY = midY - 95;
        } else {
          startX = 425;
          startY = midY + 95;
        }
      } else {
        // 5v5 Full-court Away Players spread symmetrically
        if (i === 0) {
          startX = midX + 55;
          startY = midY;
        } else if (i === 1) {
          startX = midX + 165;
          startY = midY - 115;
        } else if (i === 2) {
          startX = midX + 165;
          startY = midY + 115;
        } else if (i === 3) {
          startX = midX + 260;
          startY = midY - 65;
        } else {
          startX = midX + 260;
          startY = midY + 65;
        }
      }

      this.players.push({
        id: `away-${card.id}-${i}`,
        card,
        team: 'away',
        x: startX,
        y: startY,
        z: 0,
        vx: 0,
        vy: 0,
        facing: 'left',
        hasBall: false,
        stamina: card.stats.stamina,
        maxStamina: card.stats.stamina,
        isSprinting: false,
        actionState: 'idle',
        actionTimer: 0,
        shotHoldTime: 0,
        isUserControlled: false,
        consecutiveMakes: 0,
      });
    }

    // Ball starts in Tuxedo Penguin referee's hands at center court
    this.ball = {
      x: midX,
      y: midY,
      z: 4.0,
      vx: 0,
      vy: 0,
      vz: 0,
      state: 'in_air',
      carrierId: null,
      lastShooterId: null,
      lastTouchTeam: null,
      isThreePoint: false,
      isAlleyOop: false,
      curveFactor: 0,
      isShotAttempt: false,
      willMake: false,
      hasScored: false,
    };
  }

  public setAutoMode(active: boolean) {
    this.autoModeActive = active;
  }

  public triggerAnnouncer(phrase: string, speechText?: string) {
    this.lastCommentary = phrase;
    this.floatingTexts.push({
      id: Math.random().toString(),
      text: phrase,
      x: this.court.width / 2,
      y: 110,
      color: '#FACC15',
      opacity: 1.0,
      scale: 1.2,
      duration: 1.6,
    });
    if (this.announcerCooldown <= 0) {
      sound.speakAnnouncer(speechText || phrase);
      this.announcerCooldown = 1.8;
    }
  }

  public getTargetRim(team: 'home' | 'away'): Rim {
    if (this.court.isHalfCourt) {
      return this.court.rightRim;
    }
    return team === 'home' ? this.court.rightRim : this.court.leftRim;
  }

  // Update Game Physics Loop with clamped delta time
  public update(rawDt: number) {
    if (this.isPaused || this.isGameOver) return;

    // Clamp dt to prevent frame-drop tunneling glitches
    const dt = Math.min(0.02, rawDt);

    if (this.announcerCooldown > 0) {
      this.announcerCooldown -= dt;
    }

    // Tip-off sequence
    if (this.tipOffActive) {
      this.tipOffTimer -= dt;
      if (this.tipOffTimer <= 0) {
        this.tipOffActive = false;
        sound.playWhistle();
        this.triggerAnnouncer('TIP OFF! GAME ON!', 'Tip-off! Game on!');

        // Tip ball to home point guard
        const homePG = this.players.find(p => p.team === 'home')!;
        homePG.hasBall = true;
        homePG.actionState = 'dribbling';
        this.ball.state = 'held';
        this.ball.carrierId = homePG.id;
        this.ball.x = homePG.x + 12;
        this.ball.y = homePG.y;
        this.ball.z = 2.5;
        this.possession = 'home';
      }
      return;
    }

    // Turnover timer countdown (No race conditions with setTimeout)
    if (this.turnoverPendingTimer > 0) {
      this.turnoverPendingTimer -= dt;
      if (this.turnoverPendingTimer <= 0) {
        this.turnover(this.pendingTurnoverTeam);
      }
    }

    // Game & Shot Clock
    if (this.turnoverPendingTimer <= 0) {
      this.timeRemaining -= dt;
      if (this.timeRemaining <= 0) {
        // If a shot attempt is currently airborne, let it finish for a dramatic buzzer beater!
        if (this.ball.state === 'in_air' && this.ball.isShotAttempt) {
          // Wait for shot to score or miss
        } else {
          this.handleQuarterEnd();
          return;
        }
      }

      this.shotClock -= dt;
      if (this.shotClock <= 0) {
        sound.playBuzzer();
        this.triggerAnnouncer('SHOT CLOCK VIOLATION!', 'Shot clock violation!');
        this.turnover(this.possession === 'home' ? 'away' : 'home');
        return;
      }
    }

    // Fire timers
    if (this.homeOnFireTimer > 0) this.homeOnFireTimer -= dt;
    if (this.awayOnFireTimer > 0) this.awayOnFireTimer -= dt;

    // Rim Spring-Dampening Physics
    const k = 22.0;
    const damping = 0.86;
    this.rimFlexAngleLeft += -k * this.rimFlexAngleLeft * dt;
    this.rimFlexAngleLeft *= damping;
    this.rimFlexAngleRight += -k * this.rimFlexAngleRight * dt;
    this.rimFlexAngleRight *= damping;

    // Dynamically manage user control:
    // If user's team has possession, always control the player who currently has the ball!
    if (!this.autoModeActive) {
      if (this.possession === 'home') {
        const homeCarrier = this.players.find(p => p.hasBall && p.team === 'home');
        if (homeCarrier && !homeCarrier.isUserControlled) {
          this.players.forEach(p => { if (p.team === 'home') p.isUserControlled = false; });
          homeCarrier.isUserControlled = true;
        }
      } else {
        // On defense: ensure at least one home player is user-controlled (closest to opponent ball carrier)
        const hasControlledHome = this.players.some(p => p.team === 'home' && p.isUserControlled);
        if (!hasControlledHome) {
          const homePlayers = this.players.filter(p => p.team === 'home');
          const oppCarrier = this.players.find(p => p.hasBall);
          if (oppCarrier && homePlayers.length > 0) {
            homePlayers.sort((a, b) => Math.hypot(a.x - oppCarrier.x, a.y - oppCarrier.y) - Math.hypot(b.x - oppCarrier.x, b.y - oppCarrier.y));
            homePlayers[0].isUserControlled = true;
          } else if (homePlayers.length > 0) {
            homePlayers[0].isUserControlled = true;
          }
        }
      }
    }

    // Update Players & Ball
    this.updatePlayers(dt);
    this.updateBall(dt);
    this.updateParticles(dt);

    // Update Floating Text
    this.floatingTexts = this.floatingTexts.filter(t => {
      t.duration -= dt;
      t.y -= 25 * dt;
      t.opacity = Math.max(0, t.duration / 1.6);
      return t.duration > 0;
    });

    // Save Replay Frame
    this.replayFrames.push({
      ball: { x: this.ball.x, y: this.ball.y, z: this.ball.z },
      players: this.players.map(p => ({
        x: p.x,
        y: p.y,
        z: p.z,
        state: p.actionState,
        facing: p.facing,
      })),
    });
    if (this.replayFrames.length > 240) {
      this.replayFrames.shift();
    }
  }

  private updatePlayers(dt: number) {
    const ballCarrier = this.players.find(p => p.hasBall);

    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];

      // Regenerate stamina
      if (!p.isSprinting && p.stamina < p.maxStamina) {
        p.stamina = Math.min(p.maxStamina, p.stamina + 14 * dt);
      }

      // Action timer
      if (p.actionTimer > 0) {
        p.actionTimer -= dt;
        if (p.actionTimer <= 0 && p.actionState !== 'idle' && p.actionState !== 'dribbling') {
          p.actionState = p.hasBall ? 'dribbling' : 'idle';
          p.z = 0; // Ground elevation
        }
      }

      // Check dunk execution progress
      if (p.actionState === 'dunking' && p.hasBall) {
        const targetRim = this.getTargetRim(p.team);
        const distToRim = Math.hypot(p.x - targetRim.x, p.y - targetRim.y);

        // Fly towards rim
        const angle = Math.atan2(targetRim.y - p.y, targetRim.x - p.x);
        p.vx = Math.cos(angle) * 320;
        p.vy = Math.sin(angle) * 320;
        p.z = 8.5;

        // Ball is held directly above head in the dunker's hands
        this.ball.x = p.x;
        this.ball.y = p.y - 10;
        this.ball.z = p.z + 2.5;

        // Reach rim -> SLAM IT DOWN!
        if (distToRim <= 28) {
          this.executeDunkFinish(p, targetRim);
        }
      } else if (p.isUserControlled && !this.autoModeActive) {
        this.handleUserInputPlayer(p, dt);
      } else {
        this.handleAiPlayer(p, ballCarrier, dt);
      }

      // Integrate position
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Friction
      p.vx *= 0.85;
      p.vy *= 0.85;

      // Boundary clamp
      const minX = this.court.bounds.left + 12;
      const maxX = this.court.bounds.right - 12;
      const minY = this.court.bounds.top + 10;
      const maxY = this.court.bounds.bottom - 10;

      p.x = Math.max(minX, Math.min(maxX, p.x));
      p.y = Math.max(minY, Math.min(maxY, p.y));

      // 3v3 Half-court Clear check
      if (this.court.isHalfCourt && p.hasBall && !this.possessionCleared) {
        const distToRim = Math.hypot(p.x - this.court.rightRim.x, p.y - this.court.rightRim.y);
        if (distToRim > this.court.threePointRadius + 15) {
          this.possessionCleared = true;
          this.triggerAnnouncer('CLEARED! ATTACK!', 'Cleared!');
        }
      }

      // Ball follows dribbler precisely
      if (p.hasBall && this.ball.state === 'held' && p.actionState !== 'dunking') {
        const dX = p.facing === 'right' ? 14 : -14;
        this.ball.x = p.x + dX;
        this.ball.y = p.y + 6;
        this.ball.z = 2.2 + Math.abs(Math.sin(Date.now() / 150)) * 1.5;
      }
    }

    // Player-to-player physical collision and floor spacing repulsion
    for (let i = 0; i < this.players.length; i++) {
      for (let j = i + 1; j < this.players.length; j++) {
        const p1 = this.players[i];
        const p2 = this.players[j];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);

        // 1. Hard physical body collision box (prevent overlapping on the same spot)
        const minBodyDist = 28;
        if (dist < minBodyDist && dist > 0.001) {
          const overlap = (minBodyDist - dist) * 0.5;
          const nx = dx / dist;
          const ny = dy / dist;
          p1.x -= nx * overlap;
          p1.y -= ny * overlap;
          p2.x += nx * overlap;
          p2.y += ny * overlap;
        }

        // 2. Active Teammate Spacing (keeps teammates spread out across floor zones)
        if (p1.team === p2.team && dist < 72 && dist > 0.001) {
          const spacingRepulsion = ((72 - dist) / 72) * 1.8;
          const nx = dx / dist;
          const ny = dy / dist;
          p1.x -= nx * spacingRepulsion;
          p1.y -= ny * spacingRepulsion;
          p2.x += nx * spacingRepulsion;
          p2.y += ny * spacingRepulsion;
        }
      }
    }
  }

  private handleUserInputPlayer(p: InGamePlayer, dt: number) {
    let moveX = 0;
    let moveY = 0;

    if (this.keys['ArrowLeft'] || this.keys['KeyA']) moveX -= 1;
    if (this.keys['ArrowRight'] || this.keys['KeyD']) moveX += 1;
    if (this.keys['ArrowUp'] || this.keys['KeyW']) moveY -= 1;
    if (this.keys['ArrowDown'] || this.keys['KeyS']) moveY += 1;

    const isTurbo = (this.keys['ShiftLeft'] || this.keys['ShiftRight']) && p.stamina > 10;
    p.isSprinting = isTurbo && (moveX !== 0 || moveY !== 0);

    const isOnFire = p.team === 'home' ? this.homeOnFireTimer > 0 : this.awayOnFireTimer > 0;
    if (isTurbo && !isOnFire) {
      p.stamina = Math.max(0, p.stamina - 20 * dt);
    }

    const baseSpeed = 160 + (p.card.stats.speed / 100) * 120;
    const currentSpeed = baseSpeed * (isTurbo ? 1.45 : 1.0);

    if (moveX !== 0 || moveY !== 0) {
      const length = Math.hypot(moveX, moveY) || 1;
      p.vx = (moveX / length) * currentSpeed;
      p.vy = (moveY / length) * currentSpeed;
      p.facing = moveX > 0 ? 'right' : moveX < 0 ? 'left' : p.facing;

      if (Math.random() < 0.03 && isTurbo) {
        sound.playSneakerSqueak();
      }
    }

    // [C] SHOOT / BLOCK BUTTON
    if (this.keys['KeyC'] || this.keys['Space']) {
      if (p.hasBall) {
        p.shotHoldTime += dt;
        p.actionState = 'shooting';
      } else {
        if (p.actionState !== 'blocking' && p.actionTimer <= 0) {
          p.actionState = 'blocking';
          p.actionTimer = 0.65;
          sound.playBlockSwat();
        }
      }
    } else {
      // Released [C] button
      if (p.hasBall && p.shotHoldTime > 0.05) {
        this.executeShot(p);
      }
    }

    // [X] PASS / STEAL BUTTON
    if (this.keys['KeyX']) {
      this.keys['KeyX'] = false; // Consume single press
      if (p.hasBall) {
        this.executePass(p);
      } else {
        this.executeSteal(p);
      }
    }
  }

  private handleAiPlayer(p: InGamePlayer, ballCarrier: InGamePlayer | undefined, dt: number) {
    const targetRim = this.getTargetRim(p.team);
    const isOnOffense = p.team === this.possession;
    const midY = this.court.height / 2;
    const teammates = this.players.filter(pl => pl.team === p.team);
    const opponents = this.players.filter(pl => pl.team !== p.team);

    // ==========================================
    // 1. IF THIS PLAYER HAS THE BALL
    // ==========================================
    if (p.hasBall) {
      const distToRim = Math.hypot(p.x - targetRim.x, p.y - targetRim.y);

      // In 3v3 Streetball, AI clears out behind the arc if needed
      if (this.court.isHalfCourt && !this.possessionCleared) {
        const clearX = 260;
        const clearY = midY;
        const angle = Math.atan2(clearY - p.y, clearX - p.x);
        p.vx = Math.cos(angle) * 170;
        p.vy = Math.sin(angle) * 170;
        p.facing = 'left';
        return;
      }

      // Ball carrier drives / attacks the basket with realistic offensive pacing
      const attackOffsetX = p.team === 'home' ? -150 : 150;
      const targetX = targetRim.x + attackOffsetX;
      const targetY = targetRim.y + Math.sin(Date.now() / 850) * 40;
      const angle = Math.atan2(targetY - p.y, targetX - p.x);

      p.vx = Math.cos(angle) * (140 + p.card.stats.speed * 0.8);
      p.vy = Math.sin(angle) * (140 + p.card.stats.speed * 0.8);
      p.facing = p.vx > 0 ? 'right' : 'left';

      // Decide to shoot if in good range or shot clock expires
      if (distToRim < 190 || this.shotClock < 3.5 || (distToRim < 260 && Math.random() < 0.015)) {
        p.shotHoldTime = 0.50;
        this.executeShot(p);
      } else if (Math.random() < 0.012) {
        this.executePass(p);
      }
      return;
    }

    // ==========================================
    // 2. LOOSE BALL / REBOUND PURSUIT (ONLY CLOSEST PLAYER CHASES, REST SPACE OUT)
    // ==========================================
    const isLooseBall = !ballCarrier && (this.ball.state === 'in_air' || this.ball.state === 'bouncing' || this.ball.state === 'rim_bounce');
    if (isLooseBall && this.turnoverPendingTimer <= 0) {
      // Find closest teammate to ball
      let closestTeammate = teammates[0];
      let minDist = Infinity;
      for (const t of teammates) {
        const d = Math.hypot(t.x - this.ball.x, t.y - this.ball.y);
        if (d < minDist) {
          minDist = d;
          closestTeammate = t;
        }
      }

      // If this player is closest, charge for the loose ball / rebound
      if (p.id === closestTeammate.id) {
        const angle = Math.atan2(this.ball.y - p.y, this.ball.x - p.x);
        p.vx = Math.cos(angle) * (150 + p.card.stats.speed * 0.8);
        p.vy = Math.sin(angle) * (150 + p.card.stats.speed * 0.8);
        p.facing = p.vx > 0 ? 'right' : 'left';
        return;
      }
      // Other teammates do NOT dogpile! They space out according to offensive/defensive sets below.
    }

    // ==========================================
    // 3. OFFENSE (OFF-BALL TEAMMATES SPREAD OUT ACROSS THE FLOOR)
    // ==========================================
    if (isOnOffense) {
      const offBallTeammates = teammates.filter(pl => !pl.hasBall);
      const offBallIndex = Math.max(0, offBallTeammates.findIndex(pl => pl.id === p.id));

      let targetX = p.x;
      let targetY = p.y;

      if (this.court.isHalfCourt) {
        // 3v3 Half-Court Tactical Spacing:
        // Slot 0: Top Wing / 3-Point perimeter (Y: midY - 110)
        // Slot 1: Bottom Wing / Corner (Y: midY + 110)
        // Slot 2: Top of key (if 3 off-ball)
        if (offBallIndex === 0) {
          targetX = 350 + Math.cos(Date.now() / 1600) * 25;
          targetY = midY - 110 + Math.sin(Date.now() / 2000) * 18;
        } else if (offBallIndex === 1) {
          targetX = 350 + Math.sin(Date.now() / 1600) * 25;
          targetY = midY + 110 + Math.cos(Date.now() / 2000) * 18;
        } else {
          targetX = 280 + Math.cos(Date.now() / 1400) * 20;
          targetY = midY + Math.sin(Date.now() / 1500) * 20;
        }
      } else {
        // 5v5 Full-Court Floor Spacing:
        const dir = p.team === 'home' ? 1 : -1;
        const rimX = targetRim.x;
        const carrierX = ballCarrier ? ballCarrier.x : this.ball.x;
        const isTransition = p.team === 'home' ? carrierX < (this.court.width / 2) : carrierX > (this.court.width / 2);

        if (isTransition) {
          // Fast-break lanes spread wide along sidelines
          if (offBallIndex === 0) {
            targetX = carrierX + dir * 140;
            targetY = midY - 125;
          } else if (offBallIndex === 1) {
            targetX = carrierX + dir * 140;
            targetY = midY + 125;
          } else if (offBallIndex === 2) {
            targetX = rimX - dir * 100;
            targetY = midY;
          } else {
            targetX = carrierX - dir * 90;
            targetY = midY + (offBallIndex === 3 ? -60 : 60);
          }
        } else {
          // Half-Court Settled 5-Out Floor Spacing:
          if (offBallIndex === 0) {
            // Left Wing
            targetX = rimX - dir * 190;
            targetY = midY - 115 + Math.sin(Date.now() / 2200) * 15;
          } else if (offBallIndex === 1) {
            // Right Wing
            targetX = rimX - dir * 190;
            targetY = midY + 115 + Math.cos(Date.now() / 2200) * 15;
          } else if (offBallIndex === 2) {
            // Top of Key spacer
            targetX = rimX - dir * 265;
            targetY = midY + Math.sin(Date.now() / 1900) * 25;
          } else if (offBallIndex === 3) {
            // Left Corner
            targetX = rimX - dir * 75;
            targetY = midY - 130;
          } else {
            // Right Corner / Low Post
            targetX = rimX - dir * 75;
            targetY = midY + 130;
          }
        }
      }

      // Smooth movement towards designated spacing spot
      const dx = targetX - p.x;
      const dy = targetY - p.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 22) {
        const angle = Math.atan2(dy, dx);
        const speed = Math.min(dist * 4, 125 + p.card.stats.speed * 0.5);
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
      } else {
        p.vx *= 0.5;
        p.vy *= 0.5;
      }
      p.facing = targetRim.x > p.x ? 'right' : 'left';
      return;
    }

    // ==========================================
    // 4. DEFENSE (MAN-TO-MAN ASSIGNMENT: EACH DEFENDER GUARDS THEIR OWN MAN)
    // ==========================================
    const myDefIndex = Math.max(0, teammates.findIndex(pl => pl.id === p.id));
    const assignedMatchup = opponents[myDefIndex % opponents.length] || ballCarrier || opponents[0];

    if (!assignedMatchup) return;

    let guardTargetX = assignedMatchup.x;
    let guardTargetY = assignedMatchup.y;

    if (assignedMatchup.hasBall) {
      // ON-BALL DEFENSE: Stay firmly between the dribbler and the basket
      const toBasketX = targetRim.x - assignedMatchup.x;
      const toBasketY = targetRim.y - assignedMatchup.y;
      const bDist = Math.hypot(toBasketX, toBasketY) || 1;
      // Position 35px in front of dribbler towards the hoop
      guardTargetX = assignedMatchup.x + (toBasketX / bDist) * 35;
      guardTargetY = assignedMatchup.y + (toBasketY / bDist) * 35;
    } else {
      // OFF-BALL DEFENSE: Help-and-recover position between assigned matchup and rim
      // Sags slightly into passing lane, staying spread out with their assigned man
      guardTargetX = assignedMatchup.x * 0.72 + targetRim.x * 0.28;
      guardTargetY = assignedMatchup.y * 0.75 + midY * 0.25;
    }

    const gdx = guardTargetX - p.x;
    const gdy = guardTargetY - p.y;
    const gDist = Math.hypot(gdx, gdy);

    if (gDist > 18) {
      const angle = Math.atan2(gdy, gdx);
      const defSpeed = Math.min(gDist * 4.5, 130 + p.card.stats.defense * 0.75);
      p.vx = Math.cos(angle) * defSpeed;
      p.vy = Math.sin(angle) * defSpeed;
    } else {
      p.vx *= 0.5;
      p.vy *= 0.5;
    }

    p.facing = assignedMatchup.x > p.x ? 'right' : 'left';

    // Steal attempt if on-ball and within reach
    if (assignedMatchup.hasBall && gDist < 38 && Math.random() < 0.012) {
      this.executeSteal(p);
    }
  }

  // PASS MECHANIC (Chest pass / Directional Pass / Double-tap Alley-Oop) - CANNOT SCORE FREE POINTS
  public executePass(passer: InGamePlayer) {
    if (!passer.hasBall) return;

    const teammates = this.players.filter(p => p.team === passer.team && p.id !== passer.id);
    if (teammates.length === 0) return;

    const targetRim = this.getTargetRim(passer.team);

    // Directional passing if user is holding directional inputs
    let aimX = 0;
    let aimY = 0;
    if (passer.isUserControlled) {
      if (this.keys['ArrowLeft'] || this.keys['KeyA']) aimX -= 1;
      if (this.keys['ArrowRight'] || this.keys['KeyD']) aimX += 1;
      if (this.keys['ArrowUp'] || this.keys['KeyW']) aimY -= 1;
      if (this.keys['ArrowDown'] || this.keys['KeyS']) aimY += 1;
    }

    let target: InGamePlayer;
    if (aimX !== 0 || aimY !== 0) {
      const aimAngle = Math.atan2(aimY, aimX);
      const sortedByAim = [...teammates].sort((a, b) => {
        const angleA = Math.atan2(a.y - passer.y, a.x - passer.x);
        const angleB = Math.atan2(b.y - passer.y, b.x - passer.x);
        const diffA = Math.abs(Math.atan2(Math.sin(angleA - aimAngle), Math.cos(angleA - aimAngle)));
        const diffB = Math.abs(Math.atan2(Math.sin(angleB - aimAngle), Math.cos(angleB - aimAngle)));
        return diffA - diffB;
      });
      target = sortedByAim[0];
    } else {
      // Default: prioritize teammate closest to open basket or leading the break
      const sortedByPosition = [...teammates].sort((a, b) => {
        const distA = Math.hypot(a.x - targetRim.x, a.y - targetRim.y);
        const distB = Math.hypot(b.x - targetRim.x, b.y - targetRim.y);
        return distA - distB;
      });
      target = sortedByPosition[0];
    }

    const distToRim = Math.hypot(target.x - targetRim.x, target.y - targetRim.y);
    const isAlleyOop = distToRim < 130 && passer.card.stats.clutch > 75;

    passer.hasBall = false;
    passer.actionState = 'passing';
    passer.actionTimer = 0.35;

    this.ball.state = 'in_air';
    this.ball.carrierId = null;
    this.ball.lastShooterId = null;
    this.ball.isAlleyOop = isAlleyOop;
    this.ball.isShotAttempt = false; // PASSES NEVER SCORE FREE POINTS!
    this.ball.hasScored = false;
    this.ball.lastTouchTeam = passer.team;

    const dx = target.x - passer.x;
    const dy = target.y - passer.y;
    const dist = Math.hypot(dx, dy);
    const speed = isAlleyOop ? 380 : 540;
    const travelTime = Math.max(0.2, dist / speed);

    this.ball.vx = (dx / dist) * speed;
    this.ball.vy = (dy / dist) * speed;
    this.ball.vz = isAlleyOop ? 22 : 6;

    sound.playDribble();

    if (isAlleyOop) {
      target.actionState = 'dunking';
      target.actionTimer = travelTime + 0.4;
      target.z = 7.0;
      this.triggerAnnouncer('ALLEY-OOP LOB!', 'Up for the alley-oop!');
    }
  }

  // ACTIVE POKE STEAL
  public executeSteal(defender: InGamePlayer) {
    if (defender.actionTimer > 0) return; // Prevent spam glitch
    defender.actionState = 'stealing';
    defender.actionTimer = 0.4;
    sound.playStealPoke();

    const ballCarrier = this.players.find(p => p.hasBall && p.team !== defender.team);
    if (ballCarrier) {
      const dist = Math.hypot(defender.x - ballCarrier.x, defender.y - ballCarrier.y);
      const stealChance = (defender.card.stats.defense - ballCarrier.card.stats.stamina * 0.4) / 100;

      if (dist < 42 && Math.random() < Math.max(0.25, stealChance)) {
        ballCarrier.hasBall = false;
        ballCarrier.actionState = 'stumbled';
        ballCarrier.actionTimer = 0.6;

        this.ball.state = 'bouncing';
        this.ball.carrierId = null;
        this.ball.isShotAttempt = false;
        this.ball.lastTouchTeam = defender.team;
        this.ball.vx = (defender.x - ballCarrier.x) * 4;
        this.ball.vy = (defender.y - ballCarrier.y) * 4;
        this.ball.vz = 6;

        this.possession = defender.team;
        this.shotClock = 24.0;
        if (this.court.isHalfCourt) {
          this.possessionCleared = false; // Must clear outside 3pt arc
        }
        this.triggerAnnouncer('WHAT A STEAL!', 'Stolen away!');
      }
    }
  }

  // SHOT MECHANIC (Parabolic 3D Arc with Zero Free Points Guarantee)
  public executeShot(shooter: InGamePlayer) {
    const targetRim = this.getTargetRim(shooter.team);
    const distToRim = Math.hypot(shooter.x - targetRim.x, shooter.y - targetRim.y);

    // 3v3 Half-court Clear Rule Check
    if (this.court.isHalfCourt && !this.possessionCleared) {
      sound.playWhistle();
      this.triggerAnnouncer('TAKE IT BACK OUT TO THE ARC!', 'Must clear ball outside arc!');
      shooter.shotHoldTime = 0;
      shooter.actionState = 'dribbling';
      return;
    }

    const isDunkRange = distToRim < 110;
    const isThree = distToRim > this.court.threePointRadius;

    // Sweet apex timing is around 0.45s - 0.55s
    const apexDiff = Math.abs(shooter.shotHoldTime - 0.50);
    const timingRating = apexDiff < 0.08 ? 'EXCELLENT' : apexDiff < 0.16 ? 'GOOD' : 'LATE';

    // If inside paint key and holding shoot: MONSTER DUNK!
    if (isDunkRange && shooter.card.stats.dunk > 70) {
      shooter.actionState = 'dunking';
      shooter.actionTimer = 0.85;
      shooter.z = 8.5;
      this.triggerAnnouncer('BOOMSHAKALAKA!', 'Boomshakalaka! High flying dunk!');
      return;
    }

    // REGULAR JUMP SHOT
    shooter.hasBall = false;
    shooter.actionState = 'shooting';
    shooter.actionTimer = 0.6;
    shooter.z = 3.5;
    shooter.shotHoldTime = 0;

    // Calculate hit probability strictly
    const statRating = isThree 
      ? shooter.card.stats.threePt 
      : (shooter.card.stats.speed + shooter.card.stats.clutch) / 2;
    const isOnFire = shooter.team === 'home' ? this.homeOnFireTimer > 0 : this.awayOnFireTimer > 0;
    let makeProbability = (statRating / 100) * 0.75 + (timingRating === 'EXCELLENT' ? 0.35 : 0.05);
    if (isOnFire) makeProbability += 0.25;

    // Contest penalty if defender is actively blocking nearby
    const nearestDefender = this.players.find(p => p.team !== shooter.team && Math.hypot(p.x - shooter.x, p.y - shooter.y) < 55);
    if (nearestDefender && nearestDefender.actionState === 'blocking') {
      makeProbability *= 0.3; // Heavily contested!
      this.triggerAnnouncer('CONTESTED SHOT!');
    }

    const willMake = Math.random() < Math.min(0.95, makeProbability);

    this.ball.state = 'in_air';
    this.ball.carrierId = null;
    this.ball.lastShooterId = shooter.id;
    this.ball.lastTouchTeam = shooter.team;
    this.ball.isThreePoint = isThree;
    this.ball.isShotAttempt = true;
    this.ball.willMake = willMake;
    this.ball.hasScored = false;

    // Target end point
    let targetX = targetRim.x;
    let targetY = targetRim.y;
    const targetZ = targetRim.z;

    if (!willMake) {
      // Deliberately offset outside the hoop cylinder so it strikes the rim/back-iron and clanks
      const angle = Math.random() * Math.PI * 2;
      targetX = targetRim.x + Math.cos(angle) * 26;
      targetY = targetRim.y + Math.sin(angle) * 22;
    }

    const travelTime = 1.05 + distToRim / 450;
    const gravity = 32.0;

    this.ball.vx = (targetX - this.ball.x) / travelTime;
    this.ball.vy = (targetY - this.ball.y) / travelTime;
    this.ball.vz = (targetZ - this.ball.z + 0.5 * gravity * travelTime * travelTime) / travelTime;

    this.floatingTexts.push({
      id: Math.random().toString(),
      text: timingRating,
      x: shooter.x,
      y: shooter.y - 45,
      color: timingRating === 'EXCELLENT' ? '#10B981' : timingRating === 'GOOD' ? '#F59E0B' : '#EF4444',
      opacity: 1.0,
      scale: 1.0,
      duration: 1.1,
    });
  }

  // Finishes monster slam at rim
  public executeDunkFinish(dunker: InGamePlayer, rim: Rim) {
    // 3v3 Half-court Clear Rule Check
    if (this.court.isHalfCourt && !this.possessionCleared) {
      sound.playWhistle();
      this.triggerAnnouncer('TAKE IT BACK OUT TO THE ARC!', 'Must clear ball outside arc!');
      dunker.actionState = 'dribbling';
      dunker.z = 0;
      return;
    }

    dunker.hasBall = false;
    dunker.actionState = 'celebrating';
    dunker.actionTimer = 0.5;
    dunker.z = 0;

    this.ball.state = 'scored';
    this.ball.carrierId = null;
    this.ball.x = rim.x;
    this.ball.y = rim.y;
    this.ball.z = rim.z;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.vz = -12; // Slam cleanly down
    this.ball.isThreePoint = false;
    this.ball.hasScored = true;
    this.ball.isShotAttempt = false;

    sound.playMonsterDunk();
    this.handleBucketScored(rim);
  }

  // Detects when the ball crosses outside the court boundaries ("Out of Bounds")
  private checkBallOutOfBounds(): boolean {
    if (this.ball.state === 'held' || this.ball.state === 'scored') return false;
    if (this.turnoverPendingTimer > 0 || this.tipOffActive || this.isGameOver) return false;

    const b = this.court.bounds;
    const margin = 4;

    const isPastBoundary = (
      this.ball.x < b.left - margin ||
      this.ball.x > b.right + margin ||
      this.ball.y < b.top - margin ||
      this.ball.y > b.bottom + margin
    );

    if (isPastBoundary) {
      // If the ball hit the floor outside or is moving out
      if (this.ball.z <= 3.5 || Math.abs(this.ball.vx) > 30 || Math.abs(this.ball.vy) > 30) {
        this.handleOutOfBounds(this.ball.x, this.ball.y);
        return true;
      }
    }
    return false;
  }

  public handleOutOfBounds(outX: number, outY: number) {
    if (this.turnoverPendingTimer > 0 || this.isGameOver) return;

    sound.playWhistle();
    this.triggerAnnouncer('OUT OF BOUNDS!', 'Out of bounds!');

    const clampedX = Math.max(this.court.bounds.left + 20, Math.min(this.court.bounds.right - 20, outX));
    const clampedY = Math.max(this.court.bounds.top + 20, Math.min(this.court.bounds.bottom - 20, outY));

    this.floatingTexts.push({
      id: Math.random().toString(),
      text: 'OUT OF BOUNDS',
      x: clampedX,
      y: clampedY - 20,
      color: '#EF4444',
      opacity: 1.0,
      scale: 1.25,
      duration: 1.5,
    });

    const lastTouch = this.ball.lastTouchTeam || this.possession;
    const newPossession: 'home' | 'away' = lastTouch === 'home' ? 'away' : 'home';

    // Neutralize ball movement immediately to prevent drifting into infinity
    this.ball.state = 'bouncing';
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.vz = 0;
    this.ball.isShotAttempt = false;

    this.turnoverPendingTimer = 1.0;
    this.pendingTurnoverTeam = newPossession;
  }

  // Update Ball In Air / Bouncing / Scoring
  private updateBall(dt: number) {
    if (this.ball.state === 'held') return;

    const gravity = 30.0;
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;
    this.ball.z += this.ball.vz * dt - 0.5 * gravity * dt * dt;
    this.ball.vz -= gravity * dt;

    // 0. CHECK OUT OF BOUNDS IMMEDIATELY
    if (this.checkBallOutOfBounds()) {
      return;
    }

    // Check Rim Collisions
    const targetRim = this.getTargetRim(this.possession);
    const distToRimXY = Math.hypot(this.ball.x - targetRim.x, this.ball.y - targetRim.y);

    // 1. CLEAN SCORE CHECK (Only if marked willMake, descending vz, and has not scored yet)
    if (
      this.ball.isShotAttempt &&
      this.ball.willMake &&
      !this.ball.hasScored &&
      this.ball.state === 'in_air' &&
      distToRimXY <= 15 &&
      this.ball.z <= 10.3 &&
      this.ball.vz < 0
    ) {
      if (this.court.isHalfCourt && !this.possessionCleared) {
        // Reject invalid uncleared shot
        sound.playWhistle();
        this.triggerAnnouncer('NO BASKET! MUST CLEAR THE ARC!');
        this.ball.isShotAttempt = false;
        this.ball.state = 'rim_bounce';
        this.ball.vz = 8;
        return;
      }

      this.ball.hasScored = true;
      this.ball.isShotAttempt = false;
      this.ball.state = 'scored';
      this.ball.vx = 0;
      this.ball.vy = 0;
      this.ball.vz = -10; // Drop straight down through net
      this.handleBucketScored(targetRim);
      return;
    }

    // 2. MID-AIR BLOCK & SWAT ("REJECTED!")
    if (this.ball.state === 'in_air' && this.ball.isShotAttempt && this.turnoverPendingTimer <= 0) {
      for (const p of this.players) {
        if (p.team !== this.possession && p.actionState === 'blocking') {
          const dist = Math.hypot(p.x - this.ball.x, p.y - this.ball.y);
          if (dist < 32 && this.ball.z < 9.5 && this.ball.z > 3.5) {
            sound.playBlockSwat();
            this.ball.isShotAttempt = false; // Cannot score!
            this.ball.state = 'rim_bounce';
            this.ball.lastTouchTeam = p.team;
            const oppRim = this.getTargetRim(this.possession);
            this.ball.vx = (oppRim.x - this.ball.x > 0 ? -1 : 1) * 150 + (Math.random() - 0.5) * 80;
            this.ball.vy = (Math.random() - 0.5) * 140;
            this.ball.vz = 8;
            this.triggerAnnouncer('REJECTED!', 'Rejected! Swatted away!');
            break;
          }
        }
      }
    }

    // 3. IN-AIR PASS RECEPTION & INTERCEPTION (Passes can be caught in flight!)
    if (this.ball.state === 'in_air' && !this.ball.isShotAttempt && this.turnoverPendingTimer <= 0) {
      for (const p of this.players) {
        const dist = Math.hypot(p.x - this.ball.x, p.y - this.ball.y);

        // Friendly reception (teammate catching pass)
        if (p.team === this.ball.lastTouchTeam && p.actionState !== 'passing') {
          if (dist < 38 && this.ball.z < 7.5) {
            const isAlleyOopAttempt = this.ball.isAlleyOop;
            const wasLeaping = p.actionState === 'dunking' || p.z > 3.0;

            p.hasBall = true;
            p.actionState = 'dribbling';
            this.ball.state = 'held';
            this.ball.carrierId = p.id;
            this.ball.vx = 0;
            this.ball.vy = 0;
            this.ball.vz = 0;
            this.ball.isShotAttempt = false;
            this.ball.lastTouchTeam = p.team;

            // Switch user control to pass recipient
            if (p.team === 'home') {
              this.players.forEach(pl => { if (pl.team === 'home') pl.isUserControlled = false; });
              p.isUserControlled = true;
            }

            sound.playDribble();

            // Alley-oop slam finish if target is leaping or close to rim
            if (isAlleyOopAttempt && (wasLeaping || distToRimXY < 80)) {
              const targetRim = this.getTargetRim(p.team);
              this.executeDunkFinish(p, targetRim);
            }
            return;
          }
        } else if (p.team !== this.ball.lastTouchTeam) {
          // Mid-air defensive interception
          const isContesting = p.actionState === 'blocking' || p.actionState === 'stealing';
          const interceptChance = isContesting ? 0.70 : (p.card.stats.defense / 100) * 0.35;
          if (dist < 30 && this.ball.z < 6.0 && Math.random() < interceptChance) {
            p.hasBall = true;
            p.actionState = 'dribbling';
            this.ball.state = 'held';
            this.ball.carrierId = p.id;
            this.ball.vx = 0;
            this.ball.vy = 0;
            this.ball.vz = 0;
            this.ball.isShotAttempt = false;
            this.ball.lastTouchTeam = p.team;
            this.possession = p.team;
            this.shotClock = 24.0;
            if (this.court.isHalfCourt) this.possessionCleared = false;

            if (p.team === 'home') {
              this.players.forEach(pl => { if (pl.team === 'home') pl.isUserControlled = false; });
              p.isUserControlled = true;
            }

            sound.playStealPoke();
            this.triggerAnnouncer('INTERCEPTED!', 'Pass intercepted!');
            return;
          }
        }
      }
    }

    // 4. RIM CLANK & BOUNCE CHECK (Misses CANNOT score)
    if (
      this.ball.state === 'in_air' &&
      distToRimXY <= 26 &&
      this.ball.z <= 10.4 &&
      this.ball.z >= 8.5
    ) {
      sound.playRimClank();
      this.ball.state = 'rim_bounce';
      this.ball.isShotAttempt = false; // NEVER SCORE ON REBOUND
      this.ball.vz = 14; // Pop off rim
      this.ball.vx = (this.ball.x - targetRim.x) * 4 + (Math.random() - 0.5) * 60;
      this.ball.vy = (this.ball.y - targetRim.y) * 4 + (Math.random() - 0.5) * 60;
      this.flexRim(targetRim, 0.45);
      return;
    }

    // 5. Floor bounce
    if (this.ball.z <= 0) {
      this.ball.z = 0;
      if (Math.abs(this.ball.vz) > 4) {
        sound.playDribble();
        this.ball.vz = -this.ball.vz * 0.65;
        this.ball.vx *= 0.75;
        this.ball.vy *= 0.75;
      } else {
        this.ball.vz = 0;
        if (this.ball.state !== 'scored') {
          this.ball.state = 'bouncing';
        }
      }
    }

    // 6. Loose ball pickup check (Only if NOT pending turnover)
    if (this.turnoverPendingTimer <= 0 && this.ball.state !== 'scored') {
      if (this.ball.state === 'bouncing' || this.ball.state === 'rim_bounce') {
        for (const p of this.players) {
          const dist = Math.hypot(p.x - this.ball.x, p.y - this.ball.y);
          if (dist < 34 && this.ball.z < 4.5) {
            p.hasBall = true;
            p.actionState = 'dribbling';
            this.ball.state = 'held';
            this.ball.carrierId = p.id;
            this.ball.isShotAttempt = false;
            this.ball.lastTouchTeam = p.team;

            if (p.team !== this.possession) {
              this.possession = p.team;
              this.shotClock = 24.0;
              if (this.court.isHalfCourt) {
                this.possessionCleared = false; // Must clear 3-pt line
              }
              this.triggerAnnouncer('REBOUND!');
              sound.playDribble();
            }

            if (p.team === 'home') {
              this.players.forEach(pl => { if (pl.team === 'home') pl.isUserControlled = false; });
              p.isUserControlled = true;
            }
            break;
          }
        }
      }
    }
  }

  private handleBucketScored(rim: Rim) {
    if (this.court.isHalfCourt && !this.possessionCleared) {
      return; // Reject any uncleared score
    }

    sound.playSwish();
    this.flexRim(rim, 0.6);

    const isHome = this.possession === 'home';
    const points = this.ball.isThreePoint ? 3 : 2;

    if (isHome) {
      this.homeScore += points;
      this.homeConsecutiveMakes++;
      this.awayConsecutiveMakes = 0;

      if (this.homeConsecutiveMakes >= 3 && this.homeOnFireTimer <= 0) {
        this.homeOnFireTimer = 60.0;
        sound.playFireIgnite();
        this.triggerAnnouncer('HE\'S ON FIRE!', 'He\'s on fire!');
      }
    } else {
      this.awayScore += points;
      this.awayConsecutiveMakes++;
      this.homeConsecutiveMakes = 0;

      if (this.awayConsecutiveMakes >= 3 && this.awayOnFireTimer <= 0) {
        this.awayOnFireTimer = 60.0;
        sound.playFireIgnite();
        this.triggerAnnouncer('OPPONENT IS ON FIRE!', 'Opponent is on fire!');
      }
    }

    // Check for buzzer beater
    if (this.timeRemaining <= 0) {
      sound.speakAnnouncer("It's good at the buzzer! Unbelievable!");
      this.triggerAnnouncer("IT'S GOOD AT THE BUZZER!");
    } else {
      const bannerText = this.ball.isThreePoint ? 'FROM DOWNTOWN... YES!' : 'IT\'S GOOD!';
      this.triggerAnnouncer(bannerText);
    }

    // Celebration particles
    for (let i = 0; i < 22; i++) {
      this.particles.push({
        x: rim.x,
        y: rim.y,
        z: rim.z,
        vx: (Math.random() - 0.5) * 80,
        vy: (Math.random() - 0.5) * 80,
        vz: Math.random() * -30,
        color: this.ball.isThreePoint ? '#38BDF8' : '#F97316',
        size: 3 + Math.random() * 3,
        life: 0.8,
        maxLife: 0.8,
      });
    }

    // 3v3 Target Score Victory check
    if (this.format === '3v3') {
      if (this.homeScore >= this.targetScore || this.awayScore >= this.targetScore) {
        this.handleGameOver();
        return;
      }
    }

    // Set engine turnover countdown cleanly (NO setTimeout race conditions)
    this.turnoverPendingTimer = 1.1;
    this.pendingTurnoverTeam = isHome ? 'away' : 'home';
  }

  public turnover(newPossession: 'home' | 'away') {
    this.turnoverPendingTimer = 0;
    this.possession = newPossession;
    this.shotClock = 24.0;

    this.players.forEach(p => {
      p.hasBall = false;
      p.actionState = 'idle';
      p.vx = 0;
      p.vy = 0;
      p.z = 0;
    });

    const inbounder = this.players.find(p => p.team === newPossession)!;
    inbounder.hasBall = true;
    inbounder.actionState = 'dribbling';

    // Switch user control if home team gets possession
    if (newPossession === 'home') {
      this.players.forEach(p => {
        if (p.team === 'home') p.isUserControlled = false;
      });
      inbounder.isUserControlled = true;
    }

    const b = this.court.bounds;
    const midX = this.court.width / 2;
    const midY = this.court.height / 2;

    if (this.court.isHalfCourt) {
      // 3v3 Streetball Check-ball at top of key
      inbounder.x = 290;
      inbounder.y = midY;
      inbounder.facing = 'right';
      this.possessionCleared = true; // Checking ball at the top of key is cleared!

      // Space teammates out wide on the wings
      const teammates = this.players.filter(p => p.team === newPossession && p.id !== inbounder.id);
      teammates.forEach((t, idx) => {
        t.x = 350;
        t.y = midY + (idx === 0 ? -110 : 110);
        t.facing = 'right';
      });

      // Position defenders matched up on their designated men
      const defenders = this.players.filter(p => p.team !== newPossession);
      defenders.forEach((d, idx) => {
        if (idx === 0) {
          d.x = 360;
          d.y = midY;
        } else if (idx === 1) {
          d.x = 425;
          d.y = midY - 95;
        } else {
          d.x = 425;
          d.y = midY + 95;
        }
        d.facing = 'left';
      });
    } else {
      // 5v5 Full court baseline inbound
      const isHome = newPossession === 'home';
      inbounder.x = isHome ? b.left + 25 : b.right - 25;
      inbounder.y = midY;
      inbounder.facing = isHome ? 'right' : 'left';

      // Spread teammates downcourt into backcourt receiver and wide wing lanes
      const teammates = this.players.filter(p => p.team === newPossession && p.id !== inbounder.id);
      teammates.forEach((t, idx) => {
        if (idx === 0) {
          t.x = isHome ? b.left + 110 : b.right - 110;
          t.y = midY - 35;
        } else if (idx === 1) {
          t.x = isHome ? b.left + 240 : b.right - 240;
          t.y = midY - 120;
        } else if (idx === 2) {
          t.x = isHome ? b.left + 240 : b.right - 240;
          t.y = midY + 120;
        } else {
          t.x = isHome ? b.left + 420 : b.right - 420;
          t.y = midY + 60;
        }
        t.facing = isHome ? 'right' : 'left';
      });

      // Position defenders safely spread in transition defense
      const defenders = this.players.filter(p => p.team !== newPossession);
      defenders.forEach((d, idx) => {
        if (idx === 0) {
          d.x = isHome ? midX - 60 : midX + 60;
          d.y = midY - 35;
        } else if (idx === 1) {
          d.x = isHome ? midX + 40 : midX - 40;
          d.y = midY - 110;
        } else if (idx === 2) {
          d.x = isHome ? midX + 40 : midX - 40;
          d.y = midY + 110;
        } else if (idx === 3) {
          d.x = isHome ? midX + 160 : midX - 160;
          d.y = midY - 60;
        } else {
          d.x = isHome ? midX + 160 : midX - 160;
          d.y = midY + 60;
        }
        d.facing = isHome ? 'left' : 'right';
      });
    }

    this.ball.state = 'held';
    this.ball.carrierId = inbounder.id;
    this.ball.x = inbounder.x + (inbounder.facing === 'right' ? 12 : -12);
    this.ball.y = inbounder.y + 6;
    this.ball.z = 2.5;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.vz = 0;
    this.ball.isShotAttempt = false;
    this.ball.hasScored = false;
    this.ball.lastTouchTeam = newPossession;
  }

  private flexRim(rim: Rim, amount: number) {
    if (rim === this.court.leftRim) {
      this.rimFlexAngleLeft = amount;
    } else {
      this.rimFlexAngleRight = amount;
    }
  }

  private handleQuarterEnd() {
    sound.playBuzzer();
    if (this.format === '5v5' && this.quarter < 4) {
      this.quarter++;
      this.timeRemaining = 60;
      this.triggerAnnouncer(`END OF QUARTER ${this.quarter - 1}!`);
      this.turnover(this.quarter % 2 === 0 ? 'away' : 'home');
    } else {
      this.handleGameOver();
    }
  }

  private handleGameOver() {
    this.isGameOver = true;
    sound.playBuzzer();
    const won = this.homeScore > this.awayScore;
    sound.speakAnnouncer(won ? 'Game over! Victory for the home squad!' : 'Final buzzer! Opponent takes the win!');
    this.triggerAnnouncer(won ? 'VICTORY!' : 'FINAL BUZZER!');
  }

  private updateParticles(dt: number) {
    this.particles = this.particles.filter(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.life -= dt;
      return p.life > 0;
    });

    const isOnFire = (this.possession === 'home' && this.homeOnFireTimer > 0) || (this.possession === 'away' && this.awayOnFireTimer > 0);
    if (isOnFire && (this.ball.state === 'in_air' || this.ball.state === 'held')) {
      for (let i = 0; i < 3; i++) {
        this.particles.push({
          x: this.ball.x + (Math.random() - 0.5) * 6,
          y: this.ball.y + (Math.random() - 0.5) * 6,
          z: this.ball.z + Math.random() * 2,
          vx: (Math.random() - 0.5) * 15,
          vy: (Math.random() - 0.5) * 15,
          vz: 8 + Math.random() * 12,
          color: Math.random() > 0.4 ? '#F97316' : '#EF4444',
          size: 4 + Math.random() * 4,
          life: 0.35,
          maxLife: 0.35,
        });
      }
    }
  }
}
