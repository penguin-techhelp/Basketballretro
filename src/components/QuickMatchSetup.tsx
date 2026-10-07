import React, { useState } from 'react';
import { ALL_TEAMS } from '../data/playersAndTeams';
import { Team, CourtSurface } from '../types/game';
import { Play, ArrowLeft, Users, Shield } from 'lucide-react';
import { sound } from '../services/soundEngine';

interface QuickMatchSetupProps {
  userCustomTeam: Team;
  onStartMatch: (
    homeTeam: Team,
    awayTeam: Team,
    format: '3v3' | '5v5',
    courtSurface: CourtSurface,
    quarterMinutes: number
  ) => void;
  onExit: () => void;
}

export const QuickMatchSetup: React.FC<QuickMatchSetupProps> = ({
  userCustomTeam,
  onStartMatch,
  onExit,
}) => {
  const [format, setFormat] = useState<'3v3' | '5v5'>('5v5');
  const [selectedHomeId, setSelectedHomeId] = useState<string>(userCustomTeam.id);
  const [selectedAwayId, setSelectedAwayId] = useState<string>('team-chicago-95');
  const [surface, setSurface] = useState<CourtSurface>('maple');
  const [quarterMinutes, setQuarterMinutes] = useState<number>(1);

  const allAvailableTeams = [userCustomTeam, ...ALL_TEAMS.filter(t => t.id !== userCustomTeam.id)];

  const homeTeam = allAvailableTeams.find(t => t.id === selectedHomeId) || userCustomTeam;
  const awayTeam = allAvailableTeams.find(t => t.id === selectedAwayId) || ALL_TEAMS[0];

  const handleLaunch = () => {
    sound.playWhistle();
    sound.speakAnnouncer('Tip-off coming up! Get ready for retro hoops!');
    onStartMatch(homeTeam, awayTeam, format, surface, quarterMinutes);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 flex flex-col items-center">
      {/* Header */}
      <div className="w-full flex items-center justify-between border-b border-zinc-800 pb-3 mb-6">
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Main
        </button>

        <h2 className="font-pixel text-sm text-amber-400">EXHIBITION MATCH SETUP</h2>

        <div className="text-xs text-zinc-400">Arcade Tip-Off</div>
      </div>

      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Match Format & Rules */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-pixel text-xs text-zinc-300 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" /> 1. MATCH FORMAT
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => {
                  setFormat('3v3');
                  setSurface('asphalt');
                }}
                className={`p-3 rounded border text-left transition-all ${
                  format === '3v3'
                    ? 'border-amber-400 bg-amber-950/40 ring-1 ring-amber-400'
                    : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
                }`}
              >
                <div className="font-pixel text-xs text-white mb-1">3v3 STREETBALL</div>
                <div className="text-[11px] text-zinc-400">
                  Half-court action. First to 21 points. Check-ball at top of key.
                </div>
              </button>

              <button
                onClick={() => {
                  setFormat('5v5');
                  setSurface('maple');
                }}
                className={`p-3 rounded border text-left transition-all ${
                  format === '5v5'
                    ? 'border-amber-400 bg-amber-950/40 ring-1 ring-amber-400'
                    : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
                }`}
              >
                <div className="font-pixel text-xs text-white mb-1">5v5 PRO ARENA</div>
                <div className="text-[11px] text-zinc-400">
                  Full-court simulation. 4 quarters, 24-second shot clock, fast breaks.
                </div>
              </button>
            </div>

            {/* Quarter Length */}
            {format === '5v5' && (
              <div className="mb-4">
                <label className="text-xs text-zinc-400 mb-1.5 block">Quarter Length:</label>
                <div className="flex gap-2">
                  {[1, 2, 3].map(mins => (
                    <button
                      key={mins}
                      onClick={() => setQuarterMinutes(mins)}
                      className={`flex-1 py-1.5 font-pixel text-xs rounded border ${
                        quarterMinutes === mins
                          ? 'border-amber-400 bg-amber-500 text-black font-bold'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-400'
                      }`}
                    >
                      {mins} MIN
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Court Surface */}
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Detailed Court Surface Floor:</label>
              <div className="grid grid-cols-5 gap-1.5">
                {(['maple', 'parquet', 'oak', 'asphalt', 'neon'] as CourtSurface[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setSurface(s)}
                    className={`py-1.5 text-[11px] font-pixel capitalize rounded border ${
                      surface === s
                        ? 'border-amber-400 bg-amber-500 text-black font-bold'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Team Selection */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-pixel text-xs text-zinc-300 mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" /> 2. SELECT TEAMS
            </h3>

            {/* Home Squad Selector */}
            <div className="mb-4">
              <label className="text-xs text-zinc-400 mb-1 block">Your Team (Home):</label>
              <select
                value={selectedHomeId}
                onChange={e => setSelectedHomeId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-xs text-white"
              >
                {allAvailableTeams.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.shortName})
                  </option>
                ))}
              </select>
            </div>

            {/* Away Squad Selector */}
            <div className="mb-4">
              <label className="text-xs text-zinc-400 mb-1 block">Opponent Team (Away):</label>
              <select
                value={selectedAwayId}
                onChange={e => setSelectedAwayId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-xs text-white"
              >
                {allAvailableTeams.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.shortName})
                  </option>
                ))}
              </select>
            </div>

            {/* Matchup Preview */}
            <div className="bg-zinc-950 p-4 rounded border border-zinc-800 flex items-center justify-around text-center mt-4">
              <div>
                <div className="font-pixel text-sm text-red-400">{homeTeam.shortName}</div>
                <div className="text-[11px] text-zinc-300 font-bold">{homeTeam.name}</div>
              </div>
              <div className="font-pixel text-xs text-zinc-500">VS</div>
              <div>
                <div className="font-pixel text-sm text-blue-400">{awayTeam.shortName}</div>
                <div className="text-[11px] text-zinc-300 font-bold">{awayTeam.name}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Launch CTA */}
      <button
        onClick={handleLaunch}
        className="px-10 py-3.5 font-pixel text-sm text-black bg-amber-400 hover:bg-amber-300 rounded font-bold shadow-xl flex items-center gap-2 active:scale-95 transition-transform"
      >
        <Play className="w-5 h-5 fill-black" /> JUMP BALL / START MATCH
      </button>
    </div>
  );
};
