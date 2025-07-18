require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const Redis = require('redis');
const jwt = require('jsonwebtoken');
const { Connection, PublicKey, clusterApiUrl } = require('@solana/web3.js');
const bs58 = require('bs58');
const nacl = require('tweetnacl');
const cron = require('node-cron');

// --- Express & Socket.io Setup ---
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// --- Database & Redis ---
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
const redis = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// --- Solana Connection ---
const connection = new Connection(
  process.env.SOLANA_RPC_URL || clusterApiUrl('devnet'),
  'confirmed'
);

// --- Middleware ---
app.use(helmet());
app.use(cors());
app.use(express.json());
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// --- JWT Auth Middleware ---
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// --- Routes ---

// 1. Wallet Authentication (with signature verification)
app.post('/api/auth/connect', async (req, res) => {
  try {
    const { publicKey, signature, message } = req.body;
    if (!publicKey || !signature || !message) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    // Proper signature verification
    const isValidSignature = nacl.sign.detached.verify(
      Buffer.from(message),
      bs58.decode(signature),
      bs58.decode(publicKey)
    );
    if (!isValidSignature) {
      return res.status(400).json({ error: 'Invalid signature' });
    }
    // Get or create user
    let user = await db.query(
      'SELECT * FROM users WHERE wallet_address = $1',
      [publicKey]
    );
    if (user.rows.length === 0) {
      user = await db.query(
        'INSERT INTO users (wallet_address, created_at) VALUES ($1, NOW()) RETURNING *',
        [publicKey]
      );
    }
    const token = jwt.sign(
      { userId: user.rows[0].id, walletAddress: publicKey },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({
      token,
      user: {
        id: user.rows[0].id,
        walletAddress: publicKey,
        createdAt: user.rows[0].created_at
      }
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// 2. Get all raffles
app.get('/api/raffles', async (req, res) => {
  try {
    const { status, creator, limit = 20, offset = 0 } = req.query;
    let query = `
      SELECT r.*, u.wallet_address as creator_wallet,
             COUNT(e.id) as current_participants,
             SUM(CASE WHEN e.refunded = false THEN r.entry_fee ELSE 0 END) as total_collected
      FROM raffles r
      LEFT JOIN users u ON r.creator_id = u.id
      LEFT JOIN raffle_entries e ON r.id = e.raffle_id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;
    if (status) {
      query += ` AND r.status = $${++paramCount}`;
      params.push(status);
    }
    if (creator) {
      query += ` AND u.wallet_address = $${++paramCount}`;
      params.push(creator);
    }
    query += `
      GROUP BY r.id, u.wallet_address
      ORDER BY r.created_at DESC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;
    params.push(limit, offset);
    const result = await db.query(query, params);
    // Add real-time data from cache
    const rafflesWithLiveData = await Promise.all(
      result.rows.map(async (raffle) => {
        const liveData = await redis.get(`raffle:${raffle.id}:live`);
        return {
          ...raffle,
          liveData: liveData ? JSON.parse(liveData) : null
        };
      })
    );
    res.json(rafflesWithLiveData);
  } catch (error) {
    console.error('Get raffles error:', error);
    res.status(500).json({ error: 'Failed to fetch raffles' });
  }
});

// 3. Get specific raffle
app.get('/api/raffles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const raffle = await db.query(`
      SELECT r.*, u.wallet_address as creator_wallet,
             COUNT(e.id) as current_participants,
             SUM(CASE WHEN e.refunded = false THEN r.entry_fee ELSE 0 END) as total_collected
      FROM raffles r
      LEFT JOIN users u ON r.creator_id = u.id
      LEFT JOIN raffle_entries e ON r.id = e.raffle_id
      WHERE r.id = $1
      GROUP BY r.id, u.wallet_address
    `, [id]);
    if (raffle.rows.length === 0) {
      return res.status(404).json({ error: 'Raffle not found' });
    }
    // Get recent participants
    const participants = await db.query(`
      SELECT e.*, u.wallet_address
      FROM raffle_entries e
      JOIN users u ON e.user_id = u.id
      WHERE e.raffle_id = $1 AND e.refunded = false
      ORDER BY e.created_at DESC
      LIMIT 50
    `, [id]);
    const raffleData = {
      ...raffle.rows[0],
      participants: participants.rows
    };
    res.json(raffleData);
  } catch (error) {
    console.error('Get raffle error:', error);
    res.status(500).json({ error: 'Failed to fetch raffle' });
  }
});

// 4. Create raffle
app.post('/api/raffles', authenticateToken, async (req, res) => {
  try {
    const {
      title, description, imageUri, entryFee, minParticipants, maxParticipants,
      durationHours, prizeType, prizeValue, shippingInfo, transactionSignature
    } = req.body;
    // Verify transaction on Solana
    const transaction = await connection.getTransaction(transactionSignature);
    if (!transaction) {
      return res.status(400).json({ error: 'Invalid transaction signature' });
    }
    const endTime = new Date(Date.now() + durationHours * 60 * 60 * 1000);
    const result = await db.query(`
      INSERT INTO raffles (
        creator_id, title, description, image_uri, entry_fee,
        min_participants, max_participants, duration_hours,
        prize_type, prize_value, shipping_info, end_time,
        blockchain_address, transaction_signature, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'active')
      RETURNING *
    `, [
      req.user.userId, title, description, imageUri, entryFee,
      minParticipants, maxParticipants, durationHours,
      prizeType, prizeValue, shippingInfo, endTime,
      null, transactionSignature
    ]);
    const raffle = result.rows[0];
    io.emit('raffleCreated', raffle);
    await redis.setEx(`raffle:${raffle.id}:live`, 3600, JSON.stringify({
      currentParticipants: 0,
      totalCollected: 0,
      lastActivity: new Date().toISOString()
    }));
    res.status(201).json(raffle);
  } catch (error) {
    console.error('Create raffle error:', error);
    res.status(500).json({ error: 'Failed to create raffle' });
  }
});

// 5. Enter raffle
app.post('/api/raffles/:id/enter', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { transactionSignature } = req.body;
    const transaction = await connection.getTransaction(transactionSignature);
    if (!transaction) {
      return res.status(400).json({ error: 'Invalid transaction signature' });
    }
    const raffle = await db.query('SELECT * FROM raffles WHERE id = $1', [id]);
    if (raffle.rows.length === 0) {
      return res.status(404).json({ error: 'Raffle not found' });
    }
    const raffleData = raffle.rows[0];
    if (raffleData.status !== 'active' || new Date() > raffleData.end_time) {
      return res.status(400).json({ error: 'Raffle is not active' });
    }
    const existingEntry = await db.query(
      'SELECT id FROM raffle_entries WHERE raffle_id = $1 AND user_id = $2',
      [id, req.user.userId]
    );
    if (existingEntry.rows.length > 0) {
      return res.status(400).json({ error: 'Already entered this raffle' });
    }
    const countResult = await db.query(
      'SELECT COUNT(*) as count FROM raffle_entries WHERE raffle_id = $1 AND refunded = false',
      [id]
    );
    const currentCount = parseInt(countResult.rows[0].count);
    if (raffleData.max_participants && currentCount >= raffleData.max_participants) {
      return res.status(400).json({ error: 'Raffle is full' });
    }
    const entry = await db.query(`
      INSERT INTO raffle_entries (raffle_id, user_id, entry_number, transaction_signature)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [id, req.user.userId, currentCount, transactionSignature]);
    const newCount = currentCount + 1;
    const newTotal = newCount * raffleData.entry_fee;
    await redis.setEx(`raffle:${id}:live`, 3600, JSON.stringify({
      currentParticipants: newCount,
      totalCollected: newTotal,
      lastActivity: new Date().toISOString(),
      lastParticipant: req.user.walletAddress
    }));
    io.emit('raffleEntry', {
      raffleId: id,
      participant: req.user.walletAddress,
      entryNumber: currentCount,
      currentParticipants: newCount,
      totalCollected: newTotal
    });
    res.status(201).json(entry.rows[0]);
  } catch (error) {
    console.error('Enter raffle error:', error);
    res.status(500).json({ error: 'Failed to enter raffle' });
  }
});

// --- Additional endpoints (user raffles, stats, activity, etc.) can be added as needed ---

// --- WebSocket connections ---
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('joinRaffle', (raffleId) => socket.join(`raffle:${raffleId}`));
  socket.on('leaveRaffle', (raffleId) => socket.leave(`raffle:${raffleId}`));
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

// --- Background tasks ---
cron.schedule('*/30 * * * * *', async () => {
  try {
    const onlineUsers = io.engine.clientsCount;
    const liveData = await db.query(`
      SELECT 
        COUNT(CASE WHEN r.status = 'active' THEN 1 END) as active_raffles,
        COUNT(CASE WHEN e.created_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as entries_last_hour,
        COUNT(CASE WHEN r.status = 'completed' AND DATE(r.winner_selected_at) = CURRENT_DATE THEN 1 END) as winners_today
      FROM raffles r
      LEFT JOIN raffle_entries e ON r.id = e.raffle_id
    `);
    const liveStats = {
      onlineUsers,
      timestamp: new Date().toISOString(),
      ...liveData.rows[0]
    };
    await redis.setEx('platform:live_stats', 60, JSON.stringify(liveStats));
    io.emit('liveStatsUpdate', liveStats);
  } catch (error) {
    console.error('Live stats update error:', error);
  }
});

// --- Error handling ---
app.use((error, req, res, next) => {
  console.error('API Error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// --- Initialize connections ---
async function initializeServer() {
  try {
    await redis.connect();
    console.log('Connected to Redis');
    await db.query('SELECT NOW()');
    console.log('Connected to PostgreSQL');
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`GiveFi API server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

initializeServer();

module.exports = { app, io, db, redis };