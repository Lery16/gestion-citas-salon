import { Router } from "express";
const router = Router();

router.get("/", (req, res) => {
  res.send("Ruta empleados funcionando");
});

export default router;