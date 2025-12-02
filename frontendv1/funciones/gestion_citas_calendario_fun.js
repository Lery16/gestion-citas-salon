/**
 * funciones/gestion_citas_calendario.js
 * Lógica modular para el componente Custom Date Picker.
 * NOTA: Esta sección no depende de las variables de estado de las citas.
 */

document.addEventListener('DOMContentLoaded', () => {
    // LÓGICA DEL CALENDARIO
    const calendarioWrapper = document.getElementById('calendarioPicker');
    const inputFecha = document.getElementById('fechaSeleccionada'); // Necesario para la interacción
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
                
                const diaEl = crearDiaElemento(dia, clases.join(' '), true); 
                diaEl.dataset.fullDate = fechaDia.toISOString().split('T')[0]; calendarioDiasGrid.appendChild(diaEl);
            }
            
            const diasTotales = diaDeLaSemanaInicio + ultimoDiaDelMes.getDate(); const diasRestantes = 42 - diasTotales;
            for (let i = 1; i <= diasRestantes; i++) { calendarioDiasGrid.appendChild(crearDiaElemento(i, 'otro-mes', false)); }
        }
        
        function actualizarVista() { renderMesDropdown(); renderAnioDropdown(); renderCalendario(); }
        
        // LISTENERS
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
                inputFecha.dataset.iso = diaEl.dataset.fullDate; 
                calendarioWrapper.classList.remove('open'); renderCalendario();

                // *** IMPORTANTE: Aquí se llamaría a la función de obtención de citas, si la expones globalmente ***
                if (typeof window.obtenerCitasFiltradas === 'function') {
                    window.obtenerCitasFiltradas();
                }
            }
        });
        
        inputFecha.addEventListener('click', (e) => { e.stopPropagation(); calendarioWrapper.classList.toggle('open'); mesWrapper?.classList.remove('open'); anioWrapper?.classList.remove('open'); });
        document.addEventListener('click', (e) => { if (!calendarioWrapper.contains(e.target)) { calendarioWrapper.classList.remove('open'); mesWrapper?.classList.remove('open'); anioWrapper?.classList.remove('open'); } else if (!mesWrapper?.contains(e.target) && !anioWrapper?.contains(e.target)) { mesWrapper?.classList.remove('open'); anioWrapper?.classList.remove('open'); } });
        
        actualizarVista();
    }
});