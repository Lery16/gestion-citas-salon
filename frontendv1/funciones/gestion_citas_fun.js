document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // 1. REFERENCIAS AL DOM
    // ==========================================
    const filtroPanel = document.getElementById('filtroPanel');
    const limpiarButton = document.getElementById('limpiarFiltros');
    const selectAllCheckbox = document.getElementById('selectAll');
    const bulkCancelButton = document.getElementById('bulkCancel');
    const aplicarFiltrosBtn = document.querySelector('.aplicar-filtros-btn');
    const deshacerAccionBtn = document.getElementById('deshacerAccion');
    const guardarBtn = document.getElementById('Guardar');
    
    // Inputs de Filtros
    const buscarNombreInput = document.getElementById('buscarNombre');
    const selectEstado = document.getElementById('selectEstado');
    const inputFecha = document.getElementById('fechaSeleccionada');
    
    // Contenedor de resultados
    const listaCitasContainer = document.querySelector('.lista-citas');

    // ==========================================
    // 2. VARIABLES DE ESTADO
    // ==========================================
    // Almacena los datos originales traídos del backend (para poder "Deshacer")
    let citasOriginales = []; 
    // Almacena los datos actuales visibles con modificaciones del usuario (antes de Guardar)
    let citasVisuales = [];   
    // Almacena los IDs que han sido modificados para enviarlos al backend
    let cambiosPendientes = new Map(); // Map<id, nuevoEstado>

    // ==========================================
    // 3. LÓGICA DEL CALENDARIO (INTACTA)
    // ==========================================
    const calendarioWrapper = document.getElementById('calendarioPicker');
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
        const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const minAnio = 2020; const maxAnio = 2030;
        function renderMesDropdown() {
            if (!mesDropdown) return; mesDropdown.innerHTML = '';
            nombresMeses.forEach((nombre, index) => {
                const li = document.createElement('li'); li.textContent = nombre; li.dataset.mes = index;
                li.classList.toggle('selected', index === fechaActual.getMonth()); mesDropdown.appendChild(li);
            }); mesSelect.textContent = nombresMeses[fechaActual.getMonth()];
        }
        function renderAnioDropdown() {
            if (!anioDropdown) return; anioDropdown.innerHTML = '';
            for (let anio = minAnio; anio <= maxAnio; anio++) {
                const li = document.createElement('li'); li.textContent = anio; li.dataset.anio = anio;
                li.classList.toggle('selected', anio === fechaActual.getFullYear()); anioDropdown.appendChild(li);
            } anioSelect.textContent = fechaActual.getFullYear();
        }
        function crearDiaElemento(dia, clase, esClickeable) {
            const div = document.createElement('div'); div.classList.add('calendario-dia');
            if (clase) div.classList.add(...clase.split(' ')); div.textContent = dia;
            if (!esClickeable) div.style.cursor = 'default'; return div;
        }
        function renderCalendario() {
            if (!calendarioDiasGrid) return; calendarioDiasGrid.innerHTML = '';
            const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
            const primerDiaDelMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1);
            const ultimoDiaDelMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 0);
            let diaInicio = primerDiaDelMes.getDay(); if (diaInicio === 0) diaInicio = 7;
            let diaDeLaSemanaInicio = diaInicio - 1;
            const mesAnteriorUltimoDia = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 0).getDate();
            for (let i = diaDeLaSemanaInicio; i > 0; i--) { calendarioDiasGrid.appendChild(crearDiaElemento(mesAnteriorUltimoDia - i + 1, 'otro-mes', false)); }
            for (let dia = 1; dia <= ultimoDiaDelMes.getDate(); dia++) {
                const fechaDia = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), dia); fechaDia.setHours(0, 0, 0, 0);
                const clases = []; let isPast = fechaDia < hoy && fechaDia.getTime() !== hoy.getTime();
                let isSelected = fechaSeleccionada && fechaSeleccionada.getTime() === fechaDia.getTime();
                if (fechaDia.getTime() === hoy.getTime()) clases.push('hoy');
                if (isPast) clases.push('dia-pasado'); if (isSelected) clases.push('seleccionado');
                // Nota: Se permite click en pasado si se desea filtrar histórico, cambié !isPast a true para filtros
                const diaEl = crearDiaElemento(dia, clases.join(' '), true); 
                diaEl.dataset.fullDate = fechaDia.toISOString().split('T')[0]; calendarioDiasGrid.appendChild(diaEl);
            }
            const diasTotales = diaDeLaSemanaInicio + ultimoDiaDelMes.getDate(); const diasRestantes = 42 - diasTotales;
            for (let i = 1; i <= diasRestantes; i++) { calendarioDiasGrid.appendChild(crearDiaElemento(i, 'otro-mes', false)); }
        }
        function actualizarVista() { renderMesDropdown(); renderAnioDropdown(); renderCalendario(); }
        calPrev?.addEventListener('click', () => { fechaActual.setMonth(fechaActual.getMonth() - 1); actualizarVista(); });
        calNext?.addEventListener('click', () => { fechaActual.setMonth(fechaActual.getMonth() + 1); actualizarVista(); });
        mesSelect?.addEventListener('click', (e) => { e.stopPropagation(); anioWrapper?.classList.remove('open'); mesWrapper?.classList.toggle('open'); });
        anioSelect?.addEventListener('click', (e) => { e.stopPropagation(); mesWrapper?.classList.remove('open'); anioWrapper?.classList.toggle('open'); });
        mesDropdown?.addEventListener('click', (e) => { if (e.target.tagName === 'LI' && e.target.dataset.mes !== undefined) { fechaActual.setMonth(parseInt(e.target.dataset.mes)); mesWrapper?.classList.remove('open'); actualizarVista(); } });
        anioDropdown?.addEventListener('click', (e) => { if (e.target.tagName === 'LI' && e.target.dataset.anio !== undefined) { fechaActual.setFullYear(parseInt(e.target.dataset.anio)); anioWrapper?.classList.remove('open'); actualizarVista(); } });
        calendarioDiasGrid?.addEventListener('click', (e) => {
            const diaEl = e.target.closest('.calendario-dia');
            if (diaEl && diaEl.dataset.fullDate && !diaEl.classList.contains('otro-mes')) {
                const [year, month, day] = diaEl.dataset.fullDate.split('-').map(Number);
                fechaSeleccionada = new Date(year, month - 1, day); fechaSeleccionada.setHours(0, 0, 0, 0);
                const diaStr = String(day).padStart(2, '0'); const mesStr = String(month).padStart(2, '0');
                inputFecha.value = `${diaStr}/${mesStr}/${year}`;
                // Guardamos valor ISO en un atributo data para enviarlo fácil al backend
                inputFecha.dataset.iso = diaEl.dataset.fullDate; 
                calendarioWrapper.classList.remove('open'); renderCalendario();
            }
        });
        inputFecha.addEventListener('click', (e) => { e.stopPropagation(); calendarioWrapper.classList.toggle('open'); mesWrapper?.classList.remove('open'); anioWrapper?.classList.remove('open'); });
        document.addEventListener('click', (e) => { if (!calendarioWrapper.contains(e.target)) { calendarioWrapper.classList.remove('open'); mesWrapper?.classList.remove('open'); anioWrapper?.classList.remove('open'); } else if (!mesWrapper?.contains(e.target) && !anioWrapper?.contains(e.target)) { mesWrapper?.classList.remove('open'); anioWrapper?.classList.remove('open'); } });
        actualizarVista();
    }

    // ==========================================
    // 4. UTILIDADES
    // ==========================================
    
    // Convierte fecha input (DD/MM/YYYY) a ISO (YYYY-MM-DD) para backend si no se usó el calendario
    function parseDateToISO(value) {
        if(!value) return null;
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

    // Icono según servicio (simulación basada en tu HTML)
    function obtenerIconoServicio(nombre) {
        const n = nombre.toLowerCase();
        if(n.includes('dental')) return 'fa-tooth';
        if(n.includes('contable')) return 'fa-briefcase';
        if(n.includes('entrenamiento') || n.includes('gym')) return 'fa-dumbbell';
        if(n.includes('frenos') || n.includes('auto')) return 'fa-car';
        if(n.includes('foto')) return 'fa-camera-retro';
        return 'fa-calendar-check';
    }

    // ==========================================
    // 5. RENDERIZADO DE CITAS
    // ==========================================

    function renderizarCitas(lista) {
        listaCitasContainer.innerHTML = '';

        if (lista.length === 0) {
            listaCitasContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">No se encontraron citas con estos filtros.</div>';
            actualizarEstadoBulk();
            return;
        }

        const fragment = document.createDocumentFragment();

        lista.forEach(cita => {
            const article = document.createElement('article');
            article.className = 'cita-card';
            article.dataset.id = cita.id;

            // Clases de estado para colores de borde
            if (cita.estado === 'cancelada') article.classList.add('cancelada-card');
            if (cita.estado === 'completada') article.classList.add('completada-card');

            // --- Checkbox ---
            const divSelector = document.createElement('div');
            divSelector.className = 'cita-selector';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'cita-checkbox';
            checkbox.ariaLabel = `Seleccionar cita de ${cita.cliente}`;
            // Deshabilitar checkbox si completada o cancelada (según lógica visual html)
            if (cita.estado === 'completada' || cita.estado === 'cancelada') {
                checkbox.disabled = true;
            }
            divSelector.appendChild(checkbox);

            // --- Detalles ---
            const divDetalles = document.createElement('div');
            divDetalles.className = 'cita-detalles';
            
            const divCliente = document.createElement('div');
            divCliente.className = 'cita-cliente';
            divCliente.textContent = cita.cliente;
            
            const divMetaServicio = document.createElement('div');
            divMetaServicio.className = 'cita-meta';
            divMetaServicio.innerHTML = `<i class="fa-solid ${obtenerIconoServicio(cita.servicio)}"></i><span>Servicio: ${cita.servicio}</span>`;
            
            const divMetaFecha = document.createElement('div');
            divMetaFecha.className = 'cita-meta';
            divMetaFecha.innerHTML = `<i class="fa-regular fa-calendar-days"></i><span>Fecha: ${formatearFechaVisual(cita.fecha)}</span>`;
            
            divDetalles.append(divCliente, divMetaServicio, divMetaFecha);

            // --- Estado y Acciones ---
            const divInfoEstado = document.createElement('div');
            divInfoEstado.className = 'cita-info-estado';
            
            const spanEstado = document.createElement('span');
            spanEstado.className = `estado estado-${cita.estado}`;
            spanEstado.title = `Cita ${cita.estado}`;
            spanEstado.textContent = cita.estado.charAt(0).toUpperCase() + cita.estado.slice(1);
            
            const divAcciones = document.createElement('div');
            divAcciones.className = 'cita-acciones';

            // LÓGICA DE BOTONES SEGÚN ESTADO
            if (cita.estado === 'pendiente') {
                divAcciones.innerHTML = `
                    <button class="btn-accion btn-confirmar" title="Confirmar Cita">✓</button>
                    <button class="btn-accion btn-cancelar" title="Cancelar Cita">🛇</button>
                `;
            } else if (cita.estado === 'confirmada') {
                divAcciones.innerHTML = `
                    <button class="btn-accion btn-cancelar" title="Cancelar Cita">🛇</button>
                `;
            } else if (cita.estado === 'cancelada') {
                divAcciones.innerHTML = `
                    <button class="btn-accion btn-confirmar" title="Confirmar Cita">✓</button>
                `;
            }
            // Completada no tiene botones.

            divInfoEstado.append(spanEstado, divAcciones);
            article.append(divSelector, divDetalles, divInfoEstado);
            fragment.appendChild(article);
        });

        listaCitasContainer.appendChild(fragment);
        actualizarEstadoBulk();
    }

    // ==========================================
    // 6. CONEXIÓN CON BACKEND (FILTROS)
    // ==========================================

    async function obtenerCitasFiltradas() {
        const nombre = buscarNombreInput.value.trim();
        const estado = selectEstado.value;
        const fechaISO = parseDateToISO(inputFecha.value);

        // Construcción dinámica del payload (7 combinaciones)
        const filtros = {};
        if (nombre) filtros.nombre = nombre;
        if (estado && estado !== "") filtros.estado = estado;
        if (fechaISO) filtros.fecha = fechaISO;

        aplicarFiltrosBtn.disabled = true;
        aplicarFiltrosBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Buscando...';

        try {
            // Asumimos endpoint POST /api/citas/buscar en Express
            const response = await fetch('/api/citas/buscar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(filtros)
            });

            if (!response.ok) throw new Error('Error en la red');

            const data = await response.json();
            
            // Clonamos profundamente para guardar el estado original (Deshacer)
            citasOriginales = JSON.parse(JSON.stringify(data));
            citasVisuales = JSON.parse(JSON.stringify(data));
            cambiosPendientes.clear(); // Limpiar cambios previos al cargar nueva búsqueda
            
            renderizarCitas(citasVisuales);

        } catch (error) {
            console.error("Error fetching citas:", error);
            listaCitasContainer.innerHTML = '<p class="error">Error al cargar datos. Intenta de nuevo.</p>';
        } finally {
            aplicarFiltrosBtn.disabled = false;
            aplicarFiltrosBtn.innerHTML = '<i class="fa-solid fa-check"></i><span>Aplicar filtros</span>';
        }
    }

    aplicarFiltrosBtn.addEventListener('click', obtenerCitasFiltradas);

    limpiarButton.addEventListener('click', () => {
        buscarNombreInput.value = '';
        selectEstado.value = '';
        inputFecha.value = '';
        if(inputFecha.dataset.iso) delete inputFecha.dataset.iso;
        // Opcional: Cargar todo de nuevo al limpiar
        obtenerCitasFiltradas();
    });

    // ==========================================
    // 7. MANEJO DE ACCIONES (LOCALMENTE)
    // ==========================================

    // Delegación de eventos para botones Confirmar/Cancelar
    listaCitasContainer.addEventListener('click', (e) => {
        const btnConfirmar = e.target.closest('.btn-confirmar');
        const btnCancelar = e.target.closest('.btn-cancelar');
        const card = e.target.closest('.cita-card');

        if (!card) return;
        
        const id = card.dataset.id;
        let nuevoEstado = null;

        if (btnConfirmar) {
            nuevoEstado = 'confirmada'; // O 'pendiente' a 'confirmada' o 'cancelada' a 'confirmada'
        } else if (btnCancelar) {
            nuevoEstado = 'cancelada';
        }

        if (nuevoEstado) {
            modificarEstadoCitaLocal(id, nuevoEstado);
        }
    });

    function modificarEstadoCitaLocal(id, nuevoEstado) {
        // 1. Actualizar array visual
        const index = citasVisuales.findIndex(c => c.id == id);
        if (index !== -1) {
            citasVisuales[index].estado = nuevoEstado;
            
            // 2. Registrar cambio pendiente para guardar luego
            cambiosPendientes.set(id, nuevoEstado);

            // 3. Re-renderizar para ver cambios inmediatos
            renderizarCitas(citasVisuales);
        }
    }

    // ==========================================
    // 8. DESHACER Y GUARDAR
    // ==========================================

    deshacerAccionBtn.addEventListener('click', () => {
        if (cambiosPendientes.size === 0) {
            alert("No hay acciones para deshacer.");
            return;
        }
        // Restaurar visual con original
        citasVisuales = JSON.parse(JSON.stringify(citasOriginales));
        cambiosPendientes.clear();
        renderizarCitas(citasVisuales);
        alert("Acciones deshechas localmente.");
    });

    guardarBtn.addEventListener('click', async () => {
        if (cambiosPendientes.size === 0) {
            alert("No hay cambios pendientes para guardar.");
            return;
        }

        // Convertir Map a Array para enviar
        const cambiosArray = Array.from(cambiosPendientes, ([id, estado]) => ({ id, estado }));

        guardarBtn.disabled = true;
        guardarBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

        try {
            const response = await fetch('/api/citas/actualizar-lote', {
                method: 'PUT', // O POST, según tu backend
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cambios: cambiosArray })
            });

            if (!response.ok) throw new Error('Error guardando cambios');

            // Si todo sale bien, recargamos los datos desde la BD para asegurar sincronía
            alert("Cambios guardados exitosamente.");
            await obtenerCitasFiltradas();

        } catch (error) {
            console.error(error);
            alert("Error al conectar con el servidor.");
        } finally {
            guardarBtn.disabled = false;
            guardarBtn.innerHTML = '<i class="fa-solid fa-filter"></i><span>Guardar</span>';
        }
    });

    // ==========================================
    // 9. ACCIONES MASIVAS (BULK)
    // ==========================================

    function actualizarEstadoBulk() {
        const checkboxes = document.querySelectorAll('.cita-checkbox:not(:disabled)');
        
        checkboxes.forEach(cb => {
            // Clonar nodo para limpiar listeners viejos (truco rápido) o usar removeEventListener
            // Aquí usaremos asignación directa con lógica simple
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
    });

    bulkCancelButton.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.cita-checkbox:checked');
        if (checkboxes.length === 0) return;

        const ids = [];
        checkboxes.forEach(cb => {
            const card = cb.closest('.cita-card');
            if (card) ids.push(card.dataset.id);
        });

        // Aplicar cancelación masiva localmente
        ids.forEach(id => modificarEstadoCitaLocal(id, 'cancelada'));
        
        // Resetear checks
        selectAllCheckbox.checked = false;
    });

    // Carga inicial opcional (sin filtros)
    obtenerCitasFiltradas();
});