document.addEventListener('DOMContentLoaded', () => {
    // Selecciona el div del menú (para manejar el estado activo/hamburguesa)
    const menu = document.querySelector('.menu-opciones'); 

    // Selecciona TODOS los enlaces dentro del menú que tienen el atributo 'data-url'
    const enlacesMenu = document.querySelectorAll('.menu-opciones a[data-url]');

    // Manejo del menú hamburguesa 🍔 (Se mantiene al inicio para consistencia)
    const hamburger = document.querySelector('.menu_hamburguesa');
    if (hamburger && menu) {
        hamburger.addEventListener('touchstart', function(event) {
            event.stopPropagation(); 
            menu.classList.toggle('active'); 
        });
    }

    // Lógica para asignar el comportamiento de navegación y cerrar sesión 🔗
    enlacesMenu.forEach(enlace => {
        const urlDestino = enlace.dataset.url;

        if (urlDestino) {
            enlace.addEventListener('click', (event) => {
                event.preventDefault(); 
                
                // 1. Lógica Específica para CERRAR SESIÓN
                // Detectamos si este es el enlace de "Cerrar Sesión" usando su URL de destino.
                if (urlDestino === 'inicia_sesion.html') {
                    const usuario = sessionStorage.getItem("usuario");
                    
                    if (usuario) {
                        console.log("Cerrando sesión para:", usuario);
                        // Limpia TODAS las variables de sesión
                        sessionStorage.clear(); 
                        window.location.href = urlDestino; // Redirige a iniciar_sesion.html
                    } else {
                        console.log("Intento de cerrar sesión sin sesión activa.");
                        alert("No hay sesión iniciada para cerrar.");
                    }
                } 
                // 2. Lógica General para OTROS ENLACES (Ventana Principal, etc.)
                else {
                    console.log(`Navegando a: ${urlDestino}`);
                    window.location.href = urlDestino;
                }
            });
        }
    });
});