document.addEventListener('DOMContentLoaded', () => {
    
    const LOGIN_PAGE = 'inicia_sesion.html'; // Página de login

    // Verificar token y rol
    const userToken = localStorage.getItem('user_token');
    const userRol = localStorage.getItem('user_rol');

    if (!userToken || userRol !== 'admin') {
        window.location.href = LOGIN_PAGE; // Redirige si no es admin
        return;
    }

    // Tarjetas clickeables
    const dashboardCards = document.querySelectorAll('.dashboard-card');
    dashboardCards.forEach(card => {
        card.style.cursor = 'pointer'; 
        card.addEventListener('click', () => {
            const urlDestino = card.getAttribute('data-url');
            if (urlDestino) window.location.href = urlDestino;
        });
    });

    // Botón cerrar sesión
    const cerrarSesionBtn = document.getElementById('cerrarSesion');
    if (cerrarSesionBtn) {
        cerrarSesionBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('user_token'); // Borrar token
            localStorage.removeItem('user_rol');   // Borrar rol
            window.location.href = LOGIN_PAGE;     // Redirigir
        });
    }

});