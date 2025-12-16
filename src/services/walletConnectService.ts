import SignClient from '@walletconnect/sign-client';
import { WalletConnectModal } from '@walletconnect/modal';
import type { SessionTypes } from '@walletconnect/types';

class WalletConnectService {
  private signClient: InstanceType<typeof SignClient> | null = null;
  private modal: WalletConnectModal | null = null;
  private session: SessionTypes.Struct | null = null;
  private accountId: string = '';

  async init(projectId: string): Promise<void> {
    try {
      // Initialize SignClient
      this.signClient = await SignClient.init({
        projectId,
        metadata: {
          name: 'HBARBARIAN NFT',
          description: 'Mint your Odin Genesis NFT',
          url: window.location.origin,
          icons: ['https://www.hashgraph.com/favicon.ico']
        }
      });

      // Initialize Modal
      this.modal = new WalletConnectModal({
        projectId,
        chains: ['hedera:testnet'],
        themeMode: 'dark',
        themeVariables: {
          '--wcm-z-index': '9999'
        }
      });

      // Listen for session events
      this.signClient.on('session_event', (event: any) => {
        console.log('Session event:', event);
      });

      this.signClient.on('session_update', ({ topic, params }: { topic: string; params: any }) => {
        console.log('Session updated:', topic, params);
        const session = this.signClient?.session.get(topic);
        if (session) {
          this.session = session;
        }
      });

      this.signClient.on('session_delete', () => {
        console.log('Session deleted');
        this.reset();
      });

    } catch (error) {
      console.error('WalletConnect init error:', error);
      throw error;
    }
  }

  async connect(): Promise<string> {
    if (!this.signClient || !this.modal) {
      throw new Error('WalletConnect not initialized');
    }

    try {
      // Check for existing sessions
      const sessions = this.signClient.session.getAll();
      const lastSession = sessions[sessions.length - 1];

      if (lastSession) {
        this.session = lastSession;
        const hederaAccount = lastSession.namespaces.hedera?.accounts[0];
        if (hederaAccount) {
          this.accountId = hederaAccount.split(':')[2];
          return this.accountId;
        }
      }

      // Create new connection
      const { uri, approval } = await this.signClient.connect({
        requiredNamespaces: {
          hedera: {
            methods: [
              'hedera_getAccountInfo',
              'hedera_signTransaction',
              'hedera_executeTransaction'
            ],
            chains: ['hedera:testnet'],
            events: ['chainChanged', 'accountsChanged']
          }
        }
      });

      if (uri) {
        // Open modal with QR code
        await this.modal.openModal({ uri });
        
        // Wait for session approval
        const session = await approval();
        this.session = session;

        // Close modal
        this.modal.closeModal();

        // Get account ID
        const hederaAccount = session.namespaces.hedera?.accounts[0];
        if (hederaAccount) {
          this.accountId = hederaAccount.split(':')[2];
          return this.accountId;
        }

        throw new Error('No Hedera account found in session');
      }

      throw new Error('Failed to generate connection URI');

    } catch (error) {
      this.modal?.closeModal();
      console.error('Connection error:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.signClient && this.session) {
      try {
        await this.signClient.disconnect({
          topic: this.session.topic,
          reason: {
            code: 6000,
            message: 'User disconnected'
          }
        });
      } catch (error) {
        console.error('Disconnect error:', error);
      }
    }
    this.reset();
  }

  private reset(): void {
    this.session = null;
    this.accountId = '';
  }

  getAccountId(): string | null {
    return this.accountId || null;
  }

  isConnected(): boolean {
    return !!this.session && !!this.accountId;
  }

  getSession(): SessionTypes.Struct | null {
    return this.session;
  }
}

const walletConnectService = new WalletConnectService();
export default walletConnectService;