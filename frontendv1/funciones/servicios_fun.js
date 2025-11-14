document.addEventListener('DOMContentLoaded', () => {
    // 1. Selecciona todas las tarjetas de servicio
    const tarjetasDeServicio = document.querySelectorAll('.servicio-card');

    // 2. Itera sobre cada tarjeta para agregarle un evento
    tarjetasDeServicio.forEach(tarjeta => {
        
        tarjeta.addEventListener('click', () => {
            // 3. Encuentra el 'h3' dentro de la tarjeta clickeada
            const h3 = tarjeta.querySelector('h3');
            
            if (h3) {
                // 4. Obtiene el texto del título, ej: "Corte y Peinado"
                const servicioTitulo = h3.textContent.trim();

                try {
                    // 5. Guarda el título en localStorage
                    //    Usamos 'servicioSeleccionadoId' porque tu script fecha_hora.js
                    //    ¡ya está buscando esta clave!
                    localStorage.setItem('servicioSeleccionadoId', servicioTitulo);
                    
                    console.log(`✅ Servicio guardado: ${servicioTitulo}`);
                    
                    // 6. Redirige a la página para agendar la cita
                    window.location.href = 'agendar_cita.html';

                } catch (error) {
                    console.error('🚨 Error al guardar en localStorage:', error);
                    alert('Hubo un problema al seleccionar el servicio. Inténtalo de nuevo.');
                }
            }
        });
    });
});