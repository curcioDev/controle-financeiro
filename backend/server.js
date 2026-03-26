const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Load .env file manually
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
        const [key, ...valParts] = line.trim().split('=');
        if (key && !key.startsWith('#')) process.env[key] = valParts.join('=');
    });
}

const { authMiddleware } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const transacoesRoutes = require('./routes/transacoes');
const produtosRoutes = require('./routes/produtos');
const clientesRoutes = require('./routes/clientes');
const dashboardRoutes = require('./routes/dashboard');
const patrimonioRoutes = require('./routes/patrimonio');
const equipeRoutes = require('./routes/equipe');
const producaoRoutes = require('./routes/producao');
const funcionariosRoutes = require('./routes/funcionarios');
const apontamentosRoutes = require('./routes/apontamentos');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    });
    next();
});

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/transacoes', authMiddleware, transacoesRoutes);
app.use('/api/produtos', authMiddleware, produtosRoutes);
app.use('/api/clientes', authMiddleware, clientesRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/patrimonio', authMiddleware, patrimonioRoutes);
app.use('/api/equipe', authMiddleware, equipeRoutes);
app.use('/api/producao', authMiddleware, producaoRoutes);
app.use('/api/funcionarios', authMiddleware, funcionariosRoutes);
app.use('/api/apontamentos', authMiddleware, apontamentosRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
});

app.listen(PORT, () => {
    console.log(`\n🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📊 API disponível em http://localhost:${PORT}/api`);
    console.log(`🔐 Login: POST http://localhost:${PORT}/api/auth/login\n`);
});
