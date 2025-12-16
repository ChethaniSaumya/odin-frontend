const NETWORK = process.env.REACT_APP_HEDERA_NETWORK || 'testnet';
const MIRROR_NODE_URL = NETWORK === 'mainnet' 
  ? 'https://mainnet-public.mirrornode.hedera.com'
  : 'https://testnet.mirrornode.hedera.com';

export const mirrorNodeService = {
  async getAccountBalance(accountId: string): Promise<number> {
    try {
      const response = await fetch(`${MIRROR_NODE_URL}/api/v1/accounts/${accountId}`);
      const data = await response.json();
      return data.balance.balance / 100000000;
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      return 0;
    }
  },

  async getNFTMetadata(tokenId: string, serialNumber: number) {
    try {
      const response = await fetch(
        `${MIRROR_NODE_URL}/api/v1/tokens/${tokenId}/nfts/${serialNumber}`
      );
      const data = await response.json();
      
      const metadataBase64 = data.metadata;
      const metadataJson = atob(metadataBase64);
      const metadata = JSON.parse(metadataJson);
      
      if (metadata.image?.startsWith('ipfs://')) {
        const ipfsHash = metadata.image.replace('ipfs://', '');
        metadata.image = `https://ipfs.io/ipfs/${ipfsHash}`;
      }
      
      return {
        tokenId,
        serialNumber,
        metadata
      };
    } catch (error) {
      console.error('Failed to fetch NFT metadata:', error);
      throw error;
    }
  },

  async getAccountNFTs(accountId: string, tokenId: string) {
    try {
      const response = await fetch(
        `${MIRROR_NODE_URL}/api/v1/accounts/${accountId}/nfts?token.id=${tokenId}`
      );
      const data = await response.json();
      return data.nfts || [];
    } catch (error) {
      console.error('Failed to fetch account NFTs:', error);
      return [];
    }
  }
};

export default mirrorNodeService;