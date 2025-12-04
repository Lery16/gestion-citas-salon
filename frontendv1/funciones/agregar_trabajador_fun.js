document.addEventListener('DOMContentLoaded', () => {
    // --- CONSTANTES Y ELEMENTOS PRINCIPALES ---
    const API_BASE_URL = 'http://localhost:3000/api',
        ENDPOINT_CREAR_EMPLEADO = '/empleados',
        formulario = document.getElementById('registroForm'),
        LIMITE_CAMPOS = 12;
    
    const userToken = localStorage.getItem('user_token');
    const userRol = localStorage.getItem('user_rol');
    if (!userToken || userRol !== 'Administrador') {
        window.location.href = LOGIN_PAGE;
        return;
    }
    
    // Elementos de Rol
    const selectRol = document.getElementById('rol');
    // Asegúrate que el valor en tu HTML es 'Admin' o 'Administrador' (Usamos 'Administrador' basado en tu código)
    const VALOR_ROL_ADMIN = 'Administrador'; 

    // Contenedor principal de servicios
    const campoServicioContenedor = document.querySelector('.campo-servicio-contenedor');

    // --- TEMPLATE DEL PRIMER CAMPO DE SERVICIO (Para inyección inicial y clonación) ---
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

    // Inyectar el HTML inicial de servicios si el contenedor está vacío
    if (campoServicioContenedor && campoServicioContenedor.children.length === 0) {
        campoServicioContenedor.innerHTML = htmlPrimerCampoServicio;
    }

    // Elementos ya inyectados (Ahora se pueden referenciar)
    const agregarServicioBtn = document.getElementById('agregarServicioBtn');
    const primerCampoServicio = campoServicioContenedor.querySelector('.campo');

    // ** 🎯 CORRECCIÓN APLICADA AQUÍ **
    // Aseguramos que el primer select de servicio tenga los listeners
    if(primerCampoServicio) {
        const primerSelectServicio = primerCampoServicio.querySelector('select');
        // El listener 'change' del primer select debe llamar a las dos funciones clave
        primerSelectServicio.addEventListener('change', actualizarOpcionesSelect);
        primerSelectServicio.addEventListener('change', aplicarBloqueoRolServicios);
    }
    // ** ------------------------------ **

    // Clonación de la plantilla de servicio
    // Clonamos el campo (div.campo) con su select
    const plantillaServicio = primerCampoServicio ? primerCampoServicio.cloneNode(true) : null;
    if (plantillaServicio) {
        plantillaServicio.removeAttribute('id');
        plantillaServicio.classList.add('servicio-adicional');

        const selectTemplate = plantillaServicio.querySelector('select');
        selectTemplate.removeAttribute('id');
        selectTemplate.value = "";
        selectTemplate.classList.add('select-con-boton');

        // Nota: Si no existe <label> en el HTML inyectado de servicio, estas líneas pueden causar error. 
        // Se asume que estás usando etiquetas para estilos o accesibilidad.
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

            // Pre-Validación: Bloquear si ya es Administrador
            if (selectRol && selectRol.value === VALOR_ROL_ADMIN) {
                alert("No se pueden agregar servicios si el Rol seleccionado es Administrador.");
                return;
            }

            if (selectoresServicio.length >= LIMITE_CAMPOS) {
                alert(`Ya has agregado el máximo de ${LIMITE_CAMPOS} servicios.`);
                return
            }
            
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

            // Insertar el nuevo campo antes del contenedor del botón
            campoServicioContenedor.insertBefore(nuevoCampo, campoServicioContenedor.querySelector('.boton-agregar-servicio-contenedor'));

            // Listeners para el nuevo campo
            botonEliminarNuevo.addEventListener('click', e => {
                e.target.closest('.campo').remove();
                actualizarOpcionesSelect();
                aplicarBloqueoRolServicios(); // Aplicar bloqueo al eliminar
            });
            nuevoSelect.addEventListener('change', actualizarOpcionesSelect);
            nuevoSelect.addEventListener('change', aplicarBloqueoRolServicios); // Aplicar bloqueo al cambiar el servicio
            
            actualizarOpcionesSelect();
            aplicarBloqueoRolServicios(); // Aplicar bloqueo después de añadir un campo
        });
    }


    // --- 🔐 FUNCIÓN DE BLOQUEO ESTRICTO DE ROL/SERVICIOS ---
    function aplicarBloqueoRolServicios() {
        if (!selectRol || !campoServicioContenedor) return; // Salir si no existe el campo de Rol o el contenedor

        const selectoresServicio = campoServicioContenedor.querySelectorAll('select[name="servicio[]"]');
        // Verifica si HAY servicios seleccionados con valor (excluyendo la opción default y deshabilitados)
        const hayServiciosSeleccionados = Array.from(selectoresServicio).some(select => select.value && !select.disabled);
        const esAdministrador = selectRol.value === VALOR_ROL_ADMIN;

        // 1. BLOQUEO DE SERVICIOS si el Rol es Administrador
        if (esAdministrador) {
            // BLOQUEO ESTRICTO DEL CONTENEDOR (Estilístico y funcional para el botón)
            campoServicioContenedor.style.pointerEvents = 'none'; // Bloquea la interacción del cursor con el contenedor
            campoServicioContenedor.style.opacity = '0.5'; // Indicador visual de bloqueo
            if (agregarServicioBtn) {
                 agregarServicioBtn.disabled = true;
            }

            // BLOQUEO Y LIMPIEZA DE SELECTS DE SERVICIOS
            selectoresServicio.forEach(select => {
                // Si el Rol es Admin, forzamos a que no haya servicios
                if (select.value) {
                    select.value = ""; // Limpiar el valor seleccionado para evitar envío de datos
                }
                select.disabled = true;
                // También debemos limpiar el mensaje de custom validity si existe
                select.setCustomValidity(""); 
            });

             // Eliminar todos los campos de servicio adicionales (si existen)
            const extras = campoServicioContenedor.querySelectorAll('.servicio-adicional');
            extras.forEach(el => el.remove());

        } else {
            // DESBLOQUEAR SERVICIOS si NO es Administrador
            campoServicioContenedor.style.pointerEvents = 'auto';
            campoServicioContenedor.style.opacity = '1';
            if (agregarServicioBtn) {
                agregarServicioBtn.disabled = false;
            }
            selectoresServicio.forEach(select => {
                select.disabled = false;
            });
        }

        // 2. BLOQUEO DE ROL ADMINISTRADOR si hay Servicios seleccionados
        const opcionAdmin = selectRol.querySelector(`option[value="${VALOR_ROL_ADMIN}"]`);

        if (opcionAdmin) {
            if (hayServiciosSeleccionados) {
                // BLOQUEAR ROL ADMIN
                opcionAdmin.disabled = true;
                // Si estaba seleccionado Admin y ahora hay servicios, forzamos a Trabajador.
                if (selectRol.value === VALOR_ROL_ADMIN) {
                    selectRol.value = "Trabajador"; // Asume "Trabajador" es el valor por defecto/alternativo
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
            // Solo procesamos si el select no está deshabilitado por la regla de Administrador
            if (!selectElement.disabled) {
                const valorActual = selectElement.value;
                if (valorActual) {
                    if (valoresSeleccionados.has(valorActual)) {
                        selectElement.setCustomValidity("Este servicio ya ha sido seleccionado. Por favor, elija uno diferente.");
                        esValido = false;
                    } else {
                        valoresSeleccionados.add(valorActual);
                        selectElement.setCustomValidity("");
                    }
                } else selectElement.setCustomValidity("")
            }
        });

        selectoresServicio.forEach(currentSelect => {
            const currentSelectedValue = currentSelect.value;
            // Solo actualiza las opciones si el campo de servicio NO está deshabilitado
            if (!currentSelect.disabled) {
                Array.from(currentSelect.options).forEach(option => {
                    const optionValue = option.value;
                    
                    // Solo intentar deshabilitar opciones que tienen valor (no el placeholder)
                    if (optionValue) {
                         const yaSeleccionado = valoresSeleccionados.has(optionValue);
                        
                        // Deshabilita la opción si ya está seleccionada en otro select, a menos que sea la opción actual
                        if (yaSeleccionado && optionValue !== currentSelectedValue) {
                            option.disabled = true;
                        } else {
                            // Aseguramos que se habilite si ya no está seleccionado o es el default
                            if (!option.hasAttribute('data-default-option')) {
                                option.disabled = false;
                            }
                        }
                    }
                });
            }
        });

        // Aplicar bloqueo de consistencia después de la validación de duplicados
        // Llamar aquí asegura que si se selecciona un servicio, el rol Admin se bloquee inmediatamente.
        aplicarBloqueoRolServicios();

        return esValido;
    }

    // --- 🚀 ENVÍO DE DATOS AL BACKEND (CREACIÓN DE EMPLEADO) ---
    async function enviarDatosAlBackend(e) {
        e.preventDefault();

        // 🚨 VALIDACIÓN FINAL ESTRICTA: Doble verificación antes de enviar
        const selectoresServicio = campoServicioContenedor.querySelectorAll('select[name="servicio[]"]');
        const esAdministrador = selectRol && selectRol.value === VALOR_ROL_ADMIN;
        const hayServiciosSeleccionados = Array.from(selectoresServicio).some(select => select.value && !select.disabled);
        
        if (esAdministrador && hayServiciosSeleccionados) {
            alert("Error: El Rol Administrador no debe tener servicios asociados.");
            aplicarBloqueoRolServicios(); // Intenta limpiar
            return;
        }

        if (!actualizarOpcionesSelect()) {
            // Si la validación de duplicados falla, no enviamos
            alert("Corrija los servicios duplicados antes de continuar.");
            return;
        }

        // 1. Recolección de Servicios
        const serviciosSeleccionados = [];
        selectoresServicio.forEach(selectElement => {
            // Solo enviar servicios si NO es Admin (selectElement.disabled === false) y tiene un valor
            if (!selectElement.disabled && selectElement.value) {
                serviciosSeleccionados.push(selectElement.value)
            }
        });

        // 2. Recolección de otros campos (Asegúrate que los IDs coincidan con tu HTML)
        const nombreInput = document.getElementById('nombre'); 
        const apellidoInput = document.getElementById('apellido');
        const correoInput = document.getElementById('email');
        const telefonoInput = document.getElementById('celular');
        const passwordInput = document.getElementById('contrasena'); 
        
        // Objeto final que espera el Backend para crear al Empleado
        const datosEmpleado = {
            nombre: nombreInput ? nombreInput.value.trim() : '',
            apellido: apellidoInput ? apellidoInput.value.trim() : '',
            correo: correoInput ? correoInput.value.trim() : '',
            telefono: telefonoInput ? telefonoInput.value.trim() : '',
            contraseña: passwordInput ? passwordInput.value : '',
            rol: selectRol ? selectRol.value : 'Trabajador',
            estado: 'Disponible',
            servicios: serviciosSeleccionados
        };
        
        console.log('Datos a enviar:', datosEmpleado);

        // Validación de campos requeridos (simple)
        if (!datosEmpleado.nombre || !datosEmpleado.correo || !datosEmpleado.apellido || !datosEmpleado.contraseña || !datosEmpleado.rol) {
            alert("Por favor completa los campos obligatorios (Nombre, Apellido, Correo, Contraseña, Rol).");
            return;
        }

        try {
            // ✨ USANDO API_BASE_URL
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
                
                // Limpiar el formulario y resetear el estado
                formulario.reset();
                // Limpiar campos de servicios adicionales y aplicar la lógica de bloqueo/limpieza
                aplicarBloqueoRolServicios();
                actualizarOpcionesSelect(); 
                
            } else {
                alert(`❌ Error al crear empleado (${respuesta.status}): ${resultado.error || resultado.mensaje || 'Respuesta inesperada'}`);
                console.error('Error del servidor:', resultado);
            }
        } catch (error) {
            alert('🚨 Error de conexión: No se pudo contactar al servidor. Asegúrate que el backend esté corriendo.');
            console.error('Error de fetch:', error);
        }
    }

    // --- INICIALIZACIÓN Y LISTENERS GLOBALES ---

    // Listener para el campo de Rol (El principal gatillo para el bloqueo de servicios)
    if (selectRol) {
        selectRol.addEventListener('change', aplicarBloqueoRolServicios);
    }
    
    // Listener para el formulario
    if (formulario) {
        formulario.addEventListener('submit', enviarDatosAlBackend)
    }

    // Llamada inicial para establecer el estado del bloqueo (importante si hay valores por defecto)
    aplicarBloqueoRolServicios();
});