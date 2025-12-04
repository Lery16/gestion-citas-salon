/**
 * funciones/gestion_citas_fun.js
 * Lógica principal: Gestión de estado, filtros, renderizado y acciones CRUD (local/remoto).
 * Depende de que el DOM y calendario.js ya hayan cargado.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Verificar autenticación y rol de usuario antes de continuar
    const userToken = localStorage.getItem('user_token');
    const userRol = localStorage.getItem('user_rol');
    if (!userToken || userRol !== 'Administrador') {
        window.location.href = 'inicia_sesion.html';
        return;
    }

    // REFERENCIAS AL DOM
    const limpiarButton = document.getElementById('limpiarFiltros');
    const selectAllCheckbox = document.getElementById('selectAll');
    const bulkCancelButton = document.getElementById('bulkCancel');

    // Usar el ID correcto para el botón de aplicar filtros
    const aplicarFiltrosBtn = document.getElementById('aplicar-filtros-btn');

    const deshacerAccionBtn = document.getElementById('deshacerAccion');

    // Usar el ID correcto para el botón de guardar
    const guardarBtn = document.getElementById('Guardar');

    const API_BASE_URL = 'https://gestion-citas-salon.onrender.com/api';
    /**const API_BASE_URL = 'http://localhost:3000/api'; */

    // Inputs de Filtros
    const buscarNombreInput = document.getElementById('buscarNombre');
    const selectEstado = document.getElementById('selectEstado');
    const inputFecha = document.getElementById('fechaSeleccionada'); // Usado en filtros

    // Contenedor de resultados
    const listaCitasContainer = document.querySelector('.lista-citas');

    // VARIABLES DE ESTADO (Globales de la App)
    let citasOriginales = []; // Datos iniciales del backend (para deshacer)
    let citasVisuales = [];   // Datos actuales con cambios locales
    let cambiosPendientes = new Map(); // Cambios a enviar: Map<id, nuevoEstado>

    // --- 1. UTILIDADES (Movidas aquí ya que dependen de 'inputFecha' en su lógica) ---

    // Convierte fecha input (DD/MM/YYYY) a ISO (YYYY-MM-DD)
    function parseDateToISO(value) {
        if(!value) return null;
        // Permite usar data-iso guardado por el calendario.js si está disponible
        if(inputFecha.dataset.iso && inputFecha.value === value) return inputFecha.dataset.iso;
        const parts = value.split('/');
        if(parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
        return null;
    }

    // Formatea la fecha para la visualización en la tarjeta de la cita
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

            // El backend requiere el estado con capitalización (ej: "Cancelada")
            const estadoParaBD = nuevoEstado;

            // Convertir a minúsculas para comparaciones internas y CSS
            const estadoActualLower = citasVisuales[index].estado.toLowerCase();
            const nuevoEstadoLower = nuevoEstado.toLowerCase();

            // Actualizar solo si el estado es diferente al actual
            if (estadoActualLower !== nuevoEstadoLower) {
                // Actualizar el estado visualmente (ya capitalizado)
                citasVisuales[index].estado = nuevoEstado;

                // Almacenar el cambio usando el estado capitalizado
                cambiosPendientes.set(id, estadoParaBD);
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

        // Actualiza el texto y visibilidad de los botones de Guardar/Deshacer.
        actualizarVisibilidadBotonesGlobales();
    }

    // Controla la visibilidad y el texto de los botones globales de acción
    function actualizarVisibilidadBotonesGlobales() {
        if (cambiosPendientes.size > 0) {
            guardarBtn.classList.remove('oculto');
            deshacerAccionBtn.classList.remove('oculto');
            // Actualiza el texto para mostrar cuántos cambios hay
            guardarBtn.querySelector('span').textContent = ` Guardar Cambios (${cambiosPendientes.size})`;
        } else {
            guardarBtn.classList.add('oculto');
            deshacerAccionBtn.classList.add('oculto');
            // Restablece el texto original
            guardarBtn.querySelector('span').textContent = ' Guardar Cambios';
        }
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

        // Guardar el contenido original del botón para restaurarlo
        const originalContent = aplicarFiltrosBtn.innerHTML;

        aplicarFiltrosBtn.disabled = true;
        // Mostrar spinner mientras se busca
        aplicarFiltrosBtn.innerHTML = '<i data-lucide="loader" class="lucide-icon spin"></i><span>Buscando...</span>';

        try {
            const response = await fetch(`${API_BASE_URL}/citas/buscar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(filtros)
            });

            if (!response.ok) throw new Error('Error en la red');

            const data = await response.json();

            // Guardar datos originales y visuales, y limpiar cambios pendientes al obtener nuevos datos
            citasOriginales = JSON.parse(JSON.stringify(data));
            citasVisuales = JSON.parse(JSON.stringify(data));
            cambiosPendientes.clear();

            renderizarCitas(citasVisuales);

        } catch (error) {
            console.error("Error fetching citas:", error);
            listaCitasContainer.innerHTML = '<p class="error">Error al cargar datos. Intenta de nuevo.</p>';
        } finally {
            aplicarFiltrosBtn.disabled = false;
            // Restaurar el contenido original del botón
            aplicarFiltrosBtn.innerHTML = originalContent;
            // Recrear iconos de Lucide (asumiendo que se usa esa librería)
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }


    // --- 5. EVENT LISTENERS PRINCIPALES ---

    // Manejo de Filtros
    aplicarFiltrosBtn.addEventListener('click', window.obtenerCitasFiltradas);

    limpiarButton.addEventListener('click', () => {
        // Resetear todos los campos de filtro
        buscarNombreInput.value = '';
        selectEstado.value = '';
        inputFecha.value = '';
        if(inputFecha.dataset.iso) delete inputFecha.dataset.iso;
        window.obtenerCitasFiltradas(); // Volver a cargar sin filtros
    });

    // Acciones Individuales (Delegación de eventos para botones de acción)
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
        // Se restablece la lista visual a los datos originales traídos del backend
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

        // Convertir el Map de cambios a un Array de objetos [{id: 1, estado: "Cancelada"}, ...]
        const cambiosArray = Array.from(cambiosPendientes, ([id, estado]) => ({ id, estado }));

        // Guardar el contenido original del botón de Guardar
        const originalContent = guardarBtn.innerHTML;

        guardarBtn.disabled = true;
        // Mostrar spinner mientras se guarda
        guardarBtn.innerHTML = '<i data-lucide="loader" class="lucide-icon spin"></i><span>Guardando...</span>';
        if (typeof lucide !== 'undefined') lucide.createIcons();

        try {
            const response = await fetch(`${API_BASE_URL}/citas/actualizar-lote`, {
                method: 'PUT', // Usar PUT para actualizar recursos existentes
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cambios: cambiosArray })
            });

            if (!response.ok) throw new Error('Error guardando cambios');

            alert("Cambios guardados exitosamente.");
            // Recargar para sincronizar con el backend y limpiar cambios pendientes
            await window.obtenerCitasFiltradas();
        } catch (error) {
            console.error(error);
            alert("Error al conectar con el servidor o al guardar los cambios.");
        } finally {
            guardarBtn.disabled = false;
            // Restaurar el contenido original del botón
            guardarBtn.innerHTML = originalContent;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    });

    // --- 6. ACCIONES MASIVAS (BULK) ---

    // Inicializa listeners para checkboxes y actualiza el estado del botón de cancelación masiva
    function actualizarEstadoBulk() {
        const checkboxes = document.querySelectorAll('.cita-checkbox:not(:disabled)');

        checkboxes.forEach(cb => {
            cb.onchange = () => verificarSelectAll(checkboxes);
        });

        selectAllCheckbox.checked = false;
        bulkCancelButton.disabled = true;
    }

    // Verifica el estado de los checkboxes para actualizar el checkbox "Seleccionar Todo"
    function verificarSelectAll(checkboxes) {
        const arr = Array.from(checkboxes);
        const allChecked = arr.length > 0 && arr.every(c => c.checked);
        const anyChecked = arr.some(c => c.checked);

        selectAllCheckbox.checked = allChecked;
        // Habilita el botón de cancelación masiva si al menos uno está seleccionado
        bulkCancelButton.disabled = !anyChecked;
    }

    // Maneja la acción de "Seleccionar Todo"
    selectAllCheckbox.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.cita-checkbox:not(:disabled)');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
        // Deshabilita el botón si no hay nada seleccionado
        bulkCancelButton.disabled = !e.target.checked || checkboxes.length === 0;
        // Asegurar que el estado del botón se actualiza
        verificarSelectAll(checkboxes);
    });

    // Cancela las citas seleccionadas masivamente
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