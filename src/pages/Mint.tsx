import { useState, useEffect } from 'react';
import { Plus, Minus, Wallet, Shield, Swords, Crown, Download, ExternalLink, Info } from 'lucide-react';
import {
  AccountId,
  ContractExecuteTransaction,
  ContractId,
  Hbar,
  ContractFunctionParameters,
  HbarUnit
} from "@hashgraph/sdk";
// Import the Hedera Wallet Service
import { hederaWalletService } from '../components/WalletConnect';
import axios from 'axios';
import ClaimAirdropSection from '../components/ClaimAirdropSection';
import { Helmet } from 'react-helmet-async';

const CONTRACT_ID = process.env.REACT_APP_HEDERA_CONTRACT_ID as string;
const NETWORK = process.env.REACT_APP_HEDERA_NETWORK || 'testnet';
const MIRROR_NODE_URL = NETWORK === 'mainnet'
  ? 'https://mainnet-public.mirrornode.hedera.com'
  : 'https://testnet.mirrornode.hedera.com';
const API_BASE_URL = process.env.REACT_APP_API_URL;
const SENTX_URL = process.env.REACT_APP_SENTX_MARKETPLACE_URL;
const KABILA_URL = process.env.REACT_APP_KABILA_MARKETPLACE_URL;
const OPERATOR_ID = process.env.REACT_APP_OPERATOR_ID;

interface NFTTier {
  name: string;
  price: number; // in HBAR
  odinAllocation: number;
  available: number;
  icon: any;
  benefits: string[];
  color: string;
}

interface DynamicPricing {
  hbarUsdPrice: number;
  lastUpdated: string;
  tiers: {
    common: {
      usdPrice: number;
      hbarPrice: number;
      odinAllocation: number;
      available: number;
    };
    rare: {
      usdPrice: number;
      hbarPrice: number;
      odinAllocation: number;
      available: number;
    };
    legendary: {
      usdPrice: number;
      hbarPrice: number;
      odinAllocation: number;
      available: number;
    };
  };
}


interface WalletState {
  accountId: string | null;
  balance: number;
  isConnected: boolean;
  provider: 'walletconnect' | null;
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

const TIER_DEFINITIONS: Record<string, Omit<NFTTier, 'available' | 'icon'>> = {
  common: {
    name: 'Common Warrior',
    //price: 100,  // USD price (HBAR calculated dynamically)
    price: 100,  // USD price (HBAR calculated dynamically)
    odinAllocation: 40000,
    benefits: [
      'Early access to The Nine Realms dashboard & app',
      'Standard staking multiplier and quest participation',
      'Eligible for future airdrops and upgrades'
    ],
    color: 'from-slate-600 to-slate-800'
  },
  rare: {
    name: 'Rare Champion',
    //price: 500,  // USD price (HBAR calculated dynamically)
    price: 500,  // USD price (HBAR calculated dynamically)
    odinAllocation: 300000,
    benefits: [
      'Priority access to new Realm releases and Beta features',
      'Governance participation and boosted staking rewards',
      'Early access to land sales and in-world items'
    ],
    color: 'from-blue-600 to-purple-700'
  },
  legendary: {
    name: 'Legendary Hero',
    //price: 1500,  // USD price (HBAR calculated dynamically)
    price: 1500,  // USD price (HBAR calculated dynamically)
    odinAllocation: 1000000,
    benefits: [
      'Reserved whitelist for Realm Land Claim in Phase II',
      'Lifetime Legendary Council role (exclusive governance)',
      'Early claim on metaverse assets and major collaborations',
      'Extended commercial licensing rights'
    ],
    color: 'from-amber-500 to-orange-700'
  }
};


const TIER_ICONS = {
  common: Shield,
  rare: Swords,
  legendary: Crown
};

const Mint = () => {
  // State Management
  const [selectedTier, setSelectedTier] = useState<'common' | 'rare' | 'legendary'>('common');
  const [quantity, setQuantity] = useState(1);
  const [wallet, setWallet] = useState<WalletState>({
    accountId: null,
    balance: 0,
    isConnected: false,
    provider: null
  });
  const [isMinting, setIsMinting] = useState(false);
  const [mintSuccess, setMintSuccess] = useState(false);
  const [mintedNFTs, setMintedNFTs] = useState<MintedNFT[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [totalMinted, setTotalMinted] = useState(0);
  const [supplyData, setSupplyData] = useState<{
    common: { available: number; total: number; minted: number };
    rare: { available: number; total: number; minted: number };
    legendary: { available: number; total: number; minted: number };
  } | null>(null);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [connecting, setConnecting] = useState(false);
  const [tiers, setTiers] = useState<Record<string, NFTTier>>({});
  const [paymentStatus, setPaymentStatus] = useState<string>('');

  const maxPerTransaction = 10;
  const totalSupply = 5000;
  const remainingSupply = totalSupply - totalMinted;
  const [isLoadingTiers, setIsLoadingTiers] = useState(true);
  const [dynamicPricing, setDynamicPricing] = useState<DynamicPricing | null>(null);
  const [hbarUsdRate, setHbarUsdRate] = useState<number>(0.07); // Default fallback
  const [priceLoading, setPriceLoading] = useState<boolean>(true);
  const [isTokenAssociated, setIsTokenAssociated] = useState(false);
  const [checkingAssociation, setCheckingAssociation] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const METADATA_BASE_URL = "https://min.theninerealms.world/metadata-odin";

  const handleCopyTokenId = async () => {
    try {
      await navigator.clipboard.writeText(CONTRACT_ID);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      const textarea = document.createElement('textarea');
      textarea.value = CONTRACT_ID;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleRefreshAssociation = async () => {
    if (wallet.accountId) {
      await checkTokenAssociation(wallet.accountId);
    }
  };

  const fetchNFTMetadata = async (tokenId: number, serialNumber: number) => {
    try {
      const httpUrl = `${METADATA_BASE_URL}/${tokenId}.json`;

      console.log(`Fetching metadata from: ${httpUrl}`);
      const response = await fetch(httpUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const metadata = await response.json();

      return {
        tokenId: tokenId.toString(),
        serialNumber,
        metadata
      };
    } catch (error) {
      console.error('Failed to fetch metadata:', error);
      return null;
    }
  };

  const fetchDynamicPricing = async () => {
    try {
      setPriceLoading(true);
      console.log('💰 Fetching dynamic pricing...');

      const response = await axios.get(`${API_BASE_URL}/api/mint/dynamic-pricing`);

      if (response.data.success) {
        setDynamicPricing(response.data);
        setHbarUsdRate(response.data.hbarUsdPrice);

        console.log('✅ Dynamic pricing loaded:', {
          hbarPrice: response.data.hbarUsdPrice,
          common: response.data.tiers.common.hbarPrice + ' HBAR',
          rare: response.data.tiers.rare.hbarPrice + ' HBAR',
          legendary: response.data.tiers.legendary.hbarPrice + ' HBAR'
        });
      }
    } catch (error) {
      console.error('Failed to fetch dynamic pricing:', error);
    } finally {
      setPriceLoading(false);
    }
  };


  // ============================================
  // ADD/UPDATE useEffect FOR PRICING (around line 200)
  // ============================================

  // Fetch dynamic pricing on mount and refresh every 60 seconds
  useEffect(() => {
    fetchDynamicPricing();

    // Refresh pricing every 60 seconds
    const priceInterval = setInterval(fetchDynamicPricing, 60000);

    return () => clearInterval(priceInterval);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      await fetchDynamicPricing();
      await fetchAllDataFromBlockchain();
    };

    loadData();

    // Refresh both every 30 seconds
    const interval = setInterval(loadData, 30000);

    return () => clearInterval(interval);
  }, []);

  // Initialize WalletConnect on component mount and restore session
  useEffect(() => {
    const restoreSession = async () => {
      console.log('ðŸ”„ Starting session restoration...');

      // First initialize WalletConnect and WAIT for it to complete
      await initializeWalletConnect();

      // Add a small delay to ensure WalletConnect is fully ready
      await new Promise(resolve => setTimeout(resolve, 500));

      // Now check if WalletConnect auto-restored a session during init
      const autoRestoredAccountId = hederaWalletService.getAccountId();

      if (autoRestoredAccountId) {
        console.log('✅ Session was auto-restored during init:', autoRestoredAccountId);

        try {
          const balance = await hederaWalletService.getAccountBalance();
          const balanceInHbar = balance / 100000000;

          setWallet({
            accountId: autoRestoredAccountId,
            balance: balanceInHbar,
            isConnected: true,
            provider: 'walletconnect'
          });

          await checkTokenAssociation(autoRestoredAccountId);

          // Save to localStorage
          localStorage.setItem('walletAccountId', autoRestoredAccountId);
          localStorage.setItem('walletProvider', 'walletconnect');

          console.log('ðŸŽ‰ Session restored successfully for:', autoRestoredAccountId);
          return;
        } catch (err) {
          console.error('âŒ Failed to get balance after auto-restore:', err);
        }
      }

      // If no auto-restore, check localStorage
      const savedAccountId = localStorage.getItem('walletAccountId');
      const savedProvider = localStorage.getItem('walletProvider');

      console.log('ðŸ“¦ Saved session data:', { savedAccountId, savedProvider });

      if (savedAccountId && savedProvider === 'walletconnect') {
        console.log('✅ Found saved session, attempting to restore...');

        try {
          const restored = await hederaWalletService.restoreSession();

          if (restored) {
            console.log('ðŸ”„ Fetching balance...');
            const balance = await hederaWalletService.getAccountBalance();
            const balanceInHbar = balance / 100000000;

            console.log('ðŸ’° Balance fetched:', balanceInHbar, 'HBAR');

            setWallet({
              accountId: savedAccountId,
              balance: balanceInHbar,
              isConnected: true,
              provider: 'walletconnect'
            });

            console.log('ðŸŽ‰ Session restored successfully for:', savedAccountId);
          } else {
            console.log('âš ï¸ Could not restore session, clearing saved data');
            localStorage.removeItem('walletAccountId');
            localStorage.removeItem('walletProvider');
          }
        } catch (err) {
          console.error('âŒ Failed to restore session:', err);
          localStorage.removeItem('walletAccountId');
          localStorage.removeItem('walletProvider');
        }
      } else {
        console.log('â„¹ï¸ No saved session found');
      }
    };

    restoreSession();
  }, []);

  const initializeWalletConnect = async () => {
    try {
      const metadata = {
        name: "Odin",
        description: "OdinCoin ($ODIN) powers The Nine Realms as its utility and governance token, offering NFT holders early claims, staking rewards, and exclusive airdrops. Its burn-and-reward system drives growth and lasting value across the digital and physical realms",
        url: window.location.origin,
        icons: ['https://www.hashgraph.com/favicon.ico']
      };

      const projectId = process.env.REACT_APP_WALLETCONNECT_PROJECT_ID || '8f76b1b5b05efbd3b4d262b8c46075d4';
      await hederaWalletService.initialize(projectId, metadata);
      console.log('WalletConnect initialized successfully');
    } catch (err) {
      console.error('WalletConnect initialization error:', err);
    }
  };

  const fetchAllDataFromBlockchain = async () => {
    try {
      console.log('🔍 Fetching all data from blockchain...');
      setIsLoadingTiers(true);

      // Step 1: Get total supply from token info
      const tokenResponse: Response = await fetch(
        `${MIRROR_NODE_URL}/api/v1/tokens/${CONTRACT_ID}`
      );

      if (!tokenResponse.ok) {
        throw new Error('Failed to fetch token data');
      }

      const tokenData: any = await tokenResponse.json();
      const totalMinted = parseInt(tokenData.total_supply) || 0;

      console.log('📊 Total minted from blockchain:', totalMinted);
      setTotalMinted(totalMinted);

      // If nothing minted yet, set empty data
      if (totalMinted === 0) {
        setSupplyData({
          common: { available: 2488, total: 2488, minted: 0 },
          rare: { available: 1750, total: 1750, minted: 0 },
          legendary: { available: 750, total: 750, minted: 0 }
        });
        setIsLoadingTiers(false);
        return;
      }

      // Step 2: Get all NFTs with pagination
      let allNfts: any[] = [];
      let nextLink: string | null = `${MIRROR_NODE_URL}/api/v1/tokens/${CONTRACT_ID}/nfts?limit=100`;

      while (nextLink) {
        const nftsResponse: Response = await fetch(nextLink);
        const nftsData: any = await nftsResponse.json();

        allNfts = [...allNfts, ...nftsData.nfts];

        nextLink = nftsData.links?.next
          ? `${MIRROR_NODE_URL}${nftsData.links.next}`
          : null;

        console.log(`📦 Fetched ${allNfts.length} NFTs so far...`);
      }

      console.log(`✅ Total NFTs fetched: ${allNfts.length}`);

      // Step 3: Count by rarity - USE YOUR METADATA URL PATTERN
      let commonCount = 0;
      let rareCount = 0;
      let legendaryCount = 0;

      console.log('🔍 Fetching metadata for NFTs...');

      // Process in batches
      const batchSize = 10;
      for (let i = 0; i < allNfts.length; i += batchSize) {
        const batch = allNfts.slice(i, i + batchSize);

        const metadataPromises = batch.map(async (nft) => {
          try {
            // Use your metadata URL pattern: metadataTokenId.json
            const metadataUrl = `${METADATA_BASE_URL}/${nft.serial_number}.json`;

            const metadataResponse = await fetch(metadataUrl);

            if (!metadataResponse.ok) {
              console.warn(`Failed to fetch metadata for NFT #${nft.serial_number}`);
              return null;
            }

            const metadata: any = await metadataResponse.json();

            // Find rarity attribute
            const rarityAttr: any = metadata.attributes?.find(
              (attr: any) => attr.trait_type === 'Rarity'
            );

            if (!rarityAttr) {
              console.warn(`No rarity found for NFT #${nft.serial_number}`);
              return null;
            }

            return rarityAttr.value.toLowerCase();

          } catch (err) {
            console.error(`Failed to fetch metadata for NFT #${nft.serial_number}:`, err);
            return null;
          }
        });

        // Wait for batch to complete
        const rarities = await Promise.all(metadataPromises);

        // Count rarities from this batch
        rarities.forEach(rarity => {
          if (rarity === 'common') commonCount++;
          else if (rarity === 'rare') rareCount++;
          else if (rarity === 'legendary') legendaryCount++;
        });

        console.log(`📊 Processed ${Math.min(i + batchSize, allNfts.length)}/${allNfts.length} NFTs...`);
      }

      console.log('📊 Rarity breakdown:', {
        common: commonCount,
        rare: rareCount,
        legendary: legendaryCount,
        total: commonCount + rareCount + legendaryCount
      });

      // Step 4: Update supply data
      setSupplyData({
        common: {
          available: 2488 - commonCount,
          total: 2488,
          minted: commonCount
        },
        rare: {
          available: 1750 - rareCount,
          total: 1750,
          minted: rareCount
        },
        legendary: {
          available: 750 - legendaryCount,
          total: 750,
          minted: legendaryCount
        }
      });

      console.log('✅ All data loaded from blockchain successfully!');

    } catch (err) {
      console.error('❌ Failed to fetch from blockchain:', err);

      // Fallback to server API
      console.log('⚠️ Falling back to server API...');
      await fetchSupply();
    } finally {
      setIsLoadingTiers(false);
    }
  };

  const checkTokenAssociation = async (accountId: string) => {
    setCheckingAssociation(true);
    try {
      const response = await fetch(
        `${MIRROR_NODE_URL}/api/v1/accounts/${accountId}/tokens?token.id=${CONTRACT_ID}`
      );
      const data = await response.json();
      const associated = data.tokens && data.tokens.length > 0;
      setIsTokenAssociated(associated);
      return associated;
    } catch (error) {
      console.error('Association check failed:', error);
      return false;
    } finally {
      setCheckingAssociation(false);
    }
  };

  // Fetch supply on component mount and refresh periodically
  /*useEffect(() => {
      fetchSupply();
      const interval = setInterval(fetchSupply, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }, []);*/

  // Initialize tiers when supply data changes
  useEffect(() => {
    if (supplyData) {
      const updatedTiers: Record<string, NFTTier> = {};

      Object.entries(TIER_DEFINITIONS).forEach(([key, tierDef]) => {
        updatedTiers[key] = {
          ...tierDef, // This contains name, price, odinAllocation, benefits, color
          available: supplyData[key as keyof typeof supplyData]?.available || 0,
          icon: TIER_ICONS[key as keyof typeof TIER_ICONS]
        };
      });

      setTiers(updatedTiers);
      console.log('✅ Tiers initialized with supply data:', updatedTiers);
    }
  }, [supplyData]);

  const fetchSupply = async () => {
    try {
      console.log('📊 Fetching supply data...');
      const response = await axios.get(`${API_BASE_URL}/api/mint/stats`);

      if (response.data.success) {
        const stats = response.data;

        // ⭐ FIX: Set supply data from API
        setSupplyData({
          common: {
            available: stats.byRarity.common.available,
            total: stats.byRarity.common.total,
            minted: stats.byRarity.common.minted
          },
          rare: {
            available: stats.byRarity.rare.available,
            total: stats.byRarity.rare.total,
            minted: stats.byRarity.rare.minted
          },
          legendary: {
            available: stats.byRarity.legendary.available,
            total: stats.byRarity.legendary.total,
            minted: stats.byRarity.legendary.minted
          }
        });

        // ⭐ FIX: Set total minted
        setTotalMinted(stats.totalMinted);

        console.log('✅ Supply data loaded:', {
          totalMinted: stats.totalMinted,
          common: stats.byRarity.common,
          rare: stats.byRarity.rare,
          legendary: stats.byRarity.legendary
        });
      }
    } catch (err) {
      console.error('❌ Failed to fetch supply:', err);

      // Fallback data
      setSupplyData({
        common: { available: 2488, total: 2488, minted: 0 },
        rare: { available: 1750, total: 1750, minted: 0 },
        legendary: { available: 750, total: 750, minted: 0 }
      });
      setTotalMinted(0);
    } finally {
      setIsLoadingTiers(false);
    }
  };

  // Connect WalletConnect
  const connectWalletConnect = async () => {
    try {
      setConnecting(true);
      setError(null);

      const { accountId } = await hederaWalletService.connect();
      const balance = await hederaWalletService.getAccountBalance();
      const balanceInHbar = balance / 100000000; // Convert tinybars to HBAR

      setWallet({
        accountId,
        balance: balanceInHbar,
        isConnected: true,
        provider: 'walletconnect'
      });

      // Save session to localStorage
      localStorage.setItem('walletAccountId', accountId);
      localStorage.setItem('walletProvider', 'walletconnect');

      console.log('ACTUALLY CONNECTED AS:', accountId);
      await checkTokenAssociation(accountId);

    } catch (err: any) {
      console.error('WalletConnect connection error:', err);
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setConnecting(false);
    }
  };

  // Disconnect Wallet
  const disconnectWallet = async () => {
    try {
      await hederaWalletService.disconnect();

      // Clear saved session
      localStorage.removeItem('walletAccountId');
      localStorage.removeItem('walletProvider');

      setWallet({
        accountId: null,
        balance: 0,
        isConnected: false,
        provider: null
      });
    } catch (err) {
      console.error('Disconnect error:', err);
      setError('Failed to disconnect wallet');
    }
  };

  // Refresh Balance
  const refreshBalance = async () => {
    if (!wallet.accountId) return;

    try {
      const balance = await hederaWalletService.getAccountBalance();
      const balanceInHbar = balance / 100000000;
      setWallet(prev => ({ ...prev, balance: balanceInHbar }));
    } catch (err) {
      console.error('Failed to refresh balance:', err);
    }
  };

  const getCurrentTier = () => {
    const tierKey = selectedTier as 'common' | 'rare' | 'legendary';

    // If dynamic pricing is loaded, use it
    if (dynamicPricing?.tiers[tierKey]) {
      const dynamicTier = dynamicPricing.tiers[tierKey];
      return {
        name: TIER_DEFINITIONS[tierKey].name,
        price: dynamicTier.hbarPrice,        // Dynamic HBAR price
        usdPrice: dynamicTier.usdPrice,      // USD price for display
        odinAllocation: dynamicTier.odinAllocation,
        available: dynamicTier.available,
        icon: TIER_ICONS[tierKey],
        benefits: TIER_DEFINITIONS[tierKey].benefits,
        color: TIER_DEFINITIONS[tierKey].color
      };
    }

    // Fallback to static USD prices converted at fallback rate
    const fallbackHbarRate = 0.07; // Fallback HBAR price
    const usdPrice = TIER_DEFINITIONS[tierKey].price;

    return {
      name: TIER_DEFINITIONS[tierKey].name,
      price: Math.ceil(usdPrice / fallbackHbarRate), // Convert USD to HBAR
      usdPrice: usdPrice,
      odinAllocation: TIER_DEFINITIONS[tierKey].odinAllocation,
      available: supplyData?.[tierKey]?.available || 0,
      icon: TIER_ICONS[tierKey],
      benefits: TIER_DEFINITIONS[tierKey].benefits,
      color: TIER_DEFINITIONS[tierKey].color
    };
  };

  const currentTier = getCurrentTier();

  const formatPrice = (hbarAmount: number, usdAmount?: number) => {
    if (usdAmount) {
      return `$${usdAmount.toLocaleString()} (~${hbarAmount.toLocaleString()} HBAR)`;
    }
    return `${hbarAmount.toLocaleString()} HBAR`;
  };

  const formatHbarWithUsd = (hbarAmount: number) => {
    const usdValue = hbarAmount * hbarUsdRate;
    return {
      hbar: hbarAmount.toLocaleString(),
      usd: usdValue.toFixed(2)
    };
  };

  const initiateMint = async (selectedTier: 'common' | 'rare' | 'legendary', mintQuantity: number) => {
    try {
      console.log('🔍 DEBUG: Starting mint process');
      console.log('Tier:', selectedTier);
      console.log('Quantity:', mintQuantity);

      // Clear any previous success/error messages
      setMintSuccess(false);
      setMintedNFTs([]);
      setError(null);

      if (!wallet.isConnected || !wallet.accountId) {
        setError('Please connect your wallet first');
        return;
      }

      // ✅ STEP 1: CHECK TOKEN ASSOCIATION FIRST (BEFORE PAYMENT)
      console.log('🔍 Checking token association BEFORE payment...');
      setPaymentStatus('Checking token association...');

      const associationResponse = await fetch(
        `${API_BASE_URL}/api/token/association/${wallet.accountId}`
      );
      const associationData = await associationResponse.json();

      if (!associationData.isAssociated) {
        setError(
          `⚠️ Token Association Required!`
        );
        setPaymentStatus('');
        setIsTokenAssociated(false);
        return;
      }

      console.log('✅ Token association confirmed - proceeding with payment');
      setIsTokenAssociated(true);

      // Get tier with guaranteed pricing
      const tier = getCurrentTier();

      // Double-check pricing is loaded
      if (!tier || tier.price === 0 || tier.price === undefined) {
        setError('System error: Tier pricing not available. Please refresh the page.');
        console.error('CRITICAL: Tier has no price:', tier);
        return;
      }

      console.log('✅ Tier validation passed:', {
        name: tier.name,
        price: tier.price,
        available: tier.available
      });

      // Validate tier availability
      if (tier.available < mintQuantity) {
        setError(`Only ${tier.available} ${selectedTier} NFTs available`);
        return;
      }

      // Validate wallet balance
      const totalCost = tier.price * mintQuantity;

      if (wallet.balance < totalCost) {
        setError(`Insufficient balance. You need ${totalCost} HBAR (including gas fees)`);
        return;
      }

      setIsMinting(true);
      setPaymentStatus('Preparing payment...');

      // Calculate amount from frontend pricing - KEEP AS HBAR
      const amountInHbar = tier.price * mintQuantity;

      console.log(`💰 Sending ${amountInHbar} HBAR for ${mintQuantity} ${selectedTier} NFT(s)`);

      // STEP 2: Send payment directly using WalletConnect
      setPaymentStatus('Sending payment...');

      const treasuryAccountId = process.env.REACT_APP_TREASURY_ACCOUNT_ID as string;

      const paymentResult = await hederaWalletService.sendHBAR(
        treasuryAccountId,
        amountInHbar
      );

      // CHECK FOR USER REJECTION
      if (paymentResult.userRejected) {
        console.log('👤 User rejected transaction in wallet');
        setIsMinting(false);
        setPaymentStatus('');
        return;
      }

      if (!paymentResult.success) {
        throw new Error('Payment failed');
      }

      console.log('✅ Payment sent successfully!');
      console.log('📋 Transaction Hash:', paymentResult.transactionId);

      // STEP 3: Send transaction hash to backend for verification and minting
      setPaymentStatus('Verifying payment and minting NFT...');

      console.log('📤 Sending to backend:', {
        userAccountId: wallet.accountId,
        rarity: selectedTier,
        quantity: mintQuantity,
        transactionHash: paymentResult.transactionId
      });

      const response = await fetch(`${API_BASE_URL}/api/mint/verify-and-mint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAccountId: wallet.accountId,
          rarity: selectedTier,
          quantity: mintQuantity,
          transactionHash: paymentResult.transactionId
        })
      });

      // ✅ ALWAYS parse the response body first
      const result = await response.json();
      console.log('📊 Backend response:', result);

      // ✅ Check for success in the result, not just HTTP status
      if (!result.success) {
        // Show warning if NFTs were actually minted
        if (result.warning) {
          console.warn('⚠️ Warning:', result.warning);
        }
        throw new Error(result.error || 'Minting failed');
      }

      // nftDetails is an ARRAY from the backend
      if (!result.nftDetails || !Array.isArray(result.nftDetails) || result.nftDetails.length === 0) {
        console.error('❌ Backend returned success but nftDetails is missing or empty!');
        console.error('Full result:', JSON.stringify(result, null, 2));
        throw new Error('Server error: NFT details not returned');
      }

      // Get the first NFT details for validation
      const firstNft = result.nftDetails[0];

      if (!firstNft.metadataTokenId && !firstNft.serialNumber) {
        console.error('❌ First NFT missing both metadataTokenId and serialNumber!');
        console.error('nftDetails:', result.nftDetails);
        throw new Error('Server error: Incomplete NFT details');
      }

      console.log('🎉 NFT Minted Successfully!', result.nftDetails);

      // Process ALL minted NFTs (supports batch minting)
      const mintedNFTsArray: MintedNFT[] = [];

      for (const nftDetail of result.nftDetails) {
        const metadataTokenId = nftDetail.metadataTokenId || nftDetail.serialNumber;
        console.log('✅ Processing NFT with metadataTokenId:', metadataTokenId);

        try {
          const metadataUrl = `${METADATA_BASE_URL}/${metadataTokenId}.json`;
          console.log(`Fetching metadata from: ${metadataUrl}`);

          const metadataResponse = await fetch(metadataUrl);

          if (!metadataResponse.ok) {
            throw new Error(`Server fetch failed: ${metadataResponse.status}`);
          }

          const actualMetadata = await metadataResponse.json();
          console.log('Fetched metadata:', actualMetadata);

          mintedNFTsArray.push({
            tokenId: nftDetail.tokenId || process.env.REACT_APP_HEDERA_CONTRACT_ID || '',
            serialNumber: nftDetail.serialNumber,
            metadata: actualMetadata
          });

        } catch (metadataError) {
          console.error('Failed to fetch metadata for token:', metadataTokenId, metadataError);

          // Fallback to basic metadata
          mintedNFTsArray.push({
            tokenId: nftDetail.tokenId || process.env.REACT_APP_HEDERA_CONTRACT_ID || '',
            serialNumber: nftDetail.serialNumber,
            metadata: {
              name: `${tier.name} #${nftDetail.serialNumber || metadataTokenId}`,
              image: '',
              attributes: [
                { trait_type: 'Tier', value: selectedTier },
                { trait_type: 'ODIN Allocation', value: tier.odinAllocation.toString() }
              ]
            }
          });
        }
      }

      setMintedNFTs(mintedNFTsArray);
      setMintSuccess(true);
      setPaymentStatus('✅ Mint Complete!');

      // Refresh supply and balance
      await fetchSupply();
      await refreshBalance();

      console.log(`✅ Process completed successfully!`);
      console.log(`   NFTs minted: ${mintedNFTsArray.length}`);
      console.log(`   Transaction: ${paymentResult.transactionId}`);
      console.log(`   User: ${wallet.accountId}`);

      // Reset payment status after success
      setTimeout(() => setPaymentStatus(''), 3000);

    } catch (error: any) {
      console.error('❌ Mint error:', error);

      // Check if it's a user rejection error
      const errorMsg = error.message?.toLowerCase() || '';
      const isRejection = errorMsg.includes('reject') ||
        errorMsg.includes('cancel') ||
        errorMsg.includes('denied') ||
        (errorMsg.includes('user') && errorMsg.includes('declined'));

      if (isRejection) {
        console.log('🚫 User rejected transaction - not showing error');
      } else {
        setError(error.message);
      }

      setPaymentStatus('');
    } finally {
      setIsMinting(false);
    }
  };

