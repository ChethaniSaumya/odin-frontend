import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiService = {
  async getSupply() {
    const response = await api.get('/supply');
    return response.data;
  },

  async getTierStats() {
    const response = await api.get('/tiers/stats');
    return response.data;
  },

  async calculateCost(tier: string, quantity: number) {
    const response = await api.post('/calculate-cost', { tier, quantity });
    return response.data;
  },

  async mintNFT(userAccountId: string, quantity: number = 1, tokenId?: number) {
    const response = await api.post('/mint', {
      userAccountId,
      quantity,
      tokenId
    });
    return response.data;
  },

  async getTierForToken(tokenId: number) {
    const response = await api.get(`/tiers/${tokenId}`);
    return response.data;
  },
};

export default apiService;