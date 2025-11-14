document.addEventListener("DOMContentLoaded", () => {
  const btnCerrarSesion = document.getElementById("cerrarSesion");

  // Verifica si hay usuario en sesión
  const usuario = sessionStorage.getItem("usuario");

  if (usuario) {
    console.log("Sesión activa:", usuario);

    // Si hay sesión, activar el botón de cerrar sesión
    if (btnCerrarSesion) {
      btnCerrarSesion.addEventListener("click", (e) => {
        e.preventDefault();

        // Elimina solo los datos de sesión relacionados
        sessionStorage.clear();

        // Redirige al inicio o login
        window.location.href = "inicio.html";
      });
    }
  } else {
    console.log("No hay sesión iniciada.");

    // Desactivar el botón de cerrar sesión (no hace nada si no hay sesión)
    if (btnCerrarSesion) {
      btnCerrarSesion.addEventListener("click", (e) => {
        e.preventDefault();
        alert("No hay sesión iniciada.");
      });
    }
  }
});