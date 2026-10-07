import React, { useState, useEffect } from 'react';
import { sound } from '../services/soundEngine';
import { Play, Volume2, VolumeX, FastForward } from 'lucide-react';

interface ArcadeIntroProps {
  onComplete: () => void;
}

export const ArcadeIntro: React.FC<ArcadeIntroProps> = ({ onComplete }) => {
  const [stage, setStage] = useState<'STUDIO' | 'TITLE' | 'READY'>('STUDIO');
  const [isMuted, setIsMuted] = useState<boolean>(sound.isSoundMuted());

  useEffect(() => {
    // Stage 1: Tuxedo Penguin Studio intro
    const t1 = setTimeout(() => {
      sound.playFanfare();
      sound.speakAnnouncer("Tuxedo Penguin Gaming Sports Studio. It's in the game!");
    }, 400);

    // Stage 2: Title Slam
    const t2 = setTimeout(() => {
      setStage('TITLE');
      sound.playMonsterDunk();
      setTimeout(() => {
        sound.speakAnnouncer("BOOMSHAKALAKA!");
      }, 500);
    }, 2800);

    // Stage 3: Ready for input
    const t3 = setTimeout(() => {
      setStage('READY');
      sound.playWhistle();
    }, 4500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  // Listen for any key or click to dismiss intro
  useEffect(() => {
    const handleKey = () => {
      sound.playCoinSound();
      onComplete();
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onComplete]);

  const toggleSound = () => {
    const next = !isMuted;
    sound.setMuted(next);
    setIsMuted(next);
  };

  return (
    <div
      onClick={() => {
        sound.playCoinSound();
        onComplete();
      }}
      className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center cursor-pointer select-none overflow-hidden"
    >
      {/* Top controls: Sound & Skip */}
      <div className="absolute top-4 right-4 flex items-center gap-3 z-50">
        <button
          onClick={e => {
            e.stopPropagation();
            toggleSound();
          }}
          className="p-2 text-zinc-400 hover:text-white bg-zinc-900/80 border border-zinc-800 rounded transition-colors"
          title="Toggle Sound"
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            onComplete();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 font-pixel text-[10px] text-zinc-300 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 rounded transition-colors"
        >
          <FastForward className="w-3.5 h-3.5" /> SKIP INTRO
        </button>
      </div>

      {/* STAGE 1: Studio Mascot Logo */}
      {stage === 'STUDIO' && (
        <div className="flex flex-col items-center text-center animate-fade-in px-4">
          <div className="relative mb-6">
            <img
              src="/src/assets/images/tuxedo_penguin_referee_1791412674059.jpg"
              alt="Tuxedo Penguin Gaming Mascot"
              className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-amber-400 shadow-2xl object-cover ring-8 ring-amber-500/20 animate-pulse"
            />
          </div>

          <div className="font-pixel text-xs md:text-sm text-zinc-400 tracking-widest uppercase mb-2">
            Tuxedo Penguin Gaming
          </div>
          <div className="font-pixel text-lg md:text-2xl text-amber-400 arcade-glow mb-3">
            SPORTS STUDIO
          </div>
          <div className="text-sm md:text-lg text-white font-bold italic tracking-wide">
            "It’s In The Game!"
          </div>
        </div>
      )}

      {/* STAGE 2 & 3: Retro Hoops '95 Game Splash */}
      {(stage === 'TITLE' || stage === 'READY') && (
        <div className="flex flex-col items-center text-center animate-fade-in px-4 max-w-2xl">
          <div className="text-[10px] md:text-xs font-pixel text-orange-400 mb-2 tracking-widest">
            16-BIT COURT DYNASTY
          </div>

          <h1 className="font-pixel text-3xl md:text-5xl text-white arcade-glow tracking-wider mb-4 leading-tight">
            RETRO HOOPS ’95
          </h1>

          <div className="w-full max-w-md h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent my-3" />

          <p className="text-xs text-zinc-400 max-w-md mb-8">
            NBA Jam Over-The-Top Action × NBA Live ’95 Tactical Depth
            <br />
            True 3D Arc Physics · Spring Rims · On Fire Mode · Franchise Market
          </p>

          <div className="flex flex-col items-center gap-2">
            <div className="px-6 py-3 font-pixel text-xs md:text-sm text-black bg-amber-400 hover:bg-amber-300 rounded-md font-bold shadow-2xl animate-bounce flex items-center gap-2">
              <Play className="w-4 h-4 fill-black" />
              PRESS ANY KEY OR TAP TO TIP OFF
            </div>
            <span className="text-[10px] text-zinc-500 font-pixel mt-2">
              HOSTABLE ON GITHUB PAGES · 100% OFFLINE READY
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
