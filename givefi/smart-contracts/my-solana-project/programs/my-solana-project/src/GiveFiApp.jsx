// Enhanced GiveFi Frontend with Real Web3 Integration
// React component with Solana wallet integration and real-time features

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Connection, 
  PublicKey, 
  clusterApiUrl,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { 
  useWallet, 
  WalletProvider, 
  ConnectionProvider 
} from '@solana/wallet-adapter-react';
import { 
  WalletModalProvider, 
  WalletMultiButton 
} from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { Program, AnchorProvider, web3, BN } from '@project-serum/anchor';
import io from 'socket.io-client';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';

// Configuration
const SOLANA_NETWORK = process.env.REACT_APP_SOLANA_NETWORK || 'devnet';
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const WEBSOCKET_URL = process.env.REACT_APP_WS_URL || 'http://localhost:5000';
const PROGRAM_ID = new PublicKey(process.env.REACT_APP_PROGRAM_ID || 'GiveFiRaffle11111111111111111111111111111111');

// API Service
class APIService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem('authToken');
    
    // Set up axios defaults
    axios.defaults.baseURL = this.baseURL;
    if (this.token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
    }
  }

  setAuthToken(token) {
    this.token = token;
    localStorage.setItem('authToken', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  clearAuthToken() {
    this.token = null;
    localStorage.removeItem('authToken');
    delete axios.defaults.headers.common['Authorization'];
  }

  async authenticateWallet(publicKey, signature, message) {
    try {
      const response = await axios.post('/auth/connect', {
        publicKey: publicKey.toString(),
        signature,
        message
      });
      
      this.setAuthToken(response.data.token);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Authentication failed');
    }
  }

  async getRaffles(filters = {}) {
    try {
      const params = new URLSearchParams(filters);
      const response = await axios.get(`/raffles?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to fetch raffles');
    }
  }

  async getRaffle(id) {
    try {
      const response = await axios.get(`/raffles/${id}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to fetch raffle');
    }
  }

  async createRaffle(raffleData, transactionSignature) {
    try {
      const response = await axios.post('/raffles', {
        ...raffleData,
        transactionSignature
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to create raffle');
    }
  }

  async enterRaffle(raffleId, transactionSignature) {
    try {
      const response = await axios.post(`/raffles/${raffleId}/enter`, {
        transactionSignature
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to enter raffle');
    }
  }

  async getUserRaffles(type = 'created') {
    try {
      const response = await axios.get(`/users/me/raffles?type=${type}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to fetch user raffles');
    }
  }

  async getPlatformStats() {
    try {
      const response = await axios.get('/stats');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to fetch platform stats');
    }
  }

  async getRecentActivity(limit = 20) {
    try {
      const response = await axios.get(`/activity?limit=${limit}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to fetch activity');
    }
  }

  async getTwitterFeed() {
    try {
      const response = await axios.get('/social/twitter');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to fetch Twitter feed');
    }
  }
}

// WebSocket Service
class WebSocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect() {
    this.socket = io(WEBSOCKET_URL);
    
    this.socket.on('connect', () => {
      console.log('Connected to WebSocket server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
    });

    // Set up event listeners
    this.socket.on('raffleCreated', (data) => {
      this.emit('raffleCreated', data);
    });

    this.socket.on('raffleEntry', (data) => {
      this.emit('raffleEntry', data);
    });

    this.socket.on('raffleCompleted', (data) => {
      this.emit('raffleCompleted', data);
    });

    this.socket.on('liveStatsUpdate', (data) => {
      this.emit('liveStatsUpdate', data);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data));
    }
  }

  joinRaffle(raffleId) {
    if (this.socket) {
      this.socket.emit('joinRaffle', raffleId);
    }
  }

  leaveRaffle(raffleId) {
    if (this.socket) {
      this.socket.emit('leaveRaffle', raffleId);
    }
  }
}

// Solana Service
class SolanaService {
  constructor(connection, wallet) {
    this.connection = connection;
    this.wallet = wallet;
    this.program = null;
  }

  async initializeProgram() {
    if (!this.wallet.publicKey) return;

    const provider = new AnchorProvider(
      this.connection,
      this.wallet,
      AnchorProvider.defaultOptions()
    );

    // In production, load the IDL from your deployed program
    const idl = await this.loadProgramIDL();
    this.program = new Program(idl, PROGRAM_ID, provider);
  }

  async loadProgramIDL() {
    // In production, fetch this from your program deployment
    // For now, return a simplified IDL structure
    return {
      version: "0.1.0",
      name: "givefi_raffle",
      instructions: [
        {
          name: "createRaffle",
          accounts: [
            { name: "raffle", isMut: true, isSigner: false },
            { name: "creator", isMut: true, isSigner: true },
            { name: "systemProgram", isMut: false, isSigner: false }
          ],
          args: [
            { name: "title", type: "string" },
            { name: "entryFee", type: "u64" },
            { name: "minParticipants", type: "u64" }
          ]
        },
        {
          name: "enterRaffle",
          accounts: [
            { name: "raffle", isMut: true, isSigner: false },
            { name: "participant", isMut: true, isSigner: true },
            { name: "systemProgram", isMut: false, isSigner: false }
          ],
          args: []
        }
      ],
      accounts: [
        {
          name: "Raffle",
          type: {
            kind: "struct",
            fields: [
              { name: "creator", type: "publicKey" },
              { name: "title", type: "string" },
              { name: "entryFee", type: "u64" },
              { name: "minParticipants", type: "u64" },
              { name: "currentParticipants", type: "u64" }
            ]
          }
        }
      ]
    };
  }

  async createRaffle(raffleData) {
    if (!this.program || !this.wallet.publicKey) {
      throw new Error('Wallet not connected or program not initialized');
    }

    try {
      const [rafflePDA] = await PublicKey.findProgramAddress(
        [
          Buffer.from("raffle"),
          this.wallet.publicKey.toBuffer(),
          new BN(Date.now()).toArrayLike(Buffer, "le", 8)
        ],
        PROGRAM_ID
      );

      const tx = await this.program.methods
        .createRaffle(
          raffleData.title,
          new BN(raffleData.entryFee * LAMPORTS_PER_SOL),
          new BN(raffleData.minParticipants)
        )
        .accounts({
          raffle: rafflePDA,
          creator: this.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      return { signature: tx, rafflePDA };
    } catch (error) {
      console.error('Create raffle error:', error);
      throw new Error('Failed to create raffle on blockchain');
    }
  }

  async enterRaffle(raffleAddress) {
    if (!this.program || !this.wallet.publicKey) {
      throw new Error('Wallet not connected or program not initialized');
    }

    try {
      const tx = await this.program.methods
        .enterRaffle()
        .accounts({
          raffle: new PublicKey(raffleAddress),
          participant: this.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      return tx;
    } catch (error) {
      console.error('Enter raffle error:', error);
      throw new Error('Failed to enter raffle on blockchain');
    }
  }

  async getBalance() {
    if (!this.wallet.publicKey) return 0;
    
    try {
      const balance = await this.connection.getBalance(this.wallet.publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('Get balance error:', error);
      return 0;
    }
  }
}

// Main App Component
const GiveFiApp = () => {
  // Wallet setup
  const wallets = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    new TorusWalletAdapter(),
  ];

  const endpoint = clusterApiUrl(SOLANA_NETWORK);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="App">
            <MainApp />
            <ToastContainer position="top-right" />
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

// Main Application Logic
const MainApp = () => {
  const wallet = useWallet();
  const [connection] = useState(() => new Connection(clusterApiUrl(SOLANA_NETWORK), 'confirmed'));
  const [apiService] = useState(() => new APIService());
  const [wsService] = useState(() => new WebSocketService());
  const [solanaService, setSolanaService] = useState(null);
  
  // Application state
  const [raffles, setRaffles] = useState([]);
  const [userRaffles, setUserRaffles] = useState([]);
  const [platformStats, setPlatformStats] = useState({});
  const [recentActivity, setRecentActivity] = useState([]);
  const [twitterFeed, setTwitterFeed] = useState([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [currentView, setCurrentView] = useState('home');

  // Initialize services when wallet connects
  useEffect(() => {
    if (wallet.connected && wallet.publicKey) {
      const service = new SolanaService(connection, wallet);
      service.initializeProgram().then(() => {
        setSolanaService(service);
        updateBalance();
        authenticateUser();
      });
    } else {
      setSolanaService(null);
      apiService.clearAuthToken();
    }
  }, [wallet.connected, wallet.publicKey]);

  // Initialize WebSocket
  useEffect(() => {
    wsService.connect();
    
    // Set up WebSocket listeners
    wsService.on('raffleCreated', handleRaffleCreated);
    wsService.on('raffleEntry', handleRaffleEntry);
    wsService.on('liveStatsUpdate', handleLiveStatsUpdate);

    return () => {
      wsService.disconnect();
    };
  }, []);

  // Load initial data
  useEffect(() => {
    loadRaffles();
    loadPlatformStats();
    loadRecentActivity();
    loadTwitterFeed();
  }, []);

  // WebSocket event handlers
  const handleRaffleCreated = useCallback((data) => {
    setRaffles(prev => [data, ...prev]);
    toast.success(`New raffle created: ${data.title}`);
  }, []);

  const handleRaffleEntry = useCallback((data) => {
    setRaffles(prev => prev.map(raffle => 
      raffle.id === data.raffleId 
        ? { ...raffle, current_participants: data.currentParticipants }
        : raffle
    ));
    
    // Add to recent activity
    setRecentActivity(prev => [{
      type: 'entry',
      participant: data.participant,
      raffle_title: 'Current Raffle',
      created_at: new Date().toISOString()
    }, ...prev.slice(0, 19)]);
  }, []);

  const handleLiveStatsUpdate = useCallback((data) => {
    setPlatformStats(prev => ({ ...prev, ...data }));
  }, []);

  // API functions
  const authenticateUser = async () => {
    if (!wallet.publicKey) return;

    try {
      // Create a message to sign
      const message = `Sign this message to authenticate with GiveFi: ${Date.now()}`;
      const encodedMessage = new TextEncoder().encode(message);
      
      // Sign the message
      const signature = await wallet.signMessage(encodedMessage);
      
      // Authenticate with backend
      await apiService.authenticateWallet(
        wallet.publicKey,
        Array.from(signature),
        message
      );
      
      toast.success('Wallet authenticated successfully!');
    } catch (error) {
      console.error('Authentication error:', error);
      toast.error('Failed to authenticate wallet');
    }
  };

  const updateBalance = async () => {
    if (solanaService) {
      try {
        const newBalance = await solanaService.getBalance();
        setBalance(newBalance);
      } catch (error) {
        console.error('Balance update error:', error);
      }
    }
  };

  const loadRaffles = async () => {
    try {
      setLoading(true);
      const data = await apiService.getRaffles();
      setRaffles(data);
    } catch (error) {
      console.error('Load raffles error:', error);
      toast.error('Failed to load raffles');
    } finally {
      setLoading(false);
    }
  };

  const loadUserRaffles = async () => {
    if (!wallet.connected) return;
    
    try {
      const [created, entered] = await Promise.all([
        apiService.getUserRaffles('created'),
        apiService.getUserRaffles('entered')
      ]);
      
      setUserRaffles({ created, entered });
    } catch (error) {
      console.error('Load user raffles error:', error);
      toast.error('Failed to load your raffles');
    }
  };

  const loadPlatformStats = async () => {
    try {
      const stats = await apiService.getPlatformStats();
      setPlatformStats(stats);
    } catch (error) {
      console.error('Load platform stats error:', error);
    }
  };

  const loadRecentActivity = async () => {
    try {
      const activity = await apiService.getRecentActivity();
      setRecentActivity(activity);
    } catch (error) {
      console.error('Load recent activity error:', error);
    }
  };

  const loadTwitterFeed = async () => {
    try {
      const tweets = await apiService.getTwitterFeed();
      setTwitterFeed(tweets);
    } catch (error) {
      console.error('Load Twitter feed error:', error);
    }
  };

  const createRaffle = async (raffleData) => {
    if (!solanaService) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      setLoading(true);
      
      // Create raffle on blockchain
      const { signature, rafflePDA } = await solanaService.createRaffle(raffleData);
      
      // Save to backend
      await apiService.createRaffle({
        ...raffleData,
        blockchainAddress: rafflePDA.toString()
      }, signature);
      
      toast.success('Raffle created successfully!');
      loadRaffles();
      updateBalance();
    } catch (error) {
      console.error('Create raffle error:', error);
      toast.error(error.message || 'Failed to create raffle');
    } finally {
      setLoading(false);
    }
  };

  const enterRaffle = async (raffle) => {
    if (!solanaService) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (balance < raffle.entry_fee) {
      toast.error('Insufficient balance');
      return;
    }

    try {
      setLoading(true);
      
      // Enter raffle on blockchain
      const signature = await solanaService.enterRaffle(raffle.blockchain_address);
      
      // Save entry to backend
      await apiService.enterRaffle(raffle.id, signature);
      
      toast.success('Successfully entered the raffle!');
      loadRaffles();
      updateBalance();
    } catch (error) {
      console.error('Enter raffle error:', error);
      toast.error(error.message || 'Failed to enter raffle');
    } finally {
      setLoading(false);
    }
  };

  // Render functions would go here...
  // For brevity, I'll include just the main structure

  const renderNavigation = () => (
    <nav className="navbar">
      <div className="nav-content">
        <div className="logo">GiveFi 🎲</div>
        <ul className="nav-links">
          <li><a onClick={() => setCurrentView('home')}>Home</a></li>
          <li><a onClick={() => setCurrentView('raffles')}>Raffles</a></li>
          <li><a onClick={() => setCurrentView('create')}>Create</a></li>
          {wallet.connected && (
            <li><a onClick={() => { setCurrentView('my-raffles'); loadUserRaffles(); }}>My Raffles</a></li>
          )}
        </ul>
        <div className="wallet-section">
          {wallet.connected && (
            <div className="balance">
              {balance.toFixed(2)} SOL
            </div>
          )}
          <WalletMultiButton />
        </div>
      </div>
    </nav>
  );

  const renderLiveStats = () => (
    <div className="live-stats">
      <div className="stat-item">
        <div className="stat-value">{platformStats.active_raffles || 0}</div>
        <div className="stat-label">Active Raffles</div>
      </div>
      <div className="stat-item">
        <div className="stat-value">{platformStats.onlineUsers || 0}</div>
        <div className="stat-label">Online Users</div>
      </div>
      <div className="stat-item">
        <div className="stat-value">${(platformStats.total_volume || 0).toLocaleString()}</div>
        <div className="stat-label">Total Volume</div>
      </div>
      <div className="stat-item">
        <div className="stat-value">{platformStats.today_winners || 0}</div>
        <div className="stat-label">Today's Winners</div>
      </div>
    </div>
  );

  const renderRaffleCard = (raffle) => (
    <div key={raffle.id} className="raffle-card" onClick={() => {/* Open raffle details */}}>
      <div className="raffle-emoji">{raffle.emoji || '🎁'}</div>
      <h3>{raffle.title}</h3>
      <div className="raffle-prize">${raffle.prize_value?.toLocaleString()}</div>
      <div className="raffle-stats">
        <span>{raffle.current_participants}/{raffle.min_participants} entries</span>
        <span>⏰ {raffle.time_left}</span>
      </div>
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${Math.min((raffle.current_participants / raffle.min_participants) * 100, 100)}%` }}
        />
      </div>
      <button 
        className="enter-btn"
        onClick={(e) => { e.stopPropagation(); enterRaffle(raffle); }}
        disabled={!wallet.connected || loading}
      >
        {wallet.connected ? `Enter for ${raffle.entry_fee} SOL` : 'Connect Wallet'}
      </button>
    </div>
  );

  return (
    <div className="givefi-app">
      {renderNavigation()}
      
      {currentView === 'home' && (
        <div className="home-view">
          <div className="hero">
            <h1>Decentralized Raffles Done Right</h1>
            <p>The future of transparent, blockchain-powered raffles is here.</p>
            <button onClick={() => setCurrentView('raffles')}>
              View Featured Raffles
            </button>
          </div>
          
          {renderLiveStats()}
          
          <div className="featured-raffles">
            <h2>🔥 Featured Raffles</h2>
            <div className="raffles-grid">
              {raffles.slice(0, 3).map(renderRaffleCard)}
            </div>
          </div>
        </div>
      )}

      {currentView === 'raffles' && (
        <div className="raffles-view">
          <h2>All Raffles</h2>
          {loading ? (
            <div className="loading">Loading raffles...</div>
          ) : (
            <div className="raffles-grid">
              {raffles.map(renderRaffleCard)}
            </div>
          )}
        </div>
      )}

      {/* Additional views would be implemented here */}
    </div>
  );
};

export default GiveFiApp;