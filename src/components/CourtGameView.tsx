import React, { useEffect, useRef, useState } from 'react';
import { BasketballMatchEngine } from '../game/physics';
import { CourtRenderer } from '../game/renderer';
import { GameSettings, Team, CourtSurface } from '../types/game';
import { sound } from '../services/soundEngine';
import {
  Pause,
  Play,
  Volume2,
  VolumeX,
  RotateCcw,
  Bot,
  Zap,
  ArrowLeft,
  Flame,
} from 'lucide-react';

interface CourtGameViewProps {
  homeTeam: Team;
  awayTeam: Team;
  format: '3v3' | '5v5';
  settings: GameSettings;
  onUpdateSettings: (settings: GameSettings) => void;
  onMatchComplete: (homeScore: number, awayScore: number, coinsEarned: number) => void;
  onExit: () => void;
}

export const CourtGameView: React.FC<CourtGameViewProps> = ({
  homeTeam,
  awayTeam,
  format,
  settings,
  onUpdateSettings,
  onMatchComplete,
  onExit,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<BasketballMatchEngine | null>(null);
  const rendererRef = useRef<CourtRenderer | null>(null);

  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [matchDone, setMatchDone] = useState<boolean>(false);
  const [homeScore, setHomeScore] = useState<number>(0);
  const [awayScore, setAwayScore] = useState<number>(0);
  const [autoMode, setAutoMode] = useState<boolean>(settings.autoMode);
  const [surface, setSurface] = useState<CourtSurface>(settings.courtSurface || homeTeam.courtType || 'maple');
  const [isMuted, setIsMuted] = useState<boolean>(sound.isSoundMuted());

  // Virtual touch control states
  const touchDirectionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Initialize engine & renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fixed aspect canvas size
    const courtWidth = format === '3v3' ? 680 : 960;
    const courtHeight = 500;
    canvas.width = courtWidth;
    canvas.height = courtHeight;

    const engine = new BasketballMatchEngine(
      homeTeam.roster,
      awayTeam.roster,
      format,
      settings.quarterMinutes
    );
    engine.setAutoMode(autoMode);
    engineRef.current = engine;

    const renderer = new CourtRenderer(ctx, courtWidth, courtHeight);
    rendererRef.current = renderer;

    let animId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min(0.033, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      // Update engine
      engine.update(dt);

      // Render frame
      renderer.render(engine, surface, settings.gopiMode);

      setHomeScore(engine.homeScore);
      setAwayScore(engine.awayScore);

      if (engine.isGameOver && !matchDone) {
        setMatchDone(true);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [homeTeam, awayTeam, format, surface, settings.gopiMode]);

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!engineRef.current) return;

      if (e.code === 'KeyP' || e.code === 'Escape') {
        setIsPaused(p => !p);
        if (engineRef.current) engineRef.current.isPaused = !engineRef.current.isPaused;
        return;
      }

      if (e.code === 'KeyA') {
        setAutoMode(curr => {
          const next = !curr;
          if (engineRef.current) engineRef.current.setAutoMode(next);
          return next;
        });
        return;
      }

      engineRef.current.keys[e.code] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!engineRef.current) return;
      engineRef.current.keys[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const toggleAutoMode = () => {
    setAutoMode(curr => {
      const next = !curr;
      if (engineRef.current) engineRef.current.setAutoMode(next);
      return next;
    });
  };

  const toggleSound = () => {
    const next = !isMuted;
    sound.setMuted(next);
    setIsMuted(next);
  };

  const handleVirtualButtonDown = (key: string) => {
    if (!engineRef.current) return;
    engineRef.current.keys[key] = true;
  };

  const handleVirtualButtonUp = (key: string) => {
    if (!engineRef.current) return;
    engineRef.current.keys[key] = false;
  };

  const handleClaimMatchReward = () => {
    const won = homeScore > awayScore;
    const coins = won ? 350 + homeScore * 5 : 100;
    onMatchComplete(homeScore, awayScore, coins);
  };

  return (
    <div className="w-full flex flex-col items-center select-none">
      {/* Top Controls Bar */}
      <div className="w-full max-w-5xl flex items-center justify-between px-3 py-2 border-b border-zinc-800 mb-2">
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Exit Match
        </button>

        <div className="flex items-center gap-4">
          {/* Surface selector */}
          <div className="hidden sm:flex items-center gap-1.5 bg-zinc-900 px-2 py-1 rounded border border-zinc-800 text-[11px]">
            <span className="text-zinc-500 font-pixel text-[9px]">FLOOR:</span>
            {(['maple', 'parquet', 'oak', 'asphalt', 'neon'] as CourtSurface[]).map(s => (
              <button
                key={s}
                onClick={() => setSurface(s)}
                className={`px-2 py-0.5 rounded capitalize ${
                  surface === s ? 'bg-amber-500 text-black font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Auto Mode indicator */}
          <button
            onClick={toggleAutoMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-pixel transition-colors ${
              autoMode
                ? 'bg-cyan-500 text-black font-bold shadow'
                : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
            }`}
            title="Auto CPU Assist Mode [A]"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>AUTO: {autoMode ? 'ON' : 'OFF'}</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="p-1.5 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Pause Button */}
          <button
            onClick={() => {
              setIsPaused(p => !p);
              if (engineRef.current) engineRef.current.isPaused = !engineRef.current.isPaused;
            }}
            className="p-1.5 text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-700 rounded transition-colors"
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Canvas View with CRT effect overlay */}
      <div className="relative w-full max-w-5xl rounded-lg overflow-hidden border-2 border-zinc-700 bg-black shadow-2xl flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="w-full h-auto pixelated block"
          style={{ maxHeight: '72vh' }}
        />

        {/* Scanlines CRT filter overlay */}
        {settings.crtFilter && <div className="absolute inset-0 crt-overlay pointer-events-none" />}

        {/* Pause Modal */}
        {isPaused && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 z-40">
            <h3 className="font-pixel text-xl text-amber-400 mb-4 arcade-glow">GAME PAUSED</h3>
            <div className="flex flex-col gap-3 w-64 text-center">
              <button
                onClick={() => {
                  setIsPaused(false);
                  if (engineRef.current) engineRef.current.isPaused = false;
                }}
                className="py-2.5 font-pixel text-xs bg-amber-400 hover:bg-amber-300 text-black font-bold rounded shadow"
              >
                RESUME PLAY
              </button>
              <button
                onClick={toggleAutoMode}
                className="py-2.5 font-pixel text-xs bg-zinc-800 hover:bg-zinc-700 text-white rounded border border-zinc-700"
              >
                AUTO CPU MODE: {autoMode ? 'ENABLED' : 'DISABLED'}
              </button>
              <button
                onClick={onExit}
                className="py-2.5 font-pixel text-xs bg-red-900/60 hover:bg-red-800 text-red-200 rounded border border-red-700"
              >
                QUIT MATCH
              </button>
            </div>
          </div>
        )}

        {/* Game Over Modal */}
        {matchDone && (
          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-6 z-40">
            <h3 className="font-pixel text-2xl text-amber-400 mb-2 arcade-glow">
              {homeScore > awayScore ? 'FINAL VICTORY!' : 'FINAL BUZZER'}
            </h3>
            <div className="flex items-center gap-6 my-4 bg-zinc-950 p-4 rounded-lg border border-zinc-800">
              <div className="text-center">
                <div className="font-pixel text-xs text-red-400 mb-1">{homeTeam.shortName}</div>
                <div className="font-pixel text-3xl text-white">{homeScore}</div>
              </div>
              <div className="font-pixel text-lg text-zinc-500">vs</div>
              <div className="text-center">
                <div className="font-pixel text-xs text-blue-400 mb-1">{awayTeam.shortName}</div>
                <div className="font-pixel text-3xl text-white">{awayScore}</div>
              </div>
            </div>
            <div className="font-pixel text-xs text-emerald-400 mb-6">
              +{homeScore > awayScore ? 350 + homeScore * 5 : 100} HOOPS COINS EARNED!
            </div>
            <button
              onClick={handleClaimMatchReward}
              className="px-8 py-3 font-pixel text-xs bg-amber-400 hover:bg-amber-300 text-black font-bold rounded shadow-lg active:scale-95 transition-transform"
            >
              COLLECT REWARDS & EXIT
            </button>
          </div>
        )}
      </div>

      {/* On-Screen Touch / Virtual Gamepad Controls (Mobile & Desktop) */}
      <div className="w-full max-w-5xl mt-3 px-2 flex justify-between items-center bg-zinc-950 border border-zinc-800 rounded-lg p-3">
        {/* D-Pad Arrow Controls */}
        <div className="grid grid-cols-3 gap-1.5 w-32 h-32">
          <div />
          <button
            onMouseDown={() => handleVirtualButtonDown('ArrowUp')}
            onMouseUp={() => handleVirtualButtonUp('ArrowUp')}
            onTouchStart={() => handleVirtualButtonDown('ArrowUp')}
            onTouchEnd={() => handleVirtualButtonUp('ArrowUp')}
            className="bg-zinc-800 active:bg-amber-500 rounded flex items-center justify-center font-bold text-lg text-white"
          >
            ▲
          </button>
          <div />
          <button
            onMouseDown={() => handleVirtualButtonDown('ArrowLeft')}
            onMouseUp={() => handleVirtualButtonUp('ArrowLeft')}
            onTouchStart={() => handleVirtualButtonDown('ArrowLeft')}
            onTouchEnd={() => handleVirtualButtonUp('ArrowLeft')}
            className="bg-zinc-800 active:bg-amber-500 rounded flex items-center justify-center font-bold text-lg text-white"
          >
            ◀
          </button>
          <div className="bg-zinc-900 rounded flex items-center justify-center text-[10px] text-zinc-500 font-pixel">
            DPAD
          </div>
          <button
            onMouseDown={() => handleVirtualButtonDown('ArrowRight')}
            onMouseUp={() => handleVirtualButtonUp('ArrowRight')}
            onTouchStart={() => handleVirtualButtonDown('ArrowRight')}
            onTouchEnd={() => handleVirtualButtonUp('ArrowRight')}
            className="bg-zinc-800 active:bg-amber-500 rounded flex items-center justify-center font-bold text-lg text-white"
          >
            ▶
          </button>
          <div />
          <button
            onMouseDown={() => handleVirtualButtonDown('ArrowDown')}
            onMouseUp={() => handleVirtualButtonUp('ArrowDown')}
            onTouchStart={() => handleVirtualButtonDown('ArrowDown')}
            onTouchEnd={() => handleVirtualButtonUp('ArrowDown')}
            className="bg-zinc-800 active:bg-amber-500 rounded flex items-center justify-center font-bold text-lg text-white"
          >
            ▼
          </button>
          <div />
        </div>

        {/* Center Control Guide */}
        <div className="hidden md:flex flex-col items-center text-center text-xs text-zinc-400 space-y-1">
          <div className="font-pixel text-[10px] text-zinc-300">KEYBOARD CONTROLS</div>
          <div><span className="text-white font-bold">[Arrows / WASD]</span> Move</div>
          <div><span className="text-amber-400 font-bold">[C / Space]</span> Shoot Apex / Monster Dunk / Block</div>
          <div><span className="text-cyan-400 font-bold">[X]</span> Chest Pass / Steal / Double-tap Alley-Oop</div>
          <div><span className="text-orange-400 font-bold">[Shift]</span> Turbo Sprint / Crossover</div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {/* Turbo Sprint modifier */}
          <button
            onMouseDown={() => handleVirtualButtonDown('ShiftLeft')}
            onMouseUp={() => handleVirtualButtonUp('ShiftLeft')}
            onTouchStart={() => handleVirtualButtonDown('ShiftLeft')}
            onTouchEnd={() => handleVirtualButtonUp('ShiftLeft')}
            className="w-14 h-14 rounded-full bg-orange-700 active:bg-orange-500 text-white font-pixel text-[10px] flex flex-col items-center justify-center shadow-lg active:scale-95"
          >
            <Zap className="w-4 h-4 mb-0.5" />
            TURBO
          </button>

          {/* Pass / Steal [X] */}
          <button
            onMouseDown={() => handleVirtualButtonDown('KeyX')}
            onMouseUp={() => handleVirtualButtonUp('KeyX')}
            onTouchStart={() => handleVirtualButtonDown('KeyX')}
            onTouchEnd={() => handleVirtualButtonUp('KeyX')}
            className="w-16 h-16 rounded-full bg-cyan-700 active:bg-cyan-400 text-white font-pixel text-xs font-bold flex flex-col items-center justify-center shadow-lg active:scale-95"
          >
            <span>[X]</span>
            <span className="text-[8px] font-normal">PASS/STL</span>
          </button>

          {/* Shoot / Block [C] */}
          <button
            onMouseDown={() => handleVirtualButtonDown('KeyC')}
            onMouseUp={() => handleVirtualButtonUp('KeyC')}
            onTouchStart={() => handleVirtualButtonDown('KeyC')}
            onTouchEnd={() => handleVirtualButtonUp('KeyC')}
            className="w-16 h-16 rounded-full bg-amber-600 active:bg-amber-400 text-white font-pixel text-xs font-bold flex flex-col items-center justify-center shadow-lg active:scale-95"
          >
            <span>[C]</span>
            <span className="text-[8px] font-normal">SHOOT/BLK</span>
          </button>
        </div>
      </div>
    </div>
  );
};
