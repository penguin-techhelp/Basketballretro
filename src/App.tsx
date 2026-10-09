import React, { useState, useEffect } from 'react';
import { FranchiseSave, GameSettings, Team, CourtSurface, PlayerCard } from './types/game';
import { loadFranchise, saveFranchise, ALL_TEAMS, DIVISION_CIRCUITS } from './data/playersAndTeams';
import { sound } from './services/soundEngine';
import { TitleScreen } from './components/TitleScreen';
import { QuickMatchSetup } from './components/QuickMatchSetup';
import { CourtGameView } from './components/CourtGameView';
import { DynastyFranchise } from './components/DynastyFranchise';
import { TournamentPlayoffs } from './components/TournamentPlayoffs';
import { ThreePointContest } from './components/ThreePointContest';
import { DunkContest } from './components/DunkContest';
import { ArcadeIntro } from './components/ArcadeIntro';
import { VersionUpdateBanner } from './components/VersionUpdateBanner';
import { PWAInstallButton } from './components/PWAInstallButton';
import { versionService } from './services/versionService';

type AppView = 'TITLE' | 'QUICK_SETUP' | 'MATCH' | 'FRANCHISE' | 'TOURNAMENT' | 'THREE_POINT' | 'DUNK_CONTEST';

export default function App() {
  const [showIntro, setShowIntro] = useState<boolean>(true);
  const [currentView, setCurrentView] = useState<AppView>('TITLE');
  const [franchise, setFranchise] = useState<FranchiseSave>(loadFranchise);
  const [dailyBonusAvailable, setDailyBonusAvailable] = useState<boolean>(true);

  // Settings
  const [settings, setSettings] = useState<GameSettings>({
    soundEnabled: true,
    announcerEnabled: true,
    gopiMode: true, // Default enabled for silky 60 FPS
    crtFilter: false,
    autoMode: false,
    quarterMinutes: 1,
    courtSurface: 'maple',
  });

  // Active Match Setup
  const [matchHomeTeam, setMatchHomeTeam] = useState<Team>(ALL_TEAMS[0]);
  const [matchAwayTeam, setMatchAwayTeam] = useState<Team>(ALL_TEAMS[1]);
  const [matchFormat, setMatchFormat] = useState<'3v3' | '5v5'>('3v3');

  // Convert franchise to playable Team object
  const getUserFranchiseTeam = (): Team => {
    const activeCards = franchise.inventory.slice(0, 5);
    return {
      id: 'team-user-franchise',
      name: franchise.teamName,
      city: 'Harlem',
      shortName: 'DYN',
      primaryColor: '#DC2626',
      secondaryColor: '#F59E0B',
      courtType: 'asphalt',
      roster: activeCards,
    };
  };

  const handleUpdateFranchise = (updated: FranchiseSave) => {
    setFranchise(updated);
    saveFranchise(updated);
  };

  const handleClaimDailyBonus = () => {
    sound.playCoinSound();
    const updated = {
      ...franchise,
      coins: franchise.coins + 250,
    };
    handleUpdateFranchise(updated);
    setDailyBonusAvailable(false);
    sound.speakAnnouncer('Daily hoops bonus collected! 250 coins added!');
  };

  const handleSelectModeFromTitle = (mode: '3v3' | '5v5' | 'franchise' | 'tournament' | '3point' | 'dunk') => {
    if (mode === '3v3') {
      setMatchFormat('3v3');
      setMatchHomeTeam(getUserFranchiseTeam());
      setMatchAwayTeam(ALL_TEAMS.find(t => t.id === 'team-ny-concrete') || ALL_TEAMS[1]);
      setCurrentView('QUICK_SETUP');
    } else if (mode === '5v5') {
      setMatchFormat('5v5');
      setMatchHomeTeam(getUserFranchiseTeam());
      setMatchAwayTeam(ALL_TEAMS.find(t => t.id === 'team-chicago-95') || ALL_TEAMS[0]);
      setCurrentView('QUICK_SETUP');
    } else if (mode === 'franchise') {
      setCurrentView('FRANCHISE');
    } else if (mode === 'tournament') {
      setCurrentView('TOURNAMENT');
    } else if (mode === '3point') {
      setCurrentView('THREE_POINT');
    } else if (mode === 'dunk') {
      setCurrentView('DUNK_CONTEST');
    }
  };

  const handleStartExhibitionMatch = (
    homeTeam: Team,
    awayTeam: Team,
    format: '3v3' | '5v5',
    courtSurface: CourtSurface,
    quarterMinutes: number
  ) => {
    setMatchHomeTeam(homeTeam);
    setMatchAwayTeam(awayTeam);
    setMatchFormat(format);
    setSettings(s => ({ ...s, courtSurface, quarterMinutes }));
    setCurrentView('MATCH');
  };

  const handleStartDivisionMatch = (divisionId: number) => {
    const div = DIVISION_CIRCUITS.find(d => d.id === divisionId);
    if (!div) return;

    setMatchHomeTeam(getUserFranchiseTeam());
    setMatchAwayTeam(div.opponentTeam);
    setMatchFormat(divisionId === 1 ? '3v3' : '5v5');
    setSettings(s => ({ ...s, courtSurface: div.courtSurface, quarterMinutes: 1 }));
    setCurrentView('MATCH');
  };

  const handleMatchComplete = (homeScore: number, awayScore: number, coinsEarned: number) => {
    sound.playCoinSound();
    const updated = {
      ...franchise,
      coins: franchise.coins + coinsEarned,
    };
    handleUpdateFranchise(updated);
    setCurrentView('TITLE');
  };

  // Best shooter from squad for 3-point shootout
  const getTopShooter = (): PlayerCard => {
    const sorted = [...franchise.inventory].sort((a, b) => b.stats.threePt - a.stats.threePt);
    return sorted[0];
  };

  // Best dunker from squad for dunk contest
  const getTopDunker = (): PlayerCard => {
    const sorted = [...franchise.inventory].sort((a, b) => b.stats.dunk - a.stats.dunk);
    return sorted[0];
  };

  // Notify version sync service when entering or exiting active match
  useEffect(() => {
    versionService.setMatchState(currentView === 'MATCH');
  }, [currentView]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-between p-3 md:p-6 font-sans">
      {/* Live Internet Version Sync & Offline Banner */}
      <VersionUpdateBanner />

      {/* Top Bar Contract: 3 zones */}
      <header className="w-full max-w-5xl flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-4">
        {/* Zone 1: Single text element wordmark */}
        <button
          onClick={() => setCurrentView('TITLE')}
          className="font-pixel text-xs md:text-sm tracking-wider text-amber-400 hover:text-amber-300 transition-colors uppercase cursor-pointer"
        >
          RETRO HOOPS ’95
        </button>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-pixel text-zinc-400">
          <button
            onClick={() => handleSelectModeFromTitle('3v3')}
            className="hover:text-white transition-colors"
          >
            3v3 STREET
          </button>
          <button
            onClick={() => handleSelectModeFromTitle('5v5')}
            className="hover:text-white transition-colors"
          >
            5v5 PRO
          </button>
          <button
            onClick={() => setCurrentView('FRANCHISE')}
            className="hover:text-white transition-colors"
          >
            FRANCHISE
          </button>
          <button
            onClick={() => setCurrentView('TOURNAMENT')}
            className="hover:text-white transition-colors"
          >
            WORLD CUP
          </button>
          <button
            onClick={() => setCurrentView('THREE_POINT')}
            className="hover:text-white transition-colors"
          >
            3-POINT
          </button>
          <button
            onClick={() => setCurrentView('DUNK_CONTEST')}
            className="hover:text-white transition-colors"
          >
            DUNK CONTEST
          </button>
        </nav>

        {/* Zone 3: Primary Action & Install Button */}
        <div className="flex items-center gap-2 md:gap-3">
          <PWAInstallButton />
          <button
            onClick={() => handleSelectModeFromTitle('5v5')}
            className="px-3.5 py-1.5 font-pixel text-[11px] font-bold text-black bg-amber-400 hover:bg-amber-300 rounded shadow transition-colors whitespace-nowrap cursor-pointer"
          >
            FULL COURT TIP-OFF
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-5xl flex-1 flex flex-col items-center">
        {currentView === 'TITLE' && (
          <TitleScreen
            franchise={franchise}
            settings={settings}
            onSelectMode={handleSelectModeFromTitle}
            onUpdateSettings={setSettings}
            onClaimDailyBonus={handleClaimDailyBonus}
            dailyBonusAvailable={dailyBonusAvailable}
          />
        )}

        {currentView === 'QUICK_SETUP' && (
          <QuickMatchSetup
            userCustomTeam={getUserFranchiseTeam()}
            onStartMatch={handleStartExhibitionMatch}
            onExit={() => setCurrentView('TITLE')}
          />
        )}

        {currentView === 'MATCH' && (
          <CourtGameView
            homeTeam={matchHomeTeam}
            awayTeam={matchAwayTeam}
            format={matchFormat}
            settings={settings}
            onUpdateSettings={setSettings}
            onMatchComplete={handleMatchComplete}
            onExit={() => setCurrentView('TITLE')}
          />
        )}

        {currentView === 'FRANCHISE' && (
          <DynastyFranchise
            franchise={franchise}
            onUpdateFranchise={handleUpdateFranchise}
            onStartDivisionMatch={handleStartDivisionMatch}
            onExit={() => setCurrentView('TITLE')}
          />
        )}

        {currentView === 'TOURNAMENT' && (
          <TournamentPlayoffs
            userTeam={getUserFranchiseTeam()}
            onPlayMatch={(user, opp) => {
              setMatchHomeTeam(user);
              setMatchAwayTeam(opp);
              setMatchFormat('5v5');
              setSettings(s => ({ ...s, courtSurface: 'neon', quarterMinutes: 1 }));
              setCurrentView('MATCH');
            }}
            onExit={() => setCurrentView('TITLE')}
          />
        )}

        {currentView === 'THREE_POINT' && (
          <ThreePointContest
            player={getTopShooter()}
            highScore={franchise.highScores.threePoint}
            onFinish={(score, coins) => {
              const updated = {
                ...franchise,
                coins: franchise.coins + coins,
                highScores: {
                  ...franchise.highScores,
                  threePoint: Math.max(score, franchise.highScores.threePoint),
                },
              };
              handleUpdateFranchise(updated);
              setCurrentView('TITLE');
            }}
            onExit={() => setCurrentView('TITLE')}
          />
        )}

        {currentView === 'DUNK_CONTEST' && (
          <DunkContest
            player={getTopDunker()}
            highScore={franchise.highScores.dunkContest}
            onFinish={(score, coins) => {
              const updated = {
                ...franchise,
                coins: franchise.coins + coins,
                highScores: {
                  ...franchise.highScores,
                  dunkContest: Math.max(score, franchise.highScores.dunkContest),
                },
              };
              handleUpdateFranchise(updated);
              setCurrentView('TITLE');
            }}
            onExit={() => setCurrentView('TITLE')}
          />
        )}
      </main>

      {/* Clean Footer */}
      <footer className="w-full max-w-5xl mt-6 pt-3 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between text-[11px] text-zinc-500 gap-2">
        <div>
          © 1995 Tuxedo Penguin Gaming Sports Studio · "It’s In The Game!"
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowIntro(true)}
            className="hover:text-amber-400 font-pixel text-[10px] text-zinc-400 transition-colors cursor-pointer"
          >
            ▶ REPLAY INTRO
          </button>
          <span aria-hidden="true">·</span>
          <button
            onClick={() => versionService.checkForUpdates(true)}
            className="hover:text-amber-300 font-pixel text-[10px] text-zinc-400 transition-colors flex items-center gap-1 cursor-pointer"
            title="Check internet for latest build"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
            <span>v1.4.0 · SYNC ACTIVE</span>
          </button>
          <span aria-hidden="true">·</span>
          <span>Web Audio FM-Synth</span>
          <span aria-hidden="true">·</span>
          <span>Offline Ready</span>
          <span aria-hidden="true">·</span>
          <span>Gopi Mode 60 FPS</span>
        </div>
      </footer>

      {/* Arcade Launch Intro */}
      {showIntro && <ArcadeIntro onComplete={() => setShowIntro(false)} />}
    </div>
  );
}
