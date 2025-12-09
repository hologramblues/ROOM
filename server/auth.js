const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('./models');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'screenplay-collab-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

const generateToken = (user) => jwt.sign({ userId: user._id, email: user.email, name: user.name, color: user.color }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Token manquant' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) return res.status(401).json({ error: 'Utilisateur non trouvé' });
    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expiré' });
    return res.status(401).json({ error: 'Token invalide' });
  }
};

const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      if (user) { req.user = user; req.token = token; }
    }
    next();
  } catch (error) { next(); }
};

const socketAuthMiddleware = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) { socket.user = null; return next(); }
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    socket.user = user || null;
    next();
  } catch (error) { socket.user = null; next(); }
};

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Email, mot de passe et nom requis' });
    if (password.length < 6) return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères' });
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const user = new User({ email: email.toLowerCase(), password: hashedPassword, name });
    await user.save();
    const token = generateToken(user);
    res.status(201).json({ user: { id: user._id, email: user.email, name: user.name, color: user.color }, token });
  } catch (error) { console.error('Register error:', error); res.status(500).json({ error: "Erreur lors de l'inscription" }); }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    const token = generateToken(user);
    res.json({ user: { id: user._id, email: user.email, name: user.name, color: user.color }, token });
  } catch (error) { console.error('Login error:', error); res.status(500).json({ error: 'Erreur lors de la connexion' }); }
});

router.get('/me', authMiddleware, async (req, res) => {
  res.json({ user: { id: req.user._id, email: req.user.email, name: req.user.name, color: req.user.color } });
});

module.exports = { router, authMiddleware, optionalAuthMiddleware, socketAuthMiddleware, JWT_SECRET };
