document.addEventListener('DOMContentLoaded', () => {
    
    // --- LÓGICA DE REGISTRO/ENVÍO DEL FORMULARIO ---
    
    // Asume que el formulario principal tiene el id="registroForm"
    const formulario = document.querySelector('.formulario-card form') || document.getElementById('registroForm');
    
    // Cambiar 'la URL de la API de Node.js'
    const REGISTRO_ENDPOINT = 'http://tu-backend.com/api/registrar'; 
    
    if (formulario) {
        formulario.addEventListener('submit', async (evento) => {
            evento.preventDefault(); 
            
            // Re-validar las opciones de servicio antes de enviar (Lógica del punto 4, movida aquí)
            if (typeof actualizarOpcionesSelect === 'function' && !actualizarOpcionesSelect()) {
                alert("Corrija los servicios duplicados antes de continuar.");
                return; // Detiene el envío si hay duplicados
            }

            // 1. Recolección de datos
            const datosFormulario = new FormData(formulario);
            
            // 2. Recolectar Servicios (Servicios es un array)
            const serviciosSeleccionados = [];
            datosFormulario.forEach((valor, clave) => {
                // Buscamos todos los campos de servicio, que deberían llamarse 'servicio[]'
                if (clave === 'servicio[]' && valor) { 
                    serviciosSeleccionados.push(valor);
                }
            });

            // 3. Crear el objeto de registro
            const datosRegistro = {
                email: datosFormulario.get('email'),
                contrasena: datosFormulario.get('contrasena'),
                nombre: datosFormulario.get('nombre'),
                apellido: datosFormulario.get('apellido'),
                servicios: serviciosSeleccionados // Incluimos el array de servicios
            };

            try {
                // 4. Enviar la solicitud POST
                const respuesta = await fetch(REGISTRO_ENDPOINT, {
                    method: 'POST', 
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(datosRegistro), 
                });

                const resultado = await respuesta.json();

                if (respuesta.ok) {
                    alert('✅ Registro exitoso! Bienvenido.');
                    console.log('Respuesta del servidor:', resultado);
                    // Opcional: Redirigir al usuario
                } else {
                    const mensajeError = resultado.mensaje || 'Error desconocido al registrar.';
                    alert(`❌ Error al crear cuenta: ${mensajeError}`);
                    console.error('Error del servidor:', resultado);
                }

            } catch (error) {
                alert('🚨 Error de conexión. Verifica la URL o si el servidor está activo.');
                console.error('Error de fetch:', error);
            }
        });
    }

    // ----------------------------------------------------------------------------------
    // --- LÓGICA DE GESTIÓN DE SERVICIOS (Añadir/Eliminar/Validar) ---
    // ----------------------------------------------------------------------------------

    const agregarServicioBtn = document.getElementById('agregarServicioBtn');
    // Asegúrate de que este contenedor exista en tu HTML (e.g., <div class="campo-servicio-contenedor">...)
    const campoServicioContenedor = document.querySelector('.campo-servicio-contenedor'); 
    
    // Validamos que los elementos existan antes de proceder con la lógica de servicios
    if (!agregarServicioBtn || !campoServicioContenedor) {
        console.warn("No se encontraron los elementos necesarios para la gestión de servicios (agregarServicioBtn o campoServicioContenedor).");
        return; 
    }

    const primerCampoServicio = campoServicioContenedor.querySelector('.campo');
    
    // Si no hay un campo inicial, no podemos clonar y la lógica no aplica
    if (!primerCampoServicio) {
        console.error("No se encontró el campo de servicio inicial (.campo) dentro de .campo-servicio-contenedor.");
        return;
    }

    // Define el límite máximo total de campos de servicio (1 original + 11 adicionales = 12)
    const LIMITE_CAMPOS = 12;

    // --- 1. Preparación de la Plantilla ---
    const plantillaServicio = primerCampoServicio.cloneNode(true);
    plantillaServicio.removeAttribute('id');
    plantillaServicio.classList.add('servicio-adicional');

    const selectTemplate = plantillaServicio.querySelector('select');
    selectTemplate.removeAttribute('id');
    selectTemplate.value = ""; 
    // Aseguramos que el select no tenga la propiedad 'required' en la plantilla para la clonación
    selectTemplate.removeAttribute('required'); 
    
    // Limpieza de clases extras que no son esenciales
    selectTemplate.classList.remove('select-con-boton'); 

    const labelTemplate = plantillaServicio.querySelector('label');
    labelTemplate.classList.remove('label-con-boton');
    labelTemplate.setAttribute('for', 'servicio_template');


    // --- 3. Lógica Central: Actualización y Filtrado de Opciones (Declarada para ser usada en el submit del form) ---
    function actualizarOpcionesSelect() {
        const selectoresServicio = campoServicioContenedor.querySelectorAll('select[name="servicio[]"]');
        const valoresSeleccionados = new Set();
        let esValido = true;

        // Paso A: Recolectar todos los valores actualmente seleccionados (y validar duplicados)
        selectoresServicio.forEach(selectElement => {
            const valorActual = selectElement.value;
            if (valorActual) {
                if (valoresSeleccionados.has(valorActual)) {
                    // Marca el select con el mensaje de error de validación HTML5
                    selectElement.setCustomValidity("Este servicio ya ha sido seleccionado. Por favor, elija uno diferente.");
                    esValido = false;
                } else {
                    valoresSeleccionados.add(valorActual);
                    selectElement.setCustomValidity(""); // Limpia el error
                }
            } else {
                 selectElement.setCustomValidity("");
            }
        });

        // Paso B: Deshabilitar las opciones seleccionadas en otros selects
        selectoresServicio.forEach(currentSelect => {
            const currentSelectedValue = currentSelect.value;
            
            Array.from(currentSelect.options).forEach(option => {
                const optionValue = option.value;
                const yaSeleccionado = valoresSeleccionados.has(optionValue);
                
                // Deshabilita la opción si está seleccionada en *otro* select
                if (optionValue && yaSeleccionado && optionValue !== currentSelectedValue) {
                    option.disabled = true;
                } else {
                    // Asegura que las opciones no seleccionadas estén habilitadas
                    option.disabled = false;
                }
            });
        });
        
        return esValido;
    }
    
    // --- 2. Función para agregar un nuevo campo de servicio ---
    agregarServicioBtn.addEventListener('click', () => {
        const selectoresServicio = campoServicioContenedor.querySelectorAll('select[name="servicio[]"]');

        // VERIFICACIÓN DE LÍMITE
        if (selectoresServicio.length >= LIMITE_CAMPOS) {
            alert(`Ya has agregado el máximo de ${LIMITE_CAMPOS} servicios.`);
            return; 
        }
        
        const nuevoCampo = plantillaServicio.cloneNode(true);
        const nuevoSelect = nuevoCampo.querySelector('select');
        const nuevaLabel = nuevoCampo.querySelector('label');
        
        // Asignar ID único
        const nuevoId = 'servicio_' + Date.now();
        nuevoSelect.setAttribute('id', nuevoId);
        nuevaLabel.setAttribute('for', nuevoId);
        
        // Crear y añadir el botón de eliminar
        const botonEliminarNuevo = document.createElement('button');
        botonEliminarNuevo.type = 'button';
        botonEliminarNuevo.classList.add('boton-eliminar-servicio');
        botonEliminarNuevo.innerHTML = '&times;';
        
        nuevoCampo.appendChild(botonEliminarNuevo);

        // Insertar antes del contenedor del botón de agregar
        const botonAgregarContenedor = campoServicioContenedor.querySelector('.boton-agregar-servicio-contenedor');
        if (botonAgregarContenedor) {
             campoServicioContenedor.insertBefore(nuevoCampo, botonAgregarContenedor);
        } else {
             campoServicioContenedor.appendChild(nuevoCampo); // fallback
        }

        // Añadir listeners para eliminación y validación
        botonEliminarNuevo.addEventListener('click', (e) => {
            e.target.closest('.campo').remove();
            actualizarOpcionesSelect(); 
        });
        
        nuevoSelect.addEventListener('change', actualizarOpcionesSelect);
        
        // Actualizar las opciones en todos los selectores después de añadir uno nuevo
        actualizarOpcionesSelect(); 
    });

    // --- 4. Inicialización de Listeners ---
    // El listener del formulario ya fue manejado al principio.
    primerCampoServicio.querySelector('select').addEventListener('change', actualizarOpcionesSelect);
    
    // Ejecutar la actualización inicial en caso de que el primer campo ya tenga un valor
    actualizarOpcionesSelect(); 

});