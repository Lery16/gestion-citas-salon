document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registroForm');
    
    // **NOTA IMPORTANTE:** El endpoint y el fetch son eliminados, ya que el envío final
    // se hace en la segunda página (fecha_hora.html).

    form.addEventListener('submit', (evento) => {
        evento.preventDefault(); // Evita que se recargue la página

        // Captura los datos del formulario
        const formData = new FormData(form);
        const datosPersonales = {
            email: formData.get('email'),
            celular: formData.get('celular'),
            nombre: formData.get('nombre'),
            apellido: formData.get('apellido')
        };
        
        // Validación simple de campos
        if (!datosPersonales.nombre || !datosPersonales.email) {
             alert('Por favor, complete su Nombre y Email.');
             return;
        }

        try {
            // 1. **GUARDAR DATOS EN LOCALSTORAGE**
            localStorage.setItem('datosCliente', JSON.stringify(datosPersonales));
            
            console.log('✅ Datos personales guardados en localStorage.');
            
            // 2. **REDIRECCIONAR** a la página de selección de fecha y hora
            // Asegúrate de que tu botón en agendar_cita.html ya no tenga el 'href' fijo.
            window.location.href = 'fecha_hora.html'; 

        } catch (error) {
            console.error('🚨 Error al guardar o redirigir:', error);
            alert('🚨 Hubo un problema al avanzar al siguiente paso. Intenta de nuevo.');
        }
    });
});