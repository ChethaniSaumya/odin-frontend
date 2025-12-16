import React, { useState, useEffect } from 'react';
import { LedgerId, TransferTransaction, AccountBalanceQuery, Client } from '@hashgraph/sdk';

// Since DAppConnector import is failing, we'll use direct imports
const HederaWalletConnect = require('@hashgraph/hedera-wallet-connect');

// Types
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

// Hedera Wallet Service Class
class HederaWalletService {
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
      try {
        await this.dAppConnector.disconnectAll();
      } catch (error) {
        console.error('Disconnect error:', error);
      }
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

// Create singleton instance
const hederaWalletService = new HederaWalletService();

// Main Component
const WalletConnect: React.FC = () => {
  const [connected, setConnected] = useState<boolean>(false);
  const [accountId, setAccountId] = useState<string>('');
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [recipient, setRecipient] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [txStatus, setTxStatus] = useState<string>('');

  useEffect(() => {
    initializeWallet();
  }, []);

  const initializeWallet = async (): Promise<void> => {
    const metadata: WalletMetadata = {
      name: 'Hedera DApp',
      description: 'My Hedera Wallet Connect DApp',
      url: window.location.origin,
      icons: ['https://www.hashgraph.com/favicon.ico']
    };

    try {
      const projectId = process.env.REACT_APP_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';
      await hederaWalletService.initialize(projectId, metadata);
    } catch (err) {
      console.error('Initialization error:', err);
      setError('Failed to initialize wallet connector');
    }
  };

  const handleConnect = async (): Promise<void> => {
    try {
      setLoading(true);
      setError('');
      const { accountId: connectedAccountId } = await hederaWalletService.connect();
      setAccountId(connectedAccountId);
      setConnected(true);
      await fetchBalance();
    } catch (err: any) {
      console.error('Connection failed:', err);
      setError(err.message || 'Failed to connect wallet. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (): Promise<void> => {
    try {
      await hederaWalletService.disconnect();
      setConnected(false);
      setAccountId('');
      setBalance(null);
      setError('');
      setTxStatus('');
    } catch (err) {
      console.error('Disconnect failed:', err);
      setError('Failed to disconnect wallet');
    }
  };

  const fetchBalance = async (): Promise<void> => {
    try {
      const balanceInTinybars = await hederaWalletService.getAccountBalance();
      setBalance(balanceInTinybars / 100000000);
    } catch (err) {
      console.error('Failed to fetch balance:', err);
      setError('Failed to fetch balance');
    }
  };

  const handleSendTransaction = async (): Promise<void> => {
    if (!recipient || !amount) {
      setError('Please enter recipient and amount');
      return;
    }

    if (!/^0\.0\.\d+$/.test(recipient)) {
      setError('Invalid account ID format. Use 0.0.xxxxx');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setTxStatus('Preparing transaction...');
      
      const amountInTinybars = Math.floor(amountNum * 100000000);
      
      setTxStatus('Waiting for signature...');
      const result = await hederaWalletService.sendTransaction(recipient, amountInTinybars);
      
      setTxStatus(`Success! Transaction ID: ${result.transactionId}`);
      
      setTimeout(() => fetchBalance(), 2000);
      
      setRecipient('');
      setAmount('');
    } catch (err: any) {
      console.error('Transaction failed:', err);
      setError(`Transaction failed: ${err.message || 'Unknown error'}`);
      setTxStatus('');
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    container: {
      padding: '20px',
      maxWidth: '600px',
      margin: '0 auto',
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#fafafa',
      minHeight: '100vh'
    },
    title: {
      color: '#333',
      marginBottom: '30px',
      fontSize: '32px',
      textAlign: 'center' as const,
      fontWeight: 'bold'
    },
    button: {
      padding: '12px 24px',
      fontSize: '16px',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'all 0.3s',
      fontWeight: 'bold'
    } as React.CSSProperties,
    connectButton: {
      backgroundColor: '#4CAF50',
      color: 'white',
      width: '100%'
    },
    disconnectButton: {
      backgroundColor: '#f44336',
      color: 'white',
      marginTop: '10px'
    },
    sendButton: {
      backgroundColor: '#2196F3',
      color: 'white',
      width: '100%',
      marginTop: '10px'
    },
    accountInfo: {
      marginBottom: '20px',
      padding: '20px',
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    },
    input: {
      width: '100%',
      padding: '12px',
      marginBottom: '10px',
      border: '2px solid #ddd',
      borderRadius: '6px',
      fontSize: '14px',
      boxSizing: 'border-box'
    } as React.CSSProperties,
    error: {
      color: '#f44336',
      padding: '12px',
      backgroundColor: '#ffebee',
      borderRadius: '6px',
      marginTop: '10px',
      marginBottom: '10px',
      fontSize: '14px',
      border: '1px solid #ffcdd2'
    },
    success: {
      color: '#4CAF50',
      padding: '12px',
      backgroundColor: '#e8f5e9',
      borderRadius: '6px',
      marginTop: '10px',
      marginBottom: '10px',
      fontSize: '14px',
      border: '1px solid #c8e6c9',
      wordBreak: 'break-all' as const
    },
    transactionSection: {
      marginTop: '30px',
      padding: '20px',
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>🔗 Hedera Wallet Connect</h1>

      {error && <div style={styles.error}>❌ {error}</div>}
      {txStatus && <div style={styles.success}>✅ {txStatus}</div>}

      {!connected ? (
        <button 
          onClick={handleConnect} 
          disabled={loading}
          style={{
            ...styles.button,
            ...styles.connectButton,
            opacity: loading ? 0.6 : 1,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '⏳ Connecting...' : '🔌 Connect Wallet'}
        </button>
      ) : (
        <div>
          <div style={styles.accountInfo}>
            <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#999', textTransform: 'uppercase' }}>
              Account ID
            </p>
            <p style={{ margin: '0 0 20px 0', fontSize: '18px', fontFamily: 'monospace', fontWeight: 'bold', color: '#333' }}>
              {accountId}
            </p>
            
            {balance !== null && (
              <>
                <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#999', textTransform: 'uppercase' }}>
                  Balance
                </p>
                <p style={{ margin: '0', fontSize: '32px', fontWeight: 'bold', color: '#4CAF50' }}>
                  {balance.toFixed(4)} ℏ
                </p>
              </>
            )}
            
            <button 
              onClick={handleDisconnect}
              style={{...styles.button, ...styles.disconnectButton}}
            >
              🔓 Disconnect
            </button>
          </div>

          <div style={styles.transactionSection}>
            <h3 style={{ marginTop: 0, color: '#333', marginBottom: '20px' }}>💸 Send HBAR</h3>
            <input
              type="text"
              placeholder="Recipient Account ID (e.g., 0.0.12345)"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              style={styles.input}
              disabled={loading}
            />
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Amount in HBAR (e.g., 1.5)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={styles.input}
              disabled={loading}
            />
            <button
              onClick={handleSendTransaction}
              disabled={loading || !recipient || !amount}
              style={{
                ...styles.button,
                ...styles.sendButton,
                opacity: (loading || !recipient || !amount) ? 0.6 : 1,
                cursor: (loading || !recipient || !amount) ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? '⏳ Processing...' : '✈️ Send Transaction'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletConnect;