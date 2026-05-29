import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
/**
 * CORS — production'da FRONTEND_URL env'i Vercel domainine kilitler,
 * geliştirme için localhost:5173 / 3000 her zaman beyaz listede.
 */
const explicitOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((u) => u.trim()).filter(Boolean)
  : [];

// Production'da bile dev kullanımına izin ver — auth + CORS yine credential kontrolüyle güvenli
const LOCAL_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
];

const allowedOrigins = explicitOrigins.length === 0
  ? ["*"]
  : [...explicitOrigins, ...LOCAL_DEV_ORIGINS];

app.use(
  cors({
    origin: allowedOrigins.includes("*")
      ? "*"
      : (origin, callback) => {
          // Sunucudan sunucuya çağrılar (origin yok) ve eşleşen origin'ler için izin
          if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error(`CORS: Origin not allowed → ${origin}`));
          }
        },
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
