import axios from 'axios';

const baseURL = 'https://zero-hour-832409031925.europe-west1.run.app';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
