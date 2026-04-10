import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, orderBy, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Plus, Search, Trash2, ChevronDown } from 'lucide-react';

export interface Profile {
  id: string;
  name: string;
  userId: string;
  createdAt: any;
}

interface ProfileManagerProps {
  selectedProfileId: string | null;
  onSelectProfile: (id: string | null) => void;
}

export function ProfileManager({ selectedProfileId, onSelectProfile }: ProfileManagerProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<Profile | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;
    setError(null);

    const q = query(
      collection(db, 'profiles'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Profile[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Profile);
      });
      setProfiles(data);
      
      if (data.length > 0) {
        if (!selectedProfileId || !data.find(p => p.id === selectedProfileId)) {
          onSelectProfile(data[0].id);
        }
      } else if (selectedProfileId) {
        onSelectProfile(null);
      }
      
      setLoading(false);
    }, (err) => {
      try {
        handleFirestoreError(err, OperationType.GET, 'profiles');
      } catch (e) {
        setError(e as Error);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth.currentUser, selectedProfileId, onSelectProfile]);

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim() || !auth.currentUser) return;

    try {
      const docRef = await addDoc(collection(db, 'profiles'), {
        userId: auth.currentUser.uid,
        name: newProfileName.trim(),
        createdAt: new Date().toISOString()
      });
      
      onSelectProfile(docRef.id);
      setNewProfileName('');
      setIsCreating(false);
      setSearchQuery('');
      setIsDropdownOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'profiles');
    }
  };

  const confirmDeleteProfile = async () => {
    if (!profileToDelete) return;
    
    const idToDelete = profileToDelete.id;
    setProfileToDelete(null);
    
    if (selectedProfileId === idToDelete) {
      onSelectProfile(null);
    }
    
    try {
      // Delete all tokens in the subcollection first to avoid orphaned data
      const tokensRef = collection(db, 'profiles', idToDelete, 'tokens');
      const tokensSnapshot = await getDocs(tokensRef);
      const deletePromises = tokensSnapshot.docs.map(tokenDoc => 
        deleteDoc(doc(db, 'profiles', idToDelete, 'tokens', tokenDoc.id))
      );
      await Promise.all(deletePromises);

      // Then delete the profile document itself
      await deleteDoc(doc(db, 'profiles', idToDelete));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `profiles/${idToDelete}`);
    }
  };

  const filteredProfiles = profiles.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedProfile = profiles.find(p => p.id === selectedProfileId);

  if (loading) {
    return <div className="animate-pulse h-12 bg-paper-dark border border-ink/20"></div>;
  }

  if (error) {
    let errorMessage = error.message;
    try {
      const parsed = JSON.parse(errorMessage);
      if (parsed.error) errorMessage = parsed.error;
    } catch (e) {}
    
    return (
      <div className="bg-blood/10 p-4 border border-blood mb-6 text-blood text-sm font-mono">
        Error loading profiles: {errorMessage}
      </div>
    );
  }

  return (
    <div className="relative pt-4">
      <div className="absolute top-0 left-0 bg-blood text-paper font-serif italic font-bold tracking-widest uppercase px-4 py-1 text-sm z-10 shadow-sm">
        Profile Select
      </div>
      <div className="bg-paper-dark p-6 pt-10 border border-ink/20 flex flex-col gap-4">
        <div className="w-full relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full flex items-center justify-between px-3 py-2 text-base border border-ink/30 bg-paper focus:outline-none focus:border-ink sm:text-sm font-serif italic text-ink"
          >
            <span className="truncate">{selectedProfile ? selectedProfile.name : 'Select a Profile...'}</span>
            <ChevronDown className="h-4 w-4 text-ink-light ml-2 flex-shrink-0" />
          </button>

          {isDropdownOpen && (
            <div className="absolute z-20 mt-1 w-full bg-paper border border-ink/30 shadow-lg">
              <div className="p-2 border-b border-ink/20">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-ink-light" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search profiles..."
                    className="block w-full pl-8 pr-3 py-1.5 border border-ink/30 bg-paper focus:outline-none focus:border-ink sm:text-sm font-serif italic"
                    autoFocus
                  />
                </div>
              </div>
              <ul className="max-h-60 overflow-y-auto py-1">
                {filteredProfiles.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-ink-light text-center font-serif italic">No profiles found</li>
                ) : (
                  filteredProfiles.map((p) => (
                    <li key={p.id} className={`flex items-center justify-between px-3 py-2 hover:bg-paper-dark cursor-pointer ${selectedProfileId === p.id ? 'bg-paper-dark font-bold' : ''}`}>
                      <button
                        onClick={() => {
                          onSelectProfile(p.id);
                          setIsDropdownOpen(false);
                          setSearchQuery('');
                        }}
                        className="flex-1 text-left text-sm text-ink truncate font-serif italic"
                      >
                        {p.name}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setProfileToDelete(p);
                          setIsDropdownOpen(false);
                        }}
                        className="ml-2 p-1 text-ink-light hover:text-blood transition-colors"
                        title="Delete Profile"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="w-full flex justify-end">
          {isCreating ? (
            <form onSubmit={handleCreateProfile} className="flex flex-col gap-2 w-full">
              <input
                type="text"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                placeholder="Profile Name..."
                className="block w-full px-3 py-2 border border-ink/30 bg-paper focus:outline-none focus:border-ink sm:text-sm font-serif italic"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1 border border-ink/30 text-xs font-mono uppercase tracking-widest text-ink hover:bg-paper-dark"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newProfileName.trim()}
                  className="px-3 py-1 bg-blood text-paper text-xs font-mono uppercase tracking-widest hover:bg-blood-hover disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="text-xs font-mono uppercase tracking-widest text-blood hover:text-blood-hover flex items-center"
            >
              <Plus className="h-3 w-3 mr-1" />
              New Profile
            </button>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {profileToDelete && (
        <div className="fixed inset-0 bg-ink/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-paper border-2 border-ink max-w-sm w-full p-6">
            <h3 className="text-2xl font-serif font-black italic text-ink mb-4 uppercase tracking-tight">Delete Profile?</h3>
            <p className="text-sm text-ink-light mb-8 font-serif italic leading-relaxed">
              Are you sure you want to delete <strong>{profileToDelete.name}</strong>? This will also remove all scanned tokens associated with this profile. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setProfileToDelete(null)}
                className="px-4 py-2 text-xs font-mono uppercase tracking-widest text-ink border border-ink/30 hover:bg-paper-dark"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteProfile}
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
