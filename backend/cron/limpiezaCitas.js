import cron from "node-cron";
import { db } from "../src/config/db.js";

export const ejecutarLimpieza = async () => {
  try {
    console.log('Iniciando limpieza de citas antiguas y clientes inactivos...');
    
    // CTE para eliminar citas viejas y sus clientes sin citas restantes
    const query = `
      WITH citas_borradas AS (
          DELETE FROM Cita 
          WHERE fecha < (CURRENT_DATE - INTERVAL '3 days')
          RETURNING id_cliente
      )
      DELETE FROM Cliente
      WHERE id_cliente IN (SELECT id_cliente FROM citas_borradas)
      AND NOT EXISTS (
          -- Verifica si el cliente aún tiene otras citas
          SELECT 1 FROM Cita c_restante 
          WHERE c_restante.id_cliente = Cliente.id_cliente
      );
    `;

    const result = await db.query(query);
    
    // Cantidad de clientes eliminados
    console.log(`Limpieza completada. Clientes eliminados definitivamente: ${result.rowCount}`);

  } catch (error) {
    console.error('Error en la limpieza:', error);
  }
};

// Ejecutar al iniciar el script
await ejecutarLimpieza();

// Ejecutar cada medianoche
cron.schedule('0 0 * * *', ejecutarLimpieza);