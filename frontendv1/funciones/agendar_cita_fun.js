document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registroForm');
    
    // Función para manejar la navegación hacia atrás
    const backArrow = document.querySelector('.back-arrow');
    if (backArrow) {
        backArrow.addEventListener('click', (e) => {
            e.preventDefault();
            history.back(); // Navega a la página anterior
        });
    }

    form.addEventListener('submit', (evento) => {
        evento.preventDefault(); // Evita que se recargue la página

        // Captura los datos del formulario
        const formData = new FormData(form);
        
        // Obtiene el valor seleccionado del <select> y su texto
        const servicioSeleccionadoId = formData.get('servicios');
        const selectElement = document.getElementById('servicios');
        const servicioSeleccionadoText = selectElement.options[selectElement.selectedIndex].textContent;

        const datosPersonales = {
            email: formData.get('email'),
            celular: formData.get('celular'),
            nombre: formData.get('nombre'),
            apellido: formData.get('apellido'),
            // AGREGADO: ID del servicio (ej. 'corte-peinado')
            servicioId: servicioSeleccionadoId, 
            // AGREGADO: Nombre del servicio (ej. 'Corte y Peinado')
            servicioNombre: servicioSeleccionadoText
        };
        
        // Validación de campos incluyendo el servicio
        if (!datosPersonales.nombre || !datosPersonales.email || !datosPersonales.servicioId) {
            alert('Por favor, complete su Nombre, Email y seleccione un Servicio.');
            return;
        }

        try {
            // 1. **GUARDAR DATOS EN LOCALSTORAGE**
            // datosPersonales ahora incluye servicioId y servicioNombre
            localStorage.setItem('datosCliente', JSON.stringify(datosPersonales));
            
            console.log('✅ Datos personales y servicio guardados en localStorage:', datosPersonales);
            
            // 2. **REDIRECCIONAR** a la página de selección de fecha y hora
            window.location.href = 'fecha_hora.html'; 

        } catch (error) {
            console.error('🚨 Error al guardar o redirigir:', error);
            alert('🚨 Hubo un problema al avanzar al siguiente paso. Intenta de nuevo.');
        }
    });
});