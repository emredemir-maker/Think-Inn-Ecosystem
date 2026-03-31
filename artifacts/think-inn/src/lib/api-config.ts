export const API_ORIGIN = import.meta.env.VITE_API_URL
  ? (import.meta.env.VITE_API_URL as string).replace(/\/+$/, "")
  : "";
