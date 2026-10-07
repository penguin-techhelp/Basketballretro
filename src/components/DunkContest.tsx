import React, { useState, useEffect, useRef } from 'react';
import { sound } from '../services/soundEngine';
import { ArrowLeft, Volume2, VolumeX, Flame } from 'lucide-react';
import { PlayerCard } from '../types/game';

interface DunkContestProps {
  player: PlayerCard;
  highScore: number;
  onFinish: (score: number, coinsEarned: number) => void;
  onExit: () => void;
}

interface DunkTrick {
  id: string;
  name: string;
  difficulty: string;
  dunkReq: number;
  description: string;
  multiplier: number;
}

const DUNKS: DunkTrick[] = [
  {
    id: 'windmill',
    name: '360° Windmill Slam',
    difficulty: 'Normal',
    dunkReq: 75,
    description: 'Full circle arm rotation with thunderous rim snap.',
    multiplier: 1.0,
  },
  {
    id: 'between-legs',
    name: 'Between-The-Legs Eastbay',
    difficulty: 'Hard',
    dunkReq: 82,
    description: 'Ball weaves beneath thigh in mid-air before powerful flush.',
    multiplier: 1.15,
  },
  {
    id: 'freethrow-glide',
    name: 'Free Throw Line Glide',
    difficulty: 'Expert',
    dunkReq: 88,
    description: 'Launching from the charity stripe with maximum hangtime.',
    multiplier: 1.25,
  },
  {
    id: 'shatter-slam',
    name: 'Backboard Rattling Monster Jam',
    difficulty: 'Legendary',
    dunkReq: 92,
    description: 'Over-the-top two-handed power dunk that flexes the rim and shakes the glass.',
    multiplier: 1.35,
  },
];

const JUDGES = ['Dr. Dunk', 'Sir Charles', 'Spud Web', 'Dominique', 'Tuxedo Ref'];

