document.addEventListener('DOMContentLoaded', () => {
    const LOGIN_PAGE = 'inicia_sesion.html'; // Página de inicio de sesión

    // Validación de acceso
    const userToken = localStorage.getItem('user_token');
    const userRol = localStorage.getItem('user_rol');

    if (!userToken || userRol !== 'Administrador') {
        window.location.href = LOGIN_PAGE;
        return;
    }
    
    // Contenedor del menú
    const menu = document.querySelector('.menu-opciones'); 

    // Enlaces con data-url
    const enlacesMenu = document.querySelectorAll('.menu-opciones a[data-url]');

    // Navegación por enlaces
    enlacesMenu.forEach(enlace => {
        const urlDestino = enlace.dataset.url;

        if (urlDestino) {
            enlace.addEventListener('click', (event) => {
                event.preventDefault();
                console.log(`Navegando a: ${urlDestino}`);
                window.location.href = urlDestino;
            });
        }
    });

    // Menú hamburguesa
    const hamburger = document.querySelector('.menu_hamburguesa');

    if (hamburger && menu) {
        hamburger.addEventListener('touchstart', function(event) {
            event.stopPropagation();
            menu.classList.toggle('active');
        });
    }
});
