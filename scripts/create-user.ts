import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });

import bcrypt from "bcryptjs";
import { db } from "../src/db";
import { users } from "../src/db/schema";

async function main() {
  const email = process.argv[2] || "admin@copiloto.cl";
  const name = process.argv[3] || "Administrador";
  const password = process.argv[4] || "admin123";
  const role = process.argv[5] || "admin";

  const hash = await bcrypt.hash(password, 12);

  await db
    .insert(users)
    .values({
      email,
      name,
      passwordHash: hash,
      role,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { passwordHash: hash, name, role },
    });

  console.log(`✓ Usuario creado/actualizado:`);
  console.log(`  Email: ${email}`);
  console.log(`  Nombre: ${name}`);
  console.log(`  Rol: ${role}`);
  console.log(`  Password: ${password}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });