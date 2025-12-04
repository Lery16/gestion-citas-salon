const API_BASE_URL = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', () => {
    // 1. OBTENCIÓN DE DATOS DEL LOCALSTORAGE
    const datosCitaJSON = localStorage.getItem('datosCita');
    
    if (!datosCitaJSON) {
        alert('No se encontraron los datos del servicio. Por favor, inicie el proceso nuevamente.');
        window.location.href = 'agendar_cita.html'; // O la página anterior correspondiente
        return;
    }

    const datosCita = JSON.parse(datosCitaJSON);
    const id_cliente = datosCita.id_cliente;
    const id_servicio = datosCita.id_servicio;

    // Variables de Estado
    let diaSeleccionado = null; // Elemento DOM
    let fechaSeleccionadaStr = null; // String YYYY-MM-DD
    let estilistaSeleccionadoId = null;
    let fechaActual = new Date(); // Para navegación del calendario
    
    // Referencias DOM
    const cuerpoTablaCitas = document.getElementById('cuerpo-tabla-citas');
    const selectorMesActual = document.getElementById('selector-mes-actual');
    const listaMesesDesplegable = document.getElementById('lista-meses-desplegable');
    const mesSeleccionadoSpan = document.getElementById('mes-seleccionado');
    const flechaMesDesplegable = document.getElementById('flecha-desplegable-mes');
    const cuadriculaCalendario = document.getElementById('cuadricula-calendario');
    const desplegableEstilista = document.getElementById('desplegable-estilista');
    const desplegableHora = document.getElementById('desplegable-hora');
    const btnAgendar = document.getElementById('btn-agendar');
    const btnAnioAnterior = document.getElementById('btn-anio-anterior');
    const btnAnioSiguiente = document.getElementById('btn-anio-siguiente');
    const anioActualSpan = document.getElementById('anio-actual');

    const meses = [
        "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", 
        "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
    ];

    // Referencias de Fecha Actual Real (Para bloquear días pasados y hoy)
    const fechaReal = new Date();
    fechaReal.setHours(0,0,0,0);

    // Inicialización
    let mesActualIndex = fechaActual.getMonth();
    let mesSeleccionadoText = meses[mesActualIndex];
    let isHandlingTouch = false;

    // ==========================================
    // LÓGICA DEL CALENDARIO Y NAVEGACIÓN
    // ==========================================

    function actualizarAnioActual() {
        const anioVisible = fechaActual.getFullYear();
        anioActualSpan.textContent = anioVisible;
        
        // Bloquear ir al pasado más allá del año actual
        if (anioVisible < fechaReal.getFullYear()) {
             // Lógica defensiva, aunque se controla en cambiarAnio
        }
    }

    function cambiarAnio(direccion) {
        const nuevoAnio = fechaActual.getFullYear() + direccion;
        if (direccion === -1 && nuevoAnio < fechaReal.getFullYear()) return;
        
        fechaActual.setFullYear(nuevoAnio);
        // Ajustar mes si nos fuimos al pasado en el año actual
        if (nuevoAnio === fechaReal.getFullYear() && fechaActual.getMonth() < fechaReal.getMonth()) {
            fechaActual.setMonth(fechaReal.getMonth());
        }
        
        mesActualIndex = fechaActual.getMonth();
        mesSeleccionadoText = meses[mesActualIndex];
        mesSeleccionadoSpan.textContent = mesSeleccionadoText;
        
        actualizarAnioActual();
        mostrarCalendario();
        limpiarSeleccion();
    }

    function formatearFecha(dia) {
        const anio = fechaActual.getFullYear();
        const mes = fechaActual.getMonth() + 1;
        const diaFormateado = String(dia).padStart(2, '0');
        const mesFormateado = String(mes).padStart(2, '0');
        return `${anio}-${mesFormateado}-${diaFormateado}`;
    }

    // ==========================================
    // LÓGICA DE DATOS (FETCH BACKEND)
    // ==========================================

    /**
     * Obtiene el estado de los días del mes (Abierto, Cerrado, Agotado)
     * Basado en Horario_Semanal_Empleado y Dia_Salon_Estado
     */
    async function obtenerEstadoMes(anio, mes) {
        try {
            // El backend debe retornar un objeto: { "2024-05-01": "Abierto", "2024-05-02": "Cerrado", ... }
            const response = await fetch(`${API_BASE_URL}/calendario/estado-mes?year=${anio}&month=${mes + 1}`);
            if (!response.ok) throw new Error('Error al obtener calendario');
            return await response.json();
        } catch (error) {
            console.error(error);
            return {};
        }
    }

    /**
     * Carga los estilistas que ofrecen el servicio seleccionado (Empleado_Servicio)
     */
    async function cargarEstilistas() {
        desplegableEstilista.innerHTML = '<option value="">Cargando...</option>';
        desplegableEstilista.disabled = true;

        try {
            const response = await fetch(`${API_BASE_URL}/empleados/por-servicio/${id_servicio}`);
            const estilistas = await response.json();

            desplegableEstilista.innerHTML = '<option value="">Seleccione un estilista</option>';
            
            if (estilistas.length > 0) {
                estilistas.forEach(est => {
                    const option = document.createElement('option');
                    option.value = est.id_empleado;
                    option.textContent = `${est.nombre} ${est.apellido}`;
                    desplegableEstilista.appendChild(option);
                });
                desplegableEstilista.disabled = false;
            } else {
                desplegableEstilista.innerHTML = '<option value="">No hay estilistas para este servicio</option>';
            }
        } catch (error) {
            console.error("Error cargando estilistas:", error);
            desplegableEstilista.innerHTML = '<option value="">Error al cargar</option>';
        }
    }

    /**
     * Carga la tabla lateral con las citas reales ocupadas
     * Filtra por día, estilista y servicio.
     */
    async function cargarCitasOcupadas(fecha, idEmpleado) {
        cuerpoTablaCitas.innerHTML = '<tr><td colspan="4" class="text-center">Cargando citas...</td></tr>';
        
        try {
            const response = await fetch(`${API_BASE_URL}/citas/ocupadas?fecha=${fecha}&id_empleado=${idEmpleado}&id_servicio=${id_servicio}`);
            const citas = await response.json();
            
            mostrarTablaCitas(citas);
        } catch (error) {
            console.error("Error cargando tabla de citas:", error);
            cuerpoTablaCitas.innerHTML = '<tr><td colspan="4">Error al cargar datos.</td></tr>';
        }
    }

    /**
     * Carga los slots de tiempo disponibles (Dropdown Hora)
     * Usa la función de BD: obtener_slots_disponibles
     */
    async function cargarHorasDisponibles(fecha, idEmpleado) {
        desplegableHora.innerHTML = '<option value="">Cargando...</option>';
        desplegableHora.disabled = true;

        try {
            const response = await fetch(`${API_BASE_URL}/citas/slots-disponibles?fecha=${fecha}&id_empleado=${idEmpleado}&id_servicio=${id_servicio}`);
            const slots = await response.json(); // Array de strings ["09:00:00", "09:30:00"...]

            desplegableHora.innerHTML = '<option value="">Seleccione una hora</option>';

            if (slots.length > 0) {
                slots.forEach(hora => {
                    const option = document.createElement('option');
                    // Cortamos los segundos para mostrar HH:MM
                    const horaCorta = hora.substring(0, 5);
                    option.value = hora; 
                    option.textContent = horaCorta;
                    desplegableHora.appendChild(option);
                });
                desplegableHora.disabled = false;
            } else {
                desplegableHora.innerHTML = '<option value="">Sin horas disponibles</option>';
            }
        } catch (error) {
            console.error("Error cargando slots:", error);
            desplegableHora.innerHTML = '<option value="">Error al cargar</option>';
        }
    }

    // ==========================================
    // RENDERIZADO UI
    // ==========================================

    function mostrarCalendario() {
        // Mantener cabeceras
        const headers = Array.from(cuadriculaCalendario.querySelectorAll('.nombre-dia'));
        cuadriculaCalendario.innerHTML = '';
        headers.forEach(h => cuadriculaCalendario.appendChild(h));

        const anio = fechaActual.getFullYear();
        const mes = fechaActual.getMonth();

        // Llamada al Backend para obtener estados (Cerrado/Abierto/Agotado)
        obtenerEstadoMes(anio, mes).then(estadosMes => {
            const primerDiaSemana = new Date(anio, mes, 1).getDay();
            const diasEnMes = new Date(anio, mes + 1, 0).getDate();
            // Ajuste para que Lunes sea el primer día (0 en array visual, pero getDay() Domingo es 0)
            const inicioSemana = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1;
            const diaAnterior = new Date(anio, mes, 0).getDate();

            // Días mes anterior (relleno)
            for (let i = inicioSemana; i > 0; i--) {
                const dia = document.createElement('div');
                dia.classList.add('dia', 'dia-mes-anterior');
                dia.textContent = diaAnterior - i + 1;
                cuadriculaCalendario.appendChild(dia);
            }

            // Días del mes actual
            for (let dia = 1; dia <= diasEnMes; dia++) {
                const fechaIteracion = new Date(anio, mes, dia);
                fechaIteracion.setHours(0,0,0,0);
                const fechaStr = formatearFecha(dia);
                
                const diaElemento = document.createElement('div');
                diaElemento.classList.add('dia');
                diaElemento.textContent = dia;
                diaElemento.dataset.day = dia;

                // Lógica de Estado Visual
                let claseEstado = 'estado-disponible'; // Default (Negro)
                let esClickable = true;

                // 1. Fechas Pasadas y Hoy
                if (fechaIteracion <= fechaReal) {
                    claseEstado = 'estado-cerrado'; // Usamos estilo cerrado para pasado/hoy
                    esClickable = false;
                    diaElemento.style.opacity = '0.5';
                } 
                // 2. Estado desde DB (Días cerrados por horario o tabla estado, o agotados)
                else {
                    const estadoBackend = estadosMes[fechaStr]; // "Abierto", "Cerrado", "Agotado"
                    
                    if (estadoBackend === 'Cerrado') {
                        claseEstado = 'estado-cerrado';
                        esClickable = false;
                    } else if (estadoBackend === 'Agotado') {
                        claseEstado = 'estado-agotado'; // Circulo Rosado
                        esClickable = false; 
                    } else {
                        claseEstado = 'estado-disponible'; // Circulo Negro
                    }
                }

                diaElemento.classList.add(claseEstado);

                if (esClickable) {
                    diaElemento.addEventListener('click', handleDaySelection);
                    diaElemento.addEventListener('touchstart', handleDaySelection);
                } else {
                    diaElemento.style.cursor = 'not-allowed';
                }

                cuadriculaCalendario.appendChild(diaElemento);
            }

            // Relleno días mes siguiente
            const totalCeldas = cuadriculaCalendario.children.length - 7;
            const celdasFaltantes = 42 - (totalCeldas % 42); // Asumiendo grid de 6 filas
            // Corrección bug visual si celdasFaltantes es 42 (ya está lleno)
            if (celdasFaltantes < 42) {
                for (let i = 1; i <= celdasFaltantes; i++) {
                    const dia = document.createElement('div');
                    dia.classList.add('dia', 'dia-mes-siguiente');
                    dia.textContent = i;
                    cuadriculaCalendario.appendChild(dia);
                }
            }
            
            limpiarSeleccion();
        });
    }

    function mostrarTablaCitas(citas) {
        cuerpoTablaCitas.innerHTML = '';
        if (!citas || citas.length === 0) {
            const filaVacia = document.createElement('tr');
            filaVacia.innerHTML = `
                <td class="col-num" colspan="4" style="text-align: center;">No hay citas agendadas con este estilista para hoy.</td>
            `;
            cuerpoTablaCitas.appendChild(filaVacia);
            return;
        }

        citas.forEach((cita, index) => {
            const fila = document.createElement('tr');
            fila.classList.add('fila-cita');
            // cita.hora_inicio y cita.hora_fin vienen del backend
            const horarioTexto = `${cita.hora_inicio.substring(0,5)} - ${cita.hora_fin.substring(0,5)}`;
            
            fila.innerHTML = `
                <td class="col-num">${String(index + 1).padStart(2, '0')}</td>
                <td class="col-nombre">${cita.nombre_cliente}</td>
                <td class="col-servicio">${cita.nombre_servicio}</td>
                <td class="col-horario">${horarioTexto}</td>
            `;
            cuerpoTablaCitas.appendChild(fila);
        });
    }

    // ==========================================
    // MANEJO DE EVENTOS
    // ==========================================

    async function handleDaySelection(event) {
        if (event.type === 'touchstart') {
            isHandlingTouch = true;
            setTimeout(() => { isHandlingTouch = false; }, 500);
        } else if (event.type === 'click' && isHandlingTouch) {
            return;
        }

        const diaElemento = event.currentTarget;
        
        // Limpiar selección previa visual
        cuadriculaCalendario.querySelectorAll('.dia').forEach(d => d.classList.remove('seleccionado'));
        diaElemento.classList.add('seleccionado');
        
        diaSeleccionado = diaElemento;
        const diaNum = diaElemento.dataset.day;
        fechaSeleccionadaStr = formatearFecha(diaNum);

        // Resetear selectores dependientes
        estilistaSeleccionadoId = null;
        desplegableHora.innerHTML = '<option value="">Seleccione un estilista primero</option>';
        desplegableHora.disabled = true;
        cuerpoTablaCitas.innerHTML = ''; // Limpiar tabla

        // Cargar Estilistas disponibles para el servicio
        await cargarEstilistas();
    }

    // Evento al seleccionar Estilista
    desplegableEstilista.addEventListener('change', async (event) => {
        estilistaSeleccionadoId = event.target.value;

        if (estilistaSeleccionadoId && fechaSeleccionadaStr) {
            // 1. Cargar Horas Disponibles (Dropdown)
            await cargarHorasDisponibles(fechaSeleccionadaStr, estilistaSeleccionadoId);
            // 2. Cargar Tabla de Citas (Información visual)
            await cargarCitasOcupadas(fechaSeleccionadaStr, estilistaSeleccionadoId);
        } else {
            desplegableHora.innerHTML = '<option value="">Seleccione un estilista</option>';
            desplegableHora.disabled = true;
            cuerpoTablaCitas.innerHTML = '';
        }
    });

    // Evento Click Botón Agendar
    btnAgendar.addEventListener('click', async () => {
        const horaSeleccionada = desplegableHora.value;

        // Validaciones
        if (!fechaSeleccionadaStr) {
            alert('Por favor, seleccione una fecha en el calendario.');
            return;
        }
        if (!estilistaSeleccionadoId) {
            alert('Por favor, seleccione un estilista.');
            return;
        }
        if (!horaSeleccionada) {
            alert('Por favor, seleccione una hora de inicio.');
            return;
        }

        // Preparar Payload
        const datosReserva = {
            id_cliente: id_cliente,
            id_servicio: id_servicio,
            id_empleado: estilistaSeleccionadoId,
            fecha: fechaSeleccionadaStr,
            hora: horaSeleccionada
            // estado: No se envía, la BD lo pone en 'Pendiente' por defecto
        };

        try {
            btnAgendar.disabled = true;
            btnAgendar.textContent = "Agendando...";

            const response = await fetch(`${API_BASE_URL}/citas/agendar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(datosReserva)
            });

            const resultado = await response.json();

            if (response.ok) {
                alert('¡Cita agendada con éxito!');
                // Limpiar datos temporales si es necesario
                // Redirigir a inicio
                localStorage.removeItem('datosCita');
                window.location.href = 'inicio.html';
            } else {
                throw new Error(resultado.message || 'Error desconocido al agendar');
            }

        } catch (error) {
            console.error(error);
            alert('Hubo un error al agendar la cita: ' + error.message);
            btnAgendar.disabled = false;
            btnAgendar.textContent = "AGENDAR CITA";
        }
    });

    // ==========================================
    // LISTENERS AUXILIARES (MESES, UI)
    // ==========================================
    
    btnAnioAnterior.addEventListener('click', () => cambiarAnio(-1));
    btnAnioSiguiente.addEventListener('click', () => cambiarAnio(1));

    function alternarDesplegable() {
        listaMesesDesplegable.classList.toggle('oculto');
        flechaMesDesplegable.classList.toggle('abierto');
        if (!listaMesesDesplegable.classList.contains('oculto')) {
            actualizarClasesSeleccionado();
        }
    }

    function cerrarDesplegable() {
        listaMesesDesplegable.classList.add('oculto');
        flechaMesDesplegable.classList.remove('abierto');
    }

    function actualizarClasesSeleccionado() {
        const mesVisible = fechaActual.getMonth();
        const anioVisible = fechaActual.getFullYear();
        listaMesesDesplegable.querySelectorAll('.item-mes').forEach(item => {
            const index = parseInt(item.dataset.mesIndex);
            if (index === mesVisible) {
                item.classList.add('activo');
            } else {
                item.classList.remove('activo');
            }
            
            // Marcar meses pasados visualmente
            const esAnioPasado = anioVisible < fechaReal.getFullYear();
            const esMesPasadoEnAnioActual = anioVisible === fechaReal.getFullYear() && index < fechaReal.getMonth();
            
            if (esAnioPasado || esMesPasadoEnAnioActual) {
                item.classList.add('seleccionado'); // Reusamos clase para indicar deshabilitado visual
                item.style.opacity = '0.5';
            } else {
                item.classList.remove('seleccionado');
                item.style.opacity = '1';
            }
        });
    }

    function inicializarMeses() {
        mesSeleccionadoSpan.textContent = mesSeleccionadoText;
        meses.forEach((mes, index) => {
            const itemMes = document.createElement('div');
            itemMes.classList.add('item-mes');
            itemMes.textContent = mes;
            itemMes.dataset.mesIndex = index;

            itemMes.addEventListener('click', () => {
                const anioVisible = fechaActual.getFullYear();
                // Validar no seleccionar mes pasado
                if (anioVisible === fechaReal.getFullYear() && index < fechaReal.getMonth()) {
                    return; 
                }

                fechaActual.setMonth(index);
                mesSeleccionadoText = mes;
                mesSeleccionadoSpan.textContent = mes;
                mesActualIndex = index;
                actualizarClasesSeleccionado();
                mostrarCalendario();
                limpiarSeleccion();
                cerrarDesplegable();
            });
            listaMesesDesplegable.appendChild(itemMes);
        });
    }

    function limpiarSeleccion() {
        cuadriculaCalendario.querySelectorAll('.dia').forEach(d => d.classList.remove('seleccionado'));
        diaSeleccionado = null;
        fechaSeleccionadaStr = null;
        estilistaSeleccionadoId = null;
        
        desplegableEstilista.innerHTML = '<option value="">Seleccione un día</option>';
        desplegableEstilista.disabled = true;
        
        desplegableHora.innerHTML = '<option value="">Seleccione un estilista</option>';
        desplegableHora.disabled = true;
        
        mostrarTablaCitas([]);
    }

    // Listeners UI Meses
    selectorMesActual.addEventListener('click', alternarDesplegable);
    selectorMesActual.addEventListener('touchstart', (e) => { e.preventDefault(); alternarDesplegable(); });
    document.addEventListener('click', (event) => {
        if (!selectorMesActual.contains(event.target) && !listaMesesDesplegable.contains(event.target)) {
            cerrarDesplegable();
        }
    });

    // INICIO
    inicializarMeses();
    actualizarAnioActual();
    mostrarCalendario();
});