
import { useState, useEffect } from 'react';
import { Plus, Minus, Wallet, Shield, Swords, Crown, Download, ExternalLink, Info } from 'lucide-react';
import hashpackService from './services/hashpackService';
import apiService from './services/apiService';
import mirrorNodeService from './services/mirrorNodeService';

const CONTRACT_ID = process.env.REACT_APP_HEDERA_CONTRACT_ID as string;
const NETWORK = process.env.REACT_APP_HEDERA_NETWORK || 'testnet';

interface NFTTier {
  name: string;
  price: number;
  odinAllocation: number;
  available: number;
  icon: any;
  benefits: string[];
  color: string;
}

interface WalletState {
  accountId: string | null;
  balance: number;
  isConnected: boolean;
  provider: 'hashpack' | 'blade' | null;
}

interface MintedNFT {
  tokenId: string;
  serialNumber: number;
  metadata: {
    name: string;
    image: string;
    attributes: Array<{ trait_type: string; value: string }>;
  };
}

function App() {
  const [selectedTier, setSelectedTier] = useState<'common' | 'rare' | 'legendary'>('common');
  const [quantity, setQuantity] = useState(1);
  const [wallet, setWallet] = useState<WalletState>({
    accountId: null,
    balance: 0,
    isConnected: false,
    provider: null
  });
  const [isMinting, setIsMinting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mintSuccess, setMintSuccess] = useState(false);
  const [mintedNFTs, setMintedNFTs] = useState<MintedNFT[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [totalMinted] = useState(541);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());

  const tiers: Record<string, NFTTier> = {
    common: {
      name: 'Common Warrior',
      price: 1400,
      odinAllocation: 40000,
      available: 3500,
      icon: Shield,
      benefits: [
        'Early access to The Nine Realms dashboard & app',
        'Standard staking multiplier and quest participation',
        'Eligible for future airdrops and upgrades'
      ],
      color: 'from-slate-600 to-slate-800'
    },
    rare: {
      name: 'Rare Champion',
      price: 7200,
      odinAllocation: 300000,
      available: 800,
      icon: Swords,
      benefits: [
        'Priority access to new Realm releases and Beta features',
        'Governance participation and boosted staking rewards',
        'Early access to land sales and in-world items'
      ],
      color: 'from-blue-600 to-purple-700'
    },
    legendary: {
      name: 'Legendary Hero',
      price: 22000,
      odinAllocation: 1000000,
      available: 159,
      icon: Crown,
      benefits: [
        'Reserved whitelist for Realm Land Claim in Phase II',
        'Lifetime Legendary Council role (exclusive governance)',
        'Early claim on metaverse assets and major collaborations',
        'Extended commercial licensing rights'
      ],
      color: 'from-amber-500 to-orange-700'
    }
  };

  const maxPerTransaction = 10;
  const totalSupply = 5000;
  const remainingSupply = totalSupply - totalMinted;

  useEffect(() => {
    const init = async () => {
      try {
        await hashpackService.init();
        if (hashpackService.isConnected()) {
          const accountId = hashpackService.getAccountId();
          if (accountId) {
            const balance = await mirrorNodeService.getAccountBalance(accountId);
            setWallet({
              accountId,
              balance,
              isConnected: true,
              provider: 'hashpack'
            });
          }
        }
      } catch (err: any) {
        console.error('Init error:', err);
      }
    };
    init();
  }, []);

  const connectHashPack = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const accountId = await hashpackService.connectWallet();
      const balance = await mirrorNodeService.getAccountBalance(accountId);
      setWallet({
        accountId,
        balance,
        isConnected: true,
        provider: 'hashpack'
      });
    } catch (err: any) {
      setError(err.message || 'Failed to connect');
    } finally {
      setIsLoading(false);
    }
  };

  const connectBlade = async () => {
    try {
      setIsLoading(true);
      setError(null);
      if (!window.bladeSDK) {
        window.open('https://bladewallet.io/', '_blank');
        throw new Error('Blade wallet not found. Please install it first.');
      }
      const blade = window.bladeSDK;
      const accountId = await blade.createSession();
      const balance = await mirrorNodeService.getAccountBalance(accountId);
      setWallet({
        accountId,
        balance,
        isConnected: true,
        provider: 'blade'
      });
    } catch (err: any) {
      setError(err.message || 'Failed to connect Blade wallet');
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = async () => {
    try {
      await hashpackService.disconnectWallet();
      setWallet({
        accountId: null,
        balance: 0,
        isConnected: false,
        provider: null
      });
      setError(null);
    } catch (err: any) {
      console.error('Disconnect error:', err);
    }
  };

  const handleMint = async () => {
    if (!wallet.isConnected || !wallet.accountId) {
      setError('Please connect your wallet first');
      return;
    }

    const tier = tiers[selectedTier];
    const totalCost = tier.price * quantity;

    if (wallet.balance < totalCost + 1) {
      setError(`Insufficient balance. You need ${totalCost + 1} HBAR`);
      return;
    }

    setIsMinting(true);
    setError(null);

    try {
      const mintResult = await apiService.mintNFT(wallet.accountId, quantity);
      if (mintResult.success) {
        const nfts = await Promise.all(
          mintResult.result.serials.map((serial: number) =>
            mirrorNodeService.getNFTMetadata(CONTRACT_ID, serial)
          )
        );
        setMintedNFTs(nfts);
        setMintSuccess(true);
        const newBalance = await mirrorNodeService.getAccountBalance(wallet.accountId);
        setWallet(prev => ({ ...prev, balance: newBalance }));
        setQuantity(1);
      }
    } catch (err: any) {
      setError(err.message || 'Minting failed');
    } finally {
      setIsMinting(false);
    }
  };

  const downloadNFT = async (nft: MintedNFT) => {
    try {
      const nftId = `${nft.tokenId}-${nft.serialNumber}`;
      setDownloadingIds(prev => new Set(prev).add(nftId));
      const response = await fetch(nft.metadata.image);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${nft.metadata.name.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Failed to download NFT');
    } finally {
      setDownloadingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${nft.tokenId}-${nft.serialNumber}`);
        return newSet;
      });
    }
  };

  const incrementQuantity = () => {
    if (quantity < maxPerTransaction) {
      setQuantity(prev => prev + 1);
    }
  };

  const decrementQuantity = () => {
    if (quantity > 1) {
      setQuantity(prev => prev - 1);
    }
  };

  const currentTier = tiers[selectedTier];
  const mintCost = currentTier.price * quantity;
  const estimatedGas = 0.5;
  const totalCost = mintCost + estimatedGas;

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white" style={{ fontFamily: "'Norse', sans-serif" }}>
      <section className="relative pt-20 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-900/20 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-amber-500/10 rounded-full blur-[120px]" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <h1 className="text-6xl lg:text-8xl font-bold mb-6 tracking-wider">
              <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600 bg-clip-text text-transparent">
                HBARBARIAN
              </span>
            </h1>
            <p className="text-xl lg:text-2xl text-amber-100/80 mb-8">
              ⚔️ Join The Nine Realms ⚔️
            </p>
            <p className="text-lg text-gray-400 max-w-3xl mx-auto font-bold">
              Mint your legendary NFT and claim your place in the Nine Realms. Each hero grants exclusive access,
              $ODIN tokens, and governance rights in the Digital Realms metaverse.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-16 max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-amber-900/20 to-transparent border border-amber-500/30 rounded-2xl p-6 text-center backdrop-blur-sm">
              <div className="text-4xl font-bold text-amber-400 mb-2">{totalMinted.toLocaleString()}</div>
              <div className="text-sm text-gray-400 uppercase tracking-wider">Minted</div>
            </div>
            <div className="bg-gradient-to-br from-amber-900/20 to-transparent border border-amber-500/30 rounded-2xl p-6 text-center backdrop-blur-sm">
              <div className="text-4xl font-bold text-amber-400 mb-2">{remainingSupply.toLocaleString()}</div>
              <div className="text-sm text-gray-400 uppercase tracking-wider">Remaining</div>
            </div>
            <div className="bg-gradient-to-br from-amber-900/20 to-transparent border border-amber-500/30 rounded-2xl p-6 text-center backdrop-blur-sm">
              <div className="text-4xl font-bold text-amber-400 mb-2">{totalSupply.toLocaleString()}</div>
              <div className="text-sm text-gray-400 uppercase tracking-wider">Total Supply</div>
            </div>
          </div>

          {!wallet.isConnected ? (
            <div className="max-w-2xl mx-auto mb-16">
              <div className="bg-gradient-to-br from-amber-900/20 to-transparent border border-amber-500/30 rounded-3xl p-8 backdrop-blur-sm">
                <h3 className="text-2xl font-bold text-center mb-6 text-amber-400">Connect Your Wallet</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <button
                    onClick={connectHashPack}
                    disabled={isLoading}
                    className="group relative overflow-hidden bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 rounded-xl p-6 transition-all duration-300 transform hover:scale-105 disabled:opacity-50"
                  >
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative flex items-center justify-center space-x-3">
                      <Wallet className="w-6 h-6" />
                      <div className="text-left">
                        <div className="font-bold text-lg">HashPack</div>
                        <div className="text-sm opacity-80">Most Popular</div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={connectBlade}
                    disabled={isLoading}
                    className="group relative overflow-hidden bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 rounded-xl p-6 transition-all duration-300 transform hover:scale-105 disabled:opacity-50"
                  >
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative flex items-center justify-center space-x-3">
                      <Shield className="w-6 h-6" />
                      <div className="text-left">
                        <div className="font-bold text-lg">Blade Wallet</div>
                        <div className="text-sm opacity-80">Secure & Fast</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto mb-8">
              <div className="bg-gradient-to-r from-green-900/20 to-transparent border border-green-500/30 rounded-2xl p-4 backdrop-blur-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  <div>
                    <div className="text-sm text-gray-400">Connected</div>
                    <div className="font-bold text-sm md:text-base">{wallet.accountId}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-400">Balance</div>
                  <div className="font-bold text-amber-400">{wallet.balance.toFixed(2)} HBAR</div>
                </div>
                <button
                  onClick={disconnectWallet}
                  className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-lg text-sm transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="max-w-2xl mx-auto mb-8 p-4 bg-red-900/20 border border-red-500/50 rounded-xl text-red-400 text-center">
              {error}
            </div>
          )}

          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              {Object.entries(tiers).map(([key, tier]) => {
                const Icon = tier.icon;
                const isSelected = selectedTier === key;

                return (
                  <button
                    key={key}
                    onClick={() => setSelectedTier(key as any)}
                    className={`relative overflow-hidden rounded-2xl p-6 transition-all duration-300 transform ${
                      isSelected
                        ? 'scale-105 shadow-2xl shadow-amber-500/50'
                        : 'hover:scale-102 opacity-80 hover:opacity-100'
                    }`}
                    style={{
                      background: isSelected
                        ? `linear-gradient(135deg, ${tier.color.split(' ')[0].replace('from-', '')} 0%, ${tier.color.split(' ')[1].replace('to-', '')} 100%)`
                        : 'rgba(20, 20, 20, 0.5)',
                      border: isSelected ? '2px solid rgb(251, 191, 36)' : '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    {isSelected && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                    )}

                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-4">
                        <Icon className="w-10 h-10" />
                        {isSelected && (
                          <div className="w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>

                      <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
                      <div className="text-3xl font-bold text-amber-400 mb-4">
                        {tier.price.toLocaleString()} HBAR
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between text-base">
                          <span className="text-gray-300">$ODIN Allocation</span>
                          <span className="font-bold text-amber-400 text-lg">{tier.odinAllocation.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-base">
                          <span className="text-gray-300">Available</span>
                          <span className="font-bold text-lg">{tier.available.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-white/10">
                        <div className="text-sm text-gray-300 space-y-2">
                          {tier.benefits.slice(0, 2).map((benefit, i) => (
                            <div key={i} className="flex items-start text-base leading-relaxed">
                              <span className="text-amber-400 mr-2 text-lg">•</span>
                              <span>{benefit}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="bg-gradient-to-br from-amber-900/10 to-transparent border border-amber-500/30 rounded-3xl p-8 backdrop-blur-sm">
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xl font-bold mb-6 text-amber-400">Select Quantity</h3>
                  <div className="flex items-center justify-center space-x-8 mb-8">
                    <button
                      onClick={decrementQuantity}
                      disabled={quantity <= 1}
                      className="w-14 h-14 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                    >
                      <Minus className="w-6 h-6" />
                    </button>

                    <div className="text-center">
                      <div className="text-6xl font-bold text-amber-400">{quantity}</div>
                      <div className="text-sm text-gray-400 mt-2">Max {maxPerTransaction} per transaction</div>
                    </div>

                    <button
                      onClick={incrementQuantity}
                      disabled={quantity >= maxPerTransaction}
                      className="w-14 h-14 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                    >
                      <Plus className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold mb-6 text-amber-400">Cost Breakdown</h3>
                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between items-center pb-3 border-b border-white/10">
                      <span className="text-gray-300">{quantity} × {currentTier.name}</span>
                      <span className="font-bold text-lg">{mintCost.toLocaleString()} HBAR</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-white/10">
                      <span className="text-gray-300">Network Fee (est.)</span>
                      <span className="font-bold">{estimatedGas} HBAR</span>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-xl font-bold">Total Cost</span>
                      <span className="text-3xl font-bold text-amber-400">{totalCost.toLocaleString()} HBAR</span>
                    </div>
                    <div className="text-center text-sm text-gray-400">
                      ≈ ${(totalCost * 0.07).toFixed(2)} USD
                    </div>
                  </div>

                  <button
                    onClick={handleMint}
                    disabled={!wallet.isConnected || isMinting}
                    className="w-full py-6 rounded-xl font-bold text-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 disabled:scale-100 shadow-lg hover:shadow-amber-500/50"
                  >
                    {isMinting ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Minting Your Heroes...
                      </span>
                    ) : !wallet.isConnected ? (
                      '⚠️ Connect Wallet to Mint'
                    ) : (
                      `⚔️ MINT ${quantity} ${quantity > 1 ? 'HEROES' : 'HERO'} ⚔️`
                    )}
                  </button>
                </div>
              </div>
            </div>

            {mintSuccess && mintedNFTs.length > 0 && (
              <div className="mt-12 bg-gradient-to-br from-green-900/20 to-transparent border border-green-500/30 rounded-3xl p-8 backdrop-blur-sm">
                <div className="text-center mb-8">
                  <div className="text-6xl mb-4">🎉</div>
                  <h3 className="text-3xl font-bold text-green-400 mb-2">Mint Successful!</h3>
                  <p className="text-gray-300">Your legendary heroes have arrived in Valhalla</p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {mintedNFTs.map((nft, index) => (
                    <div key={index} className="bg-gradient-to-br from-amber-900/20 to-transparent border border-amber-500/30 rounded-2xl p-4 backdrop-blur-sm">
                      <div className="relative mb-4">
                        <img
                          src={nft.metadata.image}
                          alt={nft.metadata.name}
                          className="w-full aspect-square object-cover rounded-xl"
                        />
                        <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-bold text-amber-400">
                          #{nft.serialNumber}
                        </div>
                      </div>

                      <h4 className="font-bold text-lg mb-2 text-center">{nft.metadata.name}</h4>

                      <div className="space-y-2 mb-4">
                        {nft.metadata.attributes.slice(0, 3).map((attr, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-gray-400">{attr.trait_type}</span>
                            <span className="font-semibold text-amber-400">{attr.value}</span>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => downloadNFT(nft)}
                          disabled={downloadingIds.has(`${nft.tokenId}-${nft.serialNumber}`)}
                          className="flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                        >
                          <Download className="w-4 h-4" />
                          <span>{downloadingIds.has(`${nft.tokenId}-${nft.serialNumber}`) ? 'Downloading...' : 'Download'}</span>
                        </button>

                        <a href={`https://hashscan.io/${NETWORK}/token/${nft.tokenId}/${nft.serialNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center space-x-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-semibold transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>View</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 text-center">
                  <button
                    onClick={() => {
                      setMintSuccess(false);
                      setMintedNFTs([]);
                      setQuantity(1);
                    }}
                    className="px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-105"
                  >
                    ⚔️ Mint More Heroes
                  </button>
                </div>
              </div>
            )}

            <div className="mt-16 grid md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-amber-900/20 to-transparent border border-amber-500/30 rounded-2xl p-6 backdrop-blur-sm">
                <div className="text-amber-400 mb-4">
                  <Shield className="w-12 h-12" />
                </div>
                <h4 className="text-2xl font-bold mb-3">Common Holders</h4>
                <ul className="space-y-3 text-lg text-gray-300">
                  {tiers.common.benefits.map((benefit, i) => (
                    <li key={i} className="flex items-start">
                      <span className="text-amber-400 mr-3 text-xl">•</span>
                      <span className="text-lg leading-relaxed">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-gradient-to-br from-blue-900/20 to-transparent border border-blue-500/30 rounded-2xl p-6 backdrop-blur-sm">
                <div className="text-blue-400 mb-4">
                  <Swords className="w-12 h-12" />
                </div>
                <h4 className="text-2xl font-bold mb-3">Rare Holders</h4>
                <ul className="space-y-3 text-lg text-gray-300">
                  {tiers.rare.benefits.map((benefit, i) => (
                    <li key={i} className="flex items-start">
                      <span className="text-blue-400 mr-3 text-xl">•</span>
                      <span className="text-lg leading-relaxed">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-gradient-to-br from-amber-600/20 to-transparent border border-amber-400/50 rounded-2xl p-6 backdrop-blur-sm">
                <div className="text-amber-300 mb-4">

<div className="text-amber-300 mb-4">
                  <Crown className="w-12 h-12" />
                </div>
                <h4 className="text-2xl font-bold mb-3">Legendary Holders</h4>
                <ul className="space-y-3 text-lg text-gray-300">
                  {tiers.legendary.benefits.map((benefit, i) => (
                    <li key={i} className="flex items-start">
                      <span className="text-amber-300 mr-3 text-xl">•</span>
                      <span className="text-lg leading-relaxed">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-12 bg-gradient-to-br from-purple-900/20 to-transparent border border-purple-500/30 rounded-2xl p-6 md:p-8 backdrop-blur-sm">
              <div className="flex items-center space-x-3 mb-4">
                <Info className="w-6 h-6 md:w-8 md:h-8 text-purple-400 flex-shrink-0" />
                <h4 className="text-xl md:text-2xl font-bold text-purple-400">Royalties & Distribution</h4>
              </div>

              <p className="text-gray-300 mb-6 text-base leading-relaxed">
                8% royalty on all secondary sales, distributed as follows:
              </p>

              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 md:w-3 md:h-3 bg-purple-400 rounded-full flex-shrink-0 mt-2" />
                  <span className="text-base leading-relaxed">
                    <span className="font-bold text-purple-400">3%</span> → Digital Realms Treasury / $ODIN liquidity
                  </span>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 md:w-3 md:h-3 bg-purple-400 rounded-full flex-shrink-0 mt-2" />
                  <span className="text-base leading-relaxed">
                    <span className="font-bold text-purple-400">2%</span> → $HBARBARIAN buyback & liquidity
                  </span>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 md:w-3 md:h-3 bg-purple-400 rounded-full flex-shrink-0 mt-2" />
                  <span className="text-base leading-relaxed">
                    <span className="font-bold text-purple-400">2%</span> → Development & creative teams
                  </span>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 md:w-3 md:h-3 bg-purple-400 rounded-full flex-shrink-0 mt-2" />
                  <span className="text-base leading-relaxed">
                    <span className="font-bold text-purple-400">1%</span> → Artist & Blue Economy fund
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-8 bg-gradient-to-br from-red-900/20 to-transparent border border-red-500/30 rounded-2xl p-6 md:p-8 backdrop-blur-sm">
              <div className="flex items-center space-x-3 mb-6">
                <Info className="w-8 h-8 text-red-400 flex-shrink-0" />
                <h4 className="text-xl md:text-2xl font-bold text-red-400 leading-none">Important Information</h4>
              </div>

              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <span className="text-red-400 text-xl flex-shrink-0 leading-none" style={{ marginTop: '0.15rem' }}>◆</span>
                  <span className="text-base leading-relaxed flex-1">
                    Each Odin Genesis NFT is randomly generated with unique traits and attributes
                  </span>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="text-red-400 text-xl flex-shrink-0 leading-none" style={{ marginTop: '0.15rem' }}>◆</span>
                  <span className="text-base leading-relaxed flex-1">
                    Your NFTs and $ODIN allocation will appear in your wallet immediately after transaction confirmation
                  </span>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="text-red-400 text-xl flex-shrink-0 leading-none" style={{ marginTop: '0.15rem' }}>◆</span>
                  <span className="text-base leading-relaxed flex-1">
                    Network fees (gas) are required for all Hedera transactions - typically less than 1 HBAR
                  </span>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="text-red-400 text-xl flex-shrink-0 leading-none" style={{ marginTop: '0.15rem' }}>◆</span>
                  <span className="text-base leading-relaxed flex-1">
                    Ensure you have sufficient HBAR balance to cover both the mint price and network fees
                  </span>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="text-red-400 text-xl flex-shrink-0 leading-none" style={{ marginTop: '0.15rem' }}>◆</span>
                  <span className="text-base leading-relaxed flex-1">
                    Maximum {maxPerTransaction} NFTs per transaction - you can mint multiple times
                  </span>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="text-red-400 text-xl flex-shrink-0 leading-none" style={{ marginTop: '0.15rem' }}>◆</span>
                  <span className="text-base leading-relaxed flex-1">
                    View your NFTs on HashAxis or Zuse marketplace after minting
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-4">
              
                <a href={`https://hashscan.io/${NETWORK}/contract/${CONTRACT_ID}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-xl transition-colors"
              >
                <ExternalLink className="w-5 h-5" />
                <span>View Smart Contract</span>
              </a>

              
               <a href={`https://hashaxis.com/collection/${CONTRACT_ID}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-xl transition-colors"
              >
                <ExternalLink className="w-5 h-5" />
                <span>View on HashAxis</span>
              </a>

              
              <a href={`https://zuse.market/collection/${CONTRACT_ID}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-xl transition-colors"
              >
                <ExternalLink className="w-5 h-5" />
                <span>View on Zuse</span>
              </a>
            </div>
          </div>
        </div>
        </div>
      </section>
    </main>
  );
}

export default App;