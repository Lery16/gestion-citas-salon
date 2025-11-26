document.addEventListener('DOMContentLoaded', () => {
    const agregarServicioBtn = document.getElementById('agregarServicioBtn');
    const campoServicioContenedor = document.querySelector('.campo-servicio-contenedor');
    const primerCampoServicio = campoServicioContenedor.querySelector('.campo');
    
    // Define el límite máximo total de campos de servicio (1 original + 11 adicionales = 12)
    const LIMITE_CAMPOS = 12;

    // --- 1. Preparación de la Plantilla ---
    const plantillaServicio = primerCampoServicio.cloneNode(true);
    plantillaServicio.removeAttribute('id');
    plantillaServicio.classList.add('servicio-adicional');

    const selectTemplate = plantillaServicio.querySelector('select');
    selectTemplate.removeAttribute('id');
    selectTemplate.value = ""; 
    selectTemplate.classList.add('select-con-boton');

    const labelTemplate = plantillaServicio.querySelector('label');
    labelTemplate.classList.add('label-con-boton');
    labelTemplate.setAttribute('for', 'servicio_template');


    // --- 2. Función para agregar un nuevo campo de servicio ---
    agregarServicioBtn.addEventListener('click', () => {
        const selectoresServicio = campoServicioContenedor.querySelectorAll('select[name="servicio[]"]');

        // VERIFICACIÓN DE LÍMITE
        if (selectoresServicio.length >= LIMITE_CAMPOS) {
            alert(`Ya has agregado el máximo de ${LIMITE_CAMPOS} servicios.`);
            return; // Detiene la función si se alcanza el límite
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

        // Insertar antes del botón de agregar
        campoServicioContenedor.insertBefore(nuevoCampo, campoServicioContenedor.querySelector('.boton-agregar-servicio-contenedor'));

        // Añadir listeners para eliminación y validación
        botonEliminarNuevo.addEventListener('click', (e) => {
            e.target.closest('.campo').remove();
            actualizarOpcionesSelect(); 
        });
        
        nuevoSelect.addEventListener('change', actualizarOpcionesSelect);
        
        // Actualizar las opciones en todos los selectores después de añadir uno nuevo
        actualizarOpcionesSelect(); 
    });


    // --- 3. Lógica Central: Actualización y Filtrado de Opciones ---
    function actualizarOpcionesSelect() {
        const selectoresServicio = campoServicioContenedor.querySelectorAll('select[name="servicio[]"]');
        const valoresSeleccionados = new Set();
        let esValido = true;

        // Paso A: Recolectar todos los valores actualmente seleccionados (y validar duplicados)
        selectoresServicio.forEach(selectElement => {
            const valorActual = selectElement.value;
            if (valorActual) {
                if (valoresSeleccionados.has(valorActual)) {
                    selectElement.setCustomValidity("Este servicio ya ha sido seleccionado. Por favor, elija uno diferente.");
                    esValido = false;
                } else {
                    valoresSeleccionados.add(valorActual);
                    selectElement.setCustomValidity("");
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
                
                if (optionValue && yaSeleccionado && optionValue !== currentSelectedValue) {
                    option.disabled = true;
                } else {
                    option.disabled = false;
                }
            });
        });
        
        return esValido;
    }
    
    // --- 4. Inicialización de Listeners ---
    primerCampoServicio.querySelector('select').addEventListener('change', actualizarOpcionesSelect);

    // Impedir el envío del formulario si hay duplicados
    const formulario = document.getElementById('registroForm');
    if (formulario) {
        formulario.addEventListener('submit', (e) => {
            if (!actualizarOpcionesSelect()) {
                e.preventDefault();
                alert("Corrija los servicios duplicados antes de continuar.");
            }
        });
    }

});