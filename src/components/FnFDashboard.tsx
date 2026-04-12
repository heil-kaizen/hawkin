import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, ChevronDown, ChevronUp, Users, AlertTriangle, Trash2, Copy, Check } from 'lucide-react';

interface FnFDashboardProps {
  profileId: string;
}

interface TokenData {
  id: string;
  name: string;
  symbol: string;
  mcap: number;
  timestamp: string;
  holders: any[];
}

interface WalletAppearance {
  tokenId: string;
  tokenName: string;
  tokenSymbol: string;
  tokenMcap: number;
  balance: number;
  percentage: number;
  rank: number;
}

interface OverlappingWallet {
  id: string;
  appearances: WalletAppearance[];
  avgPercentage: number;
  score: number;
}

interface SybilCluster {
  id: string;
  tokenCombo: string[];
  wallets: OverlappingWallet[];
  avgPercentage: number;
}

export function FnFDashboard({ profileId }: FnFDashboardProps) {
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [overlappingWallets, setOverlappingWallets] = useState<OverlappingWallet[]>([]);
  const [sybilClusters, setSybilClusters] = useState<SybilCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [expandedWallet, setExpandedWallet] = useState<string | null>(null);
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
  const [tokenToDelete, setTokenToDelete] = useState<string | null>(null);
  const [copiedWalletId, setCopiedWalletId] = useState<string | null>(null);

  const handleCopy = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedWalletId(text);
    setTimeout(() => setCopiedWalletId(null), 2000);
  };

  useEffect(() => {
    if (!profileId) return;
    setLoading(true);
    setError(null);

    const q = query(collection(db, 'profiles', profileId, 'tokens'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tokenDocs: TokenData[] = [];
      snapshot.forEach((doc) => {
        tokenDocs.push({ id: doc.id, ...doc.data() } as TokenData);
      });
      
      setTokens(tokenDocs);
      computeOverlaps(tokenDocs);
      setLoading(false);
    }, (err) => {
      try {
        handleFirestoreError(err, OperationType.GET, `profiles/${profileId}/tokens`);
      } catch (e) {
        setError(e as Error);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profileId]);

  const computeOverlaps = (tokenDocs: TokenData[]) => {
    const walletMap = new Map<string, WalletAppearance[]>();

    // 1. Map all wallet appearances
    tokenDocs.forEach(token => {
      (token.holders || []).forEach(holder => {
        if (!walletMap.has(holder.wallet)) {
          walletMap.set(holder.wallet, []);
        }
        walletMap.get(holder.wallet)!.push({
          tokenId: token.id,
          tokenName: token.name,
          tokenSymbol: token.symbol,
          tokenMcap: token.mcap,
          balance: holder.balance,
          percentage: holder.percentage,
          rank: holder.rank
        });
      });
    });

    // 2. Filter for overlaps (>= 2 tokens)
    const overlaps: OverlappingWallet[] = [];
    walletMap.forEach((appearances, walletId) => {
      if (appearances.length >= 2) {
        const avgPercentage = appearances.reduce((sum, a) => sum + a.percentage, 0) / appearances.length;
        
        // Calculate deterministic score
        let hash = 0;
        for (let i = 0; i < walletId.length; i++) {
          hash = walletId.charCodeAt(i) + ((hash << 5) - hash);
        }
        const baseScore = Math.abs(hash) % 50; // 0 to 49
        const overlapBonus = (appearances.length - 1) * 15;
        const holdingBonus = Math.min(avgPercentage * 5, 30);
        const score = Math.min(Math.round(baseScore + overlapBonus + holdingBonus), 99);

        overlaps.push({
          id: walletId,
          appearances: appearances.sort((a, b) => b.tokenMcap - a.tokenMcap),
          avgPercentage,
          score
        });
      }
    });

    // Sort by number of appearances, then by average percentage
    overlaps.sort((a, b) => {
      if (b.appearances.length !== a.appearances.length) {
        return b.appearances.length - a.appearances.length;
      }
      return b.avgPercentage - a.avgPercentage;
    });

    setOverlappingWallets(overlaps);

    // 3. Compute Sybil Clusters (Wallets holding the exact same tokens with similar percentages +/- 20%)
    const clusters = new Map<string, OverlappingWallet[]>();
    
    overlaps.forEach(wallet => {
      // Create a unique key for the combination of tokens this wallet holds
      const tokenComboKey = wallet.appearances.map(a => a.tokenId).sort().join('|');
      if (!clusters.has(tokenComboKey)) {
        clusters.set(tokenComboKey, []);
      }
      clusters.get(tokenComboKey)!.push(wallet);
    });

    const finalClusters: SybilCluster[] = [];
    let clusterIdCounter = 1;

    clusters.forEach((walletsInCombo, comboKey) => {
      if (walletsInCombo.length >= 2) {
        // Group wallets within this combo if their avg percentage is within 20% of each other
        // Simple clustering: sort by percentage, group adjacent if within 20%
        walletsInCombo.sort((a, b) => b.avgPercentage - a.avgPercentage);
        
        let currentGroup: OverlappingWallet[] = [walletsInCombo[0]];
        
        for (let i = 1; i < walletsInCombo.length; i++) {
          const wallet = walletsInCombo[i];
          const prevWallet = currentGroup[currentGroup.length - 1];
          
          // Check if within 20% tolerance (e.g. 2.0% and 1.6% are within 20% of 2.0)
          const diff = Math.abs(prevWallet.avgPercentage - wallet.avgPercentage);
          const maxAllowedDiff = prevWallet.avgPercentage * 0.20; // 20% tolerance
          
          if (diff <= maxAllowedDiff) {
            currentGroup.push(wallet);
          } else {
            if (currentGroup.length >= 2) {
              finalClusters.push({
                id: `cluster-${clusterIdCounter++}`,
                tokenCombo: comboKey.split('|'),
                wallets: [...currentGroup],
                avgPercentage: currentGroup.reduce((sum, w) => sum + w.avgPercentage, 0) / currentGroup.length
              });
            }
            currentGroup = [wallet];
          }
        }
        
        if (currentGroup.length >= 2) {
          finalClusters.push({
            id: `cluster-${clusterIdCounter++}`,
            tokenCombo: comboKey.split('|'),
            wallets: [...currentGroup],
            avgPercentage: currentGroup.reduce((sum, w) => sum + w.avgPercentage, 0) / currentGroup.length
          });
        }
      }
    });

    setSybilClusters(finalClusters.sort((a, b) => b.wallets.length - a.wallets.length));
  };

  const formatMcap = (mcap: any) => {
    const num = Number(mcap);
    if (isNaN(num) || num === 0) return 'N/A';
    if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`;
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const handleDeleteToken = (tokenId: string) => {
    setTokenToDelete(tokenId);
  };

  const confirmDeleteToken = async () => {
    if (!profileId || !tokenToDelete) return;
    try {
      await deleteDoc(doc(db, 'profiles', profileId, 'tokens', tokenToDelete));
    } catch (err) {
      console.error("Error deleting token:", err);
    }
    setTokenToDelete(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 border border-ink/20 bg-paper">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blood"></div>
      </div>
    );
  }

  if (error) {
    let errorMessage = error.message;
    try {
      const parsed = JSON.parse(errorMessage);
      if (parsed.error) errorMessage = parsed.error;
    } catch (e) {}

    return (
      <div className="bg-blood/10 p-6 border border-blood text-center">
        <AlertTriangle className="h-8 w-8 text-blood mx-auto mb-3" />
        <h3 className="text-xl font-serif font-black italic text-blood mb-2 uppercase tracking-widest">Error Loading Ledger</h3>
        <p className="text-blood font-mono text-sm">{errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Scanned Tokens Section */}
      {tokens.length > 0 && (
        <div className="bg-paper border border-ink/20">
          <div className="px-6 py-4 border-b border-ink/20 flex justify-between items-center">
            <h2 className="text-xl font-serif font-black italic text-ink uppercase tracking-widest">Token Gazette</h2>
            <span className="text-xs font-mono font-bold text-paper bg-ink px-3 py-1">
              {tokens.length} TOKENS
            </span>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {tokens.map(token => (
              <div key={token.id} className="bg-paper-dark p-4 border border-ink/20 flex justify-between items-start">
                <div>
                  <h4 className="font-serif font-bold text-ink text-lg uppercase">{token.name} <span className="text-ink-light text-xs font-mono">({token.symbol})</span></h4>
                  <a 
                    href={`https://dexscreener.com/solana/${token.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-blood hover:text-blood-hover hover:underline truncate max-w-[120px] block mt-1"
                    title={token.id}
                  >
                    {formatAddress(token.id)}
                  </a>
                  <div className="text-xs text-ink-light mt-3 font-mono uppercase tracking-wider">
                    MCAP: <span className="font-bold text-ink">{formatMcap(token.mcap)}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteToken(token.id)}
                  className="text-ink-light hover:text-blood p-1 transition-colors"
                  title="Delete Token"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tokens.length < 2 && (
        <div className="bg-paper p-12 border border-ink/20 text-center">
          <h3 className="text-2xl font-serif italic text-ink mb-2">Insufficient Data</h3>
          <p className="text-ink-light font-serif">Scan at least 2 tokens in this profile to find FnF overlaps.</p>
        </div>
      )}

      {tokens.length >= 2 && (
        <>
          {/* Sybil Clusters Section (High Priority) */}
          {sybilClusters.length > 0 && (
            <div className="bg-paper border-2 border-blood">
              <div className="px-6 py-4 border-b-2 border-blood bg-blood/5 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-6 w-6 text-blood" />
                  <h2 className="text-xl font-serif font-black italic text-blood uppercase tracking-widest">Suspected Sybil Clusters</h2>
                </div>
                <span className="text-xs font-mono font-bold text-paper bg-blood px-3 py-1">
                  {sybilClusters.length} CLUSTERS
                </span>
              </div>
              <div className="p-6">
                <p className="text-sm text-blood mb-8 font-serif italic leading-relaxed">
                  These wallets hold the exact same tokens and their holding percentages are within a <strong>20% tolerance</strong> of each other. This strongly indicates a single entity splitting funds across multiple wallets.
                </p>
                
                <div className="space-y-6">
                  {sybilClusters.map((cluster) => (
                    <div key={cluster.id} className="bg-paper border border-blood/30">
                      <div 
                        className="px-4 py-3 bg-blood/5 flex justify-between items-center cursor-pointer hover:bg-blood/10 transition-colors"
                        onClick={() => setExpandedCluster(expandedCluster === cluster.id ? null : cluster.id)}
                      >
                        <div className="flex items-center gap-6">
                          <div className="flex -space-x-2">
                            {[...Array(Math.min(cluster.wallets.length, 5))].map((_, i) => (
                              <div key={i} className="h-8 w-8 rounded-full bg-paper border border-blood flex items-center justify-center">
                                <Users className="h-4 w-4 text-blood" />
                              </div>
                            ))}
                            {cluster.wallets.length > 5 && (
                              <div className="h-8 w-8 rounded-full bg-paper border border-blood flex items-center justify-center text-xs font-mono font-bold text-blood">
                                +{cluster.wallets.length - 5}
                              </div>
                            )}
                          </div>
                          <div>
                            <h4 className="font-serif font-bold text-blood uppercase">{cluster.wallets.length} Connected Wallets</h4>
                            <p className="text-xs text-blood/80 font-mono tracking-widest mt-1">AVG HOLDING: ~{cluster.avgPercentage.toFixed(2)}%</p>
                          </div>
                        </div>
                        {expandedCluster === cluster.id ? <ChevronUp className="h-5 w-5 text-blood" /> : <ChevronDown className="h-5 w-5 text-blood" />}
                      </div>
                      
                      {expandedCluster === cluster.id && (
                        <div className="p-6 border-t border-blood/30">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                              <h5 className="text-xs font-mono font-bold text-ink uppercase tracking-widest mb-4 border-b border-ink/20 pb-2">The Wallets (FnF)</h5>
                              <ul className="space-y-3">
                                {cluster.wallets.map(w => (
                                  <li key={w.id} className="flex items-center justify-between">
                                    <span className="font-mono text-sm text-blood">{formatAddress(w.id)}</span>
                                    <div className="flex items-center space-x-3">
                                      <button 
                                        onClick={(e) => handleCopy(e, w.id)}
                                        className="text-ink-light hover:text-blood transition-colors"
                                        title="Copy Wallet Address"
                                      >
                                        {copiedWalletId === w.id ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                      </button>
                                      <a href={`https://gmgn.ai/sol/address/${w.id}`} target="_blank" rel="noopener noreferrer" className="text-ink-light hover:text-blood" title="View on GMGN">
                                        <ExternalLink className="h-4 w-4" />
                                      </a>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <h5 className="text-xs font-mono font-bold text-ink uppercase tracking-widest mb-4 border-b border-ink/20 pb-2">Tokens Held Together</h5>
                              <ul className="space-y-3">
                                {cluster.tokenCombo.map(tokenId => {
                                  const token = tokens.find(t => t.id === tokenId);
                                  return token ? (
                                    <li key={tokenId} className="flex items-center justify-between">
                                      <span className="font-serif font-bold text-ink uppercase">{token.name} <span className="text-ink-light text-xs font-mono">({token.symbol})</span></span>
                                      <span className="text-xs font-mono text-ink-light">{formatMcap(token.mcap)}</span>
                                    </li>
                                  ) : null;
                                })}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Standard Overlaps Section */}
          <div className="bg-paper border border-ink/20">
            <div className="px-6 py-4 border-b border-ink/20 flex justify-between items-center">
              <h2 className="text-xl font-serif font-black italic text-ink uppercase tracking-widest">Overlap Ledger</h2>
              <span className="text-xs font-mono font-bold text-paper bg-ink px-3 py-1">
                {overlappingWallets.length} WALLETS
              </span>
            </div>
            
            {overlappingWallets.length === 0 ? (
              <div className="p-12 text-center text-ink-light font-serif italic">
                No overlapping wallets found between the scanned tokens yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-ink/20">
                  <thead className="bg-paper-dark border-b border-ink/20">
                    <tr>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-mono font-bold text-ink uppercase tracking-widest">
                        FnF Wallet
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-mono font-bold text-ink uppercase tracking-widest">
                        Wallet Score
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-mono font-bold text-ink uppercase tracking-widest">
                        Tokens Matched
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-mono font-bold text-ink uppercase tracking-widest">
                        Avg Holding
                      </th>
                      <th scope="col" className="relative px-6 py-4">
                        <span className="sr-only">Details</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-paper divide-y divide-ink/10">
                    {overlappingWallets.map((wallet) => {
                      const isExpanded = expandedWallet === wallet.id;
                      
                      return (
                        <React.Fragment key={wallet.id}>
                          <tr 
                            className={`hover:bg-paper-dark cursor-pointer transition-colors ${isExpanded ? 'bg-paper-dark' : ''}`}
                            onClick={() => setExpandedWallet(isExpanded ? null : wallet.id)}
                          >
                            <td className="px-6 py-5 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="text-sm font-mono text-blood font-bold">
                                  {formatAddress(wallet.id)}
                                </div>
                                <button 
                                  onClick={(e) => handleCopy(e, wallet.id)}
                                  className="ml-3 text-ink-light hover:text-blood transition-colors"
                                  title="Copy Wallet Address"
                                >
                                  {copiedWalletId === wallet.id ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                </button>
                                <a 
                                  href={`https://gmgn.ai/sol/address/${wallet.id}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="ml-2 text-ink-light hover:text-blood transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                  title="View on GMGN"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </div>
                            </td>
                            <td className="px-6 py-5 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-mono font-bold ${wallet.score >= 80 ? 'bg-blood text-paper' : wallet.score >= 50 ? 'bg-ink/10 text-ink' : 'bg-paper-dark text-ink-light border border-ink/20'}`}>
                                {wallet.score} PTS
                              </span>
                            </td>
                            <td className="px-6 py-5 whitespace-nowrap">
                              <span className="font-mono text-sm text-ink">
                                {wallet.appearances.length} / {tokens.length}
                              </span>
                            </td>
                            <td className="px-6 py-5 whitespace-nowrap">
                              <div className="text-sm font-mono font-bold text-ink">{wallet.avgPercentage.toFixed(2)}%</div>
                            </td>
                            <td className="px-6 py-5 whitespace-nowrap text-right text-sm font-medium">
                              {isExpanded ? (
                                <ChevronUp className="h-5 w-5 text-ink inline" />
                              ) : (
                                <ChevronDown className="h-5 w-5 text-ink-light inline" />
                              )}
                            </td>
                          </tr>
                          
                          {isExpanded && (
                            <tr>
                              <td colSpan={5} className="px-6 py-6 bg-paper-dark border-b border-ink/20">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                  {wallet.appearances.map((app, idx) => (
                                    <div key={idx} className="bg-paper p-5 border border-ink/20 hover:border-ink transition-colors">
                                      <div className="flex justify-between items-start mb-4 border-b border-ink/10 pb-3">
                                        <div>
                                          <h4 className="font-serif font-bold text-ink uppercase">{app.tokenName}</h4>
                                          <a 
                                            href={`https://dexscreener.com/solana/${app.tokenId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-mono text-xs text-blood hover:text-blood-hover hover:underline truncate max-w-[120px] block mt-1"
                                            title={app.tokenId}
                                          >
                                            {formatAddress(app.tokenId)}
                                          </a>
                                        </div>
                                        <span className="px-2 py-1 bg-ink text-paper text-xs font-mono font-bold">
                                          #{app.rank}
                                        </span>
                                      </div>
                                      <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                          <span className="text-ink-light font-mono text-xs uppercase tracking-widest">Holding</span>
                                          <span className="font-mono font-bold text-ink">{app.percentage.toFixed(2)}%</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                          <span className="text-ink-light font-mono text-xs uppercase tracking-widest">Token MCAP</span>
                                          <span className="font-mono font-bold text-ink">{formatMcap(app.tokenMcap)}</span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Delete Token Confirmation Modal */}
      {tokenToDelete && (
        <div className="fixed inset-0 bg-ink/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-paper border-2 border-ink max-w-sm w-full p-6">
            <h3 className="text-2xl font-serif font-black italic text-ink mb-4 uppercase tracking-tight">Delete Token?</h3>
            <p className="text-sm text-ink-light mb-8 font-serif italic leading-relaxed">
              Are you sure you want to remove this token from your scanned list? This will remove it from overlap calculations.
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setTokenToDelete(null)}
                className="px-4 py-2 text-xs font-mono uppercase tracking-widest text-ink border border-ink/30 hover:bg-paper-dark"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteToken}
                className="px-4 py-2 text-xs font-mono uppercase tracking-widest text-paper bg-blood hover:bg-blood-hover"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
