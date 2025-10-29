// --- Contenido de fecha_hora_fun.js (Código Unificado Modificado) ---

document.addEventListener('DOMContentLoaded', () => {
    // 1. Obtener Datos del Cliente de localStorage
    const datosClienteJSON = localStorage.getItem('datosCliente');
    let datosPersonales = {};

    if (datosClienteJSON) {
        try {
            datosPersonales = JSON.parse(datosClienteJSON);
            console.log('Datos del cliente cargados:', datosPersonales);
        } catch (e) {
            console.error('Error al parsear datos del cliente:', e);
            alert('Error al recuperar sus datos. Por favor, reinicie el proceso.');
            // Opcional: Redirigir si falla la carga
            // window.location.href = 'agendar_cita.html';
            return;
        }
    } else {
         alert('No se encontraron sus datos personales. Regrese a la página anterior.');
         // Opcional: Redirigir si no hay datos
         // window.location.href = 'agendar_cita.html';
         // return;
    }


    // Referencias a elementos HTML (Mantenemos las que usas)
    const cuadriculaCalendario = document.getElementById('cuadricula-calendario');
    const desplegableMes = document.getElementById('desplegable-mes');
    const selectorExpandido = document.getElementById('selector-mes-expandido');
    const cuerpoTablaCitas = document.getElementById('cuerpo-tabla-citas');
    const desplegableHora = document.getElementById('desplegable-hora');
    const btnAgendar = document.getElementById('btn-agendar');
    
    // ... (Variables de fechaActual y funciones auxiliares formatearFecha, etc. se mantienen igual)
    let fechaActual = new Date();
    fechaActual.setDate(1); 
    desplegableMes.value = fechaActual.getMonth().toString(); 
    const AGENDAR_ENDPOINT = '/api/agendar'; 


    // --- (Aquí van todas las funciones: formatearFecha, obtenerDatosCalendario, mostrarHoras, mostrarCitas, mostrarCalendario, limpiarSeleccion. Mantenlas EXACTAMENTE como te las proporcioné en la respuesta anterior) ---
    // (Por brevedad, omito el código de las funciones auxiliares aquí, pero deben estar presentes)

    function formatearFecha(dia) {
        const anio = fechaActual.getFullYear();
        const mes = fechaActual.getMonth() + 1;
        const diaFormateado = String(dia).padStart(2, '0');
        const mesFormateado = String(mes).padStart(2, '0');
        return `${anio}-${mesFormateado}-${diaFormateado}`;
    }

    // [AQUÍ DEBEN IR LAS FUNCIONES obtenerDatosCalendario, mostrarHoras, mostrarCitas, mostrarCalendario, limpiarSeleccion]
    // ...

    // -----------------------------------------------------------------
    // LÓGICA CLAVE: BACKEND: ENDPOINT #4 - AGENDAR LA CITA (POST)
    // -----------------------------------------------------------------
    btnAgendar.addEventListener('click', async () => {
        const elementoDiaSeleccionado = cuadriculaCalendario.querySelector('.dia.seleccionado');
        const horaSeleccionada = desplegableHora.value;

        // 1. Validaciones
        if (!elementoDiaSeleccionado) {
            alert('❌ Por favor, seleccione un día disponible.');
            return;
        }
        
        if (!horaSeleccionada || horaSeleccionada === "") {
            alert('❌ Por favor, seleccione una hora.');
            return;
        }

        // 2. CAPTURA DE DATOS DE LA CITA
        const dia = elementoDiaSeleccionado.dataset.day;
        const servicioId = localStorage.getItem('servicioSeleccionadoId') || 'ID_DEL_SERVICIO_DEFAULT';

        const datosCita = {
            date: formatearFecha(dia), 
            time: horaSeleccionada,    
            serviceId: servicioId
        };
        
        // 3. COMBINAR DATOS PERSONALES (localStorage) + DATOS DE LA CITA
        const datosFinales = {
            ...datosPersonales, // <-- Datos del formulario traídos de localStorage
            ...datosCita        // <-- Datos de fecha/hora
        };

        console.log('Enviando al backend (Datos Finales):', datosFinales);

        // 4. Envío al Backend
        try {
            const respuesta = await fetch(AGENDAR_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(datosFinales),
            });

            if (!respuesta.ok) {
                const datosError = await respuesta.json();
                throw new Error(datosError.message || 'Error en el servidor');
            }

            const resultado = await respuesta.json();
            alert(`✅ ¡Cita agendada con éxito! \nConfirmación: ${resultado.confirmationId}`);
            
            // 5. Limpieza Final: Eliminar datos personales de localStorage
            localStorage.removeItem('datosCliente'); 
            
            // Refresca el calendario y limpia la selección
            mostrarCalendario();
            limpiarSeleccion();

        } catch (error) {
            console.error('Error al agendar:', error);
            alert(`❌ Hubo un problema con su reserva: ${error.message}`);
        }
    });

    // --- INICIALIZACIÓN ---
    mostrarCalendario();
    mostrarCitas(null);
    mostrarHoras(null);
});