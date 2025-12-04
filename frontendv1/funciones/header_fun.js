document.addEventListener('DOMContentLoaded', () => {

    // Elementos del menú
    const menu = document.querySelector('.menu-opciones');
    const hamburger = document.querySelector('.menu_hamburguesa');
    const enlacesMenu = document.querySelectorAll('.menu-opciones a[data-url]');

    if (!menu || !hamburger) {
        console.error("No se encontró el menú o el icono hamburguesa.");
        return;
    }

    // Navegación de enlaces del menú
    enlacesMenu.forEach(enlace => {
        enlace.addEventListener('click', (e) => {
            e.preventDefault();
            const destino = enlace.dataset.url;
            if (destino) window.location.href = destino;
        });
    });

    // Abre o cierra el menú
    const toggleMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        menu.classList.toggle('active');
    };

    // Click en el icono
    hamburger.addEventListener('click', toggleMenu);

    // Soporte táctil
    hamburger.addEventListener('touchstart', toggleMenu, { passive: false });

    // Cierra si se hace click fuera
    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && !hamburger.contains(e.target)) {
            menu.classList.remove('active');
        }
    });

    // Botones de inicio y registro
    const signinBtn = document.querySelector('.header-buttons .signin');
    const registerBtn = document.querySelector('.header-buttons .register');

    if (signinBtn) signinBtn.addEventListener('click', () => {
        window.location.href = 'inicia_sesion.html';
    });

    if (registerBtn) registerBtn.addEventListener('click', () => {
        window.location.href = 'registrarse.html';
    });
});