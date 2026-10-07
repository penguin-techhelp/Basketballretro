import React, { useState } from 'react';
import { PlayerCard, FranchiseSave, CardTier } from '../types/game';
import { LEGEND_PLAYERS, DIVISION_CIRCUITS, saveFranchise } from '../data/playersAndTeams';
import { sound } from '../services/soundEngine';
import { ArrowLeft, Sparkles, Coins, ShoppingCart, RefreshCw, Zap, Play } from 'lucide-react';

interface DynastyFranchiseProps {
  franchise: FranchiseSave;
  onUpdateFranchise: (updated: FranchiseSave) => void;
  onStartDivisionMatch: (divisionId: number) => void;
  onExit: () => void;
}

export const DynastyFranchise: React.FC<DynastyFranchiseProps> = ({
  franchise,
  onUpdateFranchise,
  onStartDivisionMatch,
  onExit,
}) => {
  const [activeTab, setActiveTab] = useState<'ROSTER' | 'PACKS' | 'MARKET' | 'COMBINE' | 'DIVISIONS'>('ROSTER');
  const [revealedCard, setRevealedCard] = useState<PlayerCard | null>(null);
  const [isOpeningPack, setIsOpeningPack] = useState<boolean>(false);
  const [tradeSelectedIds, setTradeSelectedIds] = useState<string[]>([]);
  const [marketListings, setMarketListings] = useState<PlayerCard[]>(() => {
    // Initial 4 randomized transfer market listings
    return LEGEND_PLAYERS.filter(p => !franchise.inventory.some(i => i.id === p.id)).slice(0, 4);
  });

  // Pack Pricing
  const PACK_PRICES = {
    bronze: 150,
    silver: 350,
    gold: 800,
    allStar: 1800,
  };

  const openPack = (tier: 'bronze' | 'silver' | 'gold' | 'allStar') => {
    const cost = PACK_PRICES[tier];
    if (franchise.coins < cost) {
      sound.playGasp();
      alert('Not enough Hoops Coins! Win matches or 3-Point contests to earn coins.');
      return;
    }

    setIsOpeningPack(true);
    sound.playPackOpen();

    setTimeout(() => {
      // Pick random card from suitable pool
      let targetTier: CardTier = 'bronze';
      if (tier === 'silver') targetTier = Math.random() < 0.75 ? 'silver' : 'gold';
      else if (tier === 'gold') targetTier = Math.random() < 0.7 ? 'gold' : 'diamond';
      else if (tier === 'allStar') targetTier = Math.random() < 0.6 ? 'diamond' : 'gold';

      const pool = LEGEND_PLAYERS.filter(p => p.tier === targetTier);
      const chosen = pool[Math.floor(Math.random() * pool.length)] || LEGEND_PLAYERS[0];
      const newCard = { ...chosen, id: `${chosen.id}-${Date.now()}` };

      const updatedInventory = [...franchise.inventory, newCard];
      const updatedSave: FranchiseSave = {
        ...franchise,
        coins: franchise.coins - cost,
        inventory: updatedInventory,
      };

      onUpdateFranchise(updatedSave);
      saveFranchise(updatedSave);

      setRevealedCard(newCard);
      setIsOpeningPack(false);
      sound.playFanfare();
      sound.speakAnnouncer(`Unbelievable pull! You unlocked ${newCard.name}!`);
    }, 1200);
  };

  const buyMarketCard = (card: PlayerCard) => {
    if (franchise.coins < card.priceCoins) {
      sound.playGasp();
      alert('Insufficient Hoops Coins for this signing!');
      return;
    }

    sound.playCoinSound();
    const newCard = { ...card, id: `${card.id}-${Date.now()}` };
    const updatedInventory = [...franchise.inventory, newCard];
    const updatedSave: FranchiseSave = {
      ...franchise,
      coins: franchise.coins - card.priceCoins,
      inventory: updatedInventory,
    };

    onUpdateFranchise(updatedSave);
    saveFranchise(updatedSave);

    setMarketListings(prev => prev.filter(p => p.id !== card.id));
    sound.speakAnnouncer(`Signed ${card.name} to your franchise!`);
  };

  const sellCard = (cardId: string) => {
    const card = franchise.inventory.find(c => c.id === cardId);
    if (!card) return;
    if (franchise.inventory.length <= 5) {
      alert('You must keep at least 5 players in your squad!');
      return;
    }

    const sellPrice = Math.round(card.priceCoins * 0.6);
    sound.playCoinSound();

    const updatedInventory = franchise.inventory.filter(c => c.id !== cardId);
    const updatedLineup = franchise.activeLineupIds.filter(id => id !== cardId);
    if (updatedLineup.length < 5 && updatedInventory.length >= 5) {
      updatedLineup.push(updatedInventory.find(c => !updatedLineup.includes(c.id))!.id);
    }

    const updatedSave: FranchiseSave = {
      ...franchise,
      coins: franchise.coins + sellPrice,
      inventory: updatedInventory,
      activeLineupIds: updatedLineup,
    };

    onUpdateFranchise(updatedSave);
    saveFranchise(updatedSave);
  };

  // Trade-In Combine: 5 cards of same tier -> 1 of next tier
  const toggleTradeSelect = (cardId: string) => {
    if (tradeSelectedIds.includes(cardId)) {
      setTradeSelectedIds(prev => prev.filter(id => id !== cardId));
    } else {
      if (tradeSelectedIds.length >= 5) return;
      setTradeSelectedIds(prev => [...prev, cardId]);
    }
  };

  const executeTradeCombine = () => {
    if (tradeSelectedIds.length !== 5) return;

    const cardsToTrade = franchise.inventory.filter(c => tradeSelectedIds.includes(c.id));
    const firstTier = cardsToTrade[0].tier;
    const allSameTier = cardsToTrade.every(c => c.tier === firstTier);

    if (!allSameTier) {
      alert('All 5 cards must be of the same tier for the combine!');
      return;
    }

    let nextTier: CardTier = 'silver';
    if (firstTier === 'silver') nextTier = 'gold';
    else if (firstTier === 'gold') nextTier = 'diamond';
    else if (firstTier === 'diamond') nextTier = 'diamond';

    const pool = LEGEND_PLAYERS.filter(p => p.tier === nextTier);
    const upgraded = pool[Math.floor(Math.random() * pool.length)] || LEGEND_PLAYERS[0];
    const newCard = { ...upgraded, id: `${upgraded.id}-${Date.now()}` };

    const remainingInventory = franchise.inventory.filter(c => !tradeSelectedIds.includes(c.id));
    remainingInventory.push(newCard);

    let newLineup = franchise.activeLineupIds.filter(id => !tradeSelectedIds.includes(id));
    while (newLineup.length < 5 && remainingInventory.length >= 5) {
      const avail = remainingInventory.find(c => !newLineup.includes(c.id));
      if (avail) newLineup.push(avail.id);
      else break;
    }

    const updatedSave: FranchiseSave = {
      ...franchise,
      inventory: remainingInventory,
      activeLineupIds: newLineup,
    };

    onUpdateFranchise(updatedSave);
    saveFranchise(updatedSave);
    setTradeSelectedIds([]);
    setRevealedCard(newCard);
    sound.playFanfare();
    sound.speakAnnouncer(`Trade combine success! Upgraded to ${newCard.tier} ${newCard.name}!`);
  };

  const refreshMarket = () => {
    sound.playSneakerSqueak();
    const shuffled = [...LEGEND_PLAYERS]
      .filter(p => !franchise.inventory.some(i => i.id === p.id))
      .sort(() => 0.5 - Math.random())
      .slice(0, 4);
    setMarketListings(shuffled);
  };

  const getTierBadge = (tier: CardTier) => {
    switch (tier) {
      case 'diamond':
        return 'border-cyan-400 text-cyan-300 bg-cyan-950/60 shadow-cyan-500/20 shadow-md';
      case 'gold':
        return 'border-amber-400 text-amber-300 bg-amber-950/60 shadow-amber-500/20 shadow-md';
      case 'silver':
        return 'border-zinc-300 text-zinc-200 bg-zinc-800/80';
      case 'bronze':
      default:
        return 'border-orange-800 text-orange-400 bg-orange-950/40';
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4 flex flex-col items-center">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
        <button
          onClick={onExit}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Court
        </button>

        <div className="text-center">
          <h2 className="font-pixel text-sm text-amber-400">DYNASTY FRANCHISE & MARKET</h2>
          <div className="text-xs text-zinc-400 mt-0.5">
            Club: <span className="text-white font-bold">{franchise.teamName}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded border border-zinc-800">
          <Coins className="w-4 h-4 text-amber-400" />
          <span className="font-pixel text-xs text-amber-400">{franchise.coins}</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 w-full max-w-2xl bg-zinc-950 p-1 rounded-lg border border-zinc-800 mb-6">
        {(['ROSTER', 'PACKS', 'MARKET', 'COMBINE', 'DIVISIONS'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-xs font-pixel rounded transition-colors ${
              activeTab === tab
                ? 'bg-amber-500 text-black font-bold shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* TAB 1: ROSTER & SQUAD */}
      {activeTab === 'ROSTER' && (
        <div className="w-full flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h3 className="font-pixel text-xs text-zinc-300">
              ACTIVE SQUAD ({franchise.inventory.length} Cards in Club)
            </h3>
            <span className="text-xs text-zinc-500">First 5 cards form starting lineup</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {franchise.inventory.map((card, idx) => {
              const isStarter = idx < 5;
              return (
                <div
                  key={card.id}
                  className={`border-2 rounded-lg p-3.5 flex flex-col justify-between ${getTierBadge(
                    card.tier
                  )} relative`}
                >
                  {isStarter && (
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[8px] font-pixel bg-emerald-500 text-black rounded font-bold">
                      STARTER #{idx + 1}
                    </span>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-pixel text-xs font-bold text-white truncate max-w-[130px]">
                        {card.name}
                      </span>
                      <span className="font-pixel text-[10px] uppercase text-zinc-400">
                        {card.position}
                      </span>
                    </div>
                    {card.nickname && (
                      <div className="text-[10px] text-amber-400/90 italic mb-2">
                        "{card.nickname}"
                      </div>
                    )}

                    {/* Stat Bars */}
                    <div className="space-y-1 my-3 text-[10px] font-mono">
                      <div className="flex justify-between">
                        <span className="text-zinc-400">SPD:</span>
                        <span className="text-white font-bold">{card.stats.speed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">DNK:</span>
                        <span className="text-white font-bold">{card.stats.dunk}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">3PT:</span>
                        <span className="text-white font-bold">{card.stats.threePt}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">DEF:</span>
                        <span className="text-white font-bold">{card.stats.defense}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
                    <span className="text-[10px] text-zinc-400">#{card.number}</span>
                    <button
                      onClick={() => sellCard(card.id)}
                      className="px-2 py-1 text-[10px] font-pixel text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded transition-colors"
                    >
                      SELL (+{Math.round(card.priceCoins * 0.6)})
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: FOIL CARD PACKS */}
      {activeTab === 'PACKS' && (
        <div className="w-full flex flex-col items-center">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 w-full mb-8">
            {/* Bronze Pack */}
            <div className="bg-zinc-900 border-2 border-orange-800 rounded-lg p-5 flex flex-col items-center text-center">
              <Sparkles className="w-8 h-8 text-orange-600 mb-2" />
              <h4 className="font-pixel text-xs text-orange-400 mb-1">BRONZE FOIL PACK</h4>
              <p className="text-xs text-zinc-400 mb-4">Rucker streetballers & raw prospects.</p>
              <button
                onClick={() => openPack('bronze')}
                disabled={isOpeningPack}
                className="w-full py-2.5 font-pixel text-xs bg-orange-700 hover:bg-orange-600 text-white rounded font-bold shadow"
              >
                OPEN (150 COINS)
              </button>
            </div>

            {/* Silver Pack */}
            <div className="bg-zinc-900 border-2 border-zinc-400 rounded-lg p-5 flex flex-col items-center text-center">
              <Sparkles className="w-8 h-8 text-zinc-300 mb-2" />
              <h4 className="font-pixel text-xs text-zinc-200 mb-1">SILVER FOIL PACK</h4>
              <p className="text-xs text-zinc-400 mb-4">Solid pro starters & international stars.</p>
              <button
                onClick={() => openPack('silver')}
                disabled={isOpeningPack}
                className="w-full py-2.5 font-pixel text-xs bg-zinc-300 hover:bg-white text-black rounded font-bold shadow"
              >
                OPEN (350 COINS)
              </button>
            </div>

            {/* Gold Pack */}
            <div className="bg-zinc-900 border-2 border-amber-500 rounded-lg p-5 flex flex-col items-center text-center">
              <Sparkles className="w-8 h-8 text-amber-400 mb-2" />
              <h4 className="font-pixel text-xs text-amber-400 mb-1">GOLD FOIL PACK</h4>
              <p className="text-xs text-zinc-400 mb-4">Elite All-Stars & sharpshooters.</p>
              <button
                onClick={() => openPack('gold')}
                disabled={isOpeningPack}
                className="w-full py-2.5 font-pixel text-xs bg-amber-500 hover:bg-amber-400 text-black rounded font-bold shadow"
              >
                OPEN (800 COINS)
              </button>
            </div>

            {/* All-Star Diamond Pack */}
            <div className="bg-zinc-900 border-2 border-cyan-400 rounded-lg p-5 flex flex-col items-center text-center">
              <Sparkles className="w-8 h-8 text-cyan-400 mb-2" />
              <h4 className="font-pixel text-xs text-cyan-300 mb-1">ALL-STAR LEGENDS</h4>
              <p className="text-xs text-zinc-400 mb-4">Guaranteed 90s Diamond Hall of Famer!</p>
              <button
                onClick={() => openPack('allStar')}
                disabled={isOpeningPack}
                className="w-full py-2.5 font-pixel text-xs bg-cyan-500 hover:bg-cyan-400 text-black rounded font-bold shadow"
              >
                OPEN (1,800 COINS)
              </button>
            </div>
          </div>

          {/* Card Reveal Modal */}
          {revealedCard && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
              <div
                className={`w-full max-w-sm border-4 rounded-xl p-6 flex flex-col items-center text-center bg-zinc-950 ${getTierBadge(
                  revealedCard.tier
                )}`}
              >
                <div className="text-[10px] font-pixel text-amber-400 mb-2 uppercase">
                  ⭐ NEW CARD ACQUIRED! ⭐
                </div>
                <h3 className="font-pixel text-lg text-white mb-1">{revealedCard.name}</h3>
                {revealedCard.nickname && (
                  <div className="text-xs text-amber-400 italic mb-4">"{revealedCard.nickname}"</div>
                )}

                <div className="grid grid-cols-2 gap-2 w-full bg-zinc-900/90 p-3 rounded mb-4 text-xs font-mono">
                  <div>SPD: <span className="font-bold text-white">{revealedCard.stats.speed}</span></div>
                  <div>DNK: <span className="font-bold text-white">{revealedCard.stats.dunk}</span></div>
                  <div>3PT: <span className="font-bold text-white">{revealedCard.stats.threePt}</span></div>
                  <div>DEF: <span className="font-bold text-white">{revealedCard.stats.defense}</span></div>
                </div>

                <button
                  onClick={() => setRevealedCard(null)}
                  className="w-full py-2.5 font-pixel text-xs bg-amber-400 hover:bg-amber-300 text-black font-bold rounded"
                >
                  ADD TO CLUB
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TRANSFER MARKET */}
      {activeTab === 'MARKET' && (
        <div className="w-full flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h3 className="font-pixel text-xs text-zinc-300">LIVE TRANSFER MARKET</h3>
            <button
              onClick={refreshMarket}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Scout New Players
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {marketListings.map(card => (
              <div
                key={card.id}
                className={`border-2 rounded-lg p-4 flex flex-col justify-between ${getTierBadge(
                  card.tier
                )}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-pixel text-xs font-bold text-white truncate max-w-[130px]">
                      {card.name}
                    </span>
                    <span className="font-pixel text-[10px] text-zinc-400">{card.position}</span>
                  </div>
                  {card.nickname && (
                    <div className="text-[10px] text-amber-400/90 italic mb-3">"{card.nickname}"</div>
                  )}

                  <div className="space-y-1 text-[10px] font-mono mb-4">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">SPD:</span>
                      <span className="text-white">{card.stats.speed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">DNK:</span>
                      <span className="text-white">{card.stats.dunk}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">3PT:</span>
                      <span className="text-white">{card.stats.threePt}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">DEF:</span>
                      <span className="text-white">{card.stats.defense}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => buyMarketCard(card)}
                  className="w-full py-2 font-pixel text-[11px] bg-amber-500 hover:bg-amber-400 text-black font-bold rounded flex items-center justify-center gap-1.5 shadow"
                >
                  <ShoppingCart className="w-3 h-3" /> BUY ({card.priceCoins})
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: TRADE-IN COMBINE */}
      {activeTab === 'COMBINE' && (
        <div className="w-full flex flex-col items-center">
          <div className="max-w-xl text-center mb-6">
            <h3 className="font-pixel text-xs text-amber-400 mb-2">TRADE-IN COMBINE</h3>
            <p className="text-xs text-zinc-400">
              Select 5 cards of the exact same tier to exchange them for a guaranteed upgraded card!
              (Selected: {tradeSelectedIds.length} / 5)
            </p>
          </div>

          <div className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-6">
            {franchise.inventory.map(card => {
              const isSelected = tradeSelectedIds.includes(card.id);
              return (
                <button
                  key={card.id}
                  onClick={() => toggleTradeSelect(card.id)}
                  className={`p-2.5 rounded border-2 text-left transition-all ${
                    isSelected
                      ? 'border-emerald-400 bg-emerald-950/40 ring-2 ring-emerald-400'
                      : 'border-zinc-800 bg-zinc-950'
                  }`}
                >
                  <div className="font-pixel text-[10px] text-white truncate">{card.name}</div>
                  <div className="text-[9px] uppercase text-zinc-400 mt-1">{card.tier}</div>
                </button>
              );
            })}
          </div>

          <button
            onClick={executeTradeCombine}
            disabled={tradeSelectedIds.length !== 5}
            className={`px-8 py-3 font-pixel text-xs rounded font-bold shadow-lg flex items-center gap-2 ${
              tradeSelectedIds.length === 5
                ? 'bg-emerald-500 hover:bg-emerald-400 text-black active:scale-95'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            }`}
          >
            <Zap className="w-4 h-4" /> COMBINE & UPGRADE (5 CARDS)
          </button>
        </div>
      )}

      {/* TAB 5: DIVISION CIRCUITS */}
      {activeTab === 'DIVISIONS' && (
        <div className="w-full flex flex-col gap-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-pixel text-xs text-zinc-300">5 COMPETITIVE CIRCUITS</h3>
            <span className="text-xs text-zinc-400">Defeat champions to ascend</span>
          </div>

          <div className="space-y-3">
            {DIVISION_CIRCUITS.map(div => {
              const isUnlocked = franchise.unlockedDivision >= div.id;
              return (
                <div
                  key={div.id}
                  className={`p-4 rounded-lg border flex flex-col md:flex-row items-center justify-between gap-4 transition-all ${
                    isUnlocked
                      ? 'border-zinc-700 bg-zinc-900'
                      : 'border-zinc-800 bg-zinc-950/60 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-zinc-950 border border-zinc-700 flex items-center justify-center font-pixel text-sm text-amber-400 font-bold">
                      #{div.id}
                    </div>
                    <div>
                      <h4 className="font-pixel text-xs text-white">{div.name}</h4>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        Court: <span className="text-zinc-200">{div.courtName}</span> · Opponent:{' '}
                        <span className="text-amber-400">{div.opponentTeam.name}</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-1 max-w-lg">{div.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-[10px] text-zinc-400">WIN REWARD:</div>
                      <div className="font-pixel text-xs text-emerald-400">+{div.winReward} COINS</div>
                    </div>

                    <button
                      onClick={() => onStartDivisionMatch(div.id)}
                      disabled={!isUnlocked}
                      className={`px-5 py-2.5 font-pixel text-xs rounded font-bold flex items-center gap-1.5 shadow ${
                        isUnlocked
                          ? 'bg-amber-500 hover:bg-amber-400 text-black active:scale-95'
                          : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" /> CHALLENGE
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
