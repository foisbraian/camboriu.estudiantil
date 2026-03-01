import axios from "axios";

export const BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: BASE_URL,
});

export default api;
