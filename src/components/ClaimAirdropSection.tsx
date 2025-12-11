import React, { useState, useEffect } from 'react';
import { Gift, CheckCircle, Loader2, AlertTriangle, Shield, Swords, Crown } from 'lucide-react';

interface ClaimAirdropSectionProps {
  walletAccountId: string | null;
  apiBaseUrl: string | undefined;
  onClaimSuccess?: () => void;
}

interface EligibilityData {
  tier1_common: string[];
  tier2_common_rare: string[];
  tier3_all: string[];
}

interface ClaimResult {
  success: boolean;
  message: string;
  nfts?: Array<{
    rarity: string;
    serialNumber: number;
    metadataTokenId: number;
  }>;
  error?: string;
}

const ClaimAirdropSection: React.FC<ClaimAirdropSectionProps> = ({
  walletAccountId,
  apiBaseUrl,
  onClaimSuccess
}) => {
  const [eligibility, setEligibility] = useState<EligibilityData | null>(null);
  const [userTier, setUserTier] = useState<'tier1' | 'tier2' | 'tier3' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
  const [alreadyClaimed, setAlreadyClaimed] = useState(false);

  // Load eligibility data
  useEffect(() => {
    const loadEligibility = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/airdrop-eligibility.json');
        const data: EligibilityData = await response.json();
        setEligibility(data);
      } catch (error) {
        console.error('Failed to load eligibility data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadEligibility();
  }, []);

  // Check user eligibility when wallet connects
  useEffect(() => {
    if (!walletAccountId || !eligibility) {
      setUserTier(null);
      return;
    }

    // Check tiers in order of highest to lowest
    if (eligibility.tier3_all.includes(walletAccountId)) {
      setUserTier('tier3');
    } else if (eligibility.tier2_common_rare.includes(walletAccountId)) {
      setUserTier('tier2');
    } else if (eligibility.tier1_common.includes(walletAccountId)) {
      setUserTier('tier1');
    } else {
      setUserTier(null);
    }

    // Check if already claimed
    checkClaimStatus(walletAccountId);
  }, [walletAccountId, eligibility]);

  const checkClaimStatus = async (accountId: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/airdrop/claim-status/${accountId}`);
      const data = await response.json();
      setAlreadyClaimed(data.hasClaimed);
    } catch (error) {
      console.error('Failed to check claim status:', error);
    }
  };

  const handleClaim = async () => {
    if (!walletAccountId || !userTier) return;

    setIsClaiming(true);
    setClaimResult(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/airdrop/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAccountId: walletAccountId,
          tier: userTier
        })
      });

      const result = await response.json();

      if (result.success) {
        setClaimResult({
          success: true,
          message: result.message,
          nfts: result.nfts
        });
        setAlreadyClaimed(true);
        onClaimSuccess?.();
      } else {
        setClaimResult({
          success: false,
          message: result.error || 'Claim failed',
          error: result.error
        });
      }
    } catch (error: any) {
      setClaimResult({
        success: false,
        message: error.message || 'Failed to claim',
        error: error.message
      });
    } finally {
      setIsClaiming(false);
    }
  };

  const getTierInfo = () => {
    switch (userTier) {
      case 'tier1':
        return {
          title: 'Common Warrior',
          description: 'You are eligible to claim 1 Common NFT',
          nfts: [{ name: 'Common Warrior', icon: Shield, color: 'text-slate-400' }],
          gradient: 'from-slate-600 to-slate-800',
          borderColor: 'border-slate-500'
        };
      case 'tier2':
        return {
          title: 'Rare Champion',
          description: 'You are eligible to claim 1 Common + 1 Rare NFT',
          nfts: [
            { name: 'Common Warrior', icon: Shield, color: 'text-slate-400' },
            { name: 'Rare Champion', icon: Swords, color: 'text-blue-400' }
          ],
          gradient: 'from-blue-600 to-purple-700',
          borderColor: 'border-blue-500'
        };
      case 'tier3':
        return {
          title: 'Legendary Hero',
          description: 'You are eligible to claim 1 Common + 1 Rare + 1 Legendary NFT',
          nfts: [
            { name: 'Common Warrior', icon: Shield, color: 'text-slate-400' },
            { name: 'Rare Champion', icon: Swords, color: 'text-blue-400' },
            { name: 'Legendary Hero', icon: Crown, color: 'text-amber-400' }
          ],
          gradient: 'from-amber-500 to-orange-700',
          borderColor: 'border-amber-500'
        };
      default:
        return null;
    }
  };

  // Don't show if not connected or not eligible
  if (!walletAccountId) return null;
  if (isLoading) return null;
  if (!userTier) return null;

  const tierInfo = getTierInfo();
  if (!tierInfo) return null;

  return (
    <div className="mt-16 mb-12 max-w-4xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-900/30 border border-amber-500/50 rounded-full">
          <Gift className="w-5 h-5 text-amber-400" />
          <span className="text-amber-400 font-bold uppercase tracking-wider text-sm">Airdrop Claim</span>
        </div>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>
      </div>

      {/* Main Card */}
      <div className={`bg-gradient-to-br from-gray-900/80 via-gray-900/60 to-gray-900/80 border-2 ${tierInfo.borderColor} rounded-3xl p-8 backdrop-blur-sm shadow-2xl`}>
        
        {/* Already Claimed State */}
        {alreadyClaimed && !claimResult && (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-green-400 mb-2">Already Claimed</h3>
            <p className="text-gray-400">You have already claimed your airdrop NFTs.</p>
          </div>
        )}

        {/* Claim Success State */}
        {claimResult?.success && (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-green-400 mb-2">Claim Successful!</h3>
            <p className="text-gray-300 mb-6">{claimResult.message}</p>
            
            {claimResult.nfts && (
              <div className="grid gap-4 max-w-md mx-auto">
                {claimResult.nfts.map((nft, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                    <span className="font-medium capitalize">{nft.rarity} NFT</span>
                    <span className="text-amber-400 font-bold">Serial #{nft.serialNumber}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Claim Error State */}
        {claimResult && !claimResult.success && (
          <div className="text-center py-8">
            <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-red-400 mb-2">Claim Failed</h3>
            <p className="text-gray-300 mb-4">{claimResult.error}</p>
            <button
              onClick={() => setClaimResult(null)}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Eligible State - Ready to Claim */}
        {!alreadyClaimed && !claimResult && (
          <>
            <div className="text-center mb-8">
              <div className={`inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r ${tierInfo.gradient} rounded-full mb-4`}>
                <Gift className="w-6 h-6" />
                <span className="font-bold text-lg">{tierInfo.title}</span>
              </div>
              <p className="text-gray-300 text-lg">{tierInfo.description}</p>
            </div>

            {/* NFTs to Claim */}
            <div className="grid gap-4 mb-8">
              {tierInfo.nfts.map((nft, index) => {
                const Icon = nft.icon;
                return (
                  <div key={index} className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                    <div className={`p-3 rounded-xl bg-gray-700/50`}>
                      <Icon className={`w-8 h-8 ${nft.color}`} />
                    </div>
                    <div>
                      <div className="font-bold text-white">{nft.name}</div>
                      <div className="text-sm text-gray-400">1 NFT</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Claim Button */}
            <button
              onClick={handleClaim}
              disabled={isClaiming}
              className={`w-full py-5 rounded-xl font-bold text-xl bg-gradient-to-r ${tierInfo.gradient} hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-[1.02] disabled:scale-100 shadow-lg flex items-center justify-center gap-3`}
            >
              {isClaiming ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Claiming NFTs...
                </>
              ) : (
                <>
                  <Gift className="w-6 h-6" />
                  Claim Your NFTs
                </>
              )}
            </button>

            {/* Info Note */}
            <p className="text-center text-gray-500 text-sm mt-4">
              Make sure you have associated with the token before claiming.
              NFTs will be transferred directly to your connected wallet.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default ClaimAirdropSection;