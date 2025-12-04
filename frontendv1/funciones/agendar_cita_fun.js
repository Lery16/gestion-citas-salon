//const API_BASE_URL = 'http://localhost:3000/api'; 
const API_BASE_URL ='https://gestion-citas-salon.onrender.com/api';
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registroForm');
    const backArrow = document.querySelector('.back-arrow');

    if (backArrow) {
        backArrow.addEventListener('click', (e) => {
            e.preventDefault();
            history.back();
        });
    }

    form.addEventListener('submit', async (evento) => { // Agrega 'async'
        evento.preventDefault();

        const formData = new FormData(form);
        const servicioSeleccionadoText = form.querySelector('#servicios').options[form.querySelector('#servicios').selectedIndex].textContent;

        const datosEnvio = {
            email: formData.get('email'),
            celular: formData.get('celular'), // Mapea al campo 'telefono' en la BD
            nombre: formData.get('nombre'),
            apellido: formData.get('apellido'),
            servicioNombre: servicioSeleccionadoText // Usamos el texto para buscar el ID en el backend
        };

        // ⚠️ Validación mejorada para el frontend
        if (!datosEnvio.nombre || !datosEnvio.email || !datosEnvio.servicioNombre || datosEnvio.servicioNombre === "") {
             alert('Por favor, complete su Nombre, Email y seleccione un Servicio.');
             return;
        }

        try {
            // 1. Llamada a la API para registrar al cliente y obtener IDs
            const response = await fetch(`${API_BASE_URL}/cliente`, { // ¡Asegúrate que la URL sea correcta!
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(datosEnvio),
            });

            const data = await response.json();

            if (!response.ok) {
                // Manejar errores de la API (400, 404, 500, etc.)
                alert(`🚨 Error al agendar: ${data.message || 'Error desconocido del servidor.'}`);
                console.error('🚨 Error del servidor:', data);
                return;
            }

            // 2. Extraer IDs de la respuesta del servidor
            const id_cliente = data.id_cliente;
            const id_servicio = data.id_servicio;

            // 3. Guardar IDs en localStorage para el siguiente paso
            localStorage.setItem('datosCita', JSON.stringify({
                id_cliente: id_cliente,
                id_servicio: id_servicio
            }));
            
            console.log('✅ IDs de Cliente y Servicio guardados en localStorage:', {id_cliente, id_servicio});

            // 4. Redirigir a la siguiente página
            window.location.href = 'fecha_hora.html';

        } catch (error) {
            console.error('🚨 Error de conexión o proceso de agendamiento:', error);
            alert('🚨 Hubo un problema al conectar con el servidor. Intenta de nuevo.');
        }
    });
});
