document.addEventListener('DOMContentLoaded', () => {
    // --- Constantes ---
    const API_BASE_URL = 'http://localhost:3000/api';
    const ENDPOINT_CREAR_EMPLEADO = '/empleados';
    const CODIGO_ACCESO_REQUERIDO = 'belleza'; // Código requerido para el registro
    const LIMITE_CAMPOS = 12;

    // --- Elementos del DOM ---
    const formulario = document.getElementById('registroForm');
    const campoServicioContenedor = document.querySelector('.campo-servicio-contenedor');
    const agregarServicioBtn = document.getElementById('agregarServicioBtn');
    const codigoAccesoInput = document.getElementById('codigo');

    // El primer campo de servicio está presente en el HTML, lo usamos para la plantilla.
    // Solo necesitamos buscar el <select> si el contenedor ya existe.
    const primerCampoServicio = campoServicioContenedor ? campoServicioContenedor.querySelector('.campo:not(.servicio-adicional)') : null;
    const primerSelectServicio = primerCampoServicio ? primerCampoServicio.querySelector('select') : null;

    // Crear la plantilla para los servicios adicionales (clonando el primer campo si existe)
    const plantillaServicio = primerCampoServicio ? primerCampoServicio.cloneNode(true) : null;

    if (plantillaServicio) {
        // Preparar la plantilla para los nuevos campos
        plantillaServicio.removeAttribute('id');
        plantillaServicio.classList.add('servicio-adicional'); // Clase para poder identificar y eliminar
        
        const selectTemplate = plantillaServicio.querySelector('select');
        selectTemplate.removeAttribute('id'); // Quitar el ID del elemento original
        selectTemplate.value = ""; // Asegurar que el valor inicial sea la opción deshabilitada
        selectTemplate.required = false; // Solo el primer campo es 'required' por defecto

        // Añadir el botón de eliminar al campo plantilla
        const botonEliminarTemplate = document.createElement('button');
        botonEliminarTemplate.type = 'button';
        botonEliminarTemplate.classList.add('boton-eliminar-servicio');
        botonEliminarTemplate.innerHTML = '&times;';
        plantillaServicio.appendChild(botonEliminarTemplate);
    }

    // --- Event Listeners para el primer campo (si existe) ---
    if (primerSelectServicio) {
        primerSelectServicio.addEventListener('change', actualizarOpcionesSelect);
    }

    // --- Lógica para agregar nuevos campos de servicio ---
    if (agregarServicioBtn && plantillaServicio) {
        agregarServicioBtn.addEventListener('click', () => {
            const selectoresServicio = campoServicioContenedor.querySelectorAll('select[name="servicio[]"]');

            if (selectoresServicio.length >= LIMITE_CAMPOS) {
                alert(`Ya has agregado el máximo de ${LIMITE_CAMPOS} servicios.`);
                return;
            }

            const nuevoCampo = plantillaServicio.cloneNode(true);
            const nuevoSelect = nuevoCampo.querySelector('select');
            
            // Asignar un ID único (aunque no es estrictamente necesario para este HTML, es buena práctica)
            const nuevoId = 'servicio_' + Date.now();
            nuevoSelect.setAttribute('id', nuevoId);
            nuevoSelect.required = false; // Los campos adicionales no son obligatorios

            // El contenedor para el botón está dentro de .campo-servicio-contenedor.
            // Insertamos el nuevo campo ANTES del contenedor del botón de agregar.
            campoServicioContenedor.insertBefore(nuevoCampo, campoServicioContenedor.querySelector('.boton-agregar-servicio-contenedor'));

            // Buscar y añadir el listener al botón de eliminar del nuevo campo
            const botonEliminarNuevo = nuevoCampo.querySelector('.boton-eliminar-servicio');
            if(botonEliminarNuevo) {
                botonEliminarNuevo.addEventListener('click', e => {
                    // El botón está dentro de .servicio-adicional, que tiene la clase .campo
                    e.target.closest('.campo').remove(); 
                    actualizarOpcionesSelect(); // Recalcular opciones disponibles después de eliminar
                });
            }

            // Añadir listener para la validación y actualización de opciones
            nuevoSelect.addEventListener('change', actualizarOpcionesSelect);

            // Actualizar opciones para reflejar la selección del nuevo campo
            actualizarOpcionesSelect();
        });
    }

    // --- Función para evitar la selección de servicios duplicados ---
    function actualizarOpcionesSelect() {
        const selectoresServicio = campoServicioContenedor.querySelectorAll('select[name="servicio[]"]');
        const valoresSeleccionados = new Set();
        let esValido = true;

        // 1. Recoger valores seleccionados y validar duplicados en la UI
        selectoresServicio.forEach(selectElement => {
            const valorActual = selectElement.value;
            if (valorActual) {
                if (valoresSeleccionados.has(valorActual)) {
                    // Marcar como inválido en la UI
                    selectElement.setCustomValidity("Este servicio ya ha sido seleccionado. Por favor, elija uno diferente.");
                    esValido = false;
                } else {
                    valoresSeleccionados.add(valorActual);
                    selectElement.setCustomValidity(""); // Limpiar si antes era duplicado
                }
            } else {
                selectElement.setCustomValidity(""); // Limpiar si es la opción por defecto
            }
        });

        // 2. Deshabilitar opciones ya seleccionadas en los demás <select>
        selectoresServicio.forEach(currentSelect => {
            const currentSelectedValue = currentSelect.value;
            
            Array.from(currentSelect.options).forEach(option => {
                const optionValue = option.value;
                if (optionValue) { // Ignorar la opción deshabilitada/por defecto
                    const yaSeleccionado = valoresSeleccionados.has(optionValue);
                    
                    if (yaSeleccionado && optionValue !== currentSelectedValue) {
                        // Deshabilitar la opción si está seleccionada en otro lugar
                        option.disabled = true;
                    } else {
                        // Habilitar la opción si no está seleccionada en otro lugar
                        if (!option.hasAttribute('data-default-option')) {
                            option.disabled = false;
                        }
                    }
                }
            });
        });

        return esValido;
    }

    // --- Función para enviar datos al Backend ---
    async function enviarDatosAlBackend(e) {
        e.preventDefault();

        // 1. Validar el Código de Acceso
        if (codigoAccesoInput.value.trim() !== CODIGO_ACCESO_REQUERIDO) {
            alert("❌ Código de Acceso incorrecto. Por favor, ingrese el código válido para registrarse como trabajador.");
            codigoAccesoInput.setCustomValidity("Código incorrecto");
            return;
        } else {
             codigoAccesoInput.setCustomValidity("");
        }

        // 2. Validar duplicidad de servicios
        if (!actualizarOpcionesSelect()) {
            alert("Corrija los servicios duplicados antes de continuar.");
            return;
        }

        // 3. Recoger datos
        const selectoresServicio = campoServicioContenedor.querySelectorAll('select[name="servicio[]"]');
        const serviciosSeleccionados = [];
        selectoresServicio.forEach(selectElement => {
            // Solo incluimos servicios si tienen un valor seleccionado (no la opción por defecto)
            if (selectElement.value) {
                serviciosSeleccionados.push(selectElement.value);
            }
        });

        const nombreInput = document.getElementById('nombre');
        const apellidoInput = document.getElementById('apellido');
        const correoInput = document.getElementById('email');
        const telefonoInput = document.querySelector('input[name="celular"]'); // Usar selector por name
        const passwordInput = document.getElementById('contrasena');
        const hashPassword = CryptoJS.SHA256(passwordInput.value).toString();
        
        // El rol es fijo: 'Trabajador'
        const datosEmpleado = {
            nombre: nombreInput ? nombreInput.value.trim() : '',
            apellido: apellidoInput ? apellidoInput.value.trim() : '',
            correo: correoInput ? correoInput.value.trim() : '',
            telefono: telefonoInput ? telefonoInput.value.trim() : '',
            contraseña: hashPassword,
            rol: 'Trabajador', // Rol fijo
            estado: 'Disponible',
            servicios: serviciosSeleccionados.length > 0 ? serviciosSeleccionados : null // Enviar null o [] si no hay servicios
        };

        console.log('Datos a enviar:', datosEmpleado);

        // 4. Validación básica de campos obligatorios (aparte de la del propio form)
        if (!datosEmpleado.nombre || !datosEmpleado.correo || !datosEmpleado.apellido || !datosEmpleado.contraseña || !datosEmpleado.telefono) {
            alert("Por favor completa los campos obligatorios (Nombre, Apellido, Correo, Contraseña, Celular).");
            return;
        }
        
        // 5. Envío al Backend
        try {
            const URL_COMPLETA = `${API_BASE_URL}${ENDPOINT_CREAR_EMPLEADO}`;
            console.log('Enviando datos de empleado a:', URL_COMPLETA);
            
            const respuesta = await fetch(URL_COMPLETA, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(datosEmpleado)
            });

            const resultado = await respuesta.json();

            if (respuesta.ok) {
                alert(`✅ Empleado ${datosEmpleado.nombre} creado exitosamente!`);
                console.log('Respuesta del servidor:', resultado);
                formulario.reset(); // Limpiar formulario
                // Re-inicializar el estado de las opciones después del reset
                // Como reset() no dispara 'change' listeners, llamamos a la función manualmente.
                actualizarOpcionesSelect(); 
                
                // Si tienes campos de servicio adicionales generados dinámicamente, elimínalos
                const extras = campoServicioContenedor.querySelectorAll('.servicio-adicional');
                extras.forEach(el => el.remove());
            } else {
                alert(`❌ Error al crear empleado (${respuesta.status}): ${resultado.error || resultado.mensaje || 'Respuesta inesperada'}`);
                console.error('Error del servidor:', resultado);
            }
        } catch (error) {
            alert('🚨 Error de conexión: No se pudo contactar al servidor. Asegúrate que el backend esté corriendo.');
            console.error('Error de fetch:', error);
        }
    }

    // --- Listener de Submit ---
    if (formulario) {
        formulario.addEventListener('submit', enviarDatosAlBackend);
    }

    // Inicializar el estado de las opciones al cargar la página
    actualizarOpcionesSelect();
});