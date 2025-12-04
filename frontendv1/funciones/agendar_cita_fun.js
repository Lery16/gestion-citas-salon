// Variable de entorno para la URL base de la API
// Si estás probando en local, puedes usar la de abajo (descomenta y comenta la otra)
//const API_BASE_URL = 'http://localhost:3000/api';
const API_BASE_URL ='https://gestion-citas-salon.onrender.com/api'; // URL del deploy en Render

document.addEventListener('DOMContentLoaded', () => {
    // Referencias a elementos del DOM (formulario y flecha de regreso)
    const form = document.getElementById('registroForm');
    const backArrow = document.querySelector('.back-arrow');

    // Manejador para la navegación hacia atrás (UX básica)
    if (backArrow) {
        backArrow.addEventListener('click', (e) => {
            e.preventDefault(); // Evita el comportamiento por defecto del enlace
            history.back(); // Función nativa para volver a la página anterior
        });
    }

    // El evento principal: Enviar el formulario para registrar cliente y servicio
    form.addEventListener('submit', async (evento) => { // 'async' es clave para usar 'await' con fetch
        evento.preventDefault(); // Detiene el envío normal del formulario

        // Obtener datos del formulario de manera sencilla
        const formData = new FormData(form);
        // Obtener el TEXTO del servicio seleccionado, no solo el 'value'
        const servicioSeleccionadoText = form.querySelector('#servicios').options[form.querySelector('#servicios').selectedIndex].textContent;

        // Construir el objeto de datos que se enviará al backend
        const datosEnvio = {
            email: formData.get('email'),
            celular: formData.get('celular'), // ¡Ojo! Mapea a 'telefono' en la BD
            nombre: formData.get('nombre'),
            apellido: formData.get('apellido'),
            servicioNombre: servicioSeleccionadoText // Backend usa este texto para encontrar el ID
        };

        // Validación mejorada para el frontend: Revisar campos obligatorios
        if (!datosEnvio.nombre || !datosEnvio.email || !datosEnvio.servicioNombre || datosEnvio.servicioNombre === "") {
             alert('Por favor, complete su Nombre, Email y seleccione un Servicio.');
             return; // Detiene la ejecución si falta info
        }

        try {
            // 1. Llamada a la API (POST) para registrar al cliente/servicio
            const response = await fetch(`${API_BASE_URL}/cliente`, { // Endpoint para registro
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json', // Indicamos que enviamos JSON
                },
                body: JSON.stringify(datosEnvio), // Convertimos el objeto JS a JSON
            });

            // Parsear la respuesta del servidor
            const data = await response.json();

            if (!response.ok) {
                // Manejar respuestas de error HTTP (ej. 400 Bad Request)
                alert(`Error al agendar: ${data.message || 'Error desconocido del servidor.'}`);
                console.error('Error del servidor:', data);
                return;
            }

            // 2. Extracción de los IDs generados o encontrados por el servidor
            const id_cliente = data.id_cliente;
            const id_servicio = data.id_servicio;

            // 3. Almacenar los IDs en el navegador para usarlos en la siguiente página
            localStorage.setItem('datosCita', JSON.stringify({
                id_cliente: id_cliente,
                id_servicio: id_servicio
            }));

            console.log('IDs de Cliente y Servicio guardados en localStorage:', {id_cliente, id_servicio});

            // 4. Redirigir a la vista de selección de fecha y hora
            window.location.href = 'fecha_hora.html';

        } catch (error) {
            // Manejar errores de red (ej. servidor caído)
            console.error('Error de conexión o proceso de agendamiento:', error);
            alert('Hubo un problema al conectar con el servidor. Intenta de nuevo.');
        }
    });
});