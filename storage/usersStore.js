// backend/storage/usersStore.js
import bcrypt from "bcryptjs";
import { USERS_FILE } from "../src/config.js";
import { readJson, writeJson } from "./jsonFile.js";
import { makeId, nowIso, safeStr } from "../src/utils.js";

function stripUser(u) {
  if (!u) return null;
  const { passwordHash, resetToken, resetTokenExp, ...safe } = u;
  return safe;
}

async function readUsersRaw() {
  const data = await readJson(USERS_FILE, []);
  return Array.isArray(data) ? data : [];
}

async function writeUsersRaw(users) {
  await writeJson(USERS_FILE, Array.isArray(users) ? users : []);
}

export async function createUser({ nombre, apellido, cc, telefono, email, password, role }) {
  const users = await readUsersRaw();

  const em = safeStr(email).toLowerCase();
  const ccClean = safeStr(cc).replace(/\D/g, "");

  if (!em) throw new Error("Email requerido");
  if (!password) throw new Error("Password requerido");

  const emailTaken = users.some((u) => safeStr(u.email).toLowerCase() === em);
  if (emailTaken) throw new Error("Email ya registrado");

  if (ccClean) {
    const ccTaken = users.some((u) => safeStr(u.cc).replace(/\D/g, "") === ccClean);
    if (ccTaken) throw new Error("CC ya registrada");
  }

  const user = {
    id: makeId(),
    nombre: safeStr(nombre),
    apellido: safeStr(apellido),
    cc: ccClean,
    telefono: safeStr(telefono),
    email: em,
    role: safeStr(role || "messenger").toLowerCase(),
    passwordHash: bcrypt.hashSync(String(password), 10),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  users.push(user);
  await writeUsersRaw(users);
  return stripUser(user);
}

export async function verifyUserCredentials({ userOrCc, email, password }) {
  const users = await readUsersRaw();
  const pass = safeStr(password);
  if (!pass) return null;

  let user = null;

  const em = safeStr(email).toLowerCase();
  if (em) {
    user = users.find((u) => safeStr(u.email).toLowerCase() === em) || null;
  } else {
    const key = safeStr(userOrCc);
    const keyEm = key.toLowerCase();
    const keyCc = key.replace(/\D/g, "");
    user =
      users.find((u) => safeStr(u.email).toLowerCase() === keyEm) ||
      users.find((u) => safeStr(u.cc).replace(/\D/g, "") === keyCc) ||
      null;
  }

  if (!user) return null;
  const ok = bcrypt.compareSync(pass, safeStr(user.passwordHash));
  if (!ok) return null;

  return stripUser(user);
}

export async function setResetToken(email, token, expIso) {
  const users = await readUsersRaw();
  const em = safeStr(email).toLowerCase();
  const idx = users.findIndex((u) => safeStr(u.email).toLowerCase() === em);

  if (idx === -1) {
    // respuesta neutral (no filtra)
    return { ok: true, exists: false };
  }

  users[idx] = {
    ...users[idx],
    resetToken: safeStr(token),
    resetTokenExp: safeStr(expIso),
    updatedAt: nowIso(),
  };

  await writeUsersRaw(users);
  return { ok: true, exists: true };
}

export async function resetPasswordWithToken(token, newPassword) {
  const users = await readUsersRaw();
  const tk = safeStr(token);
  const pass = safeStr(newPassword);
  if (!tk || !pass) return { ok: false, error: "Token y password requeridos" };

  const idx = users.findIndex((u) => safeStr(u.resetToken) === tk);
  if (idx === -1) return { ok: false, error: "Token inválido" };

  const exp = safeStr(users[idx].resetTokenExp);
  if (exp && Date.parse(exp) < Date.now()) {
    return { ok: false, error: "Token expirado" };
  }

  users[idx] = {
    ...users[idx],
    passwordHash: bcrypt.hashSync(pass, 10),
    resetToken: "",
    resetTokenExp: "",
    updatedAt: nowIso(),
  };

  await writeUsersRaw(users);
  return { ok: true };
}