export const DunkContest: React.FC<DunkContestProps> = ({
  player,
  highScore,
  onFinish,
  onExit,
}) => {
  const [selectedDunk, setSelectedDunk] = useState<DunkTrick>(DUNKS[0]);
  const [phase, setPhase] = useState<'SELECT' | 'APPROACH' | 'TAKEOFF' | 'SLAM' | 'JUDGING' | 'FINISHED'>('SELECT');
  const [meterValue, setMeterValue] = useState<number>(0);
  const [meterActive, setMeterActive] = useState<boolean>(false);
  const [scores, setScores] = useState<number[]>([0, 0, 0, 0, 0]);
  const [totalScore, setTotalScore] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>('');
  const [isSoundMuted, setIsSoundMuted] = useState<boolean>(sound.isSoundMuted());

  // Accuracy ratings accumulated
  const ratingsRef = useRef<{ approach: number; takeoff: number; slam: number }>({
    approach: 0,
    takeoff: 0,
    slam: 0,
  });

  const meterValRef = useRef<number>(0);
  const meterSpeedRef = useRef<number>(0.04);
  const meterDirRef = useRef<number>(1);
  const animFrameRef = useRef<number | null>(null);

  // Meter animation
  useEffect(() => {
    if (!meterActive) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const loop = () => {
      meterValRef.current += meterSpeedRef.current * meterDirRef.current;
      if (meterValRef.current >= 1.0) {
        meterValRef.current = 1.0;
        meterDirRef.current = -1;
      } else if (meterValRef.current <= 0) {
        meterValRef.current = 0;
        meterDirRef.current = 1;
      }
      setMeterValue(meterValRef.current);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [meterActive]);

  const startDunkAttempt = () => {
    setPhase('APPROACH');
    setMeterActive(true);
    meterValRef.current = 0;
    meterSpeedRef.current = 0.035;
    setFeedback('TAP [C] AT THE GREEN APEX FOR APPROACH!');
    sound.playSneakerSqueak();
  };

  const handleMeterHit = () => {
    if (!meterActive) return;

    const hit = meterValRef.current;
    const diff = Math.abs(hit - 0.50);
    const scoreVal = Math.max(0, 10 - diff * 20);

    if (phase === 'APPROACH') {
      ratingsRef.current.approach = scoreVal;
      sound.playSneakerSqueak();
      setPhase('TAKEOFF');
      meterValRef.current = 0;
      meterSpeedRef.current = 0.045; // Faster
      setFeedback('TAP [C] AT APEX FOR TAKEOFF LEAP!');
    } else if (phase === 'TAKEOFF') {
      ratingsRef.current.takeoff = scoreVal;
      sound.playWhistle();
      setPhase('SLAM');
      meterValRef.current = 0;
      meterSpeedRef.current = 0.055; // Fastest apex
      setFeedback('TIMING SLAM: SMASH [C] TO FINISH!');
    } else if (phase === 'SLAM') {
      ratingsRef.current.slam = scoreVal;
      setMeterActive(false);
      executeDunkFinish();
    }
  };

  const executeDunkFinish = () => {
    setPhase('JUDGING');
    sound.playMonsterDunk();
    sound.speakAnnouncer('BOOMSHAKALAKA! That was ferocious!');

    // Calculate judges scores (5 judges, each 1 - 10)
    const baseAvg = (ratingsRef.current.approach + ratingsRef.current.takeoff + ratingsRef.current.slam) / 3;
    const statFactor = (player.stats.dunk / 100);
    const finalCalculated = Math.min(10, Math.max(6, baseAvg * 0.7 + statFactor * 3 * selectedDunk.multiplier));

    setTimeout(() => {
      const generatedScores = JUDGES.map(() => {
        const variance = (Math.random() - 0.5) * 1.5;
        return Math.min(10, Math.max(7, Math.round(finalCalculated + variance)));
      });

      setScores(generatedScores);
      const sum = generatedScores.reduce((a, b) => a + b, 0);
      setTotalScore(sum);
      setPhase('FINISHED');
      sound.playCheer();

      if (sum >= 48) {
        sound.speakAnnouncer('A 50 POINT MASTERPIECE! UNBELIEVABLE!');
      }
    }, 1500);
  };

  const toggleSound = () => {
    const next = !isSoundMuted;
    sound.setMuted(next);
    setIsSoundMuted(next);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 flex flex-col items-center">
      {/* Header */}
      <div className="w-full flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
        <button
          onClick={onExit}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="text-center">
          <h2 className="font-pixel text-sm text-orange-400">SLAM DUNK CONTEST ’95</h2>
          <div className="text-xs text-zinc-400 mt-0.5">
            Dunker: <span className="text-zinc-200 font-bold">{player.name}</span> ({player.stats.dunk} DUNK)
          </div>
        </div>

        <button
          onClick={toggleSound}
          className="p-2 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded transition-colors"
        >
          {isSoundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Arena Box */}
      <div className="w-full bg-zinc-900 border-2 border-zinc-700 rounded-lg p-6 relative flex flex-col items-center">
        {/* Dunk Selector Mode */}
        {phase === 'SELECT' && (
          <div className="w-full max-w-2xl flex flex-col items-center">
            <h3 className="font-pixel text-xs text-amber-400 mb-4">SELECT SIGNATURE SLAM</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full mb-6">
              {DUNKS.map(dunk => {
                const isSelected = selectedDunk.id === dunk.id;
                const canDo = player.stats.dunk >= dunk.dunkReq - 10;
                return (
                  <button
                    key={dunk.id}
                    onClick={() => setSelectedDunk(dunk)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-orange-500 bg-orange-950/40 ring-1 ring-orange-500'
                        : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-pixel text-xs text-white">{dunk.name}</span>
                      <span className="text-[10px] font-bold text-orange-400">{dunk.difficulty}</span>
                    </div>
                    <p className="text-xs text-zinc-400 mb-2">{dunk.description}</p>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                      <span>Req: {dunk.dunkReq} Dunk</span>
                      <span>·</span>
                      <span className="text-amber-400 font-semibold">{dunk.multiplier}x Multiplier</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={startDunkAttempt}
              className="px-8 py-3 font-pixel text-xs text-black bg-orange-500 hover:bg-orange-400 border-2 border-orange-600 rounded font-bold shadow-lg transition-transform active:scale-95 flex items-center gap-2"
            >
              <Flame className="w-4 h-4" /> TAKE FLIGHT
            </button>
          </div>
        )}

        {/* In-Flight Timing Rhythm Meter */}
        {(phase === 'APPROACH' || phase === 'TAKEOFF' || phase === 'SLAM') && (
          <div className="w-full max-w-md flex flex-col items-center py-6">
            <div className="text-xs font-pixel text-orange-400 mb-2">{selectedDunk.name}</div>
            <div className="text-sm font-pixel text-zinc-200 mb-6 text-center">{feedback}</div>

            {/* Visual Arc Meter */}
            <div className="w-full h-10 bg-zinc-950 border-2 border-zinc-700 rounded-md relative overflow-hidden flex items-center mb-6">
              <div className="absolute left-[44%] w-[12%] h-full bg-emerald-500/40 border-x border-emerald-400 flex items-center justify-center">
                <span className="text-[8px] font-pixel text-emerald-200">PERFECT</span>
              </div>
              <div
                className="absolute top-0 bottom-0 w-3 bg-yellow-400 shadow-md shadow-yellow-400"
                style={{ left: `calc(${meterValue * 100}% - 6px)` }}
              />
            </div>

            <button
              onClick={handleMeterHit}
              className="w-48 h-16 rounded-lg font-pixel text-sm font-bold bg-orange-500 hover:bg-orange-400 text-black shadow-lg active:scale-95 select-none"
            >
              HIT [C]
            </button>
          </div>
        )}

        {/* Judging Scoreboards */}
        {phase === 'JUDGING' && (
          <div className="text-center py-12">
            <div className="font-pixel text-lg text-amber-400 animate-pulse mb-4">
              JUDGES ARE SCORING...
            </div>
            <div className="text-xs text-zinc-400">Checking rim flex, hangtime & style!</div>
          </div>
        )}

        {/* Finished / Scorecards */}
        {phase === 'FINISHED' && (
          <div className="w-full max-w-lg flex flex-col items-center py-4">
            <h3 className="font-pixel text-lg text-orange-400 mb-4">OFFICIAL JUDGES SCORECARDS</h3>
            <div className="grid grid-cols-5 gap-3 w-full mb-6">
              {JUDGES.map((judge, idx) => (
                <div key={judge} className="flex flex-col items-center bg-zinc-950 p-2.5 rounded border border-zinc-800">
                  <span className="text-[8px] font-pixel text-zinc-400 mb-2 truncate w-full text-center">
                    {judge}
                  </span>
                  <div className="w-10 h-14 bg-white text-black font-pixel text-lg font-bold flex items-center justify-center rounded shadow-inner border border-zinc-300">
                    {scores[idx]}
                  </div>
                </div>
              ))}
            </div>

            <div className="font-pixel text-2xl text-amber-400 mb-2">
              TOTAL SCORE: {totalScore} / 50
            </div>
            <div className="font-pixel text-xs text-emerald-400 mb-6">
              +{totalScore * 40} HOOPS COINS EARNED!
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setPhase('SELECT');
                  setTotalScore(0);
                }}
                className="px-6 py-2.5 text-xs font-pixel bg-zinc-800 hover:bg-zinc-700 text-white rounded border border-zinc-700"
              >
                ANOTHER DUNK
              </button>
              <button
                onClick={() => onFinish(totalScore, totalScore * 40)}
                className="px-6 py-2.5 text-xs font-pixel bg-orange-500 hover:bg-orange-400 text-black font-bold rounded"
              >
                COLLECT COINS
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
