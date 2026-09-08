import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import denunciasRoutes from './routes/denuncias.js';
import personalRoutes from './routes/personal.js';
import usuariosRoutes from './routes/usuarios.js';

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(
  cors({
    origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(','),
  })
);

// Limita intentos para mitigar fuerza bruta en el login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intente más tarde.' },
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/denuncias', denunciasRoutes);
app.use('/api/personal', personalRoutes);
app.use('/api/usuarios', usuariosRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Recurso no encontrado.' });
});

app.listen(config.port, () => {
  console.log(`[server] API escuchando en el puerto ${config.port}`);
});
