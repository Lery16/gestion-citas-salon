document.addEventListener('DOMContentLoaded', () => {
    const menu = document.querySelector('.menu-opciones'); 
    const hamburger = document.querySelector('.menu_hamburguesa');
    popupCalendario = document.querySelector('.calendario-popup'); 

    if (hamburger && menu) {
        hamburger.addEventListener('click', function(event) {
            event.stopPropagation();
            menu.classList.toggle('active');
        });
    }
});