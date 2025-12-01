import pkg from "pg";
const { Pool } = pkg;

// Usando variables de entorno (recomendado)
const pool = new Pool({
  host: process.env.DB_HOST || "dpg-d4kjcq63jp1c738scaeg-a.oregon-postgres.render.com",
  user: process.env.DB_USER || "adminadmin",
  password: process.env.DB_PASS || "0qRPFzGxo2aABJLhk8iNuZJRam4apagy",
  database: process.env.DB_NAME || "gestiondecitas",
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
  ssl: {
    rejectUnauthorized: false // necesario para muchos hosts gestionados (Render)
  }
});

pool.connect((err) => {
  if (err) {
    console.error("❌ Error al conectar con PostgreSQL:", err);
  } else {
    console.log("✅ Conectado a PostgreSQL correctamente (Render)");
  }
});

export const db = pool;