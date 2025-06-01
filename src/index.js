require('dotenv').config();
const express = require('express');
const connectToMongo = require('./config/mongoose');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

const ingestionRoutes = require('./routes/ingestion.routes');
app.use('/api/ingest', ingestionRoutes);

// Health check 
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

connectToMongo().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server listening on http://localhost:${PORT}`);
  });
});
