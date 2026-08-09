import axios from 'axios';

// Locally, VITE_API_URL is unset, so requests go to '/api' and Vite's dev
// proxy forwards them to localhost:4000 (see vite.config.js).
// In production (Vercel), set VITE_API_URL to your deployed backend's URL,
// e.g. https://your-backend.onrender.com/api
const baseURL = import.meta.env.VITE_API_URL || '/api';

const client = axios.create({ baseURL });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default client;
