// src/components/AdminAirdropSection.tsx
import React, { useState } from 'react';
import { Shield, Swords, Crown, Send, Eye, Trash2, Plus, AlertTriangle, CheckCircle, Loader2, X } from 'lucide-react';

const OPERATOR_ID = process.env.REACT_APP_OPERATOR_ID;

interface AirdropResult {
  walletAddress: string;
  success: boolean;
  serialNumber?: number;
  metadataTokenId?: number;
  error?: string;
}

interface AirdropSummary {
  totalRequested: number;
  successful: number;
  failed: number;
  rarity: string;
  tierName: string;
  totalOdinDistributed: number;
}

interface AdminAirdropSectionProps {
  walletAccountId: string | null;
  apiBaseUrl: string | undefined;
}

const AdminAirdropSection: React.FC<AdminAirdropSectionProps> = ({ walletAccountId, apiBaseUrl }) => {
  const [selectedRarity, setSelectedRarity] = useState<'common' | 'rare' | 'legendary'>('common');
  const [walletAddresses, setWalletAddresses] = useState<string[]>(['']);
  const [bulkInput, setBulkInput] = useState('');
  const [showBulkInput, setShowBulkInput] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [results, setResults] = useState<AirdropResult[] | null>(null);
  const [summary, setSummary] = useState<AirdropSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isOperator = walletAccountId === OPERATOR_ID;
  if (!isOperator) return null;

  // Fallback API URL if not provided
  const baseUrl = apiBaseUrl || process.env.REACT_APP_API_URL;

  const tierConfig = {
    common: { name: 'Common Warrior', icon: Shield, color: 'from-slate-500 to-slate-700', borderColor: 'border-slate-500', textColor: 'text-slate-400', odin: 40000 },
    rare: { name: 'Rare Champion', icon: Swords, color: 'from-blue-500 to-purple-600', borderColor: 'border-blue-500', textColor: 'text-blue-400', odin: 300000 },
    legendary: { name: 'Legendary Hero', icon: Crown, color: 'from-amber-400 to-orange-600', borderColor: 'border-amber-500', textColor: 'text-amber-400', odin: 1000000 }
  };

  const addWalletField = () => setWalletAddresses([...walletAddresses, '']);
  const removeWalletField = (index: number) => { if (walletAddresses.length > 1) setWalletAddresses(walletAddresses.filter((_, i) => i !== index)); };
  const updateWalletAddress = (index: number, value: string) => { const updated = [...walletAddresses]; updated[index] = value.trim(); setWalletAddresses(updated); };
  
  const handleBulkImport = () => {
    const addresses = bulkInput.split(/[\n,]/).map(addr => addr.trim()).filter(addr => addr.match(/^\d+\.\d+\.\d+$/));
    if (addresses.length > 0) { setWalletAddresses(addresses); setBulkInput(''); setShowBulkInput(false); }
  };

  const getValidAddresses = () => walletAddresses.filter(addr => addr.match(/^\d+\.\d+\.\d+$/));

  const handlePreview = async () => {
    const validAddresses = getValidAddresses();
    if (validAddresses.length === 0) { setError('Please enter at least one valid wallet address'); return; }
    if (!adminPassword) { setError('Please enter admin password'); return; }
    setIsLoading(true); setError(null); setResults(null); setSummary(null);
    try {
      const response = await fetch(`${baseUrl}/api/airdrop/preview`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPassword, rarity: selectedRarity, walletAddresses: validAddresses })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      setPreviewData(data.preview); setIsPreviewMode(true);
    } catch (err: any) { setError(err.message); } finally { setIsLoading(false); }
  };

  const handleAirdrop = async () => {
    const validAddresses = getValidAddresses();
    if (validAddresses.length === 0) { setError('Please enter at least one valid wallet address'); return; }
    if (!adminPassword) { setError('Please enter admin password'); return; }
    setIsLoading(true); setError(null); setResults(null); setSummary(null); setPreviewData(null); setIsPreviewMode(false);
    try {
      const response = await fetch(`${baseUrl}/api/airdrop/batch`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPassword, rarity: selectedRarity, walletAddresses: validAddresses })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      setResults(data.results); setSummary(data.summary); setSuccessMessage(data.message);
      setWalletAddresses(['']); setAdminPassword('');
    } catch (err: any) { setError(err.message); } finally { setIsLoading(false); }
  };

  const resetForm = () => { setResults(null); setSummary(null); setPreviewData(null); setIsPreviewMode(false); setError(null); setSuccessMessage(null); };
  const validCount = getValidAddresses().length;

  return (
    <div className="mt-16 mb-12 max-w-6xl mx-auto px-4">
      <div className="flex items-center justify-center gap-3 mb-8">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-red-500/50 to-transparent"></div>
        <div className="flex items-center gap-2 px-4 py-2 bg-red-900/30 border border-red-500/50 rounded-full">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <span className="text-red-400 font-bold uppercase tracking-wider text-sm">Admin Access</span>
        </div>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-red-500/50 to-transparent"></div>
      </div>

      <div className="bg-gradient-to-br from-gray-900/80 via-gray-900/60 to-gray-900/80 border-2 border-red-500/30 rounded-3xl p-8 backdrop-blur-sm shadow-2xl shadow-red-500/10">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-red-500/20 rounded-xl border border-red-500/30"><Send className="w-8 h-8 text-red-400" /></div>
          <div><h2 className="text-3xl font-bold text-white">Batch Airdrop</h2><p className="text-gray-400">Distribute NFTs to multiple wallets</p></div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-xl flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" /><span className="text-red-300">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto"><X className="w-5 h-5 text-red-400 hover:text-red-300" /></button>
          </div>
        )}

        {summary && results && (
          <div className="mb-8 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-800/50 rounded-xl p-4 text-center border border-gray-700"><div className="text-3xl font-bold text-white">{summary.totalRequested}</div><div className="text-sm text-gray-400">Requested</div></div>
              <div className="bg-green-900/30 rounded-xl p-4 text-center border border-green-500/30"><div className="text-3xl font-bold text-green-400">{summary.successful}</div><div className="text-sm text-gray-400">Successful</div></div>
              <div className="bg-red-900/30 rounded-xl p-4 text-center border border-red-500/30"><div className="text-3xl font-bold text-red-400">{summary.failed}</div><div className="text-sm text-gray-400">Failed</div></div>
              <div className="bg-amber-900/30 rounded-xl p-4 text-center border border-amber-500/30"><div className="text-3xl font-bold text-amber-400">{summary.totalOdinDistributed.toLocaleString()}</div><div className="text-sm text-gray-400">$ODIN Allocated</div></div>
            </div>
            <div className="bg-gray-800/30 rounded-xl border border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <h4 className="font-bold text-white">Airdrop Results</h4>
                <button onClick={resetForm} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors">New Airdrop</button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {results.map((result, index) => (
                  <div key={index} className={`flex items-center justify-between p-3 border-b border-gray-700/50 last:border-0 ${result.success ? 'bg-green-900/10' : 'bg-red-900/10'}`}>
                    <div className="flex items-center gap-3">
                      {result.success ? <CheckCircle className="w-5 h-5 text-green-400" /> : <AlertTriangle className="w-5 h-5 text-red-400" />}
                      <span className="font-mono text-sm">{result.walletAddress}</span>
                    </div>
                    <div className="text-sm">{result.success ? <span className="text-green-400">Serial #{result.serialNumber}</span> : <span className="text-red-400">{result.error}</span>}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {isPreviewMode && previewData && !results && (
          <div className="mb-8 p-6 bg-blue-900/20 border border-blue-500/30 rounded-xl">
            <div className="flex items-center gap-3 mb-4"><Eye className="w-6 h-6 text-blue-400" /><h4 className="text-xl font-bold text-blue-400">Airdrop Preview</h4></div>
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="space-y-2">
                <div className="flex justify-between"><span className="text-gray-400">Tier:</span><span className="font-bold text-white">{previewData.tierName}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Recipients:</span><span className="font-bold text-white">{previewData.requestedCount}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Available:</span><span className={`font-bold ${previewData.canComplete ? 'text-green-400' : 'text-red-400'}`}>{previewData.availableCount}</span></div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between"><span className="text-gray-400">$ODIN per NFT:</span><span className="font-bold text-amber-400">{previewData.odinPerNFT.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Total $ODIN:</span><span className="font-bold text-amber-400">{previewData.totalOdinToDistribute.toLocaleString()}</span></div>
              </div>
            </div>
            {!previewData.canComplete && <div className="p-3 bg-red-900/30 border border-red-500/30 rounded-lg mb-4"><span className="text-red-300 text-sm">{previewData.warning}</span></div>}
            <div className="flex gap-3">
              <button onClick={() => setIsPreviewMode(false)} className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-bold transition-colors">Back to Edit</button>
              <button onClick={handleAirdrop} disabled={!previewData.canComplete || isLoading} className="flex-1 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 disabled:from-gray-600 disabled:to-gray-700 rounded-xl font-bold transition-all disabled:cursor-not-allowed">
                {isLoading ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" />Processing...</span> : 'Confirm Airdrop'}
              </button>
            </div>
          </div>
        )}

        {!results && !isPreviewMode && (
          <>
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-400 mb-3">Select NFT Tier</label>
              <div className="grid grid-cols-3 gap-4">
                {(Object.keys(tierConfig) as Array<keyof typeof tierConfig>).map((tier) => {
                  const config = tierConfig[tier]; const Icon = config.icon; const isSelected = selectedRarity === tier;
                  return (
                    <button key={tier} onClick={() => setSelectedRarity(tier)} className={`relative p-4 rounded-xl border-2 transition-all duration-300 ${isSelected ? `${config.borderColor} bg-gradient-to-br ${config.color} shadow-lg` : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'}`}>
                      <Icon className={`w-8 h-8 mx-auto mb-2 ${isSelected ? 'text-white' : config.textColor}`} />
                      <div className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-gray-300'}`}>{config.name}</div>
                      <div className={`text-xs mt-1 ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>{config.odin.toLocaleString()} $ODIN</div>
                      {isSelected && <div className="absolute top-2 right-2 w-3 h-3 bg-white rounded-full"></div>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-400 mb-2">Admin Password</label>
              <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Enter admin password" className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:border-amber-500 focus:outline-none transition-colors" />
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-400">Wallet Addresses ({validCount} valid)</label>
                <button onClick={() => setShowBulkInput(!showBulkInput)} className="text-sm text-amber-400 hover:text-amber-300 transition-colors">{showBulkInput ? 'Manual Entry' : 'Bulk Import'}</button>
              </div>
              {showBulkInput ? (
                <div className="space-y-3">
                  <textarea value={bulkInput} onChange={(e) => setBulkInput(e.target.value)} placeholder="Paste wallet addresses (one per line or comma-separated)" className="w-full h-40 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:border-amber-500 focus:outline-none transition-colors resize-none font-mono text-sm" />
                  <button onClick={handleBulkImport} className="w-full py-2 bg-amber-600 hover:bg-amber-500 rounded-lg font-medium transition-colors">Import Addresses</button>
                </div>
              ) : (
                <div className="space-y-3">
                  {walletAddresses.map((address, index) => (
                    <div key={index} className="flex gap-2">
                      <input type="text" value={address} onChange={(e) => updateWalletAddress(index, e.target.value)} placeholder="0.0.XXXXX" className={`flex-1 px-4 py-3 bg-gray-800 border rounded-xl focus:outline-none transition-colors font-mono ${address && !address.match(/^\d+\.\d+\.\d+$/) ? 'border-red-500 focus:border-red-400' : 'border-gray-700 focus:border-amber-500'}`} />
                      {walletAddresses.length > 1 && <button onClick={() => removeWalletField(index)} className="p-3 bg-red-900/30 hover:bg-red-900/50 border border-red-500/30 rounded-xl transition-colors"><Trash2 className="w-5 h-5 text-red-400" /></button>}
                    </div>
                  ))}
                  <button onClick={addWalletField} className="w-full py-3 border-2 border-dashed border-gray-700 hover:border-gray-600 rounded-xl flex items-center justify-center gap-2 text-gray-400 hover:text-gray-300 transition-colors"><Plus className="w-5 h-5" />Add Another Address</button>
                </div>
              )}
            </div>

            {validCount > 0 && (
              <div className="mb-6 p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
                <div className="flex items-center justify-between text-sm"><span className="text-gray-400">Will airdrop:</span><span className="font-bold text-white">{validCount} × {tierConfig[selectedRarity].name}</span></div>
                <div className="flex items-center justify-between text-sm mt-2"><span className="text-gray-400">Total $ODIN to distribute:</span><span className="font-bold text-amber-400">{(validCount * tierConfig[selectedRarity].odin).toLocaleString()}</span></div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <button onClick={handlePreview} disabled={validCount === 0 || !adminPassword || isLoading} className="py-4 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"><Eye className="w-5 h-5" />Preview</button>
              <button onClick={handleAirdrop} disabled={validCount === 0 || !adminPassword || isLoading} className="py-4 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
                {isLoading ? <><Loader2 className="w-5 h-5 animate-spin" />Processing...</> : <><Send className="w-5 h-5" />Execute Airdrop</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminAirdropSection;