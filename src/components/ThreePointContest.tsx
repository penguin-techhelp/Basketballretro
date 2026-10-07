import React, { useState, useEffect, useRef } from 'react';
import { sound } from '../services/soundEngine';
import { Trophy, Timer, Volume2, VolumeX, ArrowLeft } from 'lucide-react';
import { PlayerCard } from '../types/game';

interface ThreePointContestProps {
  player: PlayerCard;
  highScore: number;
  onFinish: (score: number, coinsEarned: number) => void;
  onExit: () => void;
}

const RACK_NAMES = ['Left Corner', 'Left Wing', 'Top of Key', 'Right Wing', 'Right Corner'];

export const ThreePointContest: React.FC<ThreePointContestProps> = ({
  player,
  highScore,
  onFinish,
  onExit,
}) => {
  const [currentRack, setCurrentRack] = useState<number>(0);
  const [currentBall, setCurrentBall] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [gameState, setGameState] = useState<'READY' | 'SHOOTING' | 'FINISHED'>('READY');
  const [isCharging, setIsCharging] = useState<boolean>(false);
  const [chargeProgress, setChargeProgress] = useState<number>(0);
  const [lastShotFeedback, setLastShotFeedback] = useState<string>('');
  const [isSoundMuted, setIsSoundMuted] = useState<boolean>(sound.isSoundMuted());

  // Ball history in current rack (up to 5 balls: 'swish' | 'clank' | 'pending')
  const [rackResults, setRackResults] = useState<Array<Array<'swish' | 'clank' | 'pending'>>>([
    ['pending', 'pending', 'pending', 'pending', 'pending'],
    ['pending', 'pending', 'pending', 'pending', 'pending'],
    ['pending', 'pending', 'pending', 'pending', 'pending'],
    ['pending', 'pending', 'pending', 'pending', 'pending'],
    ['pending', 'pending', 'pending', 'pending', 'pending'],
  ]);

  const chargeRef = useRef<number>(0);
  const chargeDirectionRef = useRef<number>(1);
  const animationFrameRef = useRef<number | null>(null);

  // Timer countdown
  useEffect(() => {
    if (gameState !== 'SHOOTING') return;

    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(interval);
          finishContest();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState, score]);

  // Charging animation loop
  useEffect(() => {
    if (!isCharging) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    const animateCharge = () => {
      chargeRef.current += 0.038 * chargeDirectionRef.current;
      if (chargeRef.current >= 1.0) {
        chargeRef.current = 1.0;
        chargeDirectionRef.current = -1;
      } else if (chargeRef.current <= 0.0) {
        chargeRef.current = 0.0;
        chargeDirectionRef.current = 1;
      }
      setChargeProgress(chargeRef.current);
      animationFrameRef.current = requestAnimationFrame(animateCharge);
    };

    animationFrameRef.current = requestAnimationFrame(animateCharge);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isCharging]);

  const startContest = () => {
    setGameState('SHOOTING');
    sound.playWhistle();
    sound.speakAnnouncer('60 seconds on the clock. 3-point shootout begins!');
  };

  const handleStartCharge = () => {
    if (gameState !== 'SHOOTING' || isCharging) return;
    setIsCharging(true);
    chargeRef.current = 0;
    chargeDirectionRef.current = 1;
    setChargeProgress(0);
  };

  const handleReleaseShot = () => {
    if (!isCharging || gameState !== 'SHOOTING') return;
    setIsCharging(false);

    // Green apex sweet spot is between 0.45 and 0.55
    const release = chargeRef.current;
    const diff = Math.abs(release - 0.50);
    const isMoneyBall = currentBall === 4;

    // Stat bonus from player's threePt stat
    const statChance = player.stats.threePt / 100;
    const isPerfect = diff < 0.09;
    const isGood = diff < 0.18;
    const willMake = isPerfect || (isGood && Math.random() < statChance * 0.9);

    const pts = isMoneyBall ? 2 : 1;

    // Update rack state
    const newResults = [...rackResults];
    newResults[currentRack][currentBall] = willMake ? 'swish' : 'clank';
    setRackResults(newResults);

    if (willMake) {
      sound.playSwish();
      setScore(s => s + pts);
      const feedback = isPerfect
        ? (isMoneyBall ? 'MONEY BALL... CASH! (+2)' : 'PERFECT SWISH! (+1)')
        : 'IT\'S GOOD!';
      setLastShotFeedback(feedback);

      if (isMoneyBall) {
        sound.speakAnnouncer('Money ball is good!');
      }
    } else {
      sound.playRimClank();
      setLastShotFeedback('BACK-IRON CLANK!');
      sound.playGasp();
    }

    // Advance to next ball or rack
    if (currentBall < 4) {
      setCurrentBall(b => b + 1);
    } else {
      // Rack finished
      if (currentRack < 4) {
        setCurrentRack(r => r + 1);
        setCurrentBall(0);
        sound.playSneakerSqueak();
      } else {
        // All 5 racks completed!
        finishContest();
      }
    }
  };

  const finishContest = () => {
    setGameState('FINISHED');
    sound.playBuzzer();
    sound.playCheer();
    const coins = score * 30 + (score > highScore ? 200 : 50);
    sound.speakAnnouncer(`Shootout over! Final score: ${score} points!`);
  };

  const toggleSound = () => {
    const next = !isSoundMuted;
    sound.setMuted(next);
    setIsSoundMuted(next);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 flex flex-col items-center">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
        <button
          onClick={onExit}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="text-center">
          <h2 className="font-pixel text-sm text-amber-400">3-POINT SHOOTOUT ’95</h2>
          <div className="text-xs text-zinc-400 mt-0.5">
            Shooter: <span className="text-zinc-200 font-bold">{player.name}</span> ({player.stats.threePt} 3PT)
          </div>
        </div>

        <button
          onClick={toggleSound}
          className="p-2 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded transition-colors"
        >
          {isSoundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Arcade Arena View */}
      <div className="w-full bg-zinc-900 border-2 border-zinc-700 rounded-lg p-6 relative overflow-hidden flex flex-col items-center">
        {/* Score & Time Jumbotron */}
        <div className="flex items-center justify-between w-full max-w-md bg-zinc-950 border border-zinc-800 px-6 py-3 rounded-md mb-6">
          <div className="text-center">
            <div className="text-[10px] font-pixel text-zinc-400">POINTS</div>
            <div className="font-pixel text-2xl text-amber-400">{score}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] font-pixel text-zinc-400 flex items-center justify-center gap-1">
              <Timer className="w-3 h-3 text-red-400" /> TIME
            </div>
            <div className="font-pixel text-2xl text-red-500">{timeLeft}s</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] font-pixel text-zinc-400 flex items-center justify-center gap-1">
              <Trophy className="w-3 h-3 text-yellow-500" /> BEST
            </div>
            <div className="font-pixel text-2xl text-zinc-300">{Math.max(score, highScore)}</div>
          </div>
        </div>

        {/* 5 Racks Display */}
        <div className="grid grid-cols-5 gap-2 w-full max-w-2xl mb-6">
          {RACK_NAMES.map((name, rIdx) => {
            const isCurrent = rIdx === currentRack && gameState === 'SHOOTING';
            return (
              <div
                key={name}
                className={`flex flex-col items-center p-2 rounded border text-center transition-all ${
                  isCurrent
                    ? 'border-amber-400 bg-amber-950/30 ring-1 ring-amber-400'
                    : 'border-zinc-800 bg-zinc-950/60'
                }`}
              >
                <div className="text-[9px] font-pixel text-zinc-400 truncate w-full mb-2">
                  {name}
                </div>
                {/* 5 Balls */}
                <div className="flex gap-1">
                  {rackResults[rIdx].map((res, bIdx) => {
                    const isMoney = bIdx === 4;
                    const isBallActive = isCurrent && bIdx === currentBall;
                    let ballColor = isMoney ? 'bg-gradient-to-r from-blue-600 to-red-600' : 'bg-orange-500';
                    if (res === 'swish') ballColor = 'bg-emerald-500 shadow-sm shadow-emerald-500';
                    if (res === 'clank') ballColor = 'bg-zinc-700 opacity-40';

                    return (
                      <div
                        key={bIdx}
                        className={`w-3.5 h-3.5 rounded-full ${ballColor} ${
                          isBallActive ? 'ring-2 ring-white scale-125 animate-pulse' : ''
                        }`}
                        title={isMoney ? 'Money Ball (2 pts)' : 'Standard (1 pt)'}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Shootout Apex Release Meter */}
        {gameState === 'SHOOTING' && (
          <div className="w-full max-w-md flex flex-col items-center mb-6">
            <div className="text-xs font-pixel text-zinc-300 mb-2">
              APEX TIMING METER: <span className="text-emerald-400">RELEASE AT APEX</span>
            </div>
            <div className="w-full h-8 bg-zinc-950 border-2 border-zinc-700 rounded-md relative overflow-hidden flex items-center">
              {/* Sweet spot green zone */}
              <div className="absolute left-[44%] w-[14%] h-full bg-emerald-500/40 border-x border-emerald-400 z-0 flex items-center justify-center">
                <span className="text-[8px] font-pixel text-emerald-200">APEX</span>
              </div>
              {/* Needle cursor */}
              <div
                className="absolute top-0 bottom-0 w-2.5 bg-yellow-400 shadow-md shadow-yellow-400 z-10"
                style={{ left: `calc(${chargeProgress * 100}% - 5px)` }}
              />
            </div>
            <div className="text-[11px] font-pixel text-amber-400 h-5 mt-2">
              {lastShotFeedback}
            </div>
          </div>
        )}

        {/* Action Controls */}
        {gameState === 'READY' && (
          <div className="text-center py-6">
            <p className="text-xs text-zinc-300 max-w-sm mb-4">
              5 racks with 5 balls each. The final ball on each rack is the 2-point MONEY BALL!
              Hold and release at the apex to sink pure swishes.
            </p>
            <button
              onClick={startContest}
              className="px-8 py-3 text-sm font-pixel text-black bg-amber-400 hover:bg-amber-300 border-2 border-amber-500 rounded font-bold shadow-lg transition-transform active:scale-95"
            >
              START 3-POINT SHOOTOUT
            </button>
          </div>
        )}

        {gameState === 'SHOOTING' && (
          <div className="flex flex-col items-center gap-3">
            <button
              onMouseDown={handleStartCharge}
              onMouseUp={handleReleaseShot}
              onTouchStart={handleStartCharge}
              onTouchEnd={handleReleaseShot}
              className={`w-48 h-16 rounded-lg font-pixel text-sm font-bold transition-all shadow-lg select-none ${
                isCharging
                  ? 'bg-emerald-500 text-black scale-95 ring-4 ring-emerald-400'
                  : 'bg-amber-500 hover:bg-amber-400 text-black'
              }`}
            >
              {isCharging ? 'RELEASE!' : 'HOLD [C] SHOOT'}
            </button>
            <span className="text-[10px] text-zinc-500">Keyboard shortcut: Hold & Release [C] or [Space]</span>
          </div>
        )}

        {gameState === 'FINISHED' && (
          <div className="text-center py-6 bg-zinc-950/80 w-full rounded-lg border border-zinc-800">
            <h3 className="font-pixel text-lg text-amber-400 mb-2">CONTEST COMPLETE!</h3>
            <div className="text-sm text-zinc-300 mb-1">
              Final Score: <span className="text-amber-400 font-bold">{score} / 30 Points</span>
            </div>
            <div className="text-xs text-emerald-400 font-pixel mb-6">
              +{score * 30 + (score > highScore ? 200 : 50)} HOOPS COINS EARNED!
            </div>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => {
                  setGameState('READY');
                  setScore(0);
                  setTimeLeft(60);
                  setCurrentRack(0);
                  setCurrentBall(0);
                  setRackResults([
                    ['pending', 'pending', 'pending', 'pending', 'pending'],
                    ['pending', 'pending', 'pending', 'pending', 'pending'],
                    ['pending', 'pending', 'pending', 'pending', 'pending'],
                    ['pending', 'pending', 'pending', 'pending', 'pending'],
                    ['pending', 'pending', 'pending', 'pending', 'pending'],
                  ]);
                }}
                className="px-6 py-2.5 text-xs font-pixel bg-zinc-800 hover:bg-zinc-700 text-white rounded border border-zinc-700"
              >
                SHOOT AGAIN
              </button>
              <button
                onClick={() => onFinish(score, score * 30 + (score > highScore ? 200 : 50))}
                className="px-6 py-2.5 text-xs font-pixel bg-amber-400 hover:bg-amber-300 text-black rounded font-bold"
              >
                COLLECT REWARD
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
