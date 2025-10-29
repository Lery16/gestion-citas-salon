document.addEventListener('DOMContentLoaded', () => {
    const usuarioJSON = localStorage.getItem("usuario");
    if (usuarioJSON) {
        const trabajador = JSON.parse(usuarioJSON);
        // Poner nombre y foto en la página principal
        const nombreElemento = document.querySelector(".nombre-trabajador");
        const fotoElemento = document.querySelector(".perfil-img");
        if (nombreElemento) nombreElemento.textContent = trabajador.nombre;
        if (fotoElemento && trabajador.foto) fotoElemento.src = trabajador.foto;
    } else {
        // No hay usuario logueado → redirigir a login
        window.location.href = 'inicia_sesion.html';
    }
});