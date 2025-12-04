document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURACIÓN ---
    const API_URL = 'http://localhost:3000/api/horarios';

    // --- ESTADO ---
    let fechaActual = new Date();
    const fechasSeleccionadas = new Set();
    let excepciones = {}; 

    // --- DOM REFERENCES ---
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

    // --- UTILIDADES ---
    const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    
    // Mapeo para traducir lo que viene de la BD (Mayúscula) a lo que está en el HTML (minúscula)
    const mapaDiasBD = {
        'Lunes': 'lunes', 'Martes': 'martes', 'Miércoles': 'miercoles',
        'Jueves': 'jueves', 'Viernes': 'viernes', 'Sábado': 'sabado', 'Domingo': 'domingo'
    };
    
    // Mapeo inverso para guardar
    const mapaDiasHTML = {
        'lunes': 'Lunes', 'martes': 'Martes', 'miercoles': 'Miércoles',
        'jueves': 'Jueves', 'viernes': 'Viernes', 'sabado': 'Sábado', 'domingo': 'Domingo'
    };

    // --- FUNCIONES LÓGICAS ---

    function inicializarToggles() {
        listaDiasSemana.querySelectorAll('.dia-semana').forEach(diaEl => {
            const toggle = diaEl.querySelector('.toggle-dia');
            if (toggle) {
                // Sincronizar estado inicial
                diaEl.dataset.abierto = toggle.checked;
                
                // Escuchar cambios manuales del usuario
                toggle.addEventListener('change', () => {
                    diaEl.dataset.abierto = toggle.checked;
                });
            }
        });
    }

    /**
     * Esta función toma los datos de la BD y configura los interruptores y horas en pantalla.
     * Si la hora es 00:00:00 a 00:00:01, apaga el switch pero deja las horas visuales intactas.
     */
    function aplicarHorarioSemanal(horarios) {
        horarios.forEach(h => {
            const diaHtmlName = mapaDiasBD[h.dia];
            if (diaHtmlName) {
                const diaEl = listaDiasSemana.querySelector(`.dia-semana[data-dia="${diaHtmlName}"]`);
                if (diaEl) {
                    const toggle = diaEl.querySelector('.toggle-dia');
                    const controlesHora = diaEl.querySelector('.controles-hora');
                    
                    // Selectores seguros con verificación de nulidad implícita al usarlos
                    const aperturaInput = controlesHora ? controlesHora.querySelector('.grupo-input:nth-of-type(1) input[type="time"]') : null;
                    const cierreInput = controlesHora ? controlesHora.querySelector('.grupo-input:nth-of-type(2) input[type="time"]') : null;

                    // LÓGICA DE DETECCIÓN DE DÍA CERRADO
                    // Si viene 00:00:00 de apertura y cierre (o cierre con 1 seg), es cerrado.
                    const esHorarioCerrado = h.hora_apertura === '00:00:00' && 
                                            (h.hora_cierre === '00:00:00' || h.hora_cierre === '00:00:01');
                    
                    const estaAbierto = !esHorarioCerrado;

                    // 1. Configurar Switch y atributo visual
                    if (toggle) {
                        toggle.checked = estaAbierto;
                    }
                    diaEl.dataset.abierto = estaAbierto;

                    // 2. Configurar inputs de hora
                    if (estaAbierto) {
                        // Si está abierto, ponemos la hora exacta de la BD
                        if (aperturaInput) aperturaInput.value = h.hora_apertura ? h.hora_apertura.substring(0, 5) : '08:00';
                        if (cierreInput) cierreInput.value = h.hora_cierre ? h.hora_cierre.substring(0, 5) : '17:00';
                    } else {
                        // Si está CERRADO, NO tocamos los inputs. 
                        // Se quedan con el valor por defecto del HTML (ej: 09:00 - 14:00).
                        // Esto evita errores de null y mejora la UX.
                    }
                }
            }
        });
        inicializarToggles(); 
    }

    function renderizarCalendario() {
        gridDias.innerHTML = '';
        const ano = fechaActual.getFullYear();
        const mes = fechaActual.getMonth();
        displayMesAno.textContent = `${nombresMeses[mes]} ${ano}`;
        const primerDiaDelMes = new Date(ano, mes, 1).getDay();
        const diasEnMes = new Date(ano, mes + 1, 0).getDate();
        const diasMesAnterior = new Date(ano, mes, 0).getDate();
        const diasRellenoInicio = primerDiaDelMes;

        // Días del mes anterior (relleno)
        for (let i = diasRellenoInicio; i > 0; i--) {
            const diaEl = document.createElement('div');
            diaEl.classList.add('dia-calendario', 'otro-mes');
            diaEl.textContent = diasMesAnterior - i + 1;
            gridDias.appendChild(diaEl);
        }

        // Días del mes actual
        for (let dia = 1; dia <= diasEnMes; dia++) {
            const diaEl = document.createElement('div');
            diaEl.classList.add('dia-calendario');
            diaEl.textContent = dia;
            const fechaISO = `${ano}-${(mes + 1).toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`;
            diaEl.dataset.fecha = fechaISO;

            if (fechasSeleccionadas.has(fechaISO)) {
                diaEl.classList.add('seleccionado');
            }

            // Pintar excepciones (Solo rojos/cerrados vienen de la BD según tu lógica)
            if (excepciones[fechaISO]) {
                if (excepciones[fechaISO].estado === 'cerrado') {
                    diaEl.classList.add('excepcion-cerrado');
                }
            }

            diaEl.addEventListener('click', () => {
                toggleSeleccionDia(diaEl, fechaISO);
            });
            gridDias.appendChild(diaEl);
        }

        // Días del mes siguiente (relleno)
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

    function obtenerFechasSeleccionadas(incluirManual = true) {
        const seleccion = new Set(fechasSeleccionadas);
        if (incluirManual) {
            const textoFechas = inputFechasManual.value.trim();
            if (textoFechas) {
                const regexDDMMYYYY = /^\d{2}-\d{2}-\d{4}$/;
                const fechasManuales = textoFechas.split(',').map(f => f.trim()).filter(f => f.length > 0);
                const fechasInvalidas = fechasManuales.filter(f => !regexDDMMYYYY.test(f));
                
                if (fechasManuales.length > 0 && fechasInvalidas.length > 0) {
                    mostrarNotificacion('Formato incorrecto. Use DD-MM-YYYY.', 'error');
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
                    }
                });
                if (!conversionExitosa) {
                    mostrarNotificacion('Error al procesar fechas manuales.', 'error');
                    return null;
                }
            }
        }

        if (seleccion.size === 0) {
            mostrarNotificacion('Seleccione al menos una fecha.', 'error');
            return null;
        }
        return seleccion;
    }

    function limpiarSeleccion() {
        inputFechasManual.value = '';
        fechasSeleccionadas.clear();
        document.querySelectorAll('.dia-calendario.seleccionado').forEach(el => el.classList.remove('seleccionado'));
    }

    function mostrarNotificacion(mensaje, tipo = 'exito') {
        const notif = document.createElement('div');
        notif.className = 'notificacion';
        notif.textContent = mensaje;

        let bgColor = tipo === 'exito' ? '#E6FFE6' : '#FFE6E6';
        let textColor = tipo === 'exito' ? '#004D00' : '#5D0000';

        notif.style.cssText = `
            position:fixed; bottom:20px; right:20px; padding:0.75rem 1.25rem;
            border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.2); z-index:1000;
            font-weight:600; transition:all 0.3s ease; opacity:0;
            background-color: ${bgColor}; color: ${textColor};
        `;
        document.body.appendChild(notif);
        setTimeout(() => notif.style.opacity = '1', 10); 
        setTimeout(() => {
            notif.style.opacity = '0';
            setTimeout(() => notif.remove(), 500);
        }, 3000);
    }

    // --- CONEXIÓN API ---

    async function cargarConfiguracion() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error('Error al cargar datos');
            const data = await response.json();

            // 1. Aplicar Horario Semanal (con la lógica de 00:00:00)
            aplicarHorarioSemanal(data.horarios_semanales);

            // 2. Aplicar Excepciones (Solo cerrados)
            excepciones = {};
            data.excepciones.forEach(ex => {
                if (ex.estado_dia.toLowerCase() === 'cerrado') {
                    excepciones[ex.fecha] = { estado: 'cerrado' };
                }
            });

            renderizarCalendario();
            mostrarNotificacion('Configuración cargada correctamente.', 'exito');
        } catch (error) {
            console.error(error);
            mostrarNotificacion('No se pudo conectar con el servidor.', 'error');
        }
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

    // GUARDAR DÍAS CERRADOS (CALENDARIO)
    btnMarcarCerrado.addEventListener('click', async () => {
        const seleccion = obtenerFechasSeleccionadas();
        if (!seleccion) return;

        const lista = Array.from(seleccion).map(f => ({ fecha: f, estado_dia: 'Cerrado' }));

        try {
            const res = await fetch(`${API_URL}/excepciones`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ excepciones: lista })
            });
            if (!res.ok) throw new Error('Error al guardar');
            
            // Actualizar localmente
            lista.forEach(item => excepciones[item.fecha] = { estado: 'cerrado' });
            renderizarCalendario();
            limpiarSeleccion();
            mostrarNotificacion('Días marcados como cerrados.', 'exito');
        } catch (e) {
            mostrarNotificacion(e.message, 'error');
        }
    });

    // ELIMINAR EXCEPCIÓN (VOLVER A ABRIR)
    const eliminarExcepcionHandler = async () => {
        const seleccion = obtenerFechasSeleccionadas();
        if (!seleccion) return;

        // Solo enviamos las fechas que realmente estaban cerradas
        const lista = Array.from(seleccion).filter(f => excepciones[f]);

        if (lista.length === 0) {
            mostrarNotificacion('Las fechas seleccionadas ya están abiertas (no son excepciones).', 'error');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/excepciones/eliminar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fechas: lista })
            });
            if (!res.ok) throw new Error('Error al eliminar');

            lista.forEach(f => delete excepciones[f]);
            renderizarCalendario();
            limpiarSeleccion();
            mostrarNotificacion('Días habilitados nuevamente (según horario semanal).', 'exito');
        } catch (e) {
            mostrarNotificacion(e.message, 'error');
        }
    };

    btnMarcarAbierto.addEventListener('click', eliminarExcepcionHandler);
    btnLimpiarExcepcion.addEventListener('click', eliminarExcepcionHandler);

    // GUARDAR HORARIO SEMANAL
    btnGuardarTodo.addEventListener('click', async () => {
        const horariosAEnviar = [];
        
        listaDiasSemana.querySelectorAll('.dia-semana').forEach(diaEl => {
            const diaNombre = mapaDiasHTML[diaEl.dataset.dia];
            const estaAbierto = diaEl.dataset.abierto === 'true';
            
            // Buscamos inputs con seguridad
            const controlesHora = diaEl.querySelector('.controles-hora');
            const aperturaInput = controlesHora ? controlesHora.querySelector('.grupo-input:nth-of-type(1) input') : null;
            const cierreInput = controlesHora ? controlesHora.querySelector('.grupo-input:nth-of-type(2) input') : null;

            // Valores a enviar
            let apertura = '00:00';
            let cierre = '00:01';

            if (estaAbierto && aperturaInput && cierreInput) {
                apertura = aperturaInput.value;
                cierre = cierreInput.value;
            }
            // Si no está abierto, enviamos 00:00, el backend sabrá qué hacer.

            horariosAEnviar.push({
                dia: diaNombre,
                hora_apertura: apertura,
                hora_cierre: cierre
            });
        });

        try {
            const res = await fetch(`${API_URL}/semanal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ horarios: horariosAEnviar })
            });
            if (!res.ok) throw new Error('Error al guardar horario semanal');
            
            mostrarNotificacion('Horario semanal actualizado correctamente.', 'exito');
        } catch (e) {
            mostrarNotificacion(e.message, 'error');
        }
    });

    // --- INICIO ---
    cargarConfiguracion();
});