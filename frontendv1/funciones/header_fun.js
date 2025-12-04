document.addEventListener('DOMContentLoaded', () => {
    // Selecciona el div del menú (se mantiene para el manejo de la clase 'active')
    const menu = document.querySelector('.menu-opciones'); 

    // Selecciona TODOS los enlaces dentro del menú que tienen el atributo 'data-url'
    const enlacesMenu = document.querySelectorAll('.menu-opciones a[data-url]');

    // 1. Asigna el evento de navegación a cada enlace 🔗
    enlacesMenu.forEach(enlace => {
        // Obtenemos la URL de destino desde el atributo data-url
        const urlDestino = enlace.dataset.url;

        // Si la URL existe, asignamos el manejador de eventos
        if (urlDestino) {
            // Usamos 'click' para la navegación, pero el mismo patrón funcionaría con 'touchstart' si fuera necesario
            enlace.addEventListener('click', (event) => {
                // Previene que el navegador siga la ruta del atributo 'href' por defecto
                event.preventDefault(); 
                
                console.log(`Navegando a: ${urlDestino}`);

                // *** ESTA ES LA LÍNEA CLAVE QUE HACE LA NAVEGACIÓN REAL ***
                window.location.href = urlDestino; 
            });
        }
    });

    // 2. Manejo del menú hamburguesa 🍔
    const hamburger = document.querySelector('.menu_hamburguesa');

    if (hamburger && menu) {
        hamburger.addEventListener('touchstart', function(event) {
            event.stopPropagation(); 
            menu.classList.toggle('active'); 
        });
    }
});

document.addEventListener('DOMContentLoaded', function() {
    // Seleccionamos los botones
    const signinBtn = document.querySelector('.header-buttons .signin');
    const registerBtn = document.querySelector('.header-buttons .register');

    // Si existen los botones
    if (signinBtn) {
        signinBtn.addEventListener('click', function() {
            window.location.href = 'inicia_sesion.html'; // reemplaza con tu HTML de login
        });
    }

    if (registerBtn) {
        registerBtn.addEventListener('click', function() {
            window.location.href = 'registrarse.html'; // reemplaza con tu HTML de registro
        });
    }
});