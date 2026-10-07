export type PlayerPosition = 'PG' | 'SG' | 'SF' | 'PF' | 'C';
export type CardTier = 'bronze' | 'silver' | 'gold' | 'diamond';

export interface PlayerCard {
  id: string;
  name: string;
  nickname?: string;
  number: number;
  position: PlayerPosition;
  tier: CardTier;
  stats: {
    speed: number;       // 40 - 99
    dunk: number;        // 40 - 99
    threePt: number;     // 40 - 99
    defense: number;     // 40 - 99
    stamina: number;     // 40 - 99
    clutch: number;      // 40 - 99
  };
  heightInches: number;  // 70 (5'10") to 85 (7'1")
  skinTone: 'light' | 'tan' | 'dark' | 'deep';
  hairColor: 'black' | 'brown' | 'blonde' | 'bald';
  hasHeadband?: boolean;
  hasGoggles?: boolean;
  sneakerColor: string;
  priceCoins: number;
}

export interface Team {
  id: string;
  name: string;
  city: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  courtType: 'maple' | 'oak' | 'asphalt' | 'neon';
  roster: PlayerCard[];
}

export type CourtSurface = 'maple' | 'parquet' | 'oak' | 'asphalt' | 'neon';

export type GameFormat = '3v3' | '5v5' | '3point' | 'dunk_contest';

export interface DivisionCircuit {
  id: number;
  name: string;
  courtName: string;
  courtSurface: CourtSurface;
  entryReward: number;
  winReward: number;
  opponentTeam: Team;
  description: string;
  isUnlocked: boolean;
}

export interface FranchiseSave {
  teamName: string;
  coins: number;
  inventory: PlayerCard[];
  activeLineupIds: string[]; // 3 IDs for 3v3 or 5 IDs for 5v5
  unlockedDivision: number;
  trophiesWon: string[];
  packs: {
    bronze: number;
    silver: number;
    gold: number;
    allStar: number;
  };
  highScores: {
    threePoint: number;
    dunkContest: number;
  };
}

export interface Ball {
  x: number;
  y: number;
  z: number;            // Height above floor (feet: 0 to 18)
  vx: number;
  vy: number;
  vz: number;
  state: 'held' | 'in_air' | 'bouncing' | 'rim_bounce' | 'scored';
  carrierId: string | null;
  lastShooterId: string | null;
  lastTouchTeam: 'home' | 'away' | null;
  isThreePoint: boolean;
  isAlleyOop: boolean;
  curveFactor: number;
  isShotAttempt?: boolean;
  willMake?: boolean;
  hasScored?: boolean;
  targetHoopX?: number;
  targetHoopY?: number;
}

export interface InGamePlayer {
  id: string;
  card: PlayerCard;
  team: 'home' | 'away';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  facing: 'left' | 'right';
  hasBall: boolean;
  stamina: number;
  maxStamina: number;
  isSprinting: boolean;
  actionState: 'idle' | 'dribbling' | 'crossover' | 'shooting' | 'dunking' | 'passing' | 'stealing' | 'blocking' | 'celebrating' | 'stumbled';
  actionTimer: number;
  shotHoldTime: number;
  isUserControlled: boolean;
  consecutiveMakes: number;
  targetX?: number;
  targetY?: number;
}

export interface GameSettings {
  soundEnabled: boolean;
  announcerEnabled: boolean;
  gopiMode: boolean; // Low-power optimized 60fps for Intel N150 / 8GB
  crtFilter: boolean;
  autoMode: boolean; // CPU helper AI
  quarterMinutes: number; // 1, 2, or 3 min
  courtSurface: CourtSurface;
}
