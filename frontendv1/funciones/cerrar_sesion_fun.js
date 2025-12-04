const LOGIN_PAGE = 'inicia_sesion.html';

document.addEventListener('DOMContentLoaded', () => {
    // Botón cerrar sesión
    const cerrarSesionBtn = document.getElementById('cerrarSesion');
    if (cerrarSesionBtn) {
        cerrarSesionBtn.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Eliminar todas las credenciales
            localStorage.removeItem('user_token'); // Borrar token
            localStorage.removeItem('user_rol');   // Borrar rol
            localStorage.removeItem('id_usuario'); // Borrar ID del usuario
            
            window.location.href = LOGIN_PAGE;     // Redirigir
        });
    }
});