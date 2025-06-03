// Middleware to ensure user is authenticated
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    // If authenticated, proceed to the next middleware or route handler
    return next();
  }
  // If not authenticated, send a 401 Unauthorized response
  res.status(401).json({ message: 'Unauthorized: Please log in.' });
};

module.exports = { ensureAuthenticated }; 