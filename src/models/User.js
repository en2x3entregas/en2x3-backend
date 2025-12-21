// src/models/User.js
import mongoose from "mongoose";

const { Schema, model } = mongoose;

const UserSchema = new Schema(
  {
    nombre: { type: String, trim: true, required: true },
    apellido: { type: String, trim: true, required: true },

    cc: { type: String, trim: true, required: true, unique: true },
    telefono: { type: String, trim: true, required: true },

    email: { type: String, trim: true, lowercase: true, required: true, unique: true },

    role: { type: String, enum: ["admin", "store", "repartidor"], required: true },

    passwordHash: { type: String, required: true },

    resetTokenHash: { type: String, default: null },
    resetTokenExpiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default model("User", UserSchema);
