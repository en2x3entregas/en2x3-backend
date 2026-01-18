// backend/src/mongo.js
import { MongoClient } from "mongodb";

let client = null;
let db = null;

export async function getDb() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || "en2x3";

  if (!uri) throw new Error("MONGODB_URI no está configurado");

  if (db) return db;

  client = new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 8000,
  });

  await client.connect();
  db = client.db(dbName);
  return db;
}

export async function getCol(name) {
  const database = await getDb();
  return database.collection(name);
}

export async function pingMongo() {
  const database = await getDb();
  await database.command({ ping: 1 });
  return true;
}