  // Reset when tier changes
  useEffect(() => {
    setMintSuccess(false);
    setMintedNFTs([]);
  }, [selectedTier]);

  // Reset when quantity changes  
  useEffect(() => {
    setMintSuccess(false);
    setMintedNFTs([]);
  }, [quantity]);

  const checkAndMintDirect = async (
    userAccountId: string,
    expectedAmount: number,
    rarity: string
  ): Promise<any> => {
    for (let attempt = 1; attempt <= 40; attempt++) { // 40 attempts = 80 seconds max
      try {
        console.log(`ðŸ”„ Check & Mint attempt ${attempt}/40`);
        setPaymentStatus(`Checking payment... (${attempt}/40)`);

        const response = await fetch(`${API_BASE_URL}/api/mint/check-and-mint`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAccountId,
            expectedAmount,
            rarity
          })
        });

        const result = await response.json();
        console.log('ðŸ“Š Check & Mint result:', result);

        if (result.status === 'minted') {
          setPaymentStatus('✅ NFT Minted Successfully!');
          return {
            success: true,
            nft: result.nftDetails,
            transactionId: result.transactionId
          };
        } else if (result.status === 'already_used') {
          setPaymentStatus('âš ï¸ Payment already used for minting');
          return {
            success: false,
            error: 'This payment has already been used to mint an NFT'
          };
        } else if (result.status === 'no_payment' || result.status === 'no_transactions') {
          setPaymentStatus(`â³ Waiting for payment... (${attempt}/40)`);
        }

