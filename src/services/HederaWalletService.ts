import { LedgerId, TransferTransaction } from '@hashgraph/sdk';

const HederaWalletConnect = require('@hashgraph/hedera-wallet-connect');

interface WalletMetadata {
  name: string;
  description: string;
  url: string;
  icons: string[];
}

interface AccountInfo {
  session: any;
  accountId: string;
}

export class HederaWalletService {
  private dAppConnector: any = null;
  private session: any = null;
  private accountId: string | null = null;

  async initialize(projectId: string, metadata: WalletMetadata): Promise<void> {
    try {
      const { DAppConnector } = HederaWalletConnect;
      
      this.dAppConnector = new DAppConnector(
        metadata,
        LedgerId.TESTNET,
        projectId
      );

      await this.dAppConnector.init({ logger: 'error' });
    } catch (error) {
      console.error('Initialization error:', error);
      throw error;
    }
  }

  async connect(): Promise<AccountInfo> {
    if (!this.dAppConnector) {
      throw new Error('DApp connector not initialized');
    }

    try {
      const session = await this.dAppConnector.openModal();
      this.session = session;
      
      const accountInfo = session.namespaces?.hedera?.accounts?.[0];
      if (accountInfo) {
        this.accountId = accountInfo.split(':').pop() || null;
      }

      if (!this.accountId) {
        throw new Error('Failed to get account ID from session');
      }

      return {
        session,
        accountId: this.accountId
      };
    } catch (error) {
      console.error('Connection error:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.session && this.dAppConnector) {
      await this.dAppConnector.disconnectAll();
      this.session = null;
      this.accountId = null;
    }
  }

  async getAccountBalance(): Promise<number> {
    if (!this.accountId || !this.dAppConnector || !this.session) {
      throw new Error('No account connected');
    }

    try {
      const signer = this.dAppConnector.signers?.[0];
      if (!signer) {
        throw new Error('No signer available');
      }

      const balance = await signer.getAccountBalance();
      return balance.hbars.toTinybars().toNumber();
    } catch (error) {
      console.error('Balance fetch error:', error);
      throw error;
    }
  }

  async sendTransaction(toAccountId: string, amount: number): Promise<any> {
    if (!this.accountId || !this.dAppConnector || !this.session) {
      throw new Error('No account connected');
    }

    try {
      const signer = this.dAppConnector.signers?.[0];
      if (!signer) {
        throw new Error('No signer available');
      }

      const transaction = new TransferTransaction()
        .addHbarTransfer(this.accountId, -amount)
        .addHbarTransfer(toAccountId, amount)
        .setTransactionMemo('Hedera Wallet Connect Transfer');

      await transaction.freezeWithSigner(signer);
      const txResponse = await transaction.executeWithSigner(signer);
      const receipt = await txResponse.getReceiptWithSigner(signer);

      return {
        transactionId: txResponse.transactionId.toString(),
        status: receipt.status.toString()
      };
    } catch (error) {
      console.error('Transaction error:', error);
      throw error;
    }
  }

  getAccountId(): string | null {
    return this.accountId;
  }

  isConnected(): boolean {
    return this.session !== null && this.accountId !== null;
  }
}

export default new HederaWalletService();