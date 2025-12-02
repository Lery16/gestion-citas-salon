import cron from "node-cron";
import { db } from "../src/config/db.js";

export const ejecutarLimpieza = async () => {
  try {
    console.log('Iniciando limpieza de citas antiguas');
    const query = `DELETE FROM Cita WHERE fecha < (CURRENT_DATE - INTERVAL '3 days');`;
    await db.query(query);
    console.log('✅ Limpieza completada');
  } catch (error) {
    console.error('❌ Error en la limpieza:', error);
  }
};

// Ejecutar inmediatamente
await ejecutarLimpieza();

// Programar cada medianoche
cron.schedule('0 0 * * *', ejecutarLimpieza);