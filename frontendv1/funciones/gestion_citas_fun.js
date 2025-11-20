/*
Estrategia de endpoints (ajusta si tu backend usa rutas diferentes):
- POST /api/citas/search    -> { nombre, estado, fecha }  => devuelve array de citas
- PUT  /api/citas/bulk-update -> { updates: [{ id, estado }] } => aplica cambios
- GET  /api/citas           -> devuelve todas las citas (opcional)

Formato esperado por cada cita del backend (ejemplo):
{
  id: 'abc123',
  cliente: 'Ana Pérez',
  servicio: 'Corte y Tinte',
  fecha: '2025-11-15T10:00:00.000Z', // ISO
  estado: 'confirmada' // o 'cancelada'
}
*/

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS ---
    const toggleButton = document.getElementById('toggleFiltros');
    const filtroPanel = document.getElementById('filtroPanel');
    const limpiarButton = document.getElementById('limpiarFiltros');
    const selectAllCheckbox = document.getElementById('selectAll');
    const bulkCancelButton = document.getElementById('bulkCancel');
    const aplicarFiltrosBtn = document.querySelector('.aplicar-filtros-btn');
    const deshacerAccionBtn = document.getElementById('deshacerAccion');
    const guardarBtn = document.getElementById('Guardar');

    const buscarNombreInput = document.getElementById('buscarNombre');
    const selectEstado = document.getElementById('selectEstado');
    const inputFecha = document.getElementById('fechaSeleccionada');
    const calendarioWrapper = document.getElementById('calendarioPicker');

    const listaCitasContainer = document.querySelector('.lista-citas');

    // Variables de estado en el frontend
    let allCitas = []; // Resultado actual mostrado (array de objetos)
    let originalCitas = []; // Copia del resultado para deshacer
    let canceledIds = new Set(); // IDs cancelados localmente desde la UI

    // Calendario
    const panelCalendario = calendarioWrapper?.querySelector('.calendario-dropdown-panel');
    const mesSelect = document.getElementById('mesSelect');
    const anioSelect = document.getElementById('anioSelect');
    const calPrev = document.getElementById('calPrev');
    const calNext = document.getElementById('calNext');
    const calendarioDiasGrid = document.getElementById('calendarioDias');

    const mesDropdown = calendarioWrapper?.querySelector('.mes-select-menu');
    const anioDropdown = calendarioWrapper?.querySelector('.anio-select-menu');
    const mesWrapper = calendarioWrapper?.querySelector('.mes-dropdown-wrapper');
    const anioWrapper = calendarioWrapper?.querySelector('.anio-dropdown-wrapper');

    if (calendarioWrapper && inputFecha && panelCalendario) {
        let fechaActual = new Date();
        let fechaSeleccionada = null;
        const nombresMeses = [
            "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ];
        const minAnio = 2020;
        const maxAnio = 2030;

        function renderMesDropdown() {
            if (!mesDropdown) return;
            mesDropdown.innerHTML = '';
            nombresMeses.forEach((nombre, index) => {
                const li = document.createElement('li');
                li.textContent = nombre;
                li.dataset.mes = index;
                li.classList.toggle('selected', index === fechaActual.getMonth());
                mesDropdown.appendChild(li);
            });
            mesSelect.textContent = nombresMeses[fechaActual.getMonth()];
        }

        function renderAnioDropdown() {
            if (!anioDropdown) return;
            anioDropdown.innerHTML = '';
            for (let anio = minAnio; anio <= maxAnio; anio++) {
                const li = document.createElement('li');
                li.textContent = anio;
                li.dataset.anio = anio;
                li.classList.toggle('selected', anio === fechaActual.getFullYear());
                anioDropdown.appendChild(li);
            }
            anioSelect.textContent = fechaActual.getFullYear();
        }

        function crearDiaElemento(dia, clase, esClickeable) {
            const div = document.createElement('div');
            div.classList.add('calendario-dia');
            if (clase) {
                div.classList.add(...clase.split(' '));
            }
            div.textContent = dia;
            if (!esClickeable) {
                div.style.cursor = 'default';
            }
            return div;
        }

        function renderCalendario() {
            if (!calendarioDiasGrid) return;
            calendarioDiasGrid.innerHTML = '';

            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);

            const primerDiaDelMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1);
            const ultimoDiaDelMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 0);

            let diaInicio = primerDiaDelMes.getDay();
            if (diaInicio === 0) diaInicio = 7;
            let diaDeLaSemanaInicio = diaInicio - 1;

            const mesAnteriorUltimoDia = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 0).getDate();
            for (let i = diaDeLaSemanaInicio; i > 0; i--) {
                const diaNum = mesAnteriorUltimoDia - i + 1;
                const diaEl = crearDiaElemento(diaNum, 'otro-mes', false);
                calendarioDiasGrid.appendChild(diaEl);
            }

            for (let dia = 1; dia <= ultimoDiaDelMes.getDate(); dia++) {
                const fechaDia = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), dia);
                fechaDia.setHours(0, 0, 0, 0);

                const clases = [];
                let isPast = fechaDia < hoy && fechaDia.getTime() !== hoy.getTime();
                let isSelected = fechaSeleccionada && fechaSeleccionada.getTime() === fechaDia.getTime();

                if (fechaDia.getTime() === hoy.getTime()) {
                    clases.push('hoy');
                }
                if (isPast) {
                    clases.push('dia-pasado');
                }
                if (isSelected) {
                    clases.push('seleccionado');
                }

                const diaEl = crearDiaElemento(dia, clases.join(' '), !isPast);
                diaEl.dataset.fullDate = fechaDia.toISOString().split('T')[0];
                calendarioDiasGrid.appendChild(diaEl);
            }

            const diasTotales = diaDeLaSemanaInicio + ultimoDiaDelMes.getDate();
            const diasRestantes = 42 - diasTotales;
            for (let i = 1; i <= diasRestantes; i++) {
                const diaEl = crearDiaElemento(i, 'otro-mes', false);
                calendarioDiasGrid.appendChild(diaEl);
            }
        }

        function actualizarVista() {
            renderMesDropdown();
            renderAnioDropdown();
            renderCalendario();
        }

        calPrev?.addEventListener('click', () => {
            fechaActual.setMonth(fechaActual.getMonth() - 1);
            actualizarVista();
        });

        calNext?.addEventListener('click', () => {
            fechaActual.setMonth(fechaActual.getMonth() + 1);
            actualizarVista();
        });

        mesSelect?.addEventListener('click', (e) => {
            e.stopPropagation();
            anioWrapper?.classList.remove('open');
            mesWrapper?.classList.toggle('open');
        });

        anioSelect?.addEventListener('click', (e) => {
            e.stopPropagation();
            mesWrapper?.classList.remove('open');
            anioWrapper?.classList.toggle('open');
        });

        mesDropdown?.addEventListener('click', (e) => {
            if (e.target.tagName === 'LI' && e.target.dataset.mes !== undefined) {
                fechaActual.setMonth(parseInt(e.target.dataset.mes));
                mesWrapper?.classList.remove('open');
                actualizarVista();
            }
        });

        anioDropdown?.addEventListener('click', (e) => {
            if (e.target.tagName === 'LI' && e.target.dataset.anio !== undefined) {
                fechaActual.setFullYear(parseInt(e.target.dataset.anio));
                anioWrapper?.classList.remove('open');
                actualizarVista();
            }
        });

        calendarioDiasGrid?.addEventListener('click', (e) => {
            const diaEl = e.target.closest('.calendario-dia');
            if (diaEl && diaEl.dataset.fullDate && !diaEl.classList.contains('dia-pasado') && !diaEl.classList.contains('otro-mes')) {
                const [year, month, day] = diaEl.dataset.fullDate.split('-').map(Number);
                fechaSeleccionada = new Date(year, month - 1, day);
                fechaSeleccionada.setHours(0, 0, 0, 0);

                const diaStr = String(day).padStart(2, '0');
                const mesStr = String(month).padStart(2, '0');
                inputFecha.value = `${diaStr}/${mesStr}/${year}`;

                calendarioWrapper.classList.remove('open');
                renderCalendario();
            }
        });

        inputFecha.addEventListener('click', (e) => {
            e.stopPropagation();
            calendarioWrapper.classList.toggle('open');
            mesWrapper?.classList.remove('open');
            anioWrapper?.classList.remove('open');
        });

        document.addEventListener('click', (e) => {
            if (!calendarioWrapper.contains(e.target)) {
                calendarioWrapper.classList.remove('open');
                mesWrapper?.classList.remove('open');
                anioWrapper?.classList.remove('open');
            } else if (!mesWrapper?.contains(e.target) && !anioWrapper?.contains(e.target)) {
                mesWrapper?.classList.remove('open');
                anioWrapper?.classList.remove('open');
            }
        });

        actualizarVista();
    }
    // -----------------------------------------------------------------------------------------------

    // ----------------- FUNCIONES DE RENDER Y UTILIDADES -----------------

    function isoDateFromInput(inputValue) {
        // inputValue expected DD/MM/YYYY or empty
        if (!inputValue) return null;
        const parts = inputValue.split('/');
        if (parts.length !== 3) return null;
        const [dd, mm, yyyy] = parts.map(p => parseInt(p, 10));
        if (!dd || !mm || !yyyy) return null;
        // Return YYYY-MM-DD
        return `${String(yyyy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }

    function formatDateDisplay(isoString) {
        // isoString can be full ISO or just date part. Return 'DD MMM, YYYY - hh:mm AM/PM'
        if (!isoString) return '';
        const d = new Date(isoString);
        if (isNaN(d)) return isoString;
        const day = String(d.getDate()).padStart(2, '0');
        const monthNames = ['Ene','Feb','Mar','Abr','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const month = monthNames[d.getMonth()];
        const year = d.getFullYear();
        let hours = d.getHours();
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        if (hours === 0) hours = 12;
        return `${day} ${month}, ${year} - ${hours}:${minutes} ${ampm}`;
    }

    function clearListaCitas() {
        listaCitasContainer.innerHTML = '';
    }

    function crearCardCita(cita) {
        // cita: { id, cliente, servicio, fecha, estado }
        const article = document.createElement('article');
        article.classList.add('cita-card');
        if (cita.estado === 'cancelada') article.classList.add('cancelada-card');
        article.dataset.id = cita.id;

        const selectorDiv = document.createElement('div');
        selectorDiv.className = 'cita-selector';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'cita-checkbox';
        checkbox.setAttribute('aria-label', `Seleccionar cita de ${cita.cliente}`);
        if (cita.estado === 'cancelada') checkbox.disabled = true;
        selectorDiv.appendChild(checkbox);

        const detallesDiv = document.createElement('div');
        detallesDiv.className = 'cita-detalles';
        const clienteDiv = document.createElement('div');
        clienteDiv.className = 'cita-cliente';
        clienteDiv.textContent = cita.cliente || 'Sin nombre';
        detallesDiv.appendChild(clienteDiv);

        const servicioDiv = document.createElement('div');
        servicioDiv.className = 'cita-meta';
        servicioDiv.innerHTML = `<i class="fa-solid fa-scissors"></i><span>Servicio: ${cita.servicio || '—'}</span>`;
        detallesDiv.appendChild(servicioDiv);

        const fechaDiv = document.createElement('div');
        fechaDiv.className = 'cita-meta';
        fechaDiv.innerHTML = `<i class="fa-regular fa-calendar-days"></i><span>Fecha: ${formatDateDisplay(cita.fecha)}</span>`;
        detallesDiv.appendChild(fechaDiv);

        const estadoDiv = document.createElement('div');
        estadoDiv.className = 'cita-info-estado';
        const estadoSpan = document.createElement('span');
        estadoSpan.className = 'estado';
        if (cita.estado === 'confirmada') {
            estadoSpan.classList.add('estado-confirmada');
            estadoSpan.textContent = 'Confirmada';
        } else {
            estadoSpan.classList.add('estado-cancelada');
            estadoSpan.textContent = 'Cancelada';
        }
        estadoDiv.appendChild(estadoSpan);

        const accionesDiv = document.createElement('div');
        accionesDiv.className = 'cita-acciones';
        if (cita.estado !== 'cancelada') {
            const btn = document.createElement('button');
            btn.className = 'btn-accion btn-cancelar';
            btn.setAttribute('title', 'Cancelar cita');
            btn.innerHTML = '🛇<i class="fa-solid fa-ban"></i>';
            accionesDiv.appendChild(btn);
        }
        estadoDiv.appendChild(accionesDiv);

        article.appendChild(selectorDiv);
        article.appendChild(detallesDiv);
        article.appendChild(estadoDiv);

        return article;
    }

    function renderCitas(arrayCitas) {
        clearListaCitas();
        allCitas = arrayCitas.slice();
        // Re-create DOM
        if (!Array.isArray(arrayCitas) || arrayCitas.length === 0) {
            listaCitasContainer.innerHTML = '<p>No se encontraron citas.</p>';
            // Actualizar referencias a checkboxes
            refreshCheckboxListeners();
            return;
        }

        const fragment = document.createDocumentFragment();
        arrayCitas.forEach(cita => {
            const card = crearCardCita(cita);
            fragment.appendChild(card);
        });
        listaCitasContainer.appendChild(fragment);

        // Guardamos copia original para deshacer
        originalCitas = arrayCitas.map(c => ({ ...c }));
        canceledIds = new Set();

        // Actualizar listeners dinámicos
        refreshCheckboxListeners();
    }

    // Actualiza la lista de checkboxes y listeners que dependen de ellos
    function refreshCheckboxListeners() {
        // Actualiza selectAll y allCitaCheckboxes
        const allCitaCheckboxes = document.querySelectorAll('.cita-checkbox:not(:disabled)');

        function updateBulkCancelButtonState() {
            const anyChecked = Array.from(allCitaCheckboxes).some(cb => cb.checked);
            bulkCancelButton.disabled = !anyChecked;
        }

        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                allCitaCheckboxes.forEach(cb => cb.checked = isChecked);
                updateBulkCancelButtonState();
            });
        }

        allCitaCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                if (!cb.checked) selectAllCheckbox.checked = false;
                const allChecked = Array.from(allCitaCheckboxes).every(c => c.checked);
                selectAllCheckbox.checked = allChecked;
                updateBulkCancelButtonState();
            });
        });

        // Desactivar botón si no hay checkboxes
        if (allCitaCheckboxes.length === 0) bulkCancelButton.disabled = true;
    }

    // ----------------- EVENTOS PRINCIPALES -----------------

    // Toggle filtros (se conserva tu comportamiento)
    if (toggleButton && filtroPanel) {
        toggleButton.addEventListener('click', () => {
            const isVisible = filtroPanel.style.display === 'block' || filtroPanel.classList.contains('active');
            const toggleIcon = toggleButton.querySelector('i');
            const toggleText = toggleButton.querySelector('span');

            if (isVisible) {
                filtroPanel.style.display = 'none';
                filtroPanel.classList.remove('active');
                toggleText.textContent = 'Mostrar filtros';
                if (toggleIcon) { toggleIcon.classList.remove('fa-chevron-up'); toggleIcon.classList.add('fa-filter'); }
            } else {
                filtroPanel.style.display = 'block';
                filtroPanel.classList.add('active');
                toggleText.textContent = 'Ocultar filtros';
                if (toggleIcon) { toggleIcon.classList.remove('fa-filter'); toggleIcon.classList.add('fa-chevron-up'); }
            }
        });
    }

    // Limpiar filtros
    if (limpiarButton) {
        limpiarButton.addEventListener('click', () => {
            buscarNombreInput.value = '';
            selectEstado.value = 'todos';
            inputFecha.value = '';
            // Cargar todo otra vez (opcional) o dejar la lista como está
            // Aquí no hacemos fetch automático; usuario puede aplicar filtros de nuevo.
            console.log('Filtros limpiados');
        });
    }

    // Deshacer acción -> recargar originalCitas
    if (deshacerAccionBtn) {
        deshacerAccionBtn.addEventListener('click', () => {
            if (!originalCitas || originalCitas.length === 0) return;
            renderCitas(originalCitas);
            canceledIds = new Set();
            console.log('Acción deshecha: restaurados datos originales.');
        });
    }

    // Guardar cambios -> enviar al backend las citas canceladas
    if (guardarBtn) {
        guardarBtn.addEventListener('click', async () => {
            if (canceledIds.size === 0) {
                alert('No hay cambios para guardar.');
                return;
            }

            const updates = Array.from(canceledIds).map(id => ({ id, estado: 'cancelada' }));

            try {
                guardarBtn.disabled = true;
                guardarBtn.textContent = 'Guardando...';

                const res = await fetch('/api/citas/bulk-update', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ updates })
                });
                if (!res.ok) throw new Error(`Error ${res.status}`);
                const data = await res.json();

                // Asumimos que backend retornó el array actualizado o éxito
                alert('Cambios guardados correctamente.');
                // Después de guardar, recargamos los datos actuales desde el servidor
                await fetchAndRenderCurrentFilters();
            } catch (err) {
                console.error(err);
                alert('Error al guardar cambios. Revisa la consola.');
            } finally {
                guardarBtn.disabled = false;
                guardarBtn.innerHTML = '<i class="fa-solid fa-filter"></i><span>Guardar</span>';
            }
        });
    }

    // Aplicar filtros -> determinar combinación y pedir al backend
    if (aplicarFiltrosBtn) {
        aplicarFiltrosBtn.addEventListener('click', async () => {
            await fetchAndRenderCurrentFilters();
        });
    }

    // Cancelar individual y masivo: usamos delegación porque los elementos son dinámicos
    listaCitasContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-cancelar');
        if (btn) {
            e.stopPropagation();
            const card = btn.closest('.cita-card');
            if (!card) return;
            const id = card.dataset.id;
            markCardAsCanceled(card, id);
            return;
        }

        const bulkBtn = e.target.closest('#bulkCancel');
        if (bulkBtn) {
            // No usado porque bulkCancelButton tiene su propio listener más abajo
            return;
        }
    });

    // Bulk cancel (botón externo)
    if (bulkCancelButton) {
        bulkCancelButton.addEventListener('click', () => {
            const checkboxes = document.querySelectorAll('.cita-checkbox:not(:disabled)');
            checkboxes.forEach(cb => {
                if (cb.checked) {
                    const card = cb.closest('.cita-card');
                    const id = card.dataset.id;
                    markCardAsCanceled(card, id);
                    cb.checked = false;
                }
            });
            if (selectAllCheckbox) selectAllCheckbox.checked = false;
            bulkCancelButton.disabled = true;
        });
    }

    function markCardAsCanceled(card, id) {
        if (!card) return;
        card.classList.add('cancelada-card');

        const estadoSpan = card.querySelector('.estado');
        if (estadoSpan) {
            estadoSpan.textContent = 'Cancelada';
            estadoSpan.className = 'estado estado-cancelada';
        }

        const acciones = card.querySelector('.cita-acciones');
        if (acciones) acciones.innerHTML = '';

        const checkbox = card.querySelector('.cita-checkbox');
        if (checkbox) {
            checkbox.checked = false;
            checkbox.disabled = true;
        }

        if (id) canceledIds.add(id);
    }

    // ----------------- FETCH / BACKEND -----------------

    async function fetchAndRenderCurrentFilters() {
        const nombre = buscarNombreInput.value.trim();
        const estado = selectEstado.value;
        const fechaISO = isoDateFromInput(inputFecha.value);

        // Determinar payload según combinaciones (aunque backend puede aceptar nulls)
        const payload = {};
        if (nombre) payload.nombre = nombre;
        if (estado && estado !== 'todos') payload.estado = estado;
        if (fechaISO) payload.fecha = fechaISO; // YYYY-MM-DD

        // Si no hay filtros, enviaremos objeto vacío para pedir todas las citas
        try {
            aplicarFiltrosBtn.disabled = true;
            aplicarFiltrosBtn.textContent = 'Buscando...';

            const res = await fetch('/api/citas/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error(`Respuesta del servidor ${res.status}`);
            const data = await res.json();

            // Esperamos data.citas o data (array)
            const citasArray = Array.isArray(data) ? data : (data.citas || []);

            // Normalizar objetos: asegurarnos de que tengan id, cliente, servicio, fecha, estado
            const normalized = citasArray.map(c => ({
                id: c.id ?? c._id ?? String(Math.random()).slice(2),
                cliente: c.cliente ?? c.nombre ?? c.customer ?? 'Sin nombre',
                servicio: c.servicio ?? c.servicioDesc ?? c.service ?? '—',
                fecha: c.fecha ?? c.fechaISO ?? c.date ?? null,
                estado: (c.estado ?? c.status ?? 'confirmada')
            }));

            renderCitas(normalized);

        } catch (err) {
            console.error('Error al consultar citas:', err);
            alert('Error al consultar citas. Revisa la consola.');
        } finally {
            aplicarFiltrosBtn.disabled = false;
            aplicarFiltrosBtn.innerHTML = '<i class="fa-solid fa-check"></i><span>Aplicar filtros</span>';
        }
    }

    // Cargar todas las citas al inicio
    (async function initLoad() {
        try {
            // Intentamos llamar GET /api/citas para traer todo; si no existe, usamos search con payload vacío
            let res = await fetch('/api/citas');
            let data;
            if (res.ok) {
                data = await res.json();
            } else {
                // Fallback
                res = await fetch('/api/citas/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
                data = res.ok ? await res.json() : [];
            }

            const citasArray = Array.isArray(data) ? data : (data.citas || []);
            const normalized = citasArray.map(c => ({
                id: c.id ?? c._id ?? String(Math.random()).slice(2),
                cliente: c.cliente ?? c.nombre ?? c.customer ?? 'Sin nombre',
                servicio: c.servicio ?? c.servicioDesc ?? c.service ?? '—',
                fecha: c.fecha ?? c.fechaISO ?? c.date ?? null,
                estado: (c.estado ?? c.status ?? 'confirmada')
            }));

            renderCitas(normalized);
        } catch (err) {
            console.error('Error inicial cargando citas:', err);
            // Mostrar fallback: puede haber ejemplos estáticos ya en el HTML
        }
    })();

});

// Manejo de ausencia de citas y error de conexión
function mostrarMensajeCentrado(mensaje) {
    const contenedor = document.getElementById('contenedor-citas');
    if (contenedor) {
        contenedor.innerHTML = `<div style="text-align:center; width:100%; padding:2rem; font-size:1.1rem; color:#444;">${mensaje}</div>`;
    }
}

async function cargarCitas() {
    try {
        const response = await fetch(URL_BACKEND);
        if (!response.ok) throw new Error('Error en la conexión');

        const citas = await response.json();

        if (!citas || citas.length === 0) {
            mostrarMensajeCentrado('No se encontraron citas');
            return;
        }

        renderizarCitas(citas);
    } catch (e) {
        console.error('No se pudo conectar con el backend:', e);
        // Si falla la conexión, no afecta el HTML existente
    }
}

cargarCitas();