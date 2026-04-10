import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, loginWithGoogle, logout } from './firebase';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TokenAnalyzer } from './components/TokenAnalyzer';
import { FnFDashboard } from './components/FnFDashboard';
import { ProfileManager } from './components/ProfileManager';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'Masthead' | 'Token Gazette' | 'Overlap Ledger' | 'Insider Dossier'>('Masthead');
  const [activeModal, setActiveModal] = useState<'tos' | 'archive' | 'news' | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const renderContent = () => {
    if (activeTab === 'Masthead') {
      return (
        <>
          <div className="mb-12">
            <h2 className="text-xs font-mono tracking-widest uppercase text-ink-light mb-2">Classified Investigation</h2>
            <h1 className="text-6xl md:text-8xl font-serif font-black italic tracking-tighter text-ink leading-none mb-8">
              DOSSIER
            </h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-4 space-y-6">
              <ProfileManager 
                selectedProfileId={selectedProfileId} 
                onSelectProfile={setSelectedProfileId} 
              />
              
              <div className="border border-ink/20 p-6 bg-paper">
                <h4 className="text-xs font-mono font-bold tracking-widest uppercase text-ink mb-4 text-center">Official Notice</h4>
                <p className="text-[10px] font-mono text-ink-light uppercase leading-relaxed text-justify">
                  The data presented in this dossier is derived from immutable ledger records. FNF Detector holds no liability for market volatility. Professional discretion is advised before shadowing suspected insider activity.
                </p>
              </div>

              <div className="border-t-2 border-b-2 border-ink py-6 mt-8">
                <h3 className="text-3xl font-serif font-black tracking-tighter text-ink mb-6 uppercase leading-none">
                  Scoring<br/>Breakdown
                </h3>
                
                <div className="space-y-6">
                  <div className="border-b border-ink/10 pb-4">
                    <div className="flex justify-between items-baseline mb-2">
                      <h4 className="text-xs font-mono font-bold tracking-widest uppercase text-ink">Proximity Index</h4>
                      <span className="text-sm font-serif text-blood">+45 pts</span>
                    </div>
                    <p className="text-sm font-serif italic text-ink-light">
                      Direct cluster association with known developer deployer wallets within the first 10 seconds of launch.
                    </p>
                  </div>

                  <div className="border-b border-ink/10 pb-4">
                    <div className="flex justify-between items-baseline mb-2">
                      <h4 className="text-xs font-mono font-bold tracking-widest uppercase text-ink">Funding Ancestry</h4>
                      <span className="text-sm font-serif text-blood">+30 pts</span>
                    </div>
                    <p className="text-sm font-serif italic text-ink-light">
                      Wallet funded via a multi-hop transfer originating from a 'Tier 1' flagged exchange cold storage.
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between items-baseline mb-2">
                      <h4 className="text-xs font-mono font-bold tracking-widest uppercase text-ink">Entry Precision</h4>
                      <span className="text-sm font-serif text-blood">+23 pts</span>
                    </div>
                    <p className="text-sm font-serif italic text-ink-light">
                      Consistently enters liquidity pools at &lt;$50k MCAP, preceding 99% of retail volume.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="lg:col-span-8 border-l-0 lg:border-l-4 border-ink pl-0 lg:pl-8">
              {selectedProfileId ? (
                <div className="space-y-8">
                  <TokenAnalyzer profileId={selectedProfileId} />
                  <FnFDashboard profileId={selectedProfileId} />
                </div>
              ) : (
                <div className="bg-paper-dark p-12 border border-ink/20 text-center">
                  <h3 className="text-2xl font-serif italic text-ink mb-2">AWAITING SUBJECT</h3>
                  <p className="text-ink-light font-serif">Select or create a profile in the left panel to begin the investigation.</p>
                </div>
              )}
            </div>
          </div>
        </>
      );
    }

    if (activeTab === 'Insider Dossier') {
      return (
        <div className="max-w-3xl mx-auto space-y-8 mt-8">
          <div className="mb-8 text-center">
            <h2 className="text-4xl font-serif font-black italic text-ink mb-2">Insider Dossier</h2>
            <p className="text-ink-light font-serif">Manage your investigation workspaces.</p>
          </div>
          <ProfileManager 
            selectedProfileId={selectedProfileId} 
            onSelectProfile={setSelectedProfileId} 
          />
        </div>
      );
    }

    if (!selectedProfileId) {
      return (
        <div className="max-w-3xl mx-auto mt-16 bg-paper-dark p-12 border border-ink/20 text-center">
          <h3 className="text-2xl font-serif italic text-ink mb-2">AWAITING SUBJECT</h3>
          <p className="text-ink-light font-serif mb-6">You must select an active investigation profile first.</p>
          <button 
            onClick={() => setActiveTab('Insider Dossier')}
            className="px-6 py-2 bg-blood text-paper font-mono text-xs uppercase tracking-widest hover:bg-blood-hover"
          >
            Go to Insider Dossier
          </button>
        </div>
      );
    }

    if (activeTab === 'Token Gazette') {
      return (
        <div className="max-w-4xl mx-auto space-y-8 mt-8">
          <div className="mb-8 text-center">
            <h2 className="text-4xl font-serif font-black italic text-ink mb-2">Token Gazette</h2>
            <p className="text-ink-light font-serif">Ingest new token data into the current dossier.</p>
          </div>
          <TokenAnalyzer profileId={selectedProfileId} />
        </div>
      );
    }

    if (activeTab === 'Overlap Ledger') {
      return (
        <div className="max-w-6xl mx-auto space-y-8 mt-8">
          <div className="mb-8 text-center">
            <h2 className="text-4xl font-serif font-black italic text-ink mb-2">Overlap Ledger</h2>
            <p className="text-ink-light font-serif">Analyze cross-references and sybil clusters.</p>
          </div>
          <FnFDashboard profileId={selectedProfileId} />
        </div>
      );
    }
  };

  const renderModal = () => {
    if (!activeModal) return null;

    let title = '';
    let content = null;

    if (activeModal === 'tos') {
      title = 'Terms of Service';
      content = (
        <div className="space-y-4 text-sm font-serif leading-relaxed text-ink-light">
          <p><strong>1. Acceptance of Terms</strong><br/>By accessing the FNF Detector Gazette, you agree to abide by these terms regarding the use of analytics data, data privacy, and usage limits for the Solana Tracker API.</p>
          <p><strong>2. Data Usage</strong><br/>The data presented in this dossier is derived from immutable ledger records. We hold no liability for market volatility. Professional discretion is advised before shadowing suspected insider activity.</p>
          <p><strong>3. Privacy</strong><br/>Your workspace and profile data are securely stored and will not be shared with third parties without explicit consent.</p>
        </div>
      );
    } else if (activeModal === 'archive') {
      title = 'The Archive';
      content = (
        <div className="space-y-4 text-sm font-serif leading-relaxed text-ink-light text-center py-8">
          <p className="italic">Dusty records and permanent snapshots...</p>
          <p>The library of all past token analyses and historical wallet snapshots is currently being indexed by our archivists.</p>
          <p className="font-bold text-blood">COMING SOON</p>
        </div>
      );
    } else if (activeModal === 'news') {
      title = 'Dispatch News';
      content = (
        <div className="space-y-6 text-sm font-serif leading-relaxed text-ink-light">
          <div className="border-b border-ink/10 pb-4">
            <span className="text-xs font-mono font-bold text-blood tracking-widest uppercase">Vol. XIV — No. 402</span>
            <h4 className="text-lg font-bold text-ink mt-1">V1.0 Live on Solana</h4>
            <p className="mt-2">The FNF Detector is officially live. Investigators can now analyze overlapping holders across multiple Solana tokens to uncover hidden alpha.</p>
          </div>
          <div className="border-b border-ink/10 pb-4">
            <span className="text-xs font-mono font-bold text-blood tracking-widest uppercase">Development Update</span>
            <h4 className="text-lg font-bold text-ink mt-1">Wallet Scoring Refinements</h4>
            <p className="mt-2">Please note that the newly introduced wallet scoring algorithm is currently in beta. Our analysts are actively working on upgrades to improve its accuracy and weighting.</p>
          </div>
          <div>
            <span className="text-xs font-mono font-bold text-blood tracking-widest uppercase">System Maintenance</span>
            <h4 className="text-lg font-bold text-ink mt-1">Helius API Upgrades</h4>
            <p className="mt-2">We are currently upgrading our RPC nodes to handle increased load during high-volatility market events.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
        <div className="bg-paper border-2 border-ink max-w-lg w-full max-h-[90vh] overflow-y-auto relative shadow-2xl">
          <div className="sticky top-0 bg-paper border-b-2 border-ink p-4 flex justify-between items-center">
            <h3 className="font-serif font-black italic text-2xl text-ink uppercase tracking-tighter">{title}</h3>
            <button 
              onClick={() => setActiveModal(null)}
              className="text-ink hover:text-blood transition-colors font-mono text-xl font-bold"
            >
              ×
            </button>
          </div>
          <div className="p-6">
            {content}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blood"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink font-serif selection:bg-blood selection:text-paper">
      {renderModal()}
      <header className="pt-8 pb-0 border-b-2 border-ink mb-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center sm:items-end gap-4 mb-8">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif font-black tracking-tighter text-blood uppercase leading-none">
              SYNDICA
            </h1>
            
            <div>
              {user ? (
                <div className="flex items-center gap-6">
                  <button
                    onClick={logout}
                    className="px-6 py-2 bg-blood text-paper font-serif font-bold tracking-widest uppercase text-xs hover:bg-blood-hover transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={loginWithGoogle}
                  className="px-6 py-2 bg-blood text-paper font-serif font-bold tracking-widest uppercase text-xs hover:bg-blood-hover transition-colors"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>

          {user && (
            <nav className="flex justify-start sm:justify-center gap-6 md:gap-12 overflow-x-auto pb-0">
              {(['Masthead', 'Token Gazette', 'Overlap Ledger', 'Insider Dossier'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`whitespace-nowrap font-serif font-bold tracking-widest text-sm md:text-base pb-3 border-b-4 transition-colors ${
                    activeTab === tab 
                      ? 'text-blood border-blood' 
                      : 'text-ink border-transparent hover:text-blood'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </nav>
          )}
        </div>
      </header>

      <div className="border-b border-ink mb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between py-1 text-[10px] sm:text-xs font-serif tracking-widest uppercase text-ink">
          <span>Vol. XIV — No. 402</span>
          <span className="hidden sm:inline">Printed on the Solana Ledger</span>
          <span>Est. 1890</span>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!user ? (
          <div className="text-center py-12 md:py-20 max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 border border-ink/30 px-3 py-1 mb-12">
              <div className="w-2 h-2 bg-blood"></div>
              <span className="text-xs font-serif tracking-widest uppercase text-ink">V1.0 Live on Solana</span>
            </div>
            <h2 className="text-5xl md:text-7xl lg:text-8xl font-serif font-black italic tracking-tight text-ink mb-8 leading-[0.9]">
              FIND THE<br />WALLETS<br />THAT MATTER.
            </h2>
            <p className="text-lg md:text-2xl font-serif italic text-ink-light max-w-2xl mx-auto mb-12 leading-relaxed">
              Analyze overlapping holders across multiple Solana tokens to uncover hidden alpha, track repeat whales, and expose sybil clusters before the crowd.
            </p>
            <button
              onClick={loginWithGoogle}
              className="px-8 py-4 bg-blood text-paper font-serif font-bold tracking-widest uppercase text-sm hover:bg-blood-hover transition-colors"
            >
              Connect Wallet to Start
            </button>
          </div>
        ) : (
          <ErrorBoundary>
            {renderContent()}
          </ErrorBoundary>
        )}
      </main>

      <footer className="border-t border-ink mt-20 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center gap-6">
          <div className="flex flex-wrap justify-center gap-8 text-xs font-mono font-bold tracking-widest uppercase text-ink-light">
            <button onClick={() => setActiveModal('tos')} title="Legal agreement regarding the use of analytics data, data privacy, and usage limits." className="hover:text-blood transition-colors uppercase">Terms of Service</button>
            <button onClick={() => setActiveModal('archive')} title="Library of all past token analyses and historical wallet snapshots." className="hover:text-blood transition-colors uppercase">The Archive</button>
            <button onClick={() => setActiveModal('news')} title="Changelog, project updates, new feature releases, and market reports." className="hover:text-blood transition-colors uppercase">Dispatch News</button>
            <a href="https://github.com/heil-kaizen" target="_blank" rel="noopener noreferrer" title="Report data inaccuracies, request features, or seek technical help." className="hover:text-blood transition-colors uppercase">Contact Editor</a>
          </div>
          <div className="text-xl font-newsreader font-black italic text-blood tracking-widest">
            WALLET GAZETTE
          </div>
        </div>
      </footer>
    </div>
  );
}
