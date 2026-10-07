import React, { useState } from 'react';
import { ALL_TEAMS } from '../data/playersAndTeams';
import { Team } from '../types/game';
import { Trophy, ArrowLeft, Play, Award } from 'lucide-react';
import { sound } from '../services/soundEngine';

interface TournamentPlayoffsProps {
  userTeam: Team;
  onPlayMatch: (userTeam: Team, opponentTeam: Team, roundName: string) => void;
  onExit: () => void;
}

interface MatchNode {
  id: string;
  round: number; // 1 = R16, 2 = QF, 3 = SF, 4 = Final
  team1: Team;
  team2: Team;
  score1?: number;
  score2?: number;
  winner?: Team;
}

export const TournamentPlayoffs: React.FC<TournamentPlayoffsProps> = ({
  userTeam,
  onPlayMatch,
  onExit,
}) => {
  // Generate 16-team tournament bracket
  const [matches, setMatches] = useState<MatchNode[]>(() => {
    // Pick 16 teams including user team
    const otherTeams = ALL_TEAMS.filter(t => t.id !== userTeam.id).slice(0, 15);
    const pool = [userTeam, ...otherTeams];

    const r16: MatchNode[] = [];
    for (let i = 0; i < 8; i++) {
      r16.push({
        id: `r16-${i}`,
        round: 1,
        team1: pool[i * 2],
        team2: pool[i * 2 + 1],
      });
    }
    return r16;
  });

  const [currentRound, setCurrentRound] = useState<number>(1);
  const [tournamentWon, setTournamentWon] = useState<boolean>(false);

  // Find user's current active match
  const userMatch = matches.find(
    m =>
      m.round === currentRound &&
      !m.winner &&
      (m.team1.id === userTeam.id || m.team2.id === userTeam.id)
  );

  const getOpponent = userMatch
    ? userMatch.team1.id === userTeam.id
      ? userMatch.team2
      : userMatch.team1
    : null;

  const simulateCpuMatches = () => {
    const nextMatches = [...matches];
    let userWonMatch = false;

    for (const m of nextMatches) {
      if (m.round === currentRound && !m.winner) {
        if (m.team1.id === userTeam.id || m.team2.id === userTeam.id) {
          // User plays or wins
          const isTeam1 = m.team1.id === userTeam.id;
          m.score1 = isTeam1 ? 78 : 71;
          m.score2 = isTeam1 ? 71 : 78;
          m.winner = userTeam;
          userWonMatch = true;
        } else {
          // CPU simulation
          const score1 = 65 + Math.floor(Math.random() * 25);
          const score2 = 65 + Math.floor(Math.random() * 25);
          m.score1 = score1;
          m.score2 = score2;
          m.winner = score1 >= score2 ? m.team1 : m.team2;
        }
      }
    }

    if (currentRound < 4 && userWonMatch) {
      // Build next round matches
      const currentWinners = nextMatches
        .filter(m => m.round === currentRound)
        .map(m => m.winner!);

      const nextRoundMatches: MatchNode[] = [];
      for (let i = 0; i < currentWinners.length; i += 2) {
        nextRoundMatches.push({
          id: `r${currentRound + 1}-${i / 2}`,
          round: currentRound + 1,
          team1: currentWinners[i],
          team2: currentWinners[i + 1],
        });
      }

      setMatches([...nextMatches, ...nextRoundMatches]);
      setCurrentRound(r => r + 1);
      sound.playFanfare();
    } else if (currentRound === 4 && userWonMatch) {
      setTournamentWon(true);
      sound.playCheer();
      sound.speakAnnouncer('World Champions! The confetti rains down for the champions!');
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4 flex flex-col items-center">
      {/* Header */}
      <div className="w-full flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
        <button
          onClick={onExit}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="text-center">
          <h2 className="font-pixel text-sm text-yellow-400">WORLD BASKETBALL CUP ’95</h2>
          <div className="text-xs text-zinc-400 mt-0.5">
            Round: <span className="text-white font-bold">{currentRound === 1 ? 'Round of 16' : currentRound === 2 ? 'Quarterfinals' : currentRound === 3 ? 'Semifinals' : 'World Championship Final'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-pixel text-[10px] text-zinc-400">YOUR SQUAD:</span>
          <span className="font-pixel text-xs text-red-400">{userTeam.name}</span>
        </div>
      </div>

      {/* Bracket Tree View */}
      <div className="w-full bg-zinc-900 border-2 border-zinc-700 rounded-lg p-6 mb-6 overflow-x-auto">
        <div className="min-w-[700px] flex justify-between gap-6">
          {/* Round 1: R16 */}
          <div className="flex flex-col justify-around gap-3 flex-1">
            <div className="text-[10px] font-pixel text-zinc-400 text-center mb-1">ROUND OF 16</div>
            {matches.filter(m => m.round === 1).map(m => (
              <div key={m.id} className="bg-zinc-950 p-2 rounded border border-zinc-800 text-xs">
                <div className={`flex justify-between ${m.team1.id === userTeam.id ? 'text-amber-400 font-bold' : 'text-zinc-300'}`}>
                  <span>{m.team1.shortName}</span>
                  <span>{m.score1 ?? '-'}</span>
                </div>
                <div className={`flex justify-between ${m.team2.id === userTeam.id ? 'text-amber-400 font-bold' : 'text-zinc-300'}`}>
                  <span>{m.team2.shortName}</span>
                  <span>{m.score2 ?? '-'}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Round 2: QF */}
          <div className="flex flex-col justify-around gap-6 flex-1">
            <div className="text-[10px] font-pixel text-zinc-400 text-center mb-1">QUARTERS</div>
            {matches.filter(m => m.round === 2).length === 0 ? (
              <div className="text-xs text-zinc-600 text-center italic">Awaiting Round 1...</div>
            ) : (
              matches.filter(m => m.round === 2).map(m => (
                <div key={m.id} className="bg-zinc-950 p-2 rounded border border-zinc-800 text-xs">
                  <div className={`flex justify-between ${m.team1.id === userTeam.id ? 'text-amber-400 font-bold' : 'text-zinc-300'}`}>
                    <span>{m.team1.shortName}</span>
                    <span>{m.score1 ?? '-'}</span>
                  </div>
                  <div className={`flex justify-between ${m.team2.id === userTeam.id ? 'text-amber-400 font-bold' : 'text-zinc-300'}`}>
                    <span>{m.team2.shortName}</span>
                    <span>{m.score2 ?? '-'}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Round 3: Semis */}
          <div className="flex flex-col justify-around gap-12 flex-1">
            <div className="text-[10px] font-pixel text-zinc-400 text-center mb-1">SEMIFINALS</div>
            {matches.filter(m => m.round === 3).length === 0 ? (
              <div className="text-xs text-zinc-600 text-center italic">Awaiting QF...</div>
            ) : (
              matches.filter(m => m.round === 3).map(m => (
                <div key={m.id} className="bg-zinc-950 p-2 rounded border border-zinc-800 text-xs">
                  <div className={`flex justify-between ${m.team1.id === userTeam.id ? 'text-amber-400 font-bold' : 'text-zinc-300'}`}>
                    <span>{m.team1.shortName}</span>
                    <span>{m.score1 ?? '-'}</span>
                  </div>
                  <div className={`flex justify-between ${m.team2.id === userTeam.id ? 'text-amber-400 font-bold' : 'text-zinc-300'}`}>
                    <span>{m.team2.shortName}</span>
                    <span>{m.score2 ?? '-'}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Round 4: Championship */}
          <div className="flex flex-col justify-center gap-3 flex-1">
            <div className="text-[10px] font-pixel text-yellow-400 text-center mb-1 flex items-center justify-center gap-1">
              <Trophy className="w-3 h-3 text-yellow-400" /> FINAL
            </div>
            {matches.filter(m => m.round === 4).length === 0 ? (
              <div className="text-xs text-zinc-600 text-center italic">Awaiting Semis...</div>
            ) : (
              matches.filter(m => m.round === 4).map(m => (
                <div key={m.id} className="bg-zinc-950 p-3 rounded border-2 border-yellow-500 text-xs">
                  <div className={`flex justify-between ${m.team1.id === userTeam.id ? 'text-amber-400 font-bold' : 'text-zinc-300'}`}>
                    <span>{m.team1.shortName}</span>
                    <span>{m.score1 ?? '-'}</span>
                  </div>
                  <div className={`flex justify-between ${m.team2.id === userTeam.id ? 'text-amber-400 font-bold' : 'text-zinc-300'}`}>
                    <span>{m.team2.shortName}</span>
                    <span>{m.score2 ?? '-'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Action Banner */}
      {!tournamentWon && userMatch && getOpponent && (
        <div className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <div className="font-pixel text-xs text-yellow-400 mb-1">
              UPCOMING KNOCKOUT MATCH:
            </div>
            <div className="text-sm font-semibold text-white">
              {userTeam.name} <span className="text-zinc-500 font-normal">vs</span> {getOpponent.name}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => onPlayMatch(userTeam, getOpponent, currentRound === 4 ? 'Championship' : 'Knockout')}
              className="px-6 py-2.5 font-pixel text-xs text-black bg-yellow-400 hover:bg-yellow-300 rounded font-bold shadow-md flex items-center gap-2 active:scale-95 transition-transform"
            >
              <Play className="w-4 h-4 fill-black" /> PLAY FULL MATCH
            </button>
            <button
              onClick={simulateCpuMatches}
              className="px-4 py-2.5 font-pixel text-[11px] text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded border border-zinc-700"
            >
              FAST-FORWARD ROUND
            </button>
          </div>
        </div>
      )}

      {/* World Cup Trophy Celebration */}
      {tournamentWon && (
        <div className="w-full bg-gradient-to-b from-yellow-950/40 to-zinc-950 border-2 border-yellow-500 rounded-lg p-8 flex flex-col items-center text-center animate-fade-in">
          <Award className="w-16 h-16 text-yellow-400 mb-4 animate-bounce" />
          <h3 className="font-pixel text-xl text-yellow-400 mb-2">WORLD CHAMPIONS ’95!</h3>
          <p className="text-sm text-zinc-300 max-w-md mb-4">
            Tuxedo Penguin Gaming Sports Studio awards the World Championship Cup to {userTeam.name}!
          </p>
          <div className="font-pixel text-sm text-emerald-400 mb-6">+2,500 HOOPS COINS REWARDED!</div>
          <button
            onClick={onExit}
            className="px-8 py-3 font-pixel text-xs bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded shadow-lg"
          >
            RETURN TO MENU
          </button>
        </div>
      )}
    </div>
  );
};
