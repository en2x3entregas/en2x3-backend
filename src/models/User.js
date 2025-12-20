import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    apellido: { type: String, required: true, trim: true },
    cc: { type: String, required: true, trim: true, unique: true, index: true },
    telefono: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, unique: true, lowercase: true, index: true },
    role: { type: String, required: true, enum: ["admin", "store", "repartidor"], index: true },

    passwordHash: { type: String, required: true },

    // Reset password
    resetTokenHash: { type: String, default: null },
    resetTokenExpiresAt: { type: Date, default: null }
  },
  { timestamps: true }
);

export default mongoose.model("User", UserSchema);
