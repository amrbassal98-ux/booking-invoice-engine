import jwt from 'jsonwebtoken';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  if (!process.env.JWT_SECRET) {
    console.error("CRITICAL: JWT_SECRET is not configured in the environment.");
    return res.status(500).json({ error: "Internal authentication configuration error." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      user_id: decoded.user_id,
      tenant_id: decoded.tenant_id,
      role: decoded.role
    };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: "Access denied. Token has expired." });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: "Access denied. Invalid token." });
    }
    console.error("Token verification failed:", error.message);
    return res.status(403).json({ error: "Access denied. Token verification failed." });
  }
};

export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ error: "Access denied. No user role found." });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: "Access denied. Insufficient permissions for this resource." 
      });
    }

    next();
  };
};
