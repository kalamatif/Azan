import React, { useState, useEffect, useRef, Component } from 'react';
import { 
  Mic, 
  MicOff, 
  Radio, 
  Search, 
  Plus, 
  MapPin, 
  User as UserIcon, 
  Settings, 
  Bell, 
  Volume2, 
  VolumeX,
  ChevronRight,
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db, signIn, logOut, handleFirestoreError, OperationType } from './firebase';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  onSnapshot, 
  updateDoc, 
  addDoc, 
  serverTimestamp, 
  query, 
  where 
} from 'firebase/firestore';
import { PrayerSchedule } from './components/PrayerSchedule';
import { WebRTCManager } from './webrtc';
import { Auth } from './components/Auth';
import { MosqueCard } from './components/MosqueCard';
import { UserProfile, Mosque, StreamSession } from './types';
import { cn } from './lib/utils';

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registered:', registration);
    }).catch(error => {
      console.log('SW registration failed:', error);
    });
  });
}

// --- Components ---

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let message = "Something went wrong.";
      try {
        if (this.state.error && this.state.error.message) {
          const errObj = JSON.parse(this.state.error.message);
          message = `Error: ${errObj.error} (Op: ${errObj.operationType})`;
        }
      } catch (e) {
        message = this.state.error?.message || message;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-6">
          <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-red-100 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Error</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const Header = () => (
  <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4">
    <div className="max-w-7xl mx-auto flex justify-between items-center">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
          <Radio className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-gray-900">Azan<span className="text-indigo-600">Connect</span></h1>
      </div>
      <Auth />
    </div>
  </header>
);

const Onboarding = ({ onComplete }: { onComplete: (data: any) => void }) => {
  const [role, setRole] = useState<'user' | 'muazzin'>('user');
  const [name, setName] = useState('');
  const [mosqueName, setMosqueName] = useState('');
  const [mosqueLocation, setMosqueLocation] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onComplete({ name, role, mosqueName, mosqueLocation });
  };

  return (
    <div className="max-w-md mx-auto mt-12 p-8 bg-white rounded-3xl shadow-xl border border-gray-100">
      <h2 className="text-2xl font-bold mb-6 text-center">Welcome to AzanConnect</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            placeholder="Your name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">I am a...</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setRole('user')}
              className={cn(
                "p-4 rounded-2xl border-2 transition-all text-center",
                role === 'user' ? "border-indigo-600 bg-indigo-50" : "border-gray-100 hover:border-indigo-200"
              )}
            >
              <UserIcon className="w-6 h-6 mx-auto mb-2 text-indigo-600" />
              <span className="font-bold">Listener</span>
            </button>
            <button
              type="button"
              onClick={() => setRole('muazzin')}
              className={cn(
                "p-4 rounded-2xl border-2 transition-all text-center",
                role === 'muazzin' ? "border-indigo-600 bg-indigo-50" : "border-gray-100 hover:border-indigo-200"
              )}
            >
              <Mic className="w-6 h-6 mx-auto mb-2 text-indigo-600" />
              <span className="font-bold">Muazzin</span>
            </button>
          </div>
        </div>

        {role === 'muazzin' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mosque Name</label>
              <input
                type="text"
                required
                value={mosqueName}
                onChange={(e) => setMosqueName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="e.g. Masjid Al-Noor"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
              <input
                type="text"
                required
                value={mosqueLocation}
                onChange={(e) => setMosqueLocation(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="City, Area"
              />
            </div>
          </motion.div>
        )}

        <button
          type="submit"
          className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
        >
          Get Started
        </button>
      </form>
    </div>
  );
};

const Broadcaster = ({ mosque, user }: { mosque: Mosque; user: UserProfile }) => {
  const [isLive, setIsLive] = useState(mosque.isLive);
  const [streamTime, setStreamTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const webrtcRef = useRef<WebRTCManager | null>(null);

  useEffect(() => {
    webrtcRef.current = new WebRTCManager(mosque.id, user.uid);
    return () => {
      webrtcRef.current?.stop();
    };
  }, [mosque.id, user.uid]);

  const toggleLive = async () => {
    const newStatus = !isLive;
    setIsLive(newStatus);
    
    if (newStatus) {
      // Start WebRTC
      await webrtcRef.current?.startBroadcasting((stream) => {
        console.log("Broadcasting stream:", stream);
      });

      // Start Stream
      try {
        const streamRef = await addDoc(collection(db, `mosques/${mosque.id}/streams`), {
          mosqueId: mosque.id,
          startTime: serverTimestamp(),
          status: 'live'
        });
        await updateDoc(doc(db, 'mosques', mosque.id), {
          isLive: true,
          currentStreamId: streamRef.id
        });
        timerRef.current = setInterval(() => setStreamTime(prev => prev + 1), 1000);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `mosques/${mosque.id}`);
      }
    } else {
      // End Stream
      webrtcRef.current?.stop();
      try {
        if (mosque.currentStreamId) {
          await updateDoc(doc(db, `mosques/${mosque.id}/streams`, mosque.currentStreamId), {
            status: 'ended',
            endTime: serverTimestamp()
          });
        }
        await updateDoc(doc(db, 'mosques', mosque.id), {
          isLive: false,
          currentStreamId: null
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `mosques/${mosque.id}`);
      }
      if (timerRef.current) clearInterval(timerRef.current);
      setStreamTime(0);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-2xl mx-auto p-8 bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 text-center">
      <div className="mb-8">
        <div className={cn(
          "w-32 h-32 mx-auto rounded-full flex items-center justify-center transition-all duration-500",
          isLive ? "bg-red-100 animate-pulse" : "bg-indigo-50"
        )}>
          {isLive ? <Mic className="w-16 h-16 text-red-600" /> : <MicOff className="w-16 h-16 text-indigo-600" />}
        </div>
      </div>

      <h2 className="text-3xl font-black mb-2">{mosque.name}</h2>
      <p className="text-gray-500 mb-8 flex items-center justify-center gap-2">
        <MapPin className="w-4 h-4" /> {mosque.location}
      </p>

      {isLive && (
        <div className="mb-8">
          <div className="text-5xl font-mono font-black text-gray-900 mb-2">{formatTime(streamTime)}</div>
          <div className="flex items-center justify-center gap-2 text-red-600 font-bold uppercase tracking-widest text-sm">
            <span className="w-2 h-2 bg-red-600 rounded-full animate-ping" />
            Live Broadcast
          </div>
        </div>
      )}

      <button
        onClick={toggleLive}
        className={cn(
          "w-full py-6 rounded-3xl font-black text-xl transition-all shadow-xl flex items-center justify-center gap-3",
          isLive 
            ? "bg-red-600 text-white hover:bg-red-700 shadow-red-200" 
            : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200"
        )}
      >
        {isLive ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        {isLive ? "Stop Azan" : "Start Live Azan"}
      </button>

      <div className="mt-12 grid grid-cols-2 gap-4">
        <div className="p-4 bg-gray-50 rounded-2xl text-left">
          <div className="text-xs font-bold text-gray-400 uppercase mb-1">Status</div>
          <div className="font-bold">{isLive ? "Broadcasting" : "Idle"}</div>
        </div>
        <div className="p-4 bg-gray-50 rounded-2xl text-left">
          <div className="text-xs font-bold text-gray-400 uppercase mb-1">Latency</div>
          <div className="font-bold text-green-600">~0.5s</div>
        </div>
      </div>
    </div>
  );
};

const Listener = ({ user }: { user: UserProfile }) => {
  const [mosques, setMosques] = useState<Mosque[]>([]);
  const [selectedMosque, setSelectedMosque] = useState<Mosque | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [volume, setVolume] = useState(80);
  const [search, setSearch] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const webrtcRef = useRef<WebRTCManager | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'mosques'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Mosque));
      setMosques(docs);
      if (user.mosqueId) {
        const myMosque = docs.find(m => m.id === user.mosqueId);
        if (myMosque) setSelectedMosque(myMosque);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'mosques');
    });
    return unsubscribe;
  }, [user.mosqueId]);

  useEffect(() => {
    if (selectedMosque?.id) {
      webrtcRef.current = new WebRTCManager(selectedMosque.id, user.uid);
    }
    return () => {
      webrtcRef.current?.stop();
    };
  }, [selectedMosque?.id, user.uid]);

  const toggleListen = async () => {
    if (!isListening && selectedMosque?.isLive) {
      await webrtcRef.current?.startListening((stream) => {
        if (audioRef.current) {
          audioRef.current.srcObject = stream;
        }
        
        // Media Session API for Lock Screen
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: 'Live Azan',
            artist: selectedMosque.name,
            album: selectedMosque.location,
            artwork: [
              { src: 'https://picsum.photos/seed/mosque/512/512', sizes: '512x512', type: 'image/png' }
            ]
          });
          
          navigator.mediaSession.setActionHandler('play', () => audioRef.current?.play());
          navigator.mediaSession.setActionHandler('pause', () => audioRef.current?.pause());
        }
      });
      setIsListening(true);
    } else {
      webrtcRef.current?.stop();
      setIsListening(false);
    }
  };

  const handleSetHomeMosque = async () => {
    if (!selectedMosque) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        homeMosqueId: selectedMosque.id
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const requestNotificationPermission = async () => {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          backgroundEnabled: true
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      }
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  useEffect(() => {
    if (user.homeMosqueId && user.backgroundEnabled) {
      const path = `mosques/${user.homeMosqueId}`;
      const unsubscribe = onSnapshot(doc(db, 'mosques', user.homeMosqueId), (snap) => {
        if (snap.exists()) {
          const m = snap.data() as Mosque;
          if (m.isLive) {
            new Notification('Azan is Live!', {
              body: `Live Azan has started at ${m.name}. Click to join.`,
              icon: 'https://picsum.photos/seed/mosque/128/128',
              tag: 'azan-live'
            });
          }
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      });
      return unsubscribe;
    }
  }, [user.homeMosqueId, user.backgroundEnabled]);

  const filteredMosques = mosques.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    m.location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search nearby mosques..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl border border-gray-100 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {filteredMosques.map(m => (
            <MosqueCard 
              key={m.id} 
              mosque={m} 
              onSelect={() => setSelectedMosque(m)}
              isSelected={selectedMosque?.id === m.id}
            />
          ))}
          {filteredMosques.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-400">
              <Info className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No mosques found in your area.</p>
            </div>
          )}
        </div>
      </div>

      <div className="lg:col-span-1">
        <AnimatePresence mode="wait">
          {selectedMosque ? (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-white p-8 rounded-[2rem] shadow-xl border border-gray-100 sticky top-24"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-indigo-100 rounded-2xl">
                  <Radio className={cn("w-8 h-8", selectedMosque.isLive ? "text-red-500 animate-pulse" : "text-indigo-600")} />
                </div>
                {selectedMosque.isLive && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-600 rounded-full text-xs font-black uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-ping" />
                    Live
                  </div>
                )}
              </div>

              <h2 className="text-2xl font-black mb-1">{selectedMosque.name}</h2>
              <p className="text-gray-500 text-sm mb-4 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> {selectedMosque.location}
              </p>

              <div className="flex gap-2 mb-8">
                <button
                  onClick={handleSetHomeMosque}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-xs font-bold transition-all border",
                    user.homeMosqueId === selectedMosque.id 
                      ? "bg-indigo-600 border-indigo-600 text-white" 
                      : "bg-white border-gray-200 text-gray-600 hover:border-indigo-600"
                  )}
                >
                  {user.homeMosqueId === selectedMosque.id ? "Home Mosque" : "Set as Home"}
                </button>
                {!user.backgroundEnabled && (
                  <button
                    onClick={requestNotificationPermission}
                    className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all"
                  >
                    Enable Alerts
                  </button>
                )}
              </div>

              {selectedMosque.isLive ? (
                <div className="space-y-6">
                  <audio ref={audioRef} autoPlay />
                  <button
                    onClick={toggleListen}
                    className={cn(
                      "w-full py-5 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-3 shadow-lg",
                      isListening 
                        ? "bg-gray-100 text-gray-900 hover:bg-gray-200" 
                        : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200"
                    )}
                  >
                    {isListening ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    {isListening ? "Mute Azan" : "Listen Live"}
                  </button>

                  <div className="space-y-3">
                    <div className="flex justify-between text-xs font-bold text-gray-400 uppercase">
                      <span>Volume</span>
                      <span>{volume}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={volume}
                      onChange={(e) => setVolume(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>
                  
                  <div className="p-4 bg-green-50 rounded-2xl flex gap-3 items-start">
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-green-800 font-medium leading-tight">
                      Connected to mosque stream. Audio will play automatically when Azan starts.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-gray-50 rounded-2xl text-center space-y-4">
                  <MicOff className="w-10 h-10 text-gray-300 mx-auto" />
                  <p className="text-gray-500 font-medium">No live broadcast at the moment.</p>
                  <button className="text-indigo-600 font-bold text-sm hover:underline flex items-center justify-center gap-1 mx-auto">
                    View Schedule <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="mt-8 pt-8 border-t border-gray-100 space-y-6">
                <PrayerSchedule city={selectedMosque.location.split(',')[0].trim()} />
                
                <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors group">
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-gray-400 group-hover:text-indigo-600" />
                    <span className="font-bold text-gray-700">Notifications</span>
                  </div>
                  <div className="w-10 h-6 bg-indigo-600 rounded-full relative">
                    <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                  </div>
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="bg-white p-12 rounded-[2rem] shadow-xl border border-gray-100 text-center space-y-4">
              <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <Radio className="w-10 h-10 text-indigo-200" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Select a Mosque</h3>
              <p className="text-gray-500">Choose a nearby mosque to listen to live Azan and receive updates.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, authLoading] = useAuthState(auth);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mosque, setMosque] = useState<Mosque | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      const path = `users/${user.uid}`;
      const unsubscribe = onSnapshot(doc(db, 'users', user.uid), async (snap) => {
        if (snap.exists()) {
          const userData = snap.data() as UserProfile;
          setProfile(userData);
          
          if (userData.role === 'muazzin' && userData.mosqueId) {
            try {
              const mSnap = await getDoc(doc(db, 'mosques', userData.mosqueId));
              if (mSnap.exists()) {
                setMosque({ id: mSnap.id, ...mSnap.data() } as Mosque);
              }
            } catch (error) {
              handleFirestoreError(error, OperationType.GET, `mosques/${userData.mosqueId}`);
            }
          }
        } else {
          setProfile(null);
        }
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      });
      return unsubscribe;
    } else {
      setProfile(null);
      setMosque(null);
      setLoading(false);
    }
  }, [user]);

  const handleOnboarding = async (data: any) => {
    if (!user) return;
    
    let mosqueId = '';
    try {
      if (data.role === 'muazzin') {
        const mosqueRef = await addDoc(collection(db, 'mosques'), {
          name: data.mosqueName,
          location: data.mosqueLocation,
          adminUid: user.uid,
          isLive: false
        });
        mosqueId = mosqueRef.id;
      }

      const newProfile: UserProfile = {
        uid: user.uid,
        name: data.name,
        email: user.email || '',
        role: data.role,
        mosqueId: mosqueId || undefined
      };

      await setDoc(doc(db, 'users', user.uid), newProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'onboarding');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="font-bold text-gray-500 animate-pulse">Connecting to AzanConnect...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#F8F9FE] text-gray-900 font-sans selection:bg-indigo-100">
        <Header />
        
        <main className="pb-24">
          {!user ? (
            <div className="max-w-4xl mx-auto px-6 py-24 text-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full font-bold text-sm">
                  <span className="w-2 h-2 bg-indigo-600 rounded-full animate-ping" />
                  Real-time Spiritual Connection
                </div>
                <h2 className="text-6xl font-black tracking-tight leading-tight">
                  Hear the Azan Clearly,<br />
                  <span className="text-indigo-600">Wherever You Are.</span>
                </h2>
                <p className="text-xl text-gray-500 max-w-2xl mx-auto">
                  Connect your home to your local mosque. Listen to live Azan and announcements 
                  with zero latency on any device.
                </p>
                <div className="pt-8">
                  <button
                    onClick={signIn}
                    className="px-12 py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-xl hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-200 hover:-translate-y-1 active:translate-y-0"
                  >
                    Join the Community
                  </button>
                </div>
                
                <div className="pt-24 grid grid-cols-3 gap-8 max-w-3xl mx-auto opacity-50 grayscale hover:grayscale-0 transition-all duration-700">
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-4xl font-black">10k+</div>
                    <div className="text-xs font-bold uppercase tracking-widest">Listeners</div>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-4xl font-black">500+</div>
                    <div className="text-xs font-bold uppercase tracking-widest">Mosques</div>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-4xl font-black">0.3s</div>
                    <div className="text-xs font-bold uppercase tracking-widest">Latency</div>
                  </div>
                </div>
              </motion.div>
            </div>
          ) : !profile ? (
            <Onboarding onComplete={handleOnboarding} />
          ) : profile.role === 'muazzin' && mosque ? (
            <div className="px-6 py-12">
              <Broadcaster mosque={mosque} user={profile} />
            </div>
          ) : (
            <Listener user={profile} />
          )}
        </main>

        {/* Footer / Bottom Nav for Mobile */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-gray-100 px-6 py-4 lg:hidden">
          <div className="flex justify-around items-center">
            <button className="p-2 text-indigo-600"><Radio className="w-6 h-6" /></button>
            <button className="p-2 text-gray-400"><Search className="w-6 h-6" /></button>
            <button className="p-2 text-gray-400"><Bell className="w-6 h-6" /></button>
            <button className="p-2 text-gray-400"><Settings className="w-6 h-6" /></button>
          </div>
        </nav>
      </div>
    </ErrorBoundary>
  );
}
