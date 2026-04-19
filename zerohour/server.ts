import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(express.json());

  // Mock database
  let ngoRequests = [
    {
      id: '1',
      ngoName: 'Red Cross Kolkata',
      taskType: 'Medical Aid',
      description: 'Need volunteers with basic first aid for flood relief camp.',
      skillsRequired: ['first aid', 'emergency response'],
      assetsRequired: [],
      location: { lat: 22.5726, lng: 88.3639, address: 'Park Street, Kolkata' },
      urgency: 5,
      createdAt: Date.now(),
    },
    {
      id: '2',
      ngoName: 'Food For All',
      taskType: 'Logistics',
      description: 'Distribution of dry rations to affected areas. 4x4 vehicles needed.',
      skillsRequired: ['driving', 'heavy lifting'],
      assetsRequired: ['4x4 vehicle'],
      location: { lat: 22.5215, lng: 88.3545, address: 'Ballygunge, Kolkata' },
      urgency: 4,
      createdAt: Date.now(),
    },
  ];

  // WebSocket for real-time updates
  wss.on('connection', (ws) => {
    console.log('Client connected');
    ws.send(JSON.stringify({ type: 'INIT', requests: ngoRequests }));
  });

  function broadcastRequests() {
    const data = JSON.stringify({ type: 'UPDATE', requests: ngoRequests });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  // API Routes
  app.get('/api/requests', (req, res) => {
    res.json(ngoRequests);
  });

  app.post('/api/dispatch', (req, res) => {
    const { requestId, volunteerId, volunteerName } = req.body;
    
    // Broadcast to all clients (including NGO dashboard)
    const data = JSON.stringify({ 
      type: 'DISPATCH', 
      requestId, 
      volunteerId, 
      volunteerName,
      timestamp: Date.now()
    });
    
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });

    res.status(200).json({ success: true });
  });

  app.post('/api/requests', (req, res) => {
    const newRequest = {
      ...req.body,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: Date.now(),
    };
    ngoRequests.push(newRequest);
    broadcastRequests();
    res.status(201).json(newRequest);
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