        await new Promise(resolve => setTimeout(resolve, 2000)); // Check every 2 seconds

      } catch (error: any) {
        console.log(`âš ï¸ Check & Mint error:`, error?.message);
        setPaymentStatus(`âš ï¸ Connection error... (${attempt}/40)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    setPaymentStatus('');
    return {
      success: false,
      error: 'Payment verification timeout'
    };
  };

  const completeMint = async (paymentId: string) => {
    try {
      setIsMinting(true);
      setError(null);

      // Step 2: Complete mint
      const response = await fetch(`${API_BASE_URL}/api/mint/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: paymentId
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      // Handle successful mint - check if it's single or batch
      let mintedNFTs: MintedNFT[] = [];

      if (result.results && Array.isArray(result.results)) {
        // Batch mint result
        mintedNFTs = result.results
          .filter((r: any) => r.success)
          .map((r: any, index: number) => ({
            tokenId: r.tokenId,
            serialNumber: r.serialNumber,
            metadata: {
              name: `${currentTier.name} #${r.metadataTokenId || index + 1}`,
              image: '',
              attributes: [
                { trait_type: 'Tier', value: selectedTier },
                { trait_type: 'ODIN Allocation', value: r.odinAllocation?.toString() || currentTier.odinAllocation.toString() }
              ]
            }
          }));
      } else {
        // Single mint result
        const metadataTokenId = result.metadataTokenId || result.serialNumber;

        try {
          const metadataUrl = `${METADATA_BASE_URL}/${metadataTokenId}.json`;
          const metadataResponse = await fetch(metadataUrl);
          const actualMetadata = await metadataResponse.json();

          mintedNFTs.push({
            tokenId: result.tokenId,
            serialNumber: result.serialNumber,
            metadata: actualMetadata
          });
        } catch (error) {
          console.error('Failed to fetch metadata:', error);
          mintedNFTs.push({
            tokenId: result.tokenId,
            serialNumber: result.serialNumber,
            metadata: {
              name: `${currentTier.name} #${result.metadataTokenId || result.serialNumber}`,
              image: '',
              attributes: [
                { trait_type: 'Tier', value: selectedTier },
                { trait_type: 'ODIN Allocation', value: result.odinAllocation?.toString() || currentTier.odinAllocation.toString() }
              ]
            }
          });
        }
      }

      setMintedNFTs(mintedNFTs);
      setMintSuccess(true);

      // Refresh supply and balance
      await fetchSupply();
      await refreshBalance();

      console.log(`✅ Minted ${mintedNFTs.length} NFTs successfully!`);

    } catch (error: any) {
      console.error('Complete mint error:', error);
      setError(error.message);
    } finally {
      setIsMinting(false);
    }
  };


  // Simulate fetching minted NFTs (replace with actual implementation)
  const simulateFetchMintedNFTs = async (mintQuantity: number) => {
    // This is a simulation - replace with actual NFT metadata fetching
    const mockNFTs: MintedNFT[] = Array.from({ length: mintQuantity }, (_, i) => ({
      tokenId: CONTRACT_ID,
      serialNumber: totalMinted + i + 1,
      metadata: {
        name: `${currentTier.name} #${totalMinted + i + 1}`,
        image: `https://via.placeholder.com/400x400/333/fff?text=${currentTier.name}+${totalMinted + i + 1}`,
        attributes: [
          { trait_type: 'Tier', value: selectedTier },
          { trait_type: 'Class', value: 'Warrior' },
          { trait_type: 'Rarity', value: selectedTier === 'common' ? 'Common' : selectedTier === 'rare' ? 'Rare' : 'Legendary' }
        ]
      }
    }));

    setMintedNFTs(mockNFTs);
  };

  // Download NFT Image
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
      console.error('Download failed:', err);
      setError('Failed to download NFT');
    } finally {
      setDownloadingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${nft.tokenId}-${nft.serialNumber}`);
        return newSet;
      });
    }
  };

  // Quantity Controls
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

  // Calculate costs
  const mintCost = currentTier.price * quantity;
  const estimatedGas = 0.005; // Estimated gas in HBAR
  const totalCost = mintCost + estimatedGas;

  return (
    <>
      <Helmet>
        <title>Odin - The Nine Realms | Mint Your Viking NFT</title>
        <meta name="description" content="Mint your exclusive Norse mythology NFT on the Hedera network. Join The Nine Realms and own a piece of Viking legend." />
        <meta property="og:title" content="Odin - The Nine Realms | Mint Your Viking NFT" />
        <meta property="og:description" content="Mint your exclusive Norse mythology NFT on the Hedera network. Join The Nine Realms and own a piece of Viking legend." />
        <meta property="og:image" content="https://theninerealms.world/images/og-mint-image.jpg" />
        <meta property="og:url" content="https://theninerealms.world/mint" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Odin - The Nine Realms | Mint Your Viking NFT" />
        <meta name="twitter:description" content="Mint your exclusive Norse mythology NFT on the Hedera network. Join The Nine Realms and own a piece of Viking legend." />
        <meta name="twitter:image" content="https://theninerealms.world/images/twitter-mint-image.jpg" />
        <meta name="twitter:site" content="@HBARbarianToken" />
        <meta name="twitter:creator" content="@HBARbarianToken" />
      </Helmet>

      <main className="min-h-screen bg-[#0a0a0a] text-white" style={{ fontFamily: "'Norse', sans-serif" }}>
        {/* Hero Section with Odin Background */}
        <section className="relative pt-20 pb-20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-amber-900/20 via-transparent to-transparent" />

          {/* Golden Glow Effect */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-amber-500/10 rounded-full blur-[120px]" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            {/* Header */}
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


            {/* Loading State Overlay */}
            {isLoadingTiers && !supplyData && (
              <div className="max-w-4xl mx-auto mb-12">
                <div className="bg-gradient-to-br from-blue-900/20 to-transparent border border-blue-500/30 rounded-2xl p-6 backdrop-blur-sm">
                  <div className="flex items-center justify-center space-x-3">
                    <div className="animate-spin h-8 w-8 border-4 border-blue-400 rounded-full border-t-transparent"></div>
                    <span className="text-blue-300 text-lg font-semibold">Loading tier data from blockchain...</span>
                  </div>
                </div>
              </div>
            )}

            {/* Supply Counter */}
            <div className="grid md:grid-cols-3 gap-6 mb-16 max-w-4xl mx-auto">
              <div className="bg-gradient-to-br from-amber-900/20 to-transparent border border-amber-500/30 rounded-2xl p-6 text-center backdrop-blur-sm">
                <div className="text-4xl font-bold text-amber-400 mb-2">
                  {supplyData ? totalMinted.toLocaleString() : '...'}
                </div>
                <div className="text-sm text-gray-400 uppercase tracking-wider">Minted</div>
              </div>
              <div className="bg-gradient-to-br from-amber-900/20 to-transparent border border-amber-500/30 rounded-2xl p-6 text-center backdrop-blur-sm">
                <div className="text-4xl font-bold text-amber-400 mb-2">
                  {supplyData ? remainingSupply.toLocaleString() : '...'}
                </div>
                <div className="text-sm text-gray-400 uppercase tracking-wider">Remaining</div>
              </div>
              <div className="bg-gradient-to-br from-amber-900/20 to-transparent border border-amber-500/30 rounded-2xl p-6 text-center backdrop-blur-sm">
                <div className="text-4xl font-bold text-amber-400 mb-2">{totalSupply.toLocaleString()}</div>
                <div className="text-sm text-gray-400 uppercase tracking-wider">Total Supply</div>
              </div>
            </div>
            {/* Ultra-Rare 1/1 Announcement */}
            <div className="max-w-4xl mx-auto mb-12 px-4">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-900/40 via-black/60 to-amber-900/40 backdrop-blur-sm border-2 border-amber-500/50 p-6 md:p-8 shadow-2xl">
                {/* Decorative corner accents */}
                <div className="absolute top-0 left-0 w-20 h-20 border-t-2 border-l-2 border-amber-400/60 rounded-tl-2xl"></div>
                <div className="absolute bottom-0 right-0 w-20 h-20 border-b-2 border-r-2 border-amber-400/60 rounded-br-2xl"></div>

                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-amber-500/10 to-purple-500/10 animate-pulse"></div>

                <div className="relative z-10">
                  {/* Header with icon - CENTERED ON MOBILE */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
                    <Crown className="w-7 h-7 sm:w-8 sm:h-8 text-amber-400 animate-pulse" />
                    <h3 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-amber-300 text-center">
                      Ultra-Rare 1/1 Masterpieces
                    </h3>
                    <Crown className="w-7 h-7 sm:w-8 sm:h-8 text-amber-400 animate-pulse" />
                  </div>

                  {/* Divider */}
                  <div className="w-24 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent mx-auto mb-6"></div>

                  {/* Content */}
                  <div className="space-y-4 text-gray-200">
                    <p className="text-base sm:text-lg leading-relaxed text-center">
                      Alongside the Genesis mint, the collection contains{' '}
                      <span className="text-amber-400 font-bold">twelve ultra-rare 1/1 NFTs</span>,
                      each with its own unique artwork and lore.
                    </p>

                    <p className="text-sm sm:text-base leading-relaxed text-center text-gray-300">
                      These will <span className="text-amber-300 font-semibold">not be minted publicly</span>.
                      Instead, they will be awarded through high-impact community activations, exclusive giveaways,
                      auctions, and special collaborations.
                    </p>

                    <p className="text-sm sm:text-base leading-relaxed text-center text-gray-300">
                      Their scarcity—and the utility tied to them—makes these some of the{' '}
                      <span className="text-amber-400 font-bold">most coveted pieces</span> in the entire Odin universe.
                    </p>
                  </div>

                  {/* Badge - CENTERED ON MOBILE */}
                  <div className="mt-6 flex justify-center">
                    <div className="inline-flex flex-col sm:flex-row items-center gap-2 px-4 sm:px-6 py-3 bg-gradient-to-r from-purple-600/30 to-amber-600/30 border border-amber-400/50 rounded-full text-center">
                      <Info className="w-5 h-5 text-amber-400" />
                      <span className="text-xs sm:text-sm font-semibold text-amber-300">
                        12 Legendary 1/1 Editions • Distribution via Special Events
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Wallet Connection */}
            {!wallet.isConnected ? (
              <div className="max-w-md mx-auto mb-16">
                <div className="bg-gradient-to-br from-amber-900/20 to-transparent border border-amber-500/30 rounded-3xl p-8 backdrop-blur-sm">
                  <h3 className="text-2xl font-bold text-center mb-6 text-amber-400">Connect Your Wallet</h3>
                  <button
                    onClick={connectWalletConnect}
                    disabled={connecting || isLoadingTiers}
                    className={`w-full group relative overflow-hidden rounded-xl p-6 transition-all duration-300 transform ${connecting || isLoadingTiers
                      ? 'opacity-50 cursor-not-allowed bg-gradient-to-r from-amber-800 to-amber-900'
                      : 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 hover:scale-105'
                      }`}
                  >
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative flex items-center justify-center space-x-3">
                      <Wallet className="w-6 h-6" />
                      <div className="text-left">
                        <div className="font-bold text-lg">WalletConnect</div>
                        <div className="text-sm opacity-80">
                          {isLoadingTiers
                            ? 'Loading system data...'
                            : connecting
                              ? 'Connecting...'
                              : 'Connect with any Hedera wallet'
                          }
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Optional: Show loading indicator */}
                  {isLoadingTiers && (
                    <div className="mt-4 text-center">
                      <div className="inline-flex items-center space-x-2 text-blue-300 text-sm">
                        <div className="animate-spin h-4 w-4 border-2 border-blue-400 rounded-full border-t-transparent"></div>
                        <span>Loading system data...</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto mb-12">
                <div className="relative overflow-hidden bg-gradient-to-br from-green-900/10 via-transparent to-transparent border-2 border-green-500/40 rounded-2xl backdrop-blur-md">
                  {/* Subtle glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-transparent" />

                  <div className="relative p-6 md:p-8">
                    <div className="grid md:grid-cols-3 gap-6 items-center">

                      {/* Left: Connection Status */}
                      <div className="flex items-center justify-center md:justify-start space-x-4">
                        <div className="relative">
                          <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center border-2 border-green-500/50">
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                          </div>
                          {/* Pulse ring effect */}
                          <div className="absolute inset-0 w-12 h-12 bg-green-500/20 rounded-full animate-ping" />
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wider text-green-400 font-semibold mb-1">
                            Connected
                          </div>
                          <div className="font-mono text-base font-bold text-white">
                            {wallet.accountId?.substring(0, 4)}...{wallet.accountId?.substring(wallet.accountId.length - 6)}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            via WalletConnect
                          </div>
                        </div>
                      </div>


                      {/* Loading State Overlay */}
                      {isLoadingTiers && !supplyData && (
                        <div className="max-w-4xl mx-auto mb-12">
                          <div className="bg-gradient-to-br from-blue-900/20 to-transparent border border-blue-500/30 rounded-2xl p-6 backdrop-blur-sm">
                            <div className="flex items-center justify-center space-x-3">
                              <div className="animate-spin h-8 w-8 border-4 border-blue-400 rounded-full border-t-transparent"></div>
                              <span className="text-blue-300 text-lg font-semibold">Loading tier data from blockchain...</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Center: Balance Display */}
                      <div className="text-center md:border-l md:border-r border-green-500/20 py-4 md:py-0">
                        <div className="text-xs uppercase tracking-wider text-gray-400 mb-2 font-semibold">
                          Wallet Balance
                        </div>
                        <div className="flex items-center justify-center space-x-2">
                          <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 bg-clip-text text-transparent">
                            {wallet.balance.toFixed(2)}
                          </div>
                          <div className="text-lg text-amber-400/80 font-bold">
                            HBAR
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          ≈ ${(wallet.balance * 0.07).toFixed(2)} USD
                        </div>
                      </div>

                      {/* Right: Disconnect Button */}
                      <div className="flex justify-center md:justify-end">
                        <button
                          onClick={disconnectWallet}
                          className="group relative overflow-hidden px-6 py-3 bg-gradient-to-br from-red-600/20 to-red-700/10 hover:from-red-600/30 hover:to-red-700/20 border border-red-500/40 hover:border-red-500/60 rounded-xl transition-all duration-300 transform hover:scale-105"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-500/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                          <div className="relative flex items-center space-x-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span className="font-bold text-red-400 group-hover:text-red-300 transition-colors">
                              Disconnect
                            </span>
                          </div>
                        </button>
                      </div>

                    </div>
                  </div>

                  {/* Bottom accent line */}
                  <div className="h-1 bg-gradient-to-r from-transparent via-green-500/50 to-transparent" />
                </div>
              </div>
            )}

            <ClaimAirdropSection
              walletAccountId={wallet.accountId}
              apiBaseUrl={API_BASE_URL}
              isTokenAssociated={isTokenAssociated}  // ✅ ADD THIS
              onClaimSuccess={() => {
                fetchSupply();
                refreshBalance();
              }}
            />

            {/* Main Minting Interface */}
            <div className="max-w-6xl mx-auto">
              {error && !error.toLowerCase().includes('reject') && !error.toLowerCase().includes('cancel') && !error.toLowerCase().includes('denied') && (
                <div className="mb-8 p-4 bg-red-900/20 border border-red-500/50 rounded-xl text-red-400 text-center">
                  {error}
                </div>
              )}
              {wallet.isConnected && !isTokenAssociated && (
                <div className="max-w-4xl mx-auto mb-12 p-8 bg-yellow-900/20 border-2 border-yellow-500 rounded-2xl">
                  <h3 className="text-2xl font-bold text-yellow-400 mb-4">⚠️ Token Association Required</h3>
                  <p className="text-gray-300 mb-4">Token ID: <strong className="text-white">{CONTRACT_ID}</strong></p>
                  <div className="flex flex-col sm:flex-row gap-3 items-center">
                    <button
                      onClick={handleCopyTokenId}
                      className="relative px-6 py-3 bg-yellow-600 rounded-lg hover:bg-yellow-500 transition-colors font-medium"
                    >
                      {copySuccess ? (
                        <span className="flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Copied!
                        </span>
                      ) : (
                        'Copy Token ID'
                      )}
                    </button>
                  </div>
                  <p className="text-sm text-gray-400 mt-4">
                    Associate this token in your wallet (HashPack) before minting, then click refresh
                  </p>
                </div>
              )}
              {/* Tier Selection */}
              <div className="grid md:grid-cols-3 gap-6 mb-12">
                {Object.keys(TIER_DEFINITIONS).map((key) => {
                  const tier = tiers[key] || {
                    name: TIER_DEFINITIONS[key].name,
                    price: TIER_DEFINITIONS[key].price,
                    odinAllocation: TIER_DEFINITIONS[key].odinAllocation,
                    available: 0,
                    icon: TIER_ICONS[key as keyof typeof TIER_ICONS],
                    benefits: TIER_DEFINITIONS[key].benefits,
                    color: TIER_DEFINITIONS[key].color
                  };

                  const Icon = tier.icon;
                  const isSelected = selectedTier === key;

                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedTier(key as any)}
                      className={`relative overflow-hidden rounded-2xl p-6 transition-all duration-300 transform ${isSelected
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
                        <div className="text-center mb-4">
                          <div className="text-2xl font-bold text-green-400">
                            ${dynamicPricing?.tiers[key as keyof typeof dynamicPricing.tiers]?.usdPrice || TIER_DEFINITIONS[key].price}
                          </div>
                          <div className="text-xl font-bold text-amber-400">
                            {dynamicPricing?.tiers[key as keyof typeof dynamicPricing.tiers]?.hbarPrice?.toLocaleString() || '...'} HBAR
                          </div>
                        </div>



                        <div className="space-y-2 mb-4">
                          <div className="flex items-center justify-between text-base">
                            <span className="text-gray-300">$ODIN Allocation</span>
                            <span className="font-bold text-amber-400 text-lg">{tier.odinAllocation.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between text-base">
                            <span className="text-gray-300">Available</span>
                            <span className="font-bold text-lg">{supplyData ? supplyData[key as keyof typeof supplyData]?.available || 0 : '...'}</span>
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

              {/* Quantity Selector & Mint Button */}
              <div id="mint-section" className="bg-gradient-to-br from-amber-900/10 to-transparent border border-amber-500/30 rounded-3xl p-8 backdrop-blur-sm">
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Left: Quantity */}
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

                  {/* Right: Cost Breakdown */}
                  <div>

                    <div className="space-y-4 mb-6">
                      <div className="flex justify-between items-center pb-3 border-b border-white/10">
                        <span className="text-gray-300">{quantity} × {currentTier.name}</span>
                        <div className="text-right">
                          <div className="font-bold text-lg">{(currentTier.price * quantity).toLocaleString()} HBAR</div>
                          <div className="text-sm text-green-400">${((currentTier.usdPrice || 0) * quantity).toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pb-3 border-b border-white/10">
                        <span className="text-gray-300">Network Fee (est.)</span>
                        <span className="font-bold">{estimatedGas} HBAR</span>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-xl font-bold">Total Cost</span>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-amber-400">
                            {(currentTier.price * quantity + estimatedGas).toLocaleString()} HBAR
                          </div>
                          <div className="text-lg text-green-400">
                            ${((currentTier.usdPrice || 0) * quantity).toLocaleString()} USD
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Updated Mint Button */}
                    {/* Updated Mint Button */}
                    <button
                      onClick={() => {
                        const tier = getCurrentTier();
                        // This check is now redundant but keep for safety
                        if (tier.price === 0) {
                          setError('Tier data is not loaded yet. Please wait...');
                          return;
                        }
                        initiateMint(selectedTier, quantity);
                      }}
                      disabled={!wallet.isConnected || isMinting || isLoadingTiers || !supplyData}
                      className="w-full py-6 rounded-xl font-bold text-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 disabled:scale-100 shadow-lg hover:shadow-amber-500/50"
                    >
                      {isMinting ? (
                        <span className="flex items-center justify-center">
                          <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Minting {quantity} Hero{quantity > 1 ? 'es' : ''}...
                        </span>
                      ) : !wallet.isConnected ? (
                        'Connect Wallet to Mint'
                      ) : isLoadingTiers ? (
                        'Loading Tier Data...'
                      ) : !supplyData ? (
                        'Loading Supply...'
                      ) : (
                        `⚔️ MINT ${quantity} ${quantity > 1 ? 'HEROES' : 'HERO'} ⚔️`
                      )}
                    </button>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mt-6 p-4 bg-red-900/20 border border-red-500/50 rounded-xl text-red-400 text-center">
                    {error}
                  </div>
                )}
              </div>

              {/* Success & Minted NFTs Display */}
              {/* Simple Success Message */}
              {mintSuccess && (
                <div className="mt-8">
                  <div className="bg-gradient-to-r from-green-500/10 via-green-500/5 to-transparent border-l-4 border-green-500 rounded-r-lg p-6">
                    <div className="flex items-center gap-4">
                      <div className="bg-green-500/20 p-3 rounded-full">
                        <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-xl font-bold text-green-400 mb-1">
                          NFT{mintedNFTs.length > 1 ? 's' : ''} Minted Successfully!
                        </h4>
                        <p className="text-gray-300">
                          Your {currentTier.name} NFT{mintedNFTs.length > 1 ? 's have' : ' has'} been transferred to your wallet.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {paymentStatus && (
                <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-xl text-center">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin h-4 w-4 border-2 border-blue-400 rounded-full border-t-transparent"></div>
                    <span className="text-blue-300">{paymentStatus}</span>
                  </div>
                </div>
              )}

              {/* Benefits Section */}
              <div className="mt-16 grid md:grid-cols-3 gap-6">
                {Object.entries(TIER_DEFINITIONS).map(([key, tierDef]) => {
                  const Icon = TIER_ICONS[key as keyof typeof TIER_ICONS];
                  const colorClass = key === 'common' ? 'text-amber-400' : key === 'rare' ? 'text-blue-400' : 'text-amber-300';
                  const borderClass = key === 'common' ? 'border-amber-500/30' : key === 'rare' ? 'border-blue-500/30' : 'border-amber-400/50';
                  const bgClass = key === 'common' ? 'from-amber-900/20' : key === 'rare' ? 'from-blue-900/20' : 'from-amber-600/20';

                  return (
                    <div key={key} className={`bg-gradient-to-br ${bgClass} to-transparent border ${borderClass} rounded-2xl p-6 backdrop-blur-sm`}>
                      <div className={`${colorClass} mb-4`}>
                        <Icon className="w-12 h-12" />
                      </div>
                      <h4 className="text-2xl font-bold mb-3">{tierDef.name} Holders</h4>
                      <ul className="space-y-3 text-lg text-gray-300">
                        {tierDef.benefits.map((benefit, i) => (
                          <li key={i} className="flex items-start">
                            <span className={`${colorClass} mr-3 text-xl`}>•</span>
                            <span className="text-lg leading-relaxed">{benefit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>

              {/* Royalties Info */}
              <div className="mt-12 bg-gradient-to-br from-purple-900/20 to-transparent border border-purple-500/30 rounded-2xl p-6 md:p-8 backdrop-blur-sm">
                <div className="flex items-center space-x-3 mb-4">
                  <Info className="w-6 h-6 md:w-8 md:h-8 text-purple-400 flex-shrink-0" />
                  <h4 className="text-xl md:text-2xl font-bold text-purple-400">Royalties & Distribution</h4>
                </div>

                <p className="text-gray-300 mb-6 text-base leading-relaxed">
                  8% royalty on all secondary sales
                </p>

              </div>

              {/* Important Information */}
              <div className="mt-8 bg-gradient-to-br from-red-900/20 to-transparent border border-red-500/30 rounded-2xl p-6 md:p-8 backdrop-blur-sm">
                <div className="flex items-center space-x-3 mb-6">
                  <Info className="w-8 h-8 text-red-400 flex-shrink-0" />
                  <h4 className="text-xl md:text-2xl font-bold text-red-400 leading-none">Important Information</h4>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <span className="text-red-400 text-xl flex-shrink-0 leading-none" style={{ marginTop: '0.15rem' }}>◆</span>
                    <span className="text-base leading-relaxed flex-1">
                      Each Odin is randomly generated with unique traits and attributes
                    </span>
                  </div>
                  <div className="flex items-start space-x-3">
                    <span className="text-red-400 text-xl flex-shrink-0 leading-none" style={{ marginTop: '0.15rem' }}>◆</span>
                    <span className="text-base leading-relaxed flex-1">
                      Your NFTs will appear in your wallet immediately after transaction confirmation
                      (Note: OdinCoin ($ODIN) will release later according to the official roadmap — it is not included with the NFT mint.)
                    </span>
                  </div>
                  <div className="flex items-start space-x-3">
                    <span className="text-red-400 text-xl flex-shrink-0 leading-none" style={{ marginTop: '0.15rem' }}>◆</span>
                    <span className="text-base leading-relaxed flex-1">
                      Network fees (gas) are required for all Hedera transactions – typically less than 1 HBAR
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
                      Maximum {maxPerTransaction} NFTs per transaction – you can mint multiple times
                    </span>
                  </div>
                  <div className="flex items-start space-x-3">
                    <span className="text-red-400 text-xl flex-shrink-0 leading-none" style={{ marginTop: '0.15rem' }}>◆</span>
                    <span className="text-base leading-relaxed flex-1">
                      View your NFTs on Sentx, Kabila, or directly inside your HashPack wallet after minting
                    </span>
                  </div>
                </div>
              </div>

              {/* Contract & Collection Links */}
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <a
                  href={`https://hashscan.io/${NETWORK}/token/${CONTRACT_ID}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-xl transition-colors"
                >
                  <ExternalLink className="w-5 h-5" />
                  <span>View Smart Contract</span>
                </a>

                <a
                  href={SENTX_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-xl transition-colors"
                >
                  <ExternalLink className="w-5 h-5" />
                  <span>View on Sentx</span>
                </a>

                <a
                  href={KABILA_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-xl transition-colors"
                >
                  <ExternalLink className="w-5 h-5" />
                  <span>View on Kabila</span>
                </a>
              </div>
            </div>


          </div>
        </section>

      </main>
    </>
  );
};

export default Mint;
