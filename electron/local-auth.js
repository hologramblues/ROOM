// electron/local-auth.js — Stub auth for local desktop user (no JWT, no passwords)

const LOCAL_USER = {
  _id: 'local-user',
  name: 'Moi',
  email: 'local@rooms.desktop',
  color: '#4ECDC4',
};

// Express middleware — always inject local user
const authMiddleware = (req, res, next) => {
  req.user = LOCAL_USER;
  req.token = 'local';
  next();
};

// Same as authMiddleware for desktop (no optional — always logged in)
const optionalAuthMiddleware = (req, res, next) => {
  req.user = LOCAL_USER;
  req.token = 'local';
  next();
};

// Socket.io middleware — inject local user on every connection
const socketAuthMiddleware = (socket, next) => {
  socket.user = LOCAL_USER;
  next();
};

module.exports = {
  LOCAL_USER,
  authMiddleware,
  optionalAuthMiddleware,
  socketAuthMiddleware,
};
