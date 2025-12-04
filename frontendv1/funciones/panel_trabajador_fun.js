document.addEventListener('DOMContentLoaded', () => {
    const LOGIN_PAGE = 'inicia_sesion.html'; // Página de login

    // Verificar token y rol
    const userToken = localStorage.getItem('user_token');
    const userRol = localStorage.getItem('user_rol');

    if (!userToken || userRol !== 'Trabajador') {
        window.location.href = LOGIN_PAGE; // Redirige si no es trabajador
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
});