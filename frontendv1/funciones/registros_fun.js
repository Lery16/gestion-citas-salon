document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('.formulario-card form');
    
    // Cambiar 'la URL de la API de Node.js'
    const REGISTRO_ENDPOINT = 'http://tu-backend.com/api/registrar'; 

    form.addEventListener('submit', async (evento) => {
        evento.preventDefault(); 

        const datosFormulario = new FormData(form);
        
        const datosRegistro = {
            email: datosFormulario.get('email'),
            contrasena: datosFormulario.get('contrasena'),
            nombre: datosFormulario.get('nombre'),
            apellido: datosFormulario.get('apellido')
            // este objeto
        };

        try {
            // 5. Enviar la solicitud POST usando Fetch API
            const respuesta = await fetch(REGISTRO_ENDPOINT, {
                method: 'POST', // Método que Node.js espera para guardar datos
                headers: {
                    // Indica que el cuerpo de la solicitud es JSON
                    'Content-Type': 'application/json',
                },
                // Convierte el objeto JavaScript a una cadena JSON para el envío
                body: JSON.stringify(datosRegistro), 
            });

            // Manejar la respuesta del servidor
            const resultado = await respuesta.json();

            if (respuesta.ok) {
                // Registro exitoso (código 200-299)
                alert('✅ Registro exitoso! Bienvenido.');
                console.log('Respuesta del servidor:', resultado);
                // Opcional: Redirigir al usuario o limpiar el formulario
            } else {
                // Error en el servidor (código 4xx o 5xx)
                // El error que viene del backend de Node.js se muestra aquí.
                const mensajeError = resultado.mensaje || 'Error desconocido al registrar.';
                alert(`❌ Error al crear cuenta: ${mensajeError}`);
                console.error('Error del servidor:', resultado);
            }

        } catch (error) {
            // Error de red, URL incorrecta o servidor caído
            alert('🚨 Error de conexión. Verifica la URL o si el servidor está activo.');
            console.error('Error de fetch:', error);
        }
    });
});