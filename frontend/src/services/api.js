import axios from 'axios';

// Fallback to local 8000 for dev if env is missing
const baseURL = 'https://zero-hour-832409031925.europe-west1.run.app';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
