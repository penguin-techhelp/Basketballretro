import React from 'react';
import { FranchiseSave, GameSettings } from '../types/game';
import { sound } from '../services/soundEngine';
import {
  Trophy,
  Flame,
  Zap,
  ShoppingBag,
  Target,
  Settings,
  Volume2,
  VolumeX,
  Sparkles,
  Coins,
  Cpu,
} from 'lucide-react';

interface TitleScreenProps {
  franchise: FranchiseSave;
  settings: GameSettings;
  onSelectMode: (mode: '3v3' | '5v5' | 'franchise' | 'tournament' | '3point' | 'dunk') => void;
  onUpdateSettings: (settings: GameSettings) => void;
  onClaimDailyBonus: () => void;
  dailyBonusAvailable: boolean;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  franchise,
  settings,
  onSelectMode,
  onUpdateSettings,
  onClaimDailyBonus,
  dailyBonusAvailable,
}) => {
  const toggleSound = () => {
    const next = !settings.soundEnabled;
    sound.setMuted(!next);
    onUpdateSettings({ ...settings, soundEnabled: next });
  };

  const toggleGopiMode = () => {
    onUpdateSettings({ ...settings, gopiMode: !settings.gopiMode });
  };

  const toggleCrt = () => {
    onUpdateSettings({ ...settings, crtFilter: !settings.crtFilter });
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col items-center">
      {/* Tuxedo Penguin Gaming Studio Intro Banner */}
      <div className="w-full flex items-center justify-between py-2 border-b border-zinc-800 mb-4 px-2">
        <div className="flex items-center gap-3">
          <img
            src="/src/assets/images/tuxedo_penguin_referee_1791412674059.jpg"
            alt="Tuxedo Penguin Gaming Mascot"
            className="w-10 h-10 rounded-full border border-amber-400 shadow object-cover"
          />
          <div>
            <div className="font-pixel text-[11px] text-zinc-200">
              TUXEDO PENGUIN GAMING SPORTS STUDIO
            </div>
            <div className="text-[10px] text-amber-400 font-bold italic tracking-wide">
              "It's In The Game!"
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Hoops Coins Balance */}
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="font-pixel text-xs text-amber-400">{franchise.coins}</span>
          </div>

          {/* Daily Bonus Button */}
          {dailyBonusAvailable && (
            <button
              onClick={onClaimDailyBonus}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-pixel bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded animate-pulse shadow"
            >
              <Sparkles className="w-3.5 h-3.5" /> +250 COINS
            </button>
          )}

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="p-1.5 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded transition-colors"
            title="Toggle Sound"
          >
            {settings.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Hero Marquee Cover Art */}
      <div className="w-full relative rounded-xl overflow-hidden border-2 border-zinc-700 bg-zinc-950 mb-6 shadow-2xl">
        <img
          src="/src/assets/images/retro_hoops_cover_1791412686658.jpg"
          alt="Retro Hoops 95 Arcade Cover"
          className="w-full h-48 md:h-64 object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent flex flex-col justify-end p-6">
          <div className="font-pixel text-xs text-amber-400 mb-1">ARCADE 16-BIT BASKETBALL SIMULATOR</div>
          <h1 className="font-pixel text-2xl md:text-3xl text-white arcade-glow tracking-wider mb-2">
            RETRO HOOPS ’95
          </h1>
          <p className="text-xs text-zinc-300 max-w-xl">
            True Arc Parabolic Trajectories · Spring-Damped Rims · "He's On Fire!" Turbo Heat Meter · Franchise Card Market · 100% In-Browser Zero Downloads
          </p>
        </div>
      </div>

      {/* Main Game Modes Selection Grid */}
      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* 1. 3v3 Half-Court Streetball */}
        <button
          onClick={() => {
            sound.playSneakerSqueak();
            onSelectMode('3v3');
          }}
          className="bg-zinc-900/90 hover:bg-zinc-800 border-2 border-orange-500/80 hover:border-orange-400 rounded-xl p-5 text-left transition-all group flex flex-col justify-between hover:scale-[1.02] shadow-lg"
        >
          <div>
            <div className="w-10 h-10 rounded-lg bg-orange-950/60 border border-orange-600 flex items-center justify-center mb-3 group-hover:bg-orange-500 transition-colors">
              <Flame className="w-5 h-5 text-orange-400 group-hover:text-black transition-colors" />
            </div>
            <div className="font-pixel text-xs text-orange-400 mb-1">3v3 STREETBALL</div>
            <h3 className="font-pixel text-sm text-white mb-2">Half-Court to 21</h3>
            <p className="text-xs text-zinc-400">
              Gritty Rucker asphalt action. Physical defense, check-ball restarts, fast-paced games to 21 points.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-[11px] font-pixel text-orange-300">
            <span>PLAY STREETBALL</span>
            <span>➔</span>
          </div>
        </button>

        {/* 2. 5v5 Full-Court Pro Arena */}
        <button
          onClick={() => {
            sound.playSneakerSqueak();
            onSelectMode('5v5');
          }}
          className="bg-zinc-900/90 hover:bg-zinc-800 border-2 border-amber-400 hover:border-amber-300 rounded-xl p-5 text-left transition-all group flex flex-col justify-between hover:scale-[1.02] shadow-xl ring-1 ring-amber-400/50"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-amber-950/60 border border-amber-500 flex items-center justify-center group-hover:bg-amber-400 transition-colors">
                <Zap className="w-5 h-5 text-amber-400 group-hover:text-black transition-colors" />
              </div>
              <span className="font-pixel text-[9px] bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded border border-amber-400/40">
                DETAIL FLOORS
              </span>
            </div>
            <div className="font-pixel text-xs text-amber-400 mb-1">5v5 FULL-COURT PRO</div>
            <h3 className="font-pixel text-sm text-white mb-2">NBA Live ’95 Arena</h3>
            <p className="text-xs text-zinc-400">
              High-gloss maple & Boston parquet floors, authentic court aprons, baseline lettering, team benches, 4 quarters, and fast breaks.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-[11px] font-pixel text-amber-300">
            <span>PLAY FULL COURT</span>
            <span>➔</span>
          </div>
        </button>

        {/* 3. Dynasty Franchise & Card Market */}
        <button
          onClick={() => {
            sound.playCoinSound();
            onSelectMode('franchise');
          }}
          className="bg-zinc-900/90 hover:bg-zinc-800 border-2 border-amber-500/80 hover:border-amber-400 rounded-xl p-5 text-left transition-all group flex flex-col justify-between hover:scale-[1.02] shadow-lg"
        >
          <div>
            <div className="w-10 h-10 rounded-lg bg-amber-950/60 border border-amber-600 flex items-center justify-center mb-3 group-hover:bg-amber-500 transition-colors">
              <ShoppingBag className="w-5 h-5 text-amber-400 group-hover:text-black transition-colors" />
            </div>
            <div className="font-pixel text-xs text-amber-400 mb-1">DYNASTY FRANCHISE</div>
            <h3 className="font-pixel text-sm text-white mb-2">Foil Packs & Market</h3>
            <p className="text-xs text-zinc-400">
              Draft bronze talent, open foil packs, buy/sell 90s legends on transfer market, and climb 5 divisions.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-[11px] font-pixel text-amber-300">
            <span>MANAGE DYNASTY</span>
            <span>➔</span>
          </div>
        </button>

        {/* 4. World Basketball Cup */}
        <button
          onClick={() => {
            sound.playFanfare();
            onSelectMode('tournament');
          }}
          className="bg-zinc-900/90 hover:bg-zinc-800 border-2 border-yellow-500/80 hover:border-yellow-400 rounded-xl p-5 text-left transition-all group flex flex-col justify-between hover:scale-[1.02] shadow-lg"
        >
          <div>
            <div className="w-10 h-10 rounded-lg bg-yellow-950/60 border border-yellow-600 flex items-center justify-center mb-3 group-hover:bg-yellow-500 transition-colors">
              <Trophy className="w-5 h-5 text-yellow-400 group-hover:text-black transition-colors" />
            </div>
            <div className="font-pixel text-xs text-yellow-400 mb-1">WORLD CUP ’95</div>
            <h3 className="font-pixel text-sm text-white mb-2">16-Team Bracket</h3>
            <p className="text-xs text-zinc-400">
              Single-elimination championship featuring USA Dream Squad, Croatia ’92, Chicago ’95, Lithuania, and Spain.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-[11px] font-pixel text-yellow-300">
            <span>ENTER WORLD CUP</span>
            <span>➔</span>
          </div>
        </button>

        {/* 5. 3-Point Shootout Contest */}
        <button
          onClick={() => {
            sound.playSwish();
            onSelectMode('3point');
          }}
          className="bg-zinc-900/90 hover:bg-zinc-800 border-2 border-emerald-500/80 hover:border-emerald-400 rounded-xl p-5 text-left transition-all group flex flex-col justify-between hover:scale-[1.02] shadow-lg"
        >
          <div>
            <div className="w-10 h-10 rounded-lg bg-emerald-950/60 border border-emerald-600 flex items-center justify-center mb-3 group-hover:bg-emerald-500 transition-colors">
              <Target className="w-5 h-5 text-emerald-400 group-hover:text-black transition-colors" />
            </div>
            <div className="font-pixel text-xs text-emerald-400 mb-1">ALL-STAR CONTEST</div>
            <h3 className="font-pixel text-sm text-white mb-2">3-Point Shootout</h3>
            <p className="text-xs text-zinc-400">
              5 racks, 25 balls, 2-point money balls, and 60 seconds. Release at apex for perfect swishes!
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-[11px] font-pixel text-emerald-300">
            <span>HIGH SCORE: {franchise.highScores.threePoint} PTS</span>
            <span>➔</span>
          </div>
        </button>

        {/* 6. Slam Dunk Contest */}
        <button
          onClick={() => {
            sound.playMonsterDunk();
            onSelectMode('dunk');
          }}
          className="bg-zinc-900/90 hover:bg-zinc-800 border-2 border-red-500/80 hover:border-red-400 rounded-xl p-5 text-left transition-all group flex flex-col justify-between hover:scale-[1.02] shadow-lg"
        >
          <div>
            <div className="w-10 h-10 rounded-lg bg-red-950/60 border border-red-600 flex items-center justify-center mb-3 group-hover:bg-red-500 transition-colors">
              <Flame className="w-5 h-5 text-red-400 group-hover:text-black transition-colors" />
            </div>
            <div className="font-pixel text-xs text-red-400 mb-1">ALL-STAR CONTEST</div>
            <h3 className="font-pixel text-sm text-white mb-2">Slam Dunk Contest</h3>
            <p className="text-xs text-zinc-400">
              Windmills, 360 spins, between-the-legs slams. Judged by 5 legends on a 50-point scale!
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-[11px] font-pixel text-red-300">
            <span>HIGH SCORE: {franchise.highScores.dunkContest} / 50</span>
            <span>➔</span>
          </div>
        </button>
      </div>

      {/* Settings & Hardware / "Gopi Mode" Tuning Panel */}
      <div className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-4 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <Settings className="w-4 h-4 text-zinc-400" />
          <span className="font-pixel text-[11px] text-zinc-300">SYSTEM ARCHITECTURE & DISPLAY</span>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Gopi Mode toggle */}
          <button
            onClick={toggleGopiMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded border transition-colors ${
              settings.gopiMode
                ? 'bg-emerald-950 border-emerald-500 text-emerald-300 font-bold'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
            title="Tuned for Intel N150 / 8GB / 60 FPS locked"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>GOPI MODE: {settings.gopiMode ? 'ON (60 FPS)' : 'OFF'}</span>
          </button>

          {/* CRT scanline toggle */}
          <button
            onClick={toggleCrt}
            className={`px-3 py-1.5 rounded border transition-colors ${
              settings.crtFilter
                ? 'bg-amber-950 border-amber-500 text-amber-300 font-bold'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            CRT SCANLINES: {settings.crtFilter ? 'ON' : 'OFF'}
          </button>

          <span className="text-[10px] text-zinc-500">
            100% In-Browser · Playable Offline Locally · GitHub Pages Ready
          </span>
        </div>
      </div>
    </div>
  );
};
