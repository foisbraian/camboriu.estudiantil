import axios from "axios";

const api = axios.create({
  // En local usa 127.0.0.1:8000, en Render usa la URL relativa o la que definas en env
  baseURL: process.env.REACT_APP_API_URL || "http://127.0.0.1:8000",
});

export default api;
