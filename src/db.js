// backend/src/db.js
import mongoose from "mongoose";

export async function connectDB() {
  const uri = (process.env.MONGO_URI || process.env.MONGODB_URI || "").trim();
  if (!uri) throw new Error("Falta MONGO_URI (o MONGODB_URI) en variables de entorno");

  mongoose.set("strictQuery", true);

  await mongoose.connect(uri, {
    autoIndex: true,
  });

  console.log("✅ MongoDB conectado");
}
