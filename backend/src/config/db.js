import pkg from 'pg';
const { Pool } = pkg;

export const db = new Pool({
  host: "127.0.0.1",
  user: "postgres",
  password: "1234",
  database: "bd_salon",
  port: 5433,
});

db.connect((err) => {
  if (err) {
    console.error("❌ Error al conectar con PostgreSQL:", err);
  } else {
    console.log("✅ Conectado a PostgreSQL correctamente");
  }
});