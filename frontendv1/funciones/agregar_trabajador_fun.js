document.addEventListener('DOMContentLoaded', () => {
    // --- Configuración de la API y Elementos DOM ---
     const API_BASE_URL ='https://gestion-citas-salon.onrender.com/api';
     const ENDPOINT_CREAR_EMPLEADO = '/empleados',
        formulario = document.getElementById('registroForm'),
        LIMITE_CAMPOS = 12; // Define el número máximo de servicios a registrar.
    
    // Verificación de autenticación y rol (solo permite Administrador)
    const userToken = localStorage.getItem('user_token');
    const userRol = localStorage.getItem('user_rol');
    if (!userToken || userRol !== 'Administrador') {
        window.location.href = 'inicia_sesion.html';
        return; // Detiene la ejecución si el usuario no es Admin.
    }
    
    // Elementos de Rol
    const selectRol = document.getElementById('rol');
    const VALOR_ROL_ADMIN = 'Administrador'; // Rol usado para la lógica de bloqueo.

    // Contenedor principal de servicios
    const campoServicioContenedor = document.querySelector('.campo-servicio-contenedor');

    // --- TEMPLATE DEL PRIMER CAMPO DE SERVICIO (HTML inyectado) ---
    const htmlPrimerCampoServicio = `
        <div class="campo"> 
            <select id="servicio" name="servicio[]" required>
                <option value="" disabled selected data-default-option>Servicio</option>
                <option value="Corte y Peinado">Corte y Peinado</option>
                <option value="Coloración y Mechas">Coloración y Mechas</option>
                <option value="Manicure Spa">Manicure Spa</option>
                <option value="Pedicure Spa">Pedicure Spa</option>
                <option value="Maquillaje Profesional">Maquillaje Profesional</option>
                <option value="Tratamientos Capilares">Tratamientos Capilares</option>
                <option value="Corte de Cabello">Corte de Cabello</option>
                <option value="Peinado">Peinado</option>
                <option value="Coloración de Cabello">Coloración de Cabello</option> <option value="Depilación de Cejas con Cera">Depilación de Cejas con Cera</option>
                <option value="Depilación de Cejas con Gillete">Depilación de Cejas con Gillete</option>
                <option value="Depilación de Cejas con Hilo">Depilación de Cejas con Hilo</option>
            </select>
        </div>
        <div class="boton-agregar-servicio-contenedor">
            <button type="button" id="agregarServicioBtn" class="boton-anadir-otro-servicio">
                + Agregar otro servicio
            </button>
        </div>
    `;

    // Inyecta el primer campo de servicio al cargar la página.
    if (campoServicioContenedor && campoServicioContenedor.children.length === 0) {
        campoServicioContenedor.innerHTML = htmlPrimerCampoServicio;
    }

    // Elementos ya inyectados (referencias)
    const agregarServicioBtn = document.getElementById('agregarServicioBtn');
    const primerCampoServicio = campoServicioContenedor.querySelector('.campo');

    // Listener para el primer select de servicio.
    if(primerCampoServicio) {
        const primerSelectServicio = primerCampoServicio.querySelector('select');
        // Asigna las funciones de validación y bloqueo al cambiar el primer servicio.
        primerSelectServicio.addEventListener('change', actualizarOpcionesSelect);
        primerSelectServicio.addEventListener('change', aplicarBloqueoRolServicios);
    }
    
    // Clonación de la plantilla de servicio para agregar nuevos campos
    const plantillaServicio = primerCampoServicio ? primerCampoServicio.cloneNode(true) : null;
    if (plantillaServicio) {
        plantillaServicio.removeAttribute('id');
        plantillaServicio.classList.add('servicio-adicional');

        const selectTemplate = plantillaServicio.querySelector('select');
        selectTemplate.removeAttribute('id');
        selectTemplate.value = ""; // Limpia el valor inicial del select clonado.
        selectTemplate.classList.add('select-con-boton');

        const labelTemplate = plantillaServicio.querySelector('label');
        if (labelTemplate) {
            labelTemplate.classList.add('label-con-boton');
            labelTemplate.setAttribute('for', 'servicio_template');
        }
    }


    // --- MANEJO DE SERVICIOS ADICIONALES ---
    if (agregarServicioBtn && plantillaServicio) {
        agregarServicioBtn.addEventListener('click', () => {
            const selectoresServicio = campoServicioContenedor.querySelectorAll('select[name="servicio[]"]');

            // Bloquea agregar servicios si el rol es Administrador.
            if (selectRol && selectRol.value === VALOR_ROL_ADMIN) {
                alert("No se pueden agregar servicios si el Rol seleccionado es Administrador.");
                return;
            }

            // Límite de campos
            if (selectoresServicio.length >= LIMITE_CAMPOS) {
                alert(`Ya has agregado el máximo de ${LIMITE_CAMPOS} servicios.`);
                return
            }
            
            // Clonar y preparar el nuevo campo
            const nuevoCampo = plantillaServicio.cloneNode(true);
            const nuevoSelect = nuevoCampo.querySelector('select');
            const nuevaLabel = nuevoCampo.querySelector('label');
            const nuevoId = 'servicio_' + Date.now();
            
            nuevoSelect.setAttribute('id', nuevoId);
            if (nuevaLabel) {
                nuevaLabel.setAttribute('for', nuevoId);
            }
            
            // Crear botón de eliminar
            const botonEliminarNuevo = document.createElement('button');
            botonEliminarNuevo.type = 'button';
            botonEliminarNuevo.classList.add('boton-eliminar-servicio');
            botonEliminarNuevo.innerHTML = '&times;';
            
            nuevoCampo.appendChild(botonEliminarNuevo);

            // Insertar el nuevo campo antes del botón de agregar.
            campoServicioContenedor.insertBefore(nuevoCampo, campoServicioContenedor.querySelector('.boton-agregar-servicio-contenedor'));

            // Listeners para el nuevo campo (Eliminar, Validar Duplicados, Bloqueo de Rol)
            botonEliminarNuevo.addEventListener('click', e => {
                e.target.closest('.campo').remove();
                actualizarOpcionesSelect();
                aplicarBloqueoRolServicios();
            });
            nuevoSelect.addEventListener('change', actualizarOpcionesSelect);
            nuevoSelect.addEventListener('change', aplicarBloqueoRolServicios); // Al cambiar servicio, revisa si bloquea Rol Admin.
            
            actualizarOpcionesSelect();
            aplicarBloqueoRolServicios(); // Ejecuta lógica después de añadir.
        });
    }


    // --- FUNCIÓN DE BLOQUEO ESTRICTO DE ROL/SERVICIOS ---
    function aplicarBloqueoRolServicios() {
        if (!selectRol || !campoServicioContenedor) return;

        const selectoresServicio = campoServicioContenedor.querySelectorAll('select[name="servicio[]"]');
        // Comprueba si hay al menos un servicio seleccionado.
        const hayServiciosSeleccionados = Array.from(selectoresServicio).some(select => select.value && !select.disabled);
        const esAdministrador = selectRol.value === VALOR_ROL_ADMIN;

        // 1. BLOQUEO DE SERVICIOS si el Rol es Administrador
        if (esAdministrador) {
            // Deshabilita visualmente el contenedor de servicios.
            campoServicioContenedor.style.pointerEvents = 'none';
            campoServicioContenedor.style.opacity = '0.5';
            if (agregarServicioBtn) {
                agregarServicioBtn.disabled = true;
            }

            // Limpia y deshabilita todos los selects de servicios.
            selectoresServicio.forEach(select => {
                if (select.value) {
                    select.value = ""; // Limpia el valor.
                }
                select.disabled = true;
                select.setCustomValidity(""); // Limpia validación.
            });

            // Elimina dinámicamente los campos extra.
            const extras = campoServicioContenedor.querySelectorAll('.servicio-adicional');
            extras.forEach(el => el.remove());

        } else {
            // DESBLOQUEAR SERVICIOS si NO es Administrador
            campoServicioContenedor.style.pointerEvents = 'auto';
            campoServicioContenedor.style.opacity = '1';
            if (agregarServicioBtn) {
                agregarServicioBtn.disabled = false;
            }
            // Habilita los selects de servicio.
            selectoresServicio.forEach(select => {
                select.disabled = false;
            });
        }

        // 2. BLOQUEO DE ROL ADMINISTRADOR si hay Servicios seleccionados
        const opcionAdmin = selectRol.querySelector(`option[value="${VALOR_ROL_ADMIN}"]`);

        if (opcionAdmin) {
            if (hayServiciosSeleccionados) {
                // Bloquea la opción 'Administrador' en el select de rol.
                opcionAdmin.disabled = true;
                // Si el usuario intentó seleccionar Admin, lo fuerza a "Trabajador".
                if (selectRol.value === VALOR_ROL_ADMIN) {
                    selectRol.value = "Trabajador"; 
                }
            } else {
                // DESBLOQUEAR ROL ADMIN
                opcionAdmin.disabled = false;
            }
        }
    }

    // --- FUNCIÓN DE VALIDACIÓN DE DUPLICADOS Y CONSISTENCIA ---
    function actualizarOpcionesSelect() {
        const selectoresServicio = campoServicioContenedor.querySelectorAll('select[name="servicio[]"]'),
            valoresSeleccionados = new Set();
        let esValido = true;

        selectoresServicio.forEach(selectElement => {
            // Solo valida selects no deshabilitados.
            if (!selectElement.disabled) {
                const valorActual = selectElement.value;
                if (valorActual) {
                    if (valoresSeleccionados.has(valorActual)) {
                        // setCustomValidity maneja la validación de formularios nativa (duplicados).
                        selectElement.setCustomValidity("Este servicio ya ha sido seleccionado. Por favor, elija uno diferente.");
                        esValido = false;
                    } else {
                        valoresSeleccionados.add(valorActual);
                        selectElement.setCustomValidity("");
                    }
                } else selectElement.setCustomValidity("")
            }
        });

        // Itera nuevamente para deshabilitar las opciones duplicadas en los otros selects.
        selectoresServicio.forEach(currentSelect => {
            const currentSelectedValue = currentSelect.value;
            if (!currentSelect.disabled) {
                Array.from(currentSelect.options).forEach(option => {
                    const optionValue = option.value;
                    
                    // Lógica para deshabilitar si ya está seleccionado en OTRO campo.
                    if (optionValue) {
                         const yaSeleccionado = valoresSeleccionados.has(optionValue);
                        
                         if (yaSeleccionado && optionValue !== currentSelectedValue) {
                             option.disabled = true;
                         } else {
                            // Habilita si no está seleccionado en otro lugar.
                             if (!option.hasAttribute('data-default-option')) {
                                 option.disabled = false;
                             }
                         }
                    }
                });
            }
        });

        // Asegura que el bloqueo de Rol se ejecute después de la validación de servicios.
        aplicarBloqueoRolServicios();

        return esValido;
    }

    // --- ENVÍO DE DATOS AL BACKEND (Función Asíncrona) ---
    async function enviarDatosAlBackend(e) {
        e.preventDefault();

        // 🚨 VALIDACIÓN FINAL ESTRICTA: Evita inconsistencia (Admin con servicios).
        const selectoresServicio = campoServicioContenedor.querySelectorAll('select[name="servicio[]"]');
        const esAdministrador = selectRol && selectRol.value === VALOR_ROL_ADMIN;
        const hayServiciosSeleccionados = Array.from(selectoresServicio).some(select => select.value && !select.disabled);
        
        if (esAdministrador && hayServiciosSeleccionados) {
            alert("Error: El Rol Administrador no debe tener servicios asociados.");
            aplicarBloqueoRolServicios(); // Intenta limpiar y re-aplicar reglas.
            return;
        }

        // Valida si hay servicios duplicados antes de enviar.
        if (!actualizarOpcionesSelect()) {
            alert("Corrija los servicios duplicados antes de continuar.");
            return;
        }

        // 1. Recolección de Servicios (solo los válidos y no deshabilitados)
        const serviciosSeleccionados = [];
        selectoresServicio.forEach(selectElement => {
            if (!selectElement.disabled && selectElement.value) {
                serviciosSeleccionados.push(selectElement.value)
            }
        });

        // 2. Recolección de otros campos por ID
        const nombreInput = document.getElementById('nombre'); 
        const apellidoInput = document.getElementById('apellido');
        const correoInput = document.getElementById('email');
        const telefonoInput = document.getElementById('celular');
        const passwordInput = document.getElementById('contrasena'); 
        
        // Objeto de datos listo para el envío.
        const datosEmpleado = {
            nombre: nombreInput ? nombreInput.value.trim() : '',
            apellido: apellidoInput ? apellidoInput.value.trim() : '',
            correo: correoInput ? correoInput.value.trim() : '',
            telefono: telefonoInput ? telefonoInput.value.trim() : '',
            contraseña: passwordInput ? passwordInput.value : '',
            rol: selectRol ? selectRol.value : 'Trabajador',
            estado: 'Disponible',
            servicios: serviciosSeleccionados // Array de servicios.
        };
        
        console.log('Datos a enviar:', datosEmpleado);

        // Validación de campos requeridos (simple)
        if (!datosEmpleado.nombre || !datosEmpleado.correo || !datosEmpleado.apellido || !datosEmpleado.contraseña || !datosEmpleado.rol) {
            alert("Por favor completa los campos obligatorios (Nombre, Apellido, Correo, Contraseña, Rol).");
            return;
        }

        try {
            // Realiza la petición POST a la API.
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
                alert(`Empleado ${datosEmpleado.nombre} creado exitosamente!`);
                console.log('Respuesta del servidor:', resultado);
                
                // Limpia el formulario y resetea el estado de los selects/bloqueos.
                formulario.reset();
                aplicarBloqueoRolServicios();
                actualizarOpcionesSelect(); 
                
            } else {
                alert(`Error al crear empleado (${respuesta.status}): ${resultado.error || resultado.mensaje || 'Respuesta inesperada'}`);
                console.error('Error del servidor:', resultado);
            }
        } catch (error) {
            alert('Error de conexión: No se pudo contactar al servidor. Asegúrate que el backend esté corriendo.');
            console.error('Error de fetch:', error);
        }
    }

    // --- INICIALIZACIÓN Y LISTENERS GLOBALES ---

    // Listener principal: si el rol cambia, se dispara la lógica de bloqueo de servicios.
    if (selectRol) {
        selectRol.addEventListener('change', aplicarBloqueoRolServicios);
    }
    
    // Listener para el envío del formulario.
    if (formulario) {
        formulario.addEventListener('submit', enviarDatosAlBackend)
    }

    // Ejecución inicial: configura el estado inicial de los servicios y el rol al cargar.
    aplicarBloqueoRolServicios();
});