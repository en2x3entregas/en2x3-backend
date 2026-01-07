import dotenv from "dotenv";
dotenv.config();

export const NODE_ENV = process.env.NODE_ENV || "development";
export const PORT = Number(process.env.PORT || 4000);

export const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_ME_DEV_SECRET";
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// CSV: https://tu-frontend.com,https://www.tu-frontend.com
export const CORS_ORIGINS = (process.env.CORS_ORIGINS || "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const DATA_DIR = process.env.DATA_DIR || "./data";
export const PACKAGES_FILE = process.env.PACKAGES_FILE || `${DATA_DIR}/paquetes.json`;
export const USERS_FILE = process.env.USERS_FILE || `${DATA_DIR}/users.json`;
export const ROUTE_SUMMARIES_FILE =
  process.env.ROUTE_SUMMARIES_FILE || `${DATA_DIR}/route_summaries.json`;

export const ALLOW_ADMIN_REGISTER =
  String(process.env.ALLOW_ADMIN_REGISTER || "false").toLowerCase() === "true";

export const TZ = process.env.TZ || "America/Bogota";
