document.addEventListener('DOMContentLoaded', () => {

    // --- ESTADO GLOBAL ---
    let fechaActual = new Date(2025, 10, 1);
    const fechasSeleccionadas = new Set();
    const excepciones = {
        '2025-11-04': { estado: 'cerrado' },
        '2025-11-27': { estado: 'cerrado' },
        '2025-11-28': { estado: 'abierto', apertura: '10:00', cierre: '15:00' }
    };

    // --- SELECTORES DEL DOM ---
    const gridDias = document.getElementById('calendario-grid-dias');
    const displayMesAno = document.getElementById('mes-ano-actual');
    const navAnterior = document.getElementById('nav-mes-anterior');
    const navSiguiente = document.getElementById('nav-mes-siguiente');

    const inputFechasManual = document.getElementById('input-fechas-manual');
    const btnMarcarCerrado = document.getElementById('btn-marcar-cerrado');
    const btnMarcarAbierto = document.getElementById('btn-marcar-abierto');
    const btnLimpiarExcepcion = document.getElementById('btn-limpiar-excepcion');
    const btnGuardarTodo = document.getElementById('btn-guardar-todo');

    const listaDiasSemana = document.getElementById('lista-dias-semana');

    const nombresMeses = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    // --- LÓGICA DE HORARIOS SEMANALES ---
    function inicializarToggles() {
        listaDiasSemana.querySelectorAll('.dia-semana').forEach(diaEl => {
            const toggle = diaEl.querySelector('.toggle-dia');
            const estaAbierto = toggle.checked;
            diaEl.dataset.abierto = estaAbierto;

            toggle.addEventListener('change', () => {
                diaEl.dataset.abierto = toggle.checked;
            });
        });
    }

    // --- LÓGICA DEL CALENDARIO ---
    function renderizarCalendario() {
        gridDias.innerHTML = '';

        const ano = fechaActual.getFullYear();
        const mes = fechaActual.getMonth();

        displayMesAno.textContent = `${nombresMeses[mes]} ${ano}`;

        const primerDiaDelMes = new Date(ano, mes, 1).getDay();
        const diasEnMes = new Date(ano, mes + 1, 0).getDate();
        const diasMesAnterior = new Date(ano, mes, 0).getDate();
        const diasRellenoInicio = primerDiaDelMes;

        // 1. Relleno mes anterior
        for (let i = diasRellenoInicio; i > 0; i--) {
            const diaEl = document.createElement('div');
            diaEl.classList.add('dia-calendario', 'otro-mes');
            diaEl.textContent = diasMesAnterior - i + 1;
            gridDias.appendChild(diaEl);
        }

        // 2. Días del mes actual
        for (let dia = 1; dia <= diasEnMes; dia++) {
            const diaEl = document.createElement('div');
            diaEl.classList.add('dia-calendario');
            diaEl.textContent = dia;

            const fechaISO = `${ano}-${(mes + 1).toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`;
            diaEl.dataset.fecha = fechaISO;

            if (fechasSeleccionadas.has(fechaISO)) {
                diaEl.classList.add('seleccionado');
            }

            if (excepciones[fechaISO]) {
                if (excepciones[fechaISO].estado === 'cerrado') {
                    diaEl.classList.add('excepcion-cerrado');
                } else {
                    diaEl.classList.add('excepcion-abierto');
                }
            }

            diaEl.addEventListener('click', () => {
                toggleSeleccionDia(diaEl, fechaISO);
            });

            gridDias.appendChild(diaEl);
        }

        // 3. Relleno mes siguiente
        const celdasUsadas = diasRellenoInicio + diasEnMes;
        const celdasRellenoFin = (7 - (celdasUsadas % 7)) % 7;

        for (let i = 1; i <= celdasRellenoFin; i++) {
            const diaEl = document.createElement('div');
            diaEl.classList.add('dia-calendario', 'otro-mes');
            diaEl.textContent = i;
            gridDias.appendChild(diaEl);
        }
    }

    function toggleSeleccionDia(diaEl, fechaISO) {
        if (fechasSeleccionadas.has(fechaISO)) {
            fechasSeleccionadas.delete(fechaISO);
            diaEl.classList.remove('seleccionado');
        } else {
            fechasSeleccionadas.add(fechaISO);
            diaEl.classList.add('seleccionado');
        }
    }

    // --- LÓGICA DE ENTRADA MANUAL ---
    function obtenerFechasSeleccionadas(incluirManual = true) {
        const seleccion = new Set(fechasSeleccionadas);

        if (incluirManual) {
            const textoFechas = inputFechasManual.value.trim();
            if (textoFechas) {
                const regexDDMMYYYY = /^\d{2}-\d{2}-\d{4}$/;

                const fechasManuales = textoFechas.split(',')
                    .map(f => f.trim())
                    .filter(f => f.length > 0);

                const fechasInvalidas = fechasManuales.filter(f => !regexDDMMYYYY.test(f));

                if (fechasManuales.length > 0 && fechasInvalidas.length > 0) {
                    mostrarNotificacion(
                        'El formato de las fechas manuales es incorrecto. Use DD-MM-YYYY (Día-Mes-Año), separadas por coma.',
                        'error'
                    );
                    return null;
                }

                let conversionExitosa = true;
                fechasManuales.forEach(f => {
                    const partes = f.split('-');
                    if (partes.length === 3) {
                        const fechaISO = `${partes[2]}-${partes[1]}-${partes[0]}`;
                        seleccion.add(fechaISO);
                    } else {
                        conversionExitosa = false;
                        console.error("Error de conversión de fecha:", f);
                    }
                });

                if (!conversionExitosa) {
                    mostrarNotificacion('Hubo un error al procesar las fechas. Asegúrese de usar DD-MM-YYYY.', 'error');
                    return null;
                }
            }
        }

        if (seleccion.size === 0) {
            mostrarNotificacion('Debes seleccionar o ingresar al menos una fecha.', 'error');
            return null;
        }

        return seleccion;
    }

    // --- EVENT LISTENERS ---
    navAnterior.addEventListener('click', () => {
        fechaActual.setMonth(fechaActual.getMonth() - 1);
        renderizarCalendario();
    });

    navSiguiente.addEventListener('click', () => {
        fechaActual.setMonth(fechaActual.getMonth() + 1);
        renderizarCalendario();
    });

    btnMarcarCerrado.addEventListener('click', () => {
        const seleccion = obtenerFechasSeleccionadas();
        if (!seleccion) return;

        seleccion.forEach(fecha => {
            excepciones[fecha] = { estado: 'cerrado' };
        });
        renderizarCalendario();
        inputFechasManual.value = '';
        fechasSeleccionadas.clear();
        document.querySelectorAll('.dia-calendario.seleccionado').forEach(el => el.classList.remove('seleccionado'));
        mostrarNotificacion(`Fechas (${seleccion.size}) marcadas como CERRADO.`, 'exito');
    });

    btnMarcarAbierto.addEventListener('click', () => {
        const seleccion = obtenerFechasSeleccionadas();
        if (!seleccion) return;

        const apertura = prompt('Hora de Apertura Especial (ej: 10:00):', '10:00');
        const cierre = prompt('Hora de Cierre Especial (ej: 14:00):', '14:00');

        if (!apertura || !cierre) {
            mostrarNotificacion('Operación cancelada.', 'error');
            return;
        }

        seleccion.forEach(fecha => {
            excepciones[fecha] = { estado: 'abierto', apertura, cierre };
        });
        renderizarCalendario();
        inputFechasManual.value = '';
        fechasSeleccionadas.clear();
        document.querySelectorAll('.dia-calendario.seleccionado').forEach(el => el.classList.remove('seleccionado'));
        mostrarNotificacion(`Fechas (${seleccion.size}) marcadas con horario especial.`, 'exito');
    });

    btnLimpiarExcepcion.addEventListener('click', () => {
        const seleccion = obtenerFechasSeleccionadas();
        if (!seleccion) return;

        let contadorLimpiado = 0;
        seleccion.forEach(fecha => {
            if (excepciones[fecha]) {
                delete excepciones[fecha];
                contadorLimpiado++;
            }
        });
        renderizarCalendario();
        inputFechasManual.value = '';
        fechasSeleccionadas.clear();
        document.querySelectorAll('.dia-calendario.seleccionado').forEach(el => el.classList.remove('seleccionado'));
        mostrarNotificacion(`Excepciones (${contadorLimpiado}) limpiadas.`, 'exito');
    });

    btnGuardarTodo.addEventListener('click', () => {
        const horariosSemanales = {};
        listaDiasSemana.querySelectorAll('.dia-semana').forEach(diaEl => {
            const diaNombre = diaEl.dataset.dia;
            const estaAbierto = diaEl.dataset.abierto === 'true';
            const apertura = diaEl.querySelector('input[type="time"]:nth-of-type(1)').value;
            const cierre = diaEl.querySelector('input[type="time"]:nth-of-type(2)').value;

            horariosSemanales[diaNombre] = {
                abierto: estaAbierto,
                apertura: estaAbierto ? apertura : null,
                cierre: estaAbierto ? cierre : null
            };
        });

        console.log("--- GUARDANDO DATOS ---");
        console.log("Horarios Semanales:", horariosSemanales);
        console.log("Excepciones de Calendario:", excepciones);

        mostrarNotificacion('¡Horarios guardados exitosamente!', 'exito');
    });

    // --- UTILIDADES ---
    function mostrarNotificacion(mensaje, tipo = 'exito') {
        const notif = document.createElement('div');
        notif.className = 'notificacion';
        notif.textContent = mensaje;
        notif.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 0.75rem 1.25rem;
            border-radius: 8px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            z-index: 1000;
            font-weight: 600;
            transition: all 0.3s ease;
        `;
        notif.style.backgroundColor = tipo === 'exito' ? 'var(--color-abierto)' : 'var(--color-cerrado)';
        notif.style.color = tipo === 'exito' ? '#004D00' : '#5D0000';

        document.body.appendChild(notif);

        setTimeout(() => {
            notif.style.opacity = '0';
            setTimeout(() => notif.remove(), 500);
        }, 3000);
    }

    // --- INICIALIZACIÓN ---
    inicializarToggles();
    renderizarCalendario();
});