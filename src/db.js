import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("Falta MONGO_URI en .env");

  mongoose.set("strictQuery", true);

  await mongoose.connect(uri, {
    autoIndex: true
  });

  console.log("✅ MongoDB conectado");
}
