document.addEventListener('DOMContentLoaded', function() {
    const hamburger = document.querySelector('.menu_hamburguesa');
    const menu = document.querySelector('.menu-opciones nav ul');

    // Alternar menú al tocar hamburguesa
    hamburger.addEventListener('click', function(event) {
        event.stopPropagation(); // evita que el clic se propague al document
        menu.classList.toggle('active');
    });

    // Cerrar menú al tocar fuera de él
    document.addEventListener('click', function(event) {
        // Si el menú está abierto y el clic no es dentro del menú ni en el botón
        if (menu.classList.contains('active') &&
            !menu.contains(event.target) &&
            !hamburger.contains(event.target)) {
            menu.classList.remove('active');
        }
    });
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