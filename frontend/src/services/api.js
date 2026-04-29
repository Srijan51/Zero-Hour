import axios from 'axios';

const baseURL = 'https://zero-hour1-832409031925.asia-south1.run.app';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;