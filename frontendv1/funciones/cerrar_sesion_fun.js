const LOGIN_PAGE = 'inicia_sesion.html';

document.addEventListener('DOMContentLoaded', () => {
    // Escucha cuando el DOM está completamente cargado.
    
    // Botón cerrar sesión
    const cerrarSesionBtn = document.getElementById('cerrarSesion');
    if (cerrarSesionBtn) {
        cerrarSesionBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Previene la acción por defecto del enlace.
            
            // Eliminar todas las credenciales
            localStorage.removeItem('user_token'); // Borra el token de seguridad.
            localStorage.removeItem('user_rol');   // Borra el rol del usuario.
            localStorage.removeItem('id_usuario'); // Borra el ID único.
            
            window.location.href = LOGIN_PAGE;       // Redirige a la página de inicio de sesión.
        });
    }
});