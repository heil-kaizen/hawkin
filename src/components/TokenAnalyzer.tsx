import React, { useState } from 'react';
import { Search, Loader2, Settings, Key } from 'lucide-react';
import { getTokenData, getTopHolders } from '../lib/solanatracker';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface TokenAnalyzerProps {
  profileId: string;
}

export function TokenAnalyzer({ profileId }: TokenAnalyzerProps) {
  const [mintAddress, setMintAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const apiKey = import.meta.env.VITE_SOLANATRACKER_API_KEY || '';

  const analyzeToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mintAddress.trim() || !profileId) return;
    if (!apiKey) {
      setError("Please set VITE_SOLANATRACKER_API_KEY in your environment variables.");
      return;
    }

    setLoading(true);
    setError('');
    setStatus('Fetching market data from Solana Tracker...');

    try {
      // 1. Fetch Solana Tracker Data
      const marketData = await getTokenData(mintAddress.trim(), apiKey);
      
      setStatus('Fetching top holders from Solana Tracker...');
      // 2. Fetch Top Holders
      const holders = await getTopHolders(mintAddress.trim(), apiKey);
      
      if (holders.length === 0) {
        throw new Error("No holders found or invalid token address.");
      }

      setStatus('Saving snapshot to profile...');
      
      // 3. Save Token Snapshot to Profile Subcollection
      const tokenRef = doc(db, 'profiles', profileId, 'tokens', mintAddress.trim());
      
      const snapshotData = {
        mcap: marketData.mcap,
        price: marketData.price,
        timestamp: new Date().toISOString(),
        symbol: marketData.symbol,
        name: marketData.name,
        holders: holders
      };

      try {
        await setDoc(tokenRef, snapshotData);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `profiles/${profileId}/tokens/${mintAddress.trim()}`);
      }

      setStatus('Analysis complete!');
      setMintAddress('');
      
      // Clear status after a few seconds
      setTimeout(() => setStatus(''), 3000);
      
    } catch (err: any) {
      console.error(err);
      let errorMessage = err.message || "An error occurred during analysis.";
      try {
        const parsed = JSON.parse(errorMessage);
        if (parsed.error) errorMessage = parsed.error;
      } catch (e) {}
      setError(errorMessage);
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-paper p-6 border border-ink/20">
      <div className="flex justify-between items-center mb-6 border-b border-ink/20 pb-4">
        <h2 className="text-2xl font-serif font-black italic text-ink">Analyze New Token</h2>
      </div>

      <form onSubmit={analyzeToken} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-ink-light" />
          </div>
          <input
            type="text"
            value={mintAddress}
            onChange={(e) => setMintAddress(e.target.value)}
            placeholder="Enter Solana Token Mint Address..."
            className="block w-full pl-10 pr-3 py-3 border border-ink/30 bg-paper focus:outline-none focus:border-ink sm:text-sm font-mono"
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !mintAddress.trim()}
          className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-xs font-mono uppercase tracking-widest text-paper bg-blood hover:bg-blood-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
              Analyzing...
            </>
          ) : (
            'Snapshot'
          )}
        </button>
      </form>
      
      {status && !error && (
        <div className="mt-4 text-sm font-serif italic text-blood flex items-center">
          <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
          {status}
        </div>
      )}
      
      {error && (
        <div className="mt-4 text-sm font-mono text-blood bg-blood/10 p-3 border border-blood">
          {error}
        </div>
      )}
    </div>
  );
}
