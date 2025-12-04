/**
 * funciones/gestion_citas_fun.js
 * Lógica principal: Gestión de estado, filtros, renderizado y acciones CRUD (local/remoto).
 * Depende de que el DOM y calendario.js ya hayan cargado.
 */

document.addEventListener('DOMContentLoaded', () => {
    const userToken = localStorage.getItem('user_token');
    const userRol = localStorage.getItem('user_rol');
    if (!userToken || userRol !== 'Administrador') {
        window.location.href = LOGIN_PAGE;
        return;
    }
    
    // REFERENCIAS AL DOM (CORREGIDAS)
    const limpiarButton = document.getElementById('limpiarFiltros');
    const selectAllCheckbox = document.getElementById('selectAll');
    const bulkCancelButton = document.getElementById('bulkCancel');
    
    // 🚩 CORRECCIÓN: Usar ID 'aplicar-filtros-btn'
    const aplicarFiltrosBtn = document.getElementById('aplicar-filtros-btn'); 
    
    const deshacerAccionBtn = document.getElementById('deshacerAccion');
    
    // 🚩 CORRECCIÓN: Usar ID 'Guardar'
    const guardarBtn = document.getElementById('Guardar'); 

    const API_BASE_URL = 'http://localhost:3000/api';
    
    // Inputs de Filtros
    const buscarNombreInput = document.getElementById('buscarNombre');
    const selectEstado = document.getElementById('selectEstado');
    const inputFecha = document.getElementById('fechaSeleccionada'); // Usado en filtros
    
    // Contenedor de resultados
    const listaCitasContainer = document.querySelector('.lista-citas');

    // VARIABLES DE ESTADO (Globales de la App)
    let citasOriginales = []; // Datos iniciales del backend
    let citasVisuales = [];   // Datos actuales con cambios locales
    let cambiosPendientes = new Map(); // Cambios a enviar: Map<id, nuevoEstado>

    // --- 1. UTILIDADES (Movidas aquí ya que dependen de 'inputFecha' en su lógica) ---
    
    // Convierte fecha input (DD/MM/YYYY) a ISO (YYYY-MM-DD)
    function parseDateToISO(value) {
        if(!value) return null;
        // Utiliza el data-iso guardado por el calendario.js si coincide el valor visible
        if(inputFecha.dataset.iso && inputFecha.value === value) return inputFecha.dataset.iso;
        const parts = value.split('/');
        if(parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
        return null;
    }

    function formatearFechaVisual(fechaString) {
        if (!fechaString) return '';
        const date = new Date(fechaString);
        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        let horas = date.getHours();
        const ampm = horas >= 12 ? 'PM' : 'AM';
        horas = horas % 12; horas = horas ? horas : 12; 
        const minutos = String(date.getMinutes()).padStart(2, '0');
        return `${date.getDate()} ${meses[date.getMonth()]}, ${date.getFullYear()} - ${horas}:${minutos} ${ampm}`;
    }


    // --- 2. MANEJO DE ESTADO LOCAL ---

    function modificarEstadoCitaLocal(id, nuevoEstado) {
        const index = citasVisuales.findIndex(c => c.id == id);
        if (index !== -1) {
            
            // Convertir a minúsculas para manejar la BD (si el estado no está ya en minúsculas)
            const estadoNormalizado = nuevoEstado.toLowerCase(); 

            // Actualizar solo si el estado es diferente al actual, para evitar loops innecesarios
            if (citasVisuales[index].estado.toLowerCase() !== estadoNormalizado) {
                 // Actualizar el estado visualmente (con la primera letra en mayúscula para el render)
                citasVisuales[index].estado = nuevoEstado.charAt(0).toUpperCase() + nuevoEstado.slice(1);
                
                // Almacenar el cambio para el envío: Map<id, estado_normalizado>
                cambiosPendientes.set(id, estadoNormalizado); 
                renderizarCitas(citasVisuales); // Re-renderizar
            }
        }
    }


    // --- 3. RENDERIZADO DE CITAS ---
    function renderizarCitas(lista) {
        listaCitasContainer.innerHTML = '';

        if (lista.length === 0) {
            listaCitasContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">No se encontraron citas con estos filtros.</div>';
            actualizarEstadoBulk();
            return;
        }

        const fragment = document.createDocumentFragment();

        lista.forEach(cita => {
            let botonesAccion = '';
            let isCheckboxDisabled = false;
            let cardClass = 'cita-card';
            // Usar estado en minúsculas para las clases CSS
            const estadoClase = cita.estado.toLowerCase(); 

            // Lógica de botones y clases de estado
            if (estadoClase === 'pendiente') {
                botonesAccion = `
                    <div class="cita-acciones">
                        <button class="btn-accion btn-confirmar" title="Confirmar Cita">✓</button>
                        <button class="btn-accion btn-cancelar" title="Cancelar Cita">🛇</button>
                    </div>
                `;
                isCheckboxDisabled = false;
            } else if (estadoClase === 'confirmada') {
                botonesAccion = `
                    <div class="cita-acciones">
                        <button class="btn-accion btn-cancelar" title="Cancelar Cita">🛇</button>
                    </div>
                `;
                isCheckboxDisabled = false;
            } else if (estadoClase === 'completada') {
                botonesAccion = `
                    <div class="cita-acciones">
                        <button class="btn-accion btn-pendiente" title="Regresar a citas pendientes">⧗</button>
                    </div>
                `;
                isCheckboxDisabled = true;
                cardClass += ' completada-card';
            } else if (estadoClase === 'cancelada') {
                botonesAccion = `
                    <div class="cita-acciones">
                        <button class="btn-accion btn-pendiente" title="Regresar a citas pendientes">⧗</button>
                    </div>
                `;
                isCheckboxDisabled = true;
                cardClass += ' cancelada-card';
            }
            
            // Atributo disabled para el checkbox
            const disabledAttr = isCheckboxDisabled ? 'disabled' : '';

            // Generar el HTML de la tarjeta usando template literals
            const citaHTML = `
                <article class="${cardClass}" data-id="${cita.id}">
                    <div class="cita-selector">
                        <input type="checkbox" class="cita-checkbox" aria-label="Seleccionar cita de ${cita.cliente}" ${disabledAttr}>
                    </div>
                    <div class="cita-detalles">
                        <div class="cita-cliente">${cita.cliente}</div>
                        <div class="cita-meta">
                            <span>Servicio: ${cita.servicio}</span>
                        </div>
                        <div class="cita-meta">
                            <span>Fecha: ${formatearFechaVisual(cita.fecha)}</span>
                        </div>
                    </div>
                    <div class="cita-info-estado">
                        <span class="estado estado-${estadoClase}" title="Cita ${cita.estado}">${cita.estado}</span>
                        ${botonesAccion}
                    </div>
                </article>
            `;

            // Crear un contenedor temporal para parsear el string HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = citaHTML.trim();
            
            // Agregar el primer (y único) hijo al fragment
            fragment.appendChild(tempDiv.firstChild);
        });

        listaCitasContainer.appendChild(fragment);
        actualizarEstadoBulk();
        
        // 🚩 ACTULIZACIÓN: Se usa para manejar la visibilidad/texto del botón de Guardar/Deshacer.
        actualizarVisibilidadBotonesGlobales();
    }
    
    // 🚩 NUEVA FUNCIÓN: Para actualizar el texto y el estado de los botones globales
    function actualizarVisibilidadBotonesGlobales() {
        if (cambiosPendientes.size > 0) {
            guardarBtn.classList.remove('oculto');
            deshacerAccionBtn.classList.remove('oculto');
            // Actualiza el texto para mostrar cuántos cambios hay
            guardarBtn.querySelector('span').textContent = ` Guardar Cambios (${cambiosPendientes.size})`;
        } else {
            guardarBtn.classList.add('oculto');
            deshacerAccionBtn.classList.add('oculto');
             // Restablece el texto original
            guardarBtn.querySelector('span').textContent = ' Guardar Cambios';
        }
        // Asumiendo que 'oculto' es una clase que lo esconde/deshabilita
        // Si no existe, puedes agregar estilos directos o crear esa clase CSS.
    }


    // --- 4. CONEXIÓN CON BACKEND (FETCH) ---
    // Hacemos esta función global (window) para que calendario.js pueda llamarla al seleccionar una fecha
    window.obtenerCitasFiltradas = async function() {
        const nombre = buscarNombreInput.value.trim();
        const estado = selectEstado.value;
        const fechaISO = parseDateToISO(inputFecha.value);

        const filtros = {};
        if (nombre) filtros.nombre = nombre;
        if (estado && estado !== "") filtros.estado = estado;
        if (fechaISO) filtros.fecha = fechaISO;

        // Guardar el contenido original del botón
        const originalContent = aplicarFiltrosBtn.innerHTML; 

        aplicarFiltrosBtn.disabled = true;
        // 🚩 CORRECCIÓN: Usar el ID correcto para actualizar el spinner
        aplicarFiltrosBtn.innerHTML = '<i data-lucide="loader" class="lucide-icon spin"></i><span>Buscando...</span>';

        try {
            const response = await fetch(`${API_BASE_URL}/citas/buscar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(filtros)
            });

            if (!response.ok) throw new Error('Error en la red');

            const data = await response.json();
            
            // Asegurar que los estados se guarden en mayúsculas/minúsculas como vienen de la BD
            citasOriginales = JSON.parse(JSON.stringify(data));
            citasVisuales = JSON.parse(JSON.stringify(data));
            cambiosPendientes.clear();
            
            renderizarCitas(citasVisuales);

        } catch (error) {
            console.error("Error fetching citas:", error);
            listaCitasContainer.innerHTML = '<p class="error">Error al cargar datos. Intenta de nuevo.</p>';
        } finally {
            aplicarFiltrosBtn.disabled = false;
            // 🚩 CORRECCIÓN: Usar el contenido original para restaurar
            aplicarFiltrosBtn.innerHTML = originalContent; 
            // Recrear iconos de Lucide
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }


    // --- 5. EVENT LISTENERS PRINCIPALES ---

    // Filtros
    // 🚩 CORRECCIÓN: El selector para aplicarFiltrosBtn ya usa el ID correcto
    aplicarFiltrosBtn.addEventListener('click', window.obtenerCitasFiltradas);

    limpiarButton.addEventListener('click', () => {
        buscarNombreInput.value = '';
        selectEstado.value = '';
        inputFecha.value = '';
        if(inputFecha.dataset.iso) delete inputFecha.dataset.iso;
        window.obtenerCitasFiltradas();
    });

    // Acciones Individuales (Delegación)
    listaCitasContainer.addEventListener('click', (e) => {
        const btnConfirmar = e.target.closest('.btn-confirmar');
        const btnCancelar = e.target.closest('.btn-cancelar');
        const btnPendiente = e.target.closest('.btn-pendiente');
        
        const card = e.target.closest('.cita-card');
        if (!card) return;
        const id = card.dataset.id;
        let nuevoEstado = null;

        if (btnConfirmar) {
            // El estado que se guarda visualmente (primera letra mayúscula)
            nuevoEstado = 'Confirmada'; 
        } else if (btnCancelar) {
             nuevoEstado = 'Cancelada';
        } else if (btnPendiente) {
             nuevoEstado = 'Pendiente';
        }

        if (nuevoEstado) {
            modificarEstadoCitaLocal(id, nuevoEstado);
        }
    });

    // Deshacer
    deshacerAccionBtn.addEventListener('click', () => {
        if (cambiosPendientes.size === 0) {
            alert("No hay acciones para deshacer.");
            return;
        }
        // Se restablece al estado original
        citasVisuales = JSON.parse(JSON.stringify(citasOriginales)); 
        cambiosPendientes.clear();
        renderizarCitas(citasVisuales);
        alert("Acciones deshechas localmente. Haga clic en 'Guardar Cambios' para revertir las acciones si ya se enviaron al servidor.");
    });

    // Guardar
    guardarBtn.addEventListener('click', async () => {
        if (cambiosPendientes.size === 0) {
            alert("No hay cambios pendientes para guardar.");
            return;
        }

        // Se envían los cambios normalizados (Map<id, estado_en_minusculas>)
        const cambiosArray = Array.from(cambiosPendientes, ([id, estado]) => ({ id, estado }));
        
        // Guardar el contenido original del botón de Guardar
        const originalContent = guardarBtn.innerHTML;
        
        guardarBtn.disabled = true;
        // 🚩 CORRECCIÓN: Usar el ID correcto para actualizar el spinner
        guardarBtn.innerHTML = '<i data-lucide="loader" class="lucide-icon spin"></i><span>Guardando...</span>';
        if (typeof lucide !== 'undefined') lucide.createIcons();

        try {
            // Se asume que el backend espera un PUT a /citas y el body tiene { cambios: [] }
            const response = await fetch(`${API_BASE_URL}/citas`, { 
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cambios: cambiosArray })
            });

            if (!response.ok) throw new Error('Error guardando cambios');

            alert("Cambios guardados exitosamente.");
            await window.obtenerCitasFiltradas(); // Recargar para sincronizar y limpiar cambios pendientes
        } catch (error) {
            console.error(error);
            alert("Error al conectar con el servidor o al guardar los cambios.");
        } finally {
            guardarBtn.disabled = false;
            // 🚩 CORRECCIÓN: Usar el contenido original para restaurar
            guardarBtn.innerHTML = originalContent; 
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    });


    // --- 6. ACCIONES MASIVAS (BULK) ---

    function actualizarEstadoBulk() {
        const checkboxes = document.querySelectorAll('.cita-checkbox:not(:disabled)');
        
        checkboxes.forEach(cb => {
            cb.onchange = () => verificarSelectAll(checkboxes);
        });

        selectAllCheckbox.checked = false;
        bulkCancelButton.disabled = true;
    }

    function verificarSelectAll(checkboxes) {
        const arr = Array.from(checkboxes);
        const allChecked = arr.length > 0 && arr.every(c => c.checked);
        const anyChecked = arr.some(c => c.checked);
        
        selectAllCheckbox.checked = allChecked;
        bulkCancelButton.disabled = !anyChecked;
    }

    selectAllCheckbox.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.cita-checkbox:not(:disabled)');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
        bulkCancelButton.disabled = !e.target.checked || checkboxes.length === 0;
        // Asegurar que el estado del botón se actualiza
        verificarSelectAll(checkboxes); 
    });

    bulkCancelButton.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.cita-checkbox:checked');
        if (checkboxes.length === 0) return;

        const ids = [];
        checkboxes.forEach(cb => {
            const card = cb.closest('.cita-card');
            if (card) ids.push(card.dataset.id);
        });

        // Aplicar el estado de cancelación a todas las citas seleccionadas
        ids.forEach(id => modificarEstadoCitaLocal(id, 'Cancelada'));
        
        // Resetear checks y estado de botones
        selectAllCheckbox.checked = false;
        bulkCancelButton.disabled = true;
    });

    // Carga inicial (Llama a la función que es global)
    window.obtenerCitasFiltradas();
});