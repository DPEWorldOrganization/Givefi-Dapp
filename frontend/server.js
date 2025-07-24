import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Serve static files from the current directory
app.use('/utils', express.static(path.join(__dirname, 'utils')));
app.use('/pages', express.static(path.join(__dirname, 'pages')));
app.use('/styles', express.static(path.join(__dirname, 'styles')));
app.use('/components', express.static(path.join(__dirname, 'components')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'index-integrated.html'));
});

app.get('/create', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'create-raffle.html'));
});

app.get('/browse', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'browse.html'));
});

// API endpoints for future backend integration
app.get('/api/raffles', (req, res) => {
    // Mock raffle data
    res.json({
        raffles: [
            {
                id: 'bmw-raffle-1',
                title: 'BMW 640i M Sport',
                description: 'Luxury sports coupe worth $70,000+',
                entryFee: 0.1,
                maxParticipants: 50,
                currentParticipants: 23,
                endTime: Date.now() + (2 * 24 * 60 * 60 * 1000),
                prizeValue: 70000,
                cashOption: 3.3,
                host: '48mihemhp1UxYjz1UznH4fJ9FnF3AfN3XG18GasPFamU',
                status: 'active'
            }
        ]
    });
});

app.get('/api/raffle/:id', (req, res) => {
    const { id } = req.params;
    
    // Mock individual raffle data
    res.json({
        id: id,
        title: 'BMW 640i M Sport',
        description: 'Luxury sports coupe worth $70,000+',
        entryFee: 0.1,
        maxParticipants: 50,
        currentParticipants: 23,
        endTime: Date.now() + (2 * 24 * 60 * 60 * 1000),
        prizeValue: 70000,
        cashOption: 3.3,
        host: '48mihemhp1UxYjz1UznH4fJ9FnF3AfN3XG18GasPFamU',
        status: 'active',
        participants: [] // Would contain participant public keys
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        solanaNetwork: 'localhost:8899',
        programId: '48mihemhp1UxYjz1UznH4fJ9FnF3AfN3XG18GasPFamU'
    });
});

app.listen(PORT, () => {
    console.log(`🚀 GiveFi Frontend Server running on http://localhost:${PORT}`);
    console.log(`📝 Health check: http://localhost:${PORT}/health`);
    console.log(`🎲 Raffle API: http://localhost:${PORT}/api/raffles`);
    console.log(`💎 Smart Contract: 48mihemhp1UxYjz1UznH4fJ9FnF3AfN3XG18GasPFamU`);
    console.log(`🔗 Solana Network: localhost:8899`);
});
