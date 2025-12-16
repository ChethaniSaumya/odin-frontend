// AdminPanel.tsx (Complete Version)
import { useState, useEffect } from 'react';
import { 
  Shield, 
  AlertTriangle, 
  Lock, 
  Key, 
  Wallet, 
  Database, 
  RefreshCw,
  CheckCircle,
  XCircle,
  Settings,
  LogOut,
  Loader,
  Copy,
  ExternalLink
} from 'lucide-react';

interface TreasuryInfo {
  currentTreasury: string;
  configuredTreasury: string;
  match: boolean;
  warning: string | null;
}

interface TransferResult {
  success: boolean;
  transactionId?: string;
  oldTreasury?: string;
  newTreasury?: string;
  message?: string;
  successful?: number;
  failed?: number;
}

interface KeyPair {
  publicKey: string;
  privateKey: string;
}

const AdminPanel = () => {
  // State
  const [adminPassword, setAdminPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  // Treasury Management
  const [treasuryInfo, setTreasuryInfo] = useState<TreasuryInfo | null>(null);
  const [newTreasuryAccountId, setNewTreasuryAccountId] = useState('');
  const [newTreasuryPrivateKey, setNewTreasuryPrivateKey] = useState('');
  
  // NFT Transfer
  const [oldTreasuryAccountId, setOldTreasuryAccountId] = useState('');
  const [nftSerialNumbers, setNftSerialNumbers] = useState('');
  const [oldTreasuryPrivateKey, setOldTreasuryPrivateKey] = useState('');
  const [transferResult, setTransferResult] = useState<TransferResult | null>(null);
  
  // Admin Key Management
  const [newAdminPublicKey, setNewAdminPublicKey] = useState('');
  const [confirmIrreversible, setConfirmIrreversible] = useState(false);
  const [securityPhrase, setSecurityPhrase] = useState('');
  const [generatedKeyPair, setGeneratedKeyPair] = useState<KeyPair | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // API Configuration
  const API_BASE_URL = process.env.REACT_APP_ADMIN_API_URL || 'http://localhost:3000';

  // Authentication
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // Simple password check
      if (adminPassword === process.env.REACT_APP_ADMIN_PASSWORD) {
        setIsAuthenticated(true);
        setMessage({ type: 'success', text: 'Authenticated successfully' });
        await loadTreasuryInfo();
      } else {
        setMessage({ type: 'error', text: 'Invalid password' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAdminPassword('');
    setMessage(null);
    setTreasuryInfo(null);
    setTransferResult(null);
    setGeneratedKeyPair(null);
    setNewAdminPublicKey('');
    setConfirmIrreversible(false);
    setSecurityPhrase('');
  };

  // Helper Functions
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  // Treasury Functions
  const loadTreasuryInfo = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/upgrade/treasury/info`);
      const data = await response.json();
      if (data.success) {
        setTreasuryInfo(data);
      }
    } catch (error) {
      console.error('Failed to load treasury info:', error);
    }
  };

  const updateTreasury = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setTransferResult(null);

    if (!newTreasuryAccountId || !newTreasuryPrivateKey) {
      setMessage({ type: 'error', text: 'Please fill all fields' });
      setLoading(false);
      return;
    }

    // Validate account ID format
    if (!/^\d+\.\d+\.\d+$/.test(newTreasuryAccountId)) {
      setMessage({ type: 'error', text: 'Invalid account format. Use: 0.0.XXXXX' });
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/upgrade/treasury`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newTreasuryAccountId,
          newTreasuryPrivateKey,
          adminPassword
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setTransferResult(data);
        setMessage({ 
          type: 'success', 
          text: 'Treasury update initiated successfully!' 
        });
        await loadTreasuryInfo();
        setNewTreasuryAccountId('');
        setNewTreasuryPrivateKey('');
      } else {
        setMessage({ type: 'error', text: data.error || 'Update failed' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const transferNFTs = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setTransferResult(null);

    const serials = nftSerialNumbers.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    
    if (serials.length === 0) {
      setMessage({ type: 'error', text: 'Please enter valid serial numbers' });
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/upgrade/transfer-nfts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serialNumbers: serials,
          oldTreasuryAccountId,
          newTreasuryAccountId: newTreasuryAccountId || treasuryInfo?.currentTreasury,
          oldTreasuryPrivateKey,
          adminPassword
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setTransferResult(data);
        setMessage({ 
          type: 'success', 
          text: `Successfully transferred ${data.successful} NFT${data.successful !== 1 ? 's' : ''}` 
        });
        setNftSerialNumbers('');
        setOldTreasuryAccountId('');
        setOldTreasuryPrivateKey('');
      } else {
        setMessage({ type: 'error', text: data.error || 'Transfer failed' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Admin Key Functions
  const generateNewKeyPair = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/upgrade/admin/generate-key?password=${encodeURIComponent(adminPassword)}`);
      const data = await response.json();
      
      if (data.success) {
        setGeneratedKeyPair(data.newAdminKeyPair);
        setMessage({ 
          type: 'success', 
          text: 'New key pair generated! Save the private key securely.' 
        });
      } else {
        setMessage({ type: 'error', text: data.error || 'Key generation failed' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const transferAdminKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setTransferResult(null);

    if (!newAdminPublicKey || !confirmIrreversible || securityPhrase !== "I understand this is permanent") {
      setMessage({ 
        type: 'error', 
        text: 'Please fill all fields and confirm understanding' 
      });
      setLoading(false);
      return;
    }

    if (!window.confirm('⚠️ CRITICAL WARNING: This is PERMANENT! You will lose all admin control. Are you absolutely sure?')) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/upgrade/admin/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newAdminPublicKey,
          confirmIrreversible,
          adminPassword,
          securityPhrase
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setTransferResult(data);
        setMessage({ 
          type: 'success', 
          text: 'Admin key transferred. YOU NO LONGER HAVE ADMIN CONTROL!' 
        });
        setNewAdminPublicKey('');
        setConfirmIrreversible(false);
        setSecurityPhrase('');
        setGeneratedKeyPair(null);
      } else {
        setMessage({ type: 'error', text: data.error || 'Transfer failed' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Effect to load data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadTreasuryInfo();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800/50 backdrop-blur-lg rounded-2xl p-8 border border-gray-700 shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-700 rounded-full mb-4 shadow-lg">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
            <p className="text-gray-300 mt-2">Complete Token Management</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Admin Password
              </label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900/70 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Enter admin password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 rounded-xl font-semibold text-white transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <Loader className="w-5 h-5 mr-2 animate-spin" />
                  Authenticating...
                </span>
              ) : 'Access Panel'}
            </button>
          </form>

          {message && (
            <div className={`mt-6 p-4 rounded-xl ${message.type === 'success' ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}>
              <div className="flex items-center">
                {message.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-green-400 mr-2" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400 mr-2" />
                )}
                <span className="text-sm">{message.text}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-gray-100">
      {/* Header */}
      <header className="bg-gray-800/50 backdrop-blur-lg border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-700 rounded-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Token Management Panel</h1>
                <p className="text-sm text-gray-400">HBARBARIAN NFT Collection</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 rounded-xl text-red-300 hover:text-red-200 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {message && (
          <div className={`mb-6 p-4 rounded-xl ${message.type === 'success' ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}>
            <div className="flex items-center">
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-400 mr-2 flex-shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400 mr-2 flex-shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Treasury Management */}
          <div className="space-y-8">
            {/* Treasury Status */}
            <div className="bg-gray-800/30 backdrop-blur-lg rounded-2xl p-6 border border-gray-700 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center">
                  <Wallet className="w-6 h-6 mr-3 text-amber-400" />
                  Current Treasury Status
                </h2>
                <button
                  onClick={loadTreasuryInfo}
                  disabled={loading}
                  className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {treasuryInfo ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-600">
                      <div className="text-sm text-gray-400 mb-1">On-Chain Treasury</div>
                      <div className="font-mono text-lg font-bold text-white truncate">
                        {treasuryInfo.currentTreasury}
                      </div>
                    </div>
                    <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-600">
                      <div className="text-sm text-gray-400 mb-1">Configured Treasury</div>
                      <div className="font-mono text-lg font-bold text-white truncate">
                        {treasuryInfo.configuredTreasury}
                      </div>
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl ${treasuryInfo.match ? 'bg-green-900/20 border border-green-700' : 'bg-amber-900/20 border border-amber-700'}`}>
                    <div className="flex items-center">
                      {treasuryInfo.match ? (
                        <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-400 mr-3" />
                      )}
                      <div>
                        <div className="font-semibold">
                          {treasuryInfo.match ? 'Configuration ✓' : 'Configuration Mismatch!'}
                        </div>
                        {treasuryInfo.warning && (
                          <div className="text-sm text-gray-300 mt-1">{treasuryInfo.warning}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Loader className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                  <p className="mt-2 text-gray-400">Loading treasury info...</p>
                </div>
              )}
            </div>

            {/* Update Treasury */}
            <div className="bg-gray-800/30 backdrop-blur-lg rounded-2xl p-6 border border-gray-700 shadow-xl">
              <h2 className="text-xl font-bold mb-6 flex items-center">
                <Settings className="w-6 h-6 mr-3 text-blue-400" />
                Update Treasury Account
              </h2>

              <form onSubmit={updateTreasury} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    New Treasury Account ID
                  </label>
                  <input
                    type="text"
                    value={newTreasuryAccountId}
                    onChange={(e) => setNewTreasuryAccountId(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900/70 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.0.XXXXX"
                    required
                  />
                  <p className="mt-2 text-xs text-gray-400">Format: 0.0.XXXXX</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    New Treasury Private Key
                  </label>
                  <textarea
                    value={newTreasuryPrivateKey}
                    onChange={(e) => setNewTreasuryPrivateKey(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900/70 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    placeholder="302e..."
                    rows={3}
                    required
                  />
                  <p className="mt-2 text-xs text-gray-400">DER format private key (starts with 302e...)</p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 rounded-xl font-semibold text-white transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <Loader className="w-5 h-5 mr-2 animate-spin" />
                      Updating Treasury...
                    </span>
                  ) : 'Update Treasury Account'}
                </button>
              </form>
            </div>

            {/* Transfer Existing NFTs */}
            <div className="bg-gray-800/30 backdrop-blur-lg rounded-2xl p-6 border border-gray-700 shadow-xl">
              <h2 className="text-xl font-bold mb-6 flex items-center">
                <Database className="w-6 h-6 mr-3 text-purple-400" />
                Transfer NFTs to New Treasury
              </h2>

              <div className="mb-6 p-4 bg-blue-900/20 border border-blue-700 rounded-xl">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-blue-300">Use this after updating treasury</p>
                    <p className="text-gray-300 mt-1">Transfer existing NFTs from old treasury to new treasury</p>
                  </div>
                </div>
              </div>

              <form onSubmit={transferNFTs} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Old Treasury Account ID
                  </label>
                  <input
                    type="text"
                    value={oldTreasuryAccountId}
                    onChange={(e) => setOldTreasuryAccountId(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900/70 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.0.XXXXX"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Old Treasury Private Key
                  </label>
                  <textarea
                    value={oldTreasuryPrivateKey}
                    onChange={(e) => setOldTreasuryPrivateKey(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900/70 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    placeholder="302e..."
                    rows={2}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    NFT Serial Numbers
                  </label>
                  <textarea
                    value={nftSerialNumbers}
                    onChange={(e) => setNftSerialNumbers(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900/70 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    placeholder="1, 2, 3, 5, 10..."
                    rows={3}
                    required
                  />
                  <p className="mt-2 text-xs text-gray-400">Comma-separated serial numbers</p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 px-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 rounded-xl font-semibold text-white transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <Loader className="w-5 h-5 mr-2 animate-spin" />
                      Transferring NFTs...
                    </span>
                  ) : 'Transfer NFTs'}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column - Admin Key Management */}
          <div className="space-y-8">
            {/* Generate New Admin Key Pair */}
            <div className="bg-gray-800/30 backdrop-blur-lg rounded-2xl p-6 border border-gray-700 shadow-xl">
              <h2 className="text-xl font-bold mb-6 flex items-center">
                <Key className="w-6 h-6 mr-3 text-green-400" />
                Generate New Admin Key Pair
              </h2>

              <button
                onClick={generateNewKeyPair}
                disabled={loading}
                className="w-full py-4 px-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 rounded-xl font-semibold text-white transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg mb-6"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <Loader className="w-5 h-5 mr-2 animate-spin" />
                    Generating...
                  </span>
                ) : 'Generate New Key Pair'}
              </button>

              {generatedKeyPair && (
                <div className="space-y-6">
                  <div className="p-4 bg-red-900/20 border border-red-700 rounded-xl">
                    <div className="flex items-start">
                      <AlertTriangle className="w-5 h-5 text-red-400 mr-3 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="font-semibold text-red-300">⚠️ SAVE THE PRIVATE KEY NOW!</p>
                        <p className="text-gray-300 mt-1">Copy and store securely. It won't be shown again.</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-300">
                        Public Key (use for transfer)
                      </label>
                      <button
                        onClick={() => copyToClipboard(generatedKeyPair.publicKey, 'public')}
                        className="flex items-center space-x-1 text-xs text-gray-400 hover:text-white"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copied === 'public' ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="bg-gray-900/70 p-4 rounded-xl font-mono text-xs break-all border border-gray-600">
                      {generatedKeyPair.publicKey}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-300">
                        Private Key (SAVE SECURELY!)
                      </label>
                      <button
                        onClick={() => copyToClipboard(generatedKeyPair.privateKey, 'private')}
                        className="flex items-center space-x-1 text-xs text-gray-400 hover:text-white"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copied === 'private' ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="bg-gray-900/70 p-4 rounded-xl font-mono text-xs break-all border-2 border-red-700">
                      {generatedKeyPair.privateKey}
                    </div>
                  </div>

                  <div className="p-4 bg-blue-900/20 border border-blue-700 rounded-xl">
                    <div className="text-sm">
                      <p className="font-semibold text-blue-300">Instructions:</p>
                      <ol className="mt-2 space-y-2 text-gray-300">
                        <li>1. Save both keys in a secure password manager</li>
                        <li>2. Use the public key for admin transfer</li>
                        <li>3. Keep private key secret - it controls the collection</li>
                        <li>4. Consider storing in multiple secure locations</li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Transfer Admin Control */}
            <div className="bg-gray-800/30 backdrop-blur-lg rounded-2xl p-6 border border-red-700 shadow-xl">
              <div className="flex items-center mb-6">
                <AlertTriangle className="w-6 h-6 text-red-400 mr-3" />
                <h2 className="text-xl font-bold text-red-300">Transfer Admin Control (IRREVERSIBLE)</h2>
              </div>

              <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-xl">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-red-400 mr-3 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-red-300">⚠️ CRITICAL WARNING:</p>
                    <ul className="mt-2 space-y-1 text-gray-300">
                      <li>• This is PERMANENT and CANNOT be reversed</li>
                      <li>• You will lose all admin control over the collection</li>
                      <li>• The new admin will have full control</li>
                      <li>• Double-check the public key before proceeding</li>
                      <li>• 10-second execution delay (emergency cancel window)</li>
                    </ul>
                  </div>
                </div>
              </div>

              <form onSubmit={transferAdminKey} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    New Admin Public Key
                  </label>
                  <textarea
                    value={newAdminPublicKey}
                    onChange={(e) => setNewAdminPublicKey(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900/70 border border-red-700 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent font-mono text-sm"
                    placeholder="302a300506032b6570032100..."
                    rows={3}
                    required
                  />
                  <p className="mt-2 text-xs text-gray-400">
                    Public key of the new admin wallet (starts with 302a...)
                  </p>
                </div>

                <div>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={confirmIrreversible}
                      onChange={(e) => setConfirmIrreversible(e.target.checked)}
                      className="w-4 h-4 text-red-600 bg-gray-700 border-red-700 rounded focus:ring-red-600"
                    />
                    <span className="text-sm text-gray-300">
                      I confirm this action is permanent and irreversible
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Security Phrase
                  </label>
                  <input
                    type="text"
                    value={securityPhrase}
                    onChange={(e) => setSecurityPhrase(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900/70 border border-red-700 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="I understand this is permanent"
                    required
                  />
                  <p className="mt-2 text-xs text-gray-400">
                    Type exactly: "I understand this is permanent"
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !confirmIrreversible || securityPhrase !== "I understand this is permanent"}
                  className="w-full py-4 px-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 rounded-xl font-semibold text-white transition-all transform hover:scale-[1.02] disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <Loader className="w-5 h-5 mr-2 animate-spin" />
                      Transferring...
                    </span>
                  ) : 'TRANSFER ADMIN CONTROL (PERMANENT)'}
                </button>
              </form>

              <div className="mt-6 p-4 bg-amber-900/20 border border-amber-700 rounded-xl">
                <div className="flex items-start">
                  <Lock className="w-5 h-5 text-amber-400 mr-3 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-amber-300">Recommended Process:</p>
                    <ol className="mt-2 space-y-2 text-gray-300">
                      <li>1. Generate new key pair above</li>
                      <li>2. Copy the public key into field</li>
                      <li>3. Confirm understanding and proceed</li>
                      <li>4. Save new private key in multiple locations</li>
                      <li>5. Update .env with new admin key (if needed)</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>

            {/* Results Section */}
            {transferResult && (
              <div className="bg-gray-800/30 backdrop-blur-lg rounded-2xl p-6 border border-gray-700 shadow-xl">
                <h2 className="text-xl font-bold mb-6 flex items-center">
                  {transferResult.success ? (
                    <CheckCircle className="w-6 h-6 mr-3 text-green-400" />
                  ) : (
                    <XCircle className="w-6 h-6 mr-3 text-red-400" />
                  )}
                  Operation Results
                </h2>

                {transferResult.success ? (
                  <div className="space-y-6">
                    <div className="p-4 bg-green-900/20 border border-green-700 rounded-xl">
                      <div className="flex items-center">
                        <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
                        <div>
                          <div className="font-semibold">Success!</div>
                          <div className="text-sm text-gray-300 mt-1">{transferResult.message}</div>
                        </div>
                      </div>
                    </div>

                    {transferResult.transactionId && (
                      <div className="space-y-4">
                        <div className="bg-gray-900/50 rounded-xl p-4">
                          <div className="text-sm text-gray-400 mb-1">Transaction ID</div>
                          <div className="font-mono text-sm truncate">{transferResult.transactionId}</div>
                          <a
                            href={`https://hashscan.io/mainnet/transaction/${transferResult.transactionId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center text-xs text-blue-400 hover:text-blue-300"
                          >
                            View on HashScan <ExternalLink className="w-3 h-3 ml-1" />
                          </a>
                        </div>
                      </div>
                    )}

                    {transferResult.oldTreasury && transferResult.newTreasury && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-900/50 rounded-xl p-4">
                          <div className="text-sm text-gray-400 mb-1">From</div>
                          <div className="font-mono text-sm truncate">{transferResult.oldTreasury}</div>
                        </div>
                        <div className="bg-gray-900/50 rounded-xl p-4">
                          <div className="text-sm text-gray-400 mb-1">To</div>
                          <div className="font-mono text-sm truncate">{transferResult.newTreasury}</div>
                        </div>
                      </div>
                    )}

                    {transferResult.successful !== undefined && transferResult.failed !== undefined && (
                      <div className="flex justify-between items-center p-4 bg-gray-900/50 rounded-xl">
                        <div className="text-green-400 font-semibold">
                          {transferResult.successful} Successful
                        </div>
                        {transferResult.failed > 0 && (
                          <div className="text-red-400 font-semibold">
                            {transferResult.failed} Failed
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-red-900/20 border border-red-700 rounded-xl">
                    <div className="flex items-center">
                      <XCircle className="w-5 h-5 text-red-400 mr-3" />
                      <div>
                        <div className="font-semibold">Operation Failed</div>
                        <div className="text-sm text-gray-300 mt-1">{transferResult.message}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Instructions Section */}
            <div className="bg-gray-800/30 backdrop-blur-lg rounded-2xl p-6 border border-gray-700 shadow-xl">
              <h2 className="text-xl font-bold mb-6 flex items-center">
                <Settings className="w-6 h-6 mr-3 text-blue-400" />
                Management Instructions
              </h2>

              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm">1</span>
                  </div>
                  <div>
                    <div className="font-semibold">Treasury Account</div>
                    <div className="text-sm text-gray-300 mt-1">
                      Controls where new NFTs are minted to. Can be changed multiple times.
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-purple-900/50 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm">2</span>
                  </div>
                  <div>
                    <div className="font-semibold">NFT Transfer</div>
                    <div className="text-sm text-gray-300 mt-1">
                      Move existing NFTs between treasuries after changing treasury account.
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-red-900/50 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm">3</span>
                  </div>
                  <div>
                    <div className="font-semibold">Admin Control</div>
                    <div className="text-sm text-gray-300 mt-1">
                      IRREVERSIBLE transfer of all admin privileges to new wallet/DAO.
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-green-900/50 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm">4</span>
                  </div>
                  <div>
                    <div className="font-semibold">Security</div>
                    <div className="text-sm text-gray-300 mt-1">
                      Always backup keys, use hardware wallets for critical operations.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Warning */}
        <div className="mt-8 p-4 bg-gray-800/30 backdrop-blur-lg border border-amber-700/50 rounded-2xl">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-amber-400 mr-3 flex-shrink-0" />
            <p className="text-sm text-gray-300">
              This panel controls critical token operations. All actions are logged. Ensure you have proper backups, understand the implications, and verify all inputs before proceeding.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminPanel;