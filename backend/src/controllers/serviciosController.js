import { db } from '../config/db.js';

console.log(" Controlador de servicios cargado correctamente");


export const obtenerServicios = (req, res) => {
  console.log("Petición recibida a /api/servicios");

  const sql = "SELECT * FROM servicios";
  db.query(sql, (err, result) => {
    if (err) {
      console.error("Error al obtener servicios:", err);
      res.status(500).json({ error: "Error al obtener servicios" });
    } else {
      res.json(result);
    }
  });
};

export const crearServicio =(req, res) => {
    const { nombre, descripcion, precio } = req.body;
    const sql = "INSERT INTO servicios (nombre, descripcion, precio) VALUES (?, ?, ?)";
    db.query(sql, [nombre, descripcion, precio], (err, result) => {
        if(err) return res.status(500).json({ error: "Error al crear servivio" });
        res.json({ mensaje: "Servicio creado correctamente" });

    });
};

export const actualizarServicio = (req, res) => {
    const { id } = req.params;
    const sql = "DELETE FROM servcios WHERE id=?";
    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json({ error: "Error al eliminar servicio" })
            res.json({ mensaje: "Servicio elimina correctamente" });
    });
};

export const empleadosPorServicio = (req, res) => {
  const idServicio = req.params.id;
  const sql = `
    SELECT e.id, e.nombre, e.especialidad, e.estado
    FROM empleados e
    INNER JOIN empleados_servicios es ON e.id = es.id_empleado
    WHERE es.id_servicio = ? AND e.estado = 'disponible';
  `;
  db.query(sql, [idServicio], (err, result) => {
    if (err) {
      console.error("Error al obtener empleados por servicio:", err);
      res.status(500).json({ error: "Error al obtener empleados por servicio" });
    } else {
      res.json(result);
    }
  });
};

export const eliminarServicio = (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM servicios WHERE id=?";
  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ error: "Error al eliminar servicio" });
    res.json({ mensaje: "Servicio eliminado correctamente" });
  });
};