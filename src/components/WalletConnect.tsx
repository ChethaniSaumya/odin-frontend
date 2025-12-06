import React, { useState, useEffect } from 'react';
import {
  LedgerId,
  TransferTransaction,
  AccountBalanceQuery,
  Client,
  Hbar,
  AccountId,
  PublicKey,
  HbarUnit
} from '@hashgraph/sdk';

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
  private signer: any = null;

  // Add this method to your HederaWalletService class
  getSigner(): any {
    return this.signer;
  }

  async initialize(projectId: string, metadata: WalletMetadata): Promise<void> {
    try {
      const { DAppConnector } = HederaWalletConnect;

      this.dAppConnector = new DAppConnector(
        metadata,
        LedgerId.TESTNET,
        projectId
      );

      await this.dAppConnector.init({
        logger: 'error',
        relayUrl: 'wss://relay.walletconnect.com'
      });

      // Check if there are existing signers after init
      console.log('ðŸ” Checking for existing signers after init...');
      if (this.dAppConnector.signers?.length > 0) {
        console.log('âœ… Found existing signers:', this.dAppConnector.signers.length);
        this.signer = this.dAppConnector.signers[0];

        // Try to get account from signer
        const signerAccountId = this.signer?.getAccountId?.()?.toString();
        if (signerAccountId) {
          this.accountId = signerAccountId;
          this.session = { restored: true }; // Mark as having a session
          console.log('âœ… Auto-restored session for:', this.accountId);
        }
      }
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
      console.log('ðŸ”„ Starting connection process...');

      // â­ SOLUTION 1: Clear any existing WalletConnect sessions first
      console.log('ðŸ§¹ Clearing existing WalletConnect sessions...');

      try {
        // Check if there are existing sessions
        const existingSessions = this.dAppConnector.getSessions?.();
        if (existingSessions && existingSessions.length > 0) {
          console.log(`Found ${existingSessions.length} existing session(s), disconnecting...`);
          await this.dAppConnector.disconnectAll();
          console.log('âœ… All existing sessions disconnected');

          // Wait for cleanup
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (disconnectError) {
        console.warn('âš ï¸ Could not disconnect existing sessions:', disconnectError);
        // Continue anyway
      }

      // Clear any cached session data
      try {
        // Clear local storage items that might cache old sessions
        if (typeof window !== 'undefined' && window.localStorage) {
          const keysToRemove: string[] = [];

          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('walletconnect') || key.includes('wc@2'))) {
              keysToRemove.push(key);
            }
          }

          keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            console.log(`ðŸ—‘ï¸ Removed localStorage key: ${key}`);
          });

          if (keysToRemove.length > 0) {
            console.log(`âœ… Cleared ${keysToRemove.length} localStorage keys`);
          }
        }
      } catch (storageError) {
        console.warn('âš ï¸ Could not clear localStorage:', storageError);
      }

      console.log('ðŸ”— Opening WalletConnect modal...');

      // Now open fresh modal
      const session = await this.dAppConnector.openModal();
      this.session = session;

      console.log('âœ… Session created:', {
        sessionId: session.topic,
        accounts: session.namespaces?.hedera?.accounts
      });

      // Get the signer from the session
      console.log('ðŸ” Getting signer...');
      this.signer = this.dAppConnector.signers?.[0];

      if (!this.signer) {
        console.error('âŒ No signer available after connection');
        console.log('Available signers:', this.dAppConnector.signers);
        throw new Error('No signer available after connection');
      }

      console.log('âœ… Signer obtained');

      const accountInfo = session.namespaces?.hedera?.accounts?.[0];
      if (accountInfo) {
        // Parse account ID correctly
        const parts = accountInfo.split(':');
        this.accountId = parts[parts.length - 1] || null;
        console.log(`âœ… Parsed Account ID: ${this.accountId}`);
      }

      if (!this.accountId) {
        console.error('âŒ Failed to get account ID from session');
        console.log('Session namespace:', session.namespaces?.hedera);
        throw new Error('Failed to get account ID from session');
      }

      // â­ ADDITIONAL: Debug signer information
      console.log('ðŸ”§ Signer Debug Info:', {
        accountId: this.accountId,
        signerType: this.signer?.constructor?.name,
        hasExecuteMethod: typeof this.signer?.execute === 'function',
        hasSignMethod: typeof this.signer?.sign === 'function',
        sessionTopic: session.topic
      });

      return {
        session,
        accountId: this.accountId
      };
    } catch (error) {
      console.error('âŒ Connection error:', error);
      throw new Error(`Connection failed: ${error instanceof Error ? error.message : String(error)}`);
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
      this.signer = null;
    }
  }

  async getAccountBalance(): Promise<number> {
    if (!this.accountId) throw new Error('No account connected');

    // Bypass the buggy WalletConnect balance query
    const client = Client.forTestnet();
    const query = new AccountBalanceQuery().setAccountId(this.accountId);
    const balance = await query.execute(client);
    return balance.hbars.toTinybars().toNumber();
  }

  async sendTransaction(toAccountId: string, amountInHbar: number): Promise<any> {
    if (!this.accountId || !this.signer) {
      throw new Error('No account connected or signer not available');
    }

    try {
      console.log(`ðŸ“¤ Creating transfer: ${amountInHbar} HBAR from ${this.accountId} to ${toAccountId}`);

      // Convert HBAR to tinybars for SDK
      const amountInTinybars = Math.floor(amountInHbar * 100000000);
      const amount = Hbar.fromTinybars(amountInTinybars);
      const negativeAmount = Hbar.fromTinybars(-amountInTinybars);

      console.log('ðŸ’° Amount objects:', {
        hbarAmount: amountInHbar,
        tinybarsEquivalent: amount.toTinybars().toString(),
        sending: amount.toString(),
        from: this.accountId,
        to: toAccountId
      });

      const transaction = new TransferTransaction()
        .addHbarTransfer(this.accountId, negativeAmount)
        .addHbarTransfer(toAccountId, amount)
        .setTransactionMemo('Odin Payment');

      console.log('Transaction created, executing with signer...');

      try {
        // Use the signer to execute the transaction
        const txResponse = await transaction.executeWithSigner(this.signer);

        console.log('â³ Waiting for receipt...');
        const receipt = await txResponse.getReceiptWithSigner(this.signer);

        console.log('âœ… Transaction complete:', txResponse.transactionId.toString());

        return {
          success: true,
          transactionId: txResponse.transactionId.toString(),
          status: receipt.status.toString()
        };
      } catch (executionError: any) {
        // â­ CATCH USER REJECTION SPECIFICALLY
        console.log('ðŸ”• User rejected transaction or execution failed silently');

        // Check for rejection patterns
        const errorMessage = executionError.message || '';
        const errorString = errorMessage.toLowerCase();

        // Common rejection messages from wallets
        const rejectionPatterns = [
          'reject', 'denied', 'cancelled', 'user denied',
          'user rejected', 'transaction declined', 'signature rejected',
          'request rejected', 'user cancelled', 'canceled by user'
        ];

        const isUserRejection = rejectionPatterns.some(pattern =>
          errorString.includes(pattern)
        );

        if (isUserRejection) {
          console.log('ðŸ‘¤ User intentionally rejected the transaction');
          // Return a special flag instead of throwing error
          return {
            success: false,
            userRejected: true,
            message: 'Transaction cancelled by user'
          };
        }

        // For other errors, still throw
        console.error('âŒ Transaction error:', executionError);
        throw new Error(`Transaction failed: ${executionError.message}`);
      }
    } catch (error: any) {
      console.error('âŒ Transaction error:', error);
      throw new Error(`Transaction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async sendHBAR(toAccountId: string, amountInHbar: number): Promise<any> {
    if (!this.accountId || !this.session) {
      throw new Error('No account connected');
    }

    try {
      // Ensure amount is a valid HBAR amount
      const amountNum = Number(amountInHbar);

      if (!amountNum || amountNum <= 0) {
        throw new Error(`Invalid amount: ${amountInHbar}. Must be a positive number.`);
      }

      console.log(`ðŸ’° Preparing to send ${amountNum} HBAR to ${toAccountId}`);

      // Call sendTransaction with HBAR amount
      const result = await this.sendTransaction(toAccountId, amountNum);

      // â­ CHECK FOR USER REJECTION
      if (result.userRejected) {
        console.log('ðŸ”• Payment cancelled by user');
        return {
          success: false,
          userRejected: true,
          message: 'Payment cancelled'
        };
      }

      console.log('âœ… Payment successful:', result);

      return {
        success: true,
        transactionId: result.transactionId,
        status: result.status
      };

    } catch (error: any) {
      console.error('âŒ Payment error:', error);
      throw new Error(`Payment failed: ${error.message}`);
    }
  }

  getAccountId(): string | null {
    return this.accountId;
  }

  isConnected(): boolean {
    // First check in-memory state
    if (this.session !== null && this.accountId !== null) {
      return true;
    }

    // Then check if dAppConnector has active sessions
    try {
      const sessions = this.dAppConnector?.walletConnectClient?.session?.getAll() || [];
      console.log('ðŸ” Active WalletConnect sessions:', sessions.length);
      return sessions.length > 0;
    } catch (error) {
      console.error('Error checking connection:', error);
      return false;
    }
  }

  async restoreSession(): Promise<boolean> {
    try {
      console.log('ðŸ”„ Attempting to restore session...');

      if (!this.dAppConnector) {
        console.log('âŒ dAppConnector not initialized');
        return false;
      }

      // Try multiple ways to get sessions
      let sessions: any[] = [];

      // Method 1: Try walletConnectClient
      try {
        sessions = this.dAppConnector.walletConnectClient?.session?.getAll() || [];
        console.log('ðŸ“‹ Method 1 - walletConnectClient sessions:', sessions.length);
      } catch (e) {
        console.log('âš ï¸ Method 1 failed:', e);
      }

      // Method 2: Try signClient
      if (sessions.length === 0) {
        try {
          sessions = this.dAppConnector.signClient?.session?.getAll() || [];
          console.log('ðŸ“‹ Method 2 - signClient sessions:', sessions.length);
        } catch (e) {
          console.log('âš ï¸ Method 2 failed:', e);
        }
      }

      // Method 3: Try getSessions method
      if (sessions.length === 0) {
        try {
          sessions = this.dAppConnector.getSessions?.() || [];
          console.log('ðŸ“‹ Method 3 - getSessions:', sessions.length);
        } catch (e) {
          console.log('âš ï¸ Method 3 failed:', e);
        }
      }

      // Method 4: Check signers directly
      if (sessions.length === 0 && this.dAppConnector.signers?.length > 0) {
        console.log('ðŸ“‹ Method 4 - Found signers:', this.dAppConnector.signers.length);
        this.signer = this.dAppConnector.signers[0];

        // Try to get accountId from signer
        const signerAccountId = this.signer?.getAccountId?.()?.toString();
        if (signerAccountId) {
          this.accountId = signerAccountId;
          console.log('âœ… Restored from signer:', this.accountId);
          return true;
        }
      }

      if (sessions.length === 0) {
        console.log('âŒ No active sessions found with any method');
        return false;
      }

      // Get the first active session
      const existingSession = sessions[0];
      this.session = existingSession;

      // Extract account ID
      const accountInfo = existingSession.namespaces?.hedera?.accounts?.[0];
      if (accountInfo) {
        const parts = accountInfo.split(':');
        this.accountId = parts[parts.length - 1] || null;
      }

      // Get signer
      this.signer = this.dAppConnector.signers?.[0];

      console.log('âœ… Session restored:', {
        accountId: this.accountId,
        hasSigner: !!this.signer
      });

      return this.accountId !== null;
    } catch (error) {
      console.error('âŒ Failed to restore session:', error);
      return false;
    }
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
      // Use a default project ID for testing if not available
      const projectId = process.env.REACT_APP_WALLETCONNECT_PROJECT_ID || '4f21b4ddac58f70e52f42df326a08f4e';

      console.log('Initializing Hedera Wallet Service...');
      await hederaWalletService.initialize(projectId, metadata);
      console.log('Hedera Wallet Service initialized successfully');
    } catch (err: any) {
      console.error('Initialization error:', err);
      setError(`Failed to initialize wallet connector: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleConnect = async (): Promise<void> => {
    try {
      setLoading(true);
      setError('');
      console.log('Connecting wallet...');

      const { accountId: connectedAccountId } = await hederaWalletService.connect();
      setAccountId(connectedAccountId);
      setConnected(true);

      console.log('Wallet connected, fetching balance...');
      await fetchBalance();

    } catch (err: any) {
      console.error('Connection failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect wallet. Please try again.');
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
      console.log('Fetching account balance...');
      const balanceInTinybars = await hederaWalletService.getAccountBalance();
      const balanceInHbar = balanceInTinybars / 100000000;
      setBalance(balanceInHbar);
      console.log(`Balance fetched: ${balanceInHbar} HBAR`);
    } catch (err: any) {
      console.error('Failed to fetch balance:', err);
      setError(`Failed to fetch balance: ${err instanceof Error ? err.message : String(err)}`);
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

      // Refresh balance after successful transaction
      setTimeout(() => fetchBalance(), 2000);

      setRecipient('');
      setAmount('');
    } catch (err: any) {
      console.error('Transaction failed:', err);
      setError(`Transaction failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
      <h1 style={styles.title}>ðŸ”— Hedera Wallet Connect</h1>

      {error && <div style={styles.error}>âŒ {error}</div>}
      {txStatus && <div style={styles.success}>âœ… {txStatus}</div>}

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
          {loading ? 'â³ Connecting...' : 'ðŸ”Œ Connect Wallet'}
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
                  {balance.toFixed(4)} â„
                </p>
              </>
            )}

            <button
              onClick={handleDisconnect}
              style={{ ...styles.button, ...styles.disconnectButton }}
            >
              ðŸ”“ Disconnect
            </button>
          </div>

          <div style={styles.transactionSection}>
            <h3 style={{ marginTop: 0, color: '#333', marginBottom: '20px' }}>ðŸ’¸ Send HBAR</h3>
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
              {loading ? 'â³ Processing...' : 'âœˆï¸ Send Transaction'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Export both the component and the service
export default WalletConnect;
export { hederaWalletService };
