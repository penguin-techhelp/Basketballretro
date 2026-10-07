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

export interface CourtConfig {
  width: number;
  height: number;
  isHalfCourt: boolean;
  leftRim: Rim;
  rightRim: Rim;
  threePointRadius: number;
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
    };
  }

  return {
    width,
    height,
    isHalfCourt: false,
    leftRim: { x: 80, y: height / 2, z: 10, radius: 14, flexY: 0, flexVelocity: 0 },
    rightRim: { x: width - 80, y: height / 2, z: 10, radius: 14, flexY: 0, flexVelocity: 0 },
    threePointRadius: 215,
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

  // Tip-off Penguin State
  public tipOffActive: boolean = true;
  public tipOffTimer: number = 2.0;

  // Replay Buffer (records last 300 frames = 5 seconds)
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

    // Initialize Home Players
    for (let i = 0; i < count; i++) {
      const card = homeRoster[i] || homeRoster[0];
      const startX = this.court.isHalfCourt ? 300 + i * 40 : 250 + (i % 3) * 60;
      const startY = 160 + i * 65;
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
        hasBall: i === 0, // First home player starts with ball
        stamina: card.stats.stamina,
        maxStamina: card.stats.stamina,
        isSprinting: false,
        actionState: i === 0 ? 'dribbling' : 'idle',
        actionTimer: 0,
        shotHoldTime: 0,
        isUserControlled: i === 0,
        consecutiveMakes: 0,
      });
    }

    // Initialize Away Players
    for (let i = 0; i < count; i++) {
      const card = awayRoster[i] || awayRoster[0];
      const startX = this.court.isHalfCourt ? 440 + i * 35 : 680 - (i % 3) * 60;
      const startY = 160 + i * 65;
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

    // Ball initialization
    const ballCarrier = this.players.find(p => p.hasBall)!;
    this.ball = {
      x: ballCarrier.x + 12,
      y: ballCarrier.y,
      z: 2.5,
      vx: 0,
      vy: 0,
      vz: 0,
      state: 'held',
      carrierId: ballCarrier.id,
      lastShooterId: null,
      lastTouchTeam: 'home',
      isThreePoint: false,
      isAlleyOop: false,
      curveFactor: 0,
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

  // Active rim for current shooting team
  public getTargetRim(team: 'home' | 'away'): Rim {
    if (this.court.isHalfCourt) {
      return this.court.rightRim; // In half-court, all baskets are on the right hoop
    }
    return team === 'home' ? this.court.rightRim : this.court.leftRim;
  }

  // Update Game Physics Loop (Called at 60 FPS / fixed 16.6ms timestep)
  public update(dt: number) {
    if (this.isPaused || this.isGameOver) return;

    if (this.announcerCooldown > 0) {
      this.announcerCooldown -= dt;
    }

    // Tip-off animation sequence
    if (this.tipOffActive) {
      this.tipOffTimer -= dt;
      if (this.tipOffTimer <= 0) {
        this.tipOffActive = false;
        sound.playWhistle();
        this.triggerAnnouncer('TIP OFF! GAME ON!', 'Tip-off! Game on!');
      }
      return;
    }

    // Clock updates
    this.timeRemaining -= dt;
    if (this.timeRemaining <= 0) {
      this.handleQuarterEnd();
      return;
    }

    this.shotClock -= dt;
    if (this.shotClock <= 0) {
      sound.playBuzzer();
      this.triggerAnnouncer('SHOT CLOCK VIOLATION!', 'Shot clock violation!');
      this.turnover(this.possession === 'home' ? 'away' : 'home');
      return;
    }

    // Fire timers
    if (this.homeOnFireTimer > 0) this.homeOnFireTimer -= dt;
    if (this.awayOnFireTimer > 0) this.awayOnFireTimer -= dt;

    // Rim Spring-Dampening Physics
    const k = 18.0; // Spring constant
    const damping = 0.88;
    this.rimFlexAngleLeft += -k * this.rimFlexAngleLeft * dt;
    this.rimFlexAngleLeft *= damping;
    this.rimFlexAngleRight += -k * this.rimFlexAngleRight * dt;
    this.rimFlexAngleRight *= damping;

    // Update Players
    this.updatePlayers(dt);

    // Update Ball Physics
    this.updateBall(dt);

    // Update Particles
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

    for (const p of this.players) {
      // Regenerate stamina
      if (!p.isSprinting && p.stamina < p.maxStamina) {
        p.stamina = Math.min(p.maxStamina, p.stamina + 12 * dt);
      }

      // Action timer tick
      if (p.actionTimer > 0) {
        p.actionTimer -= dt;
        if (p.actionTimer <= 0 && p.actionState !== 'idle' && p.actionState !== 'dribbling') {
          p.actionState = p.hasBall ? 'dribbling' : 'idle';
        }
      }

      // USER CONTROLLED PLAYER
      if (p.isUserControlled && !this.autoModeActive) {
        this.handleUserInputPlayer(p, dt);
      } else {
        // CPU AI BEHAVIOR
        this.handleAiPlayer(p, ballCarrier, dt);
      }

      // Physics integrate
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Friction
      p.vx *= 0.84;
      p.vy *= 0.84;

      // Boundary clamp
      const minX = this.court.isHalfCourt ? 220 : 60;
      const maxX = this.court.width - 60;
      const minY = 90;
      const maxY = this.court.height - 70;

      p.x = Math.max(minX, Math.min(maxX, p.x));
      p.y = Math.max(minY, Math.min(maxY, p.y));

      // Ball follow dribbler
      if (p.hasBall && this.ball.state === 'held') {
        const dX = p.facing === 'right' ? 14 : -14;
        this.ball.x = p.x + dX;
        this.ball.y = p.y + 6;
        this.ball.z = 2.2 + Math.abs(Math.sin(Date.now() / 150)) * 1.5;
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

    // Turbo Sprint modifier [Shift]
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
        // Charging shot
        p.shotHoldTime += dt;
        p.actionState = 'shooting';
      } else {
        // Defensive jump block contest
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
      this.keys['KeyX'] = false; // Single tap consume
      if (p.hasBall) {
        this.executePass(p);
      } else {
        // Active poke steal
        this.executeSteal(p);
      }
    }
  }

  private handleAiPlayer(p: InGamePlayer, ballCarrier: InGamePlayer | undefined, dt: number) {
    const targetRim = this.getTargetRim(p.team);
    const isOnOffense = p.team === this.possession;

    if (p.hasBall) {
      // CPU Has Ball: Offensive set
      const distToRim = Math.hypot(p.x - targetRim.x, p.y - targetRim.y);

      // Drive toward rim or 3pt spot
      const targetX = targetRim.x + (p.team === 'home' ? -180 : 180);
      const targetY = targetRim.y;
      const angle = Math.atan2(targetY - p.y, targetX - p.x);

      p.vx = Math.cos(angle) * (140 + p.card.stats.speed * 0.8);
      p.vy = Math.sin(angle) * (140 + p.card.stats.speed * 0.8);
      p.facing = p.vx > 0 ? 'right' : 'left';

      // Decide to shoot if in range or shot clock low
      if (distToRim < 190 || this.shotClock < 3.5 || (distToRim < 260 && Math.random() < 0.015)) {
        p.shotHoldTime = 0.48; // Good CPU apex timing
        this.executeShot(p);
      } else if (Math.random() < 0.01) {
        // Pass to open teammate
        this.executePass(p);
      }
    } else if (isOnOffense) {
      // Offense without ball: spacing & cut to basket
      const targetX = targetRim.x + (p.team === 'home' ? -260 : 260) + Math.sin(Date.now() / 800 + p.x) * 60;
      const targetY = 120 + ((p.id.charCodeAt(3) * 70) % 260);
      const angle = Math.atan2(targetY - p.y, targetX - p.x);
      p.vx = Math.cos(angle) * 110;
      p.vy = Math.sin(angle) * 110;
      p.facing = p.vx > 0 ? 'right' : 'left';
    } else {
      // DEFENSE: Guard nearest opponent or ball carrier
      const opponentToGuard = ballCarrier && Math.hypot(p.x - ballCarrier.x, p.y - ballCarrier.y) < 180
        ? ballCarrier
        : this.players.find(opp => opp.team !== p.team) || ballCarrier;

      if (opponentToGuard) {
        // Stay between opponent and target rim
        const oppRim = this.getTargetRim(opponentToGuard.team);
        const guardX = (opponentToGuard.x * 2 + oppRim.x) / 3;
        const guardY = (opponentToGuard.y * 2 + oppRim.y) / 3;

        const angle = Math.atan2(guardY - p.y, guardX - p.x);
        const dist = Math.hypot(guardX - p.x, guardY - p.y);
        if (dist > 25) {
          p.vx = Math.cos(angle) * (130 + p.card.stats.defense * 0.7);
          p.vy = Math.sin(angle) * (130 + p.card.stats.defense * 0.7);
        }
        p.facing = opponentToGuard.x > p.x ? 'right' : 'left';

        // CPU steal attempt
        if (dist < 40 && opponentToGuard.hasBall && Math.random() < 0.01) {
          this.executeSteal(p);
        }
      }
    }
  }

  // PASS MECHANIC (Chest pass / Double-tap Alley-Oop)
  public executePass(passer: InGamePlayer) {
    if (!passer.hasBall) return;

    // Find best teammate
    const teammates = this.players.filter(p => p.team === passer.team && p.id !== passer.id);
    if (teammates.length === 0) return;

    // Pick teammate closest to rim or in open lane
    const targetRim = this.getTargetRim(passer.team);
    teammates.sort((a, b) => {
      const distA = Math.hypot(a.x - targetRim.x, a.y - targetRim.y);
      const distB = Math.hypot(b.x - targetRim.x, b.y - targetRim.y);
      return distA - distB;
    });

    const target = teammates[0];
    const distToRim = Math.hypot(target.x - targetRim.x, target.y - targetRim.y);
    const isAlleyOop = distToRim < 130 && passer.card.stats.clutch > 75;

    passer.hasBall = false;
    passer.actionState = 'passing';
    passer.actionTimer = 0.35;

    this.ball.state = 'in_air';
    this.ball.carrierId = null;
    this.ball.lastShooterId = null;
    this.ball.isAlleyOop = isAlleyOop;

    const dx = target.x - passer.x;
    const dy = target.y - passer.y;
    const dist = Math.hypot(dx, dy);
    const speed = isAlleyOop ? 380 : 520;
    const travelTime = dist / speed;

    this.ball.vx = (dx / dist) * speed;
    this.ball.vy = (dy / dist) * speed;
    this.ball.vz = isAlleyOop ? 22 : 8; // High arc lob for alley-oop

    sound.playDribble();

    if (isAlleyOop) {
      target.actionState = 'dunking';
      target.actionTimer = travelTime + 0.4;
      this.triggerAnnouncer('ALLEY-OOP LOB!', 'Up for the alley-oop!');
    }
  }

  // ACTIVE POKE STEAL
  public executeSteal(defender: InGamePlayer) {
    defender.actionState = 'stealing';
    defender.actionTimer = 0.4;
    sound.playStealPoke();

    const ballCarrier = this.players.find(p => p.hasBall && p.team !== defender.team);
    if (ballCarrier) {
      const dist = Math.hypot(defender.x - ballCarrier.x, defender.y - ballCarrier.y);
      const stealChance = (defender.card.stats.defense - ballCarrier.card.stats.stamina * 0.4) / 100;

      if (dist < 42 && Math.random() < Math.max(0.25, stealChance)) {
        // SUCCESSFUL STEAL
        ballCarrier.hasBall = false;
        ballCarrier.actionState = 'stumbled';
        ballCarrier.actionTimer = 0.6;

        this.ball.state = 'bouncing';
        this.ball.carrierId = null;
        this.ball.vx = (defender.x - ballCarrier.x) * 4;
        this.ball.vy = (defender.y - ballCarrier.y) * 4;
        this.ball.vz = 6;

        this.possession = defender.team;
        this.shotClock = 24.0;
        this.triggerAnnouncer('WHAT A STEAL!', 'Stolen away!');
      }
    }
  }

  // SHOT MECHANIC (Parabolic 3D arc or Monster Dunk)
  public executeShot(shooter: InGamePlayer) {
    shooter.hasBall = false;
    const targetRim = this.getTargetRim(shooter.team);
    const distToRim = Math.hypot(shooter.x - targetRim.x, shooter.y - targetRim.y);
    const isDunkRange = distToRim < 110;

    // Check if three pointer
    const isThree = distToRim > this.court.threePointRadius;

    // Sweet apex timing is around 0.45s - 0.55s
    const apexDiff = Math.abs(shooter.shotHoldTime - 0.50);
    const timingRating = apexDiff < 0.08 ? 'EXCELLENT' : apexDiff < 0.16 ? 'GOOD' : 'LATE';

    shooter.shotHoldTime = 0;
    this.ball.state = 'in_air';
    this.ball.carrierId = null;
    this.ball.lastShooterId = shooter.id;
    this.ball.lastTouchTeam = shooter.team;
    this.ball.isThreePoint = isThree;

    if (isDunkRange && shooter.card.stats.dunk > 70) {
      // MONSTER DUNK SEQUENCE!
      shooter.actionState = 'dunking';
      shooter.actionTimer = 0.75;
      shooter.z = 8.5; // Elevate
      
      this.ball.vx = (targetRim.x - shooter.x) * 2.2;
      this.ball.vy = (targetRim.y - shooter.y) * 2.2;
      this.ball.vz = 8;
      
      this.triggerAnnouncer('BOOMSHAKALAKA!', 'Boomshakalaka! Monster slam!');
      return;
    }

    // REGULAR JUMP SHOT
    shooter.actionState = 'shooting';
    shooter.actionTimer = 0.6;
    shooter.z = 3.5;

    // Calculate 3D Parabolic flight trajectory to rim
    const travelTime = 1.05 + distToRim / 450;
    const gravity = 32.0; // ft/s^2 scaled

    // Hit rate calculation based on stats + timing + distance
    const statRating = isThree ? shooter.card.stats.threePt : (shooter.card.stats.speed + shooter.card.stats.clutch) / 2;
    const isOnFire = shooter.team === 'home' ? this.homeOnFireTimer > 0 : this.awayOnFireTimer > 0;
    let makeProbability = (statRating / 100) * 0.75 + (timingRating === 'EXCELLENT' ? 0.35 : 0.05);
    if (isOnFire) makeProbability += 0.25;

    const willMake = Math.random() < Math.min(0.96, makeProbability);

    // Target end point (exact center if make, slight offset if rim clank)
    const targetX = willMake ? targetRim.x : targetRim.x + (Math.random() > 0.5 ? 12 : -12);
    const targetY = willMake ? targetRim.y : targetRim.y + (Math.random() > 0.5 ? 10 : -10);
    const targetZ = targetRim.z;

    this.ball.vx = (targetX - this.ball.x) / travelTime;
    this.ball.vy = (targetY - this.ball.y) / travelTime;
    // Parabolic equation: targetZ = z0 + vz * t - 0.5 * g * t^2 -> vz = (targetZ - z0 + 0.5 * g * t^2) / t
    this.ball.vz = (targetZ - this.ball.z + 0.5 * gravity * travelTime * travelTime) / travelTime;

    // Float rating text
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

  // Update Ball In Air / Bouncing / Scoring
  private updateBall(dt: number) {
    if (this.ball.state === 'held') return;

    const gravity = 30.0;
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;
    this.ball.z += this.ball.vz * dt - 0.5 * gravity * dt * dt;
    this.ball.vz -= gravity * dt;

    // Check Rim Collisions
    const targetRim = this.getTargetRim(this.possession);
    const distToRimXY = Math.hypot(this.ball.x - targetRim.x, this.ball.y - targetRim.y);
    const distToRimZ = Math.abs(this.ball.z - targetRim.z);

    // Ball reached hoop height
    if (distToRimXY < targetRim.radius && distToRimZ < 2.0 && this.ball.vz < 0 && this.ball.state === 'in_air') {
      // SWISH / SCORE!
      this.handleBucketScored(targetRim);
      return;
    } else if (distToRimXY < targetRim.radius + 12 && distToRimZ < 2.2 && this.ball.state === 'in_air') {
      // RIM BOUNCE / CLANK
      sound.playRimClank();
      this.ball.state = 'rim_bounce';
      this.ball.vx = -this.ball.vx * 0.4 + (Math.random() - 0.5) * 80;
      this.ball.vy = -this.ball.vy * 0.4 + (Math.random() - 0.5) * 80;
      this.ball.vz = 14; // Rebound pop
      this.flexRim(targetRim, 0.4);
      return;
    }

    // Floor bounce
    if (this.ball.z <= 0) {
      this.ball.z = 0;
      if (Math.abs(this.ball.vz) > 4) {
        sound.playDribble();
        this.ball.vz = -this.ball.vz * 0.65;
        this.ball.vx *= 0.75;
        this.ball.vy *= 0.75;
      } else {
        this.ball.vz = 0;
        this.ball.state = 'bouncing';
      }
    }

    // Loose ball pickup check by nearby players
    if (this.ball.state === 'bouncing' || this.ball.state === 'rim_bounce') {
      for (const p of this.players) {
        const dist = Math.hypot(p.x - this.ball.x, p.y - this.ball.y);
        if (dist < 32 && this.ball.z < 4.0) {
          // Player secures rebound / loose ball
          p.hasBall = true;
          p.actionState = 'dribbling';
          this.ball.state = 'held';
          this.ball.carrierId = p.id;
          this.possession = p.team;
          this.shotClock = 24.0;
          break;
        }
      }
    }
  }

  private handleBucketScored(rim: Rim) {
    this.ball.state = 'scored';
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

    const bannerText = this.ball.isThreePoint ? 'FROM DOWNTOWN... YES!' : 'IT\'S GOOD!';
    this.triggerAnnouncer(bannerText);

    // Spawn net celebration particles
    for (let i = 0; i < 20; i++) {
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

    // Turnover to other team (Check ball or inbound)
    setTimeout(() => {
      this.turnover(isHome ? 'away' : 'home');
    }, 1200);
  }

  public turnover(newPossession: 'home' | 'away') {
    this.possession = newPossession;
    this.shotClock = 24.0;
    this.players.forEach(p => (p.hasBall = false));

    const inbounder = this.players.find(p => p.team === newPossession)!;
    inbounder.hasBall = true;
    inbounder.actionState = 'dribbling';

    if (this.court.isHalfCourt) {
      // Check-ball at top of key
      inbounder.x = 310;
      inbounder.y = this.court.height / 2;
    } else {
      // Full court baseline inbound
      inbounder.x = newPossession === 'home' ? 100 : this.court.width - 100;
      inbounder.y = this.court.height / 2;
    }

    this.ball.state = 'held';
    this.ball.carrierId = inbounder.id;
    this.ball.x = inbounder.x;
    this.ball.y = inbounder.y;
    this.ball.z = 2.5;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.vz = 0;
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

    // Add On-Fire ball trail particles
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
