import walletConnectService from './walletConnectService';

class HashPackService {
  private projectId: string = process.env.REACT_APP_WALLETCONNECT_PROJECT_ID || '';

  async init(): Promise<void> {
    if (!this.projectId) {
      console.warn('WalletConnect Project ID not found');
      return;
    }
    await walletConnectService.init(this.projectId);
  }

  async connectWallet(): Promise<string> {
    return await walletConnectService.connect();
  }

  async disconnectWallet(): Promise<void> {
    await walletConnectService.disconnect();
  }

  getAccountId(): string | null {
    return walletConnectService.getAccountId();
  }

  isConnected(): boolean {
    return walletConnectService.isConnected();
  }
}

const hashpackService = new HashPackService();
export default hashpackService;