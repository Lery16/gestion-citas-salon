import mysql from "mysql2";

export const db = mysql.createConnection({
  host: "127.0.0.1",
  user: "root",
  password: "1234",
  database: "bd_salon"
});

db.connect((err) => {
  if (err) {
    console.error("Error al conectar con MySQL:", err);
  } else {
    console.log("Conectado a MySQL correctamente");
  }
});
