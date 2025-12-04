// La URL de la API se configura para el entorno de producción (Render)
const API_BASE_URL ='https://gestion-citas-salon.onrender.com/api';

// Espera a que el DOM esté completamente cargado antes de ejecutar el script.
document.addEventListener('DOMContentLoaded', () => {
    // 1. OBTENCIÓN DE DATOS DEL LOCALSTORAGE
    // Recuperamos los datos de la cita (cliente y servicio) guardados previamente.
    const datosCitaJSON = localStorage.getItem('datosCita');
    
    if (!datosCitaJSON) {
        // Bloqueo de seguridad: si no hay datos, redirigimos para iniciar el proceso.
        alert('No se encontraron los datos del servicio. Por favor, inicie el proceso nuevamente.');
        window.location.href = 'agendar_cita.html'; // O la página anterior correspondiente
        return;
    }

    const datosCita = JSON.parse(datosCitaJSON);
    const id_cliente = datosCita.id_cliente;
    const id_servicio = datosCita.id_servicio;

    // Variables de Estado
    let diaSeleccionado = null; // Elemento DOM para el control visual de la selección
    let fechaSeleccionadaStr = null; // String YYYY-MM-DD para el backend
    let estilistaSeleccionadoId = null;
    let fechaActual = new Date(); // Objeto Date para navegar por el calendario
    
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
    fechaReal.setHours(0,0,0,0); // Normalizamos a medianoche para comparaciones
    
    // Inicialización
    let mesActualIndex = fechaActual.getMonth();
    let mesSeleccionadoText = meses[mesActualIndex];
    let isHandlingTouch = false; // Bandera para evitar doble evento (click y touch)

    // LÓGICA DEL CALENDARIO Y NAVEGACIÓN

    // Muestra el año visible en la UI.
    function actualizarAnioActual() {
        const anioVisible = fechaActual.getFullYear();
        anioActualSpan.textContent = anioVisible;
        
        // El control de año pasado se realiza en cambiarAnio.
    }

    // Navega al año anterior o siguiente, con validación.
    function cambiarAnio(direccion) {
        const nuevoAnio = fechaActual.getFullYear() + direccion;
        // Evita ir a años anteriores al año actual real.
        if (direccion === -1 && nuevoAnio < fechaReal.getFullYear()) return;
        
        fechaActual.setFullYear(nuevoAnio);
        
        // Ajuste: si regresamos al año actual, el mes debe ser al menos el mes actual real.
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

    // Formato estándar YYYY-MM-DD requerido por el backend (SQL).
    function formatearFecha(dia) {
        const anio = fechaActual.getFullYear();
        const mes = fechaActual.getMonth() + 1;
        const diaFormateado = String(dia).padStart(2, '0');
        const mesFormateado = String(mes).padStart(2, '0');
        return `${anio}-${mesFormateado}-${diaFormateado}`;
    }

    // LÓGICA DE DATOS (FETCH BACKEND)

    /**
     * Llama al endpoint para obtener el estado de cada día del mes.
     * Esto usa lógica de backend (horarios, días festivos y citas agotadas).
     */
    async function obtenerEstadoMes(anio, mes) {
        try {
            // Se envía mes + 1 porque en JavaScript los meses van de 0 a 11.
            const response = await fetch(`${API_BASE_URL}/calendario/estado-mes?year=${anio}&month=${mes + 1}`);
            if (!response.ok) throw new Error('Error al obtener calendario');
            // Retorna un objeto mapeando fecha a estado (e.g., "Abierto", "Cerrado").
            return await response.json();
        } catch (error) {
            console.error(error);
            return {};
        }
    }

    /**
     * Carga el dropdown con los empleados que pueden realizar el 'id_servicio'.
     */
    async function cargarEstilistas() {
        // Estado inicial de carga.
        desplegableEstilista.innerHTML = '<option value="">Cargando...</option>';
        desplegableEstilista.disabled = true;

        try {
            const response = await fetch(`${API_BASE_URL}/empleados/por-servicio/${id_servicio}`);
            const estilistas = await response.json();

            desplegableEstilista.innerHTML = '<option value="">Seleccione un estilista</option>';
            
            if (estilistas.length > 0) {
                // Rellenamos el <select> con los estilistas obtenidos.
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
     * Muestra la lista de citas **ya agendadas** para el día/estilista seleccionado.
     * Esto es solo informativo para el usuario.
     */
    async function cargarCitasOcupadas(fecha, idEmpleado) {
        cuerpoTablaCitas.innerHTML = '<tr><td colspan="4" class="text-center">Cargando citas...</td></tr>';
        
        try {
            // Se envía el id_servicio para calcular correctamente la hora de fin.
            const response = await fetch(`${API_BASE_URL}/citas/ocupadas?fecha=${fecha}&id_empleado=${idEmpleado}&id_servicio=${id_servicio}`);
            const citas = await response.json();
            
            mostrarTablaCitas(citas);
        } catch (error) {
            console.error("Error cargando tabla de citas:", error);
            cuerpoTablaCitas.innerHTML = '<tr><td colspan="4">Error al cargar datos.</td></tr>';
        }
    }

    /**
     * Llama al endpoint que usa la función de BD `obtener_slots_disponibles`.
     * Retorna los intervalos de tiempo donde el servicio **cabe** en el horario del estilista.
     */
    async function cargarHorasDisponibles(fecha, idEmpleado) {
        desplegableHora.innerHTML = '<option value="">Cargando...</option>';
        desplegableHora.disabled = true;

        try {
            // El backend usa la fecha, el empleado y la duración del servicio para calcular los slots.
            const response = await fetch(`${API_BASE_URL}/citas/slots-disponibles?fecha=${fecha}&id_empleado=${idEmpleado}&id_servicio=${id_servicio}`);
            const slots = await response.json(); // Array de strings ["09:00:00", "09:30:00"...]

            desplegableHora.innerHTML = '<option value="">Seleccione una hora</option>';

            if (slots.length > 0) {
                // Rellenamos el <select> de horas.
                slots.forEach(hora => {
                    const option = document.createElement('option');
                    // Mostramos solo HH:MM para mejor visualización.
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

    // RENDERIZADO UI

    // Genera la cuadrícula de días del calendario para el mes actual.
    function mostrarCalendario() {
        // Preserva las cabeceras (nombres de días) al limpiar la cuadrícula.
        const headers = Array.from(cuadriculaCalendario.querySelectorAll('.nombre-dia'));
        cuadriculaCalendario.innerHTML = '';
        headers.forEach(h => cuadriculaCalendario.appendChild(h));

        const anio = fechaActual.getFullYear();
        const mes = fechaActual.getMonth();

        // Se usa .then() para esperar los estados antes de pintar los días.
        obtenerEstadoMes(anio, mes).then(estadosMes => {
            const primerDiaSemana = new Date(anio, mes, 1).getDay();
            const diasEnMes = new Date(anio, mes + 1, 0).getDate();
            // Ajuste de `getDay()`: 0 (Dom) a 6 (Sáb). Convertimos a Lunes=0, Domingo=6.
            const inicioSemana = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1;
            const diaAnterior = new Date(anio, mes, 0).getDate();

            // Relleno de días del mes anterior (inactivos).
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
                let claseEstado = 'estado-disponible';
                let esClickable = true;

                // 1. Fechas Pasadas y Hoy: Inhabilitar selección.
                if (fechaIteracion <= fechaReal) {
                    claseEstado = 'estado-cerrado'; 
                    esClickable = false;
                    diaElemento.style.opacity = '0.5';
                } 
                // 2. Estado desde DB: Cerrado por negocio o Agotado por reservas.
                else {
                    const estadoBackend = estadosMes[fechaStr]; // "Abierto", "Cerrado", "Agotado"
                    
                    if (estadoBackend === 'Cerrado') {
                        claseEstado = 'estado-cerrado';
                        esClickable = false;
                    } else if (estadoBackend === 'Agotado') {
                        claseEstado = 'estado-agotado'; // Estilo para indicar lleno (Rosado)
                        esClickable = false; 
                    } else {
                        claseEstado = 'estado-disponible'; // Estilo para indicar disponible (Negro)
                    }
                }

                diaElemento.classList.add(claseEstado);

                if (esClickable) {
                    // Solo los días disponibles son clickeables.
                    diaElemento.addEventListener('click', handleDaySelection);
                    diaElemento.addEventListener('touchstart', handleDaySelection);
                } else {
                    diaElemento.style.cursor = 'not-allowed';
                }

                cuadriculaCalendario.appendChild(diaElemento);
            }

            // Relleno de días del mes siguiente (inactivos) para completar la cuadrícula.
            const totalCeldas = cuadriculaCalendario.children.length - 7;
            const celdasFaltantes = 42 - (totalCeldas % 42); 
            // Corrección: si el calendario ya tiene 42 celdas, no añade más.
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

    // Pinta las filas de la tabla de citas ocupadas.
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
            // Formatea el horario (quitando segundos).
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

    // MANEJO DE EVENTOS

    // Maneja la selección de un día en el calendario.
    async function handleDaySelection(event) {
        // Lógica para prevenir doble disparo de evento en dispositivos táctiles.
        if (event.type === 'touchstart') {
            isHandlingTouch = true;
            setTimeout(() => { isHandlingTouch = false; }, 500);
        } else if (event.type === 'click' && isHandlingTouch) {
            return;
        }

        const diaElemento = event.currentTarget;
        
        // Limpiar selección previa visual.
        cuadriculaCalendario.querySelectorAll('.dia').forEach(d => d.classList.remove('seleccionado'));
        diaElemento.classList.add('seleccionado');
        
        diaSeleccionado = diaElemento;
        const diaNum = diaElemento.dataset.day;
        fechaSeleccionadaStr = formatearFecha(diaNum);

        // Al seleccionar un día, se resetean y recargan los selectores dependientes.
        estilistaSeleccionadoId = null;
        desplegableHora.innerHTML = '<option value="">Seleccione un estilista primero</option>';
        desplegableHora.disabled = true;
        cuerpoTablaCitas.innerHTML = ''; 

        // Cargar Estilistas disponibles para el servicio.
        await cargarEstilistas();
    }

    // Evento al seleccionar Estilista.
    desplegableEstilista.addEventListener('change', async (event) => {
        estilistaSeleccionadoId = event.target.value;

        // Si se seleccionó estilista y día, se cargan horas y tabla de citas.
        if (estilistaSeleccionadoId && fechaSeleccionadaStr) {
            // 1. Cargar Horas Disponibles (Dropdown) - Lógica de reserva.
            await cargarHorasDisponibles(fechaSeleccionadaStr, estilistaSeleccionadoId);
            // 2. Cargar Tabla de Citas (Información visual) - Lógica de ocupación.
            await cargarCitasOcupadas(fechaSeleccionadaStr, estilistaSeleccionadoId);
        } else {
            // Si el estilista se deselecciona, limpiamos.
            desplegableHora.innerHTML = '<option value="">Seleccione un estilista</option>';
            desplegableHora.disabled = true;
            cuerpoTablaCitas.innerHTML = '';
        }
    });

    // Evento Click Botón Agendar
    btnAgendar.addEventListener('click', async () => {
        const horaSeleccionada = desplegableHora.value;

        // Validaciones: Todos los campos deben estar seleccionados.
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

        // Preparar Payload para la solicitud POST.
        const datosReserva = {
            id_cliente: id_cliente,
            id_servicio: id_servicio,
            id_empleado: estilistaSeleccionadoId,
            fecha: fechaSeleccionadaStr,
            hora: horaSeleccionada
        };

        try {
            // Deshabilitamos el botón para evitar múltiples clics.
            btnAgendar.disabled = true;
            btnAgendar.textContent = "Agendando...";

            // Solicitud POST al endpoint de agendar cita.
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
                // Eliminamos los datos temporales y redirigimos a la página de inicio.
                localStorage.removeItem('datosCita');
                window.location.href = 'inicio.html';
            } else {
                // Manejo de errores de negocio (e.g., slot ya ocupado).
                throw new Error(resultado.message || 'Error desconocido al agendar');
            }

        } catch (error) {
            console.error(error);
            alert('Hubo un error al agendar la cita: ' + error.message);
            // Restaurar el botón en caso de fallo.
            btnAgendar.disabled = false;
            btnAgendar.textContent = "AGENDAR CITA";
        }
    });

    // LISTENERS AUXILIARES (MESES, UI)
    
    // Asignación de eventos para la navegación de año.
    btnAnioAnterior.addEventListener('click', () => cambiarAnio(-1));
    btnAnioSiguiente.addEventListener('click', () => cambiarAnio(1));

    // Muestra/oculta el menú desplegable de meses.
    function alternarDesplegable() {
        listaMesesDesplegable.classList.toggle('oculto');
        flechaMesDesplegable.classList.toggle('abierto');
        if (!listaMesesDesplegable.classList.contains('oculto')) {
            actualizarClasesSeleccionado();
        }
    }

    // Cierra el menú desplegable de meses.
    function cerrarDesplegable() {
        listaMesesDesplegable.classList.add('oculto');
        flechaMesDesplegable.classList.remove('abierto');
    }

    // Resalta el mes activo y sombrea los meses pasados en el desplegable.
    function actualizarClasesSeleccionado() {
        const mesVisible = fechaActual.getMonth();
        const anioVisible = fechaActual.getFullYear();
        listaMesesDesplegable.querySelectorAll('.item-mes').forEach(item => {
            const index = parseInt(item.dataset.mesIndex);
            
            // Marca el mes actualmente visible en el calendario.
            if (index === mesVisible) {
                item.classList.add('activo');
            } else {
                item.classList.remove('activo');
            }
            
            // Lógica para deshabilitar visualmente meses pasados.
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

    // Crea los elementos DOM para cada mes en el desplegable.
    function inicializarMeses() {
        mesSeleccionadoSpan.textContent = mesSeleccionadoText;
        meses.forEach((mes, index) => {
            const itemMes = document.createElement('div');
            itemMes.classList.add('item-mes');
            itemMes.textContent = mes;
            itemMes.dataset.mesIndex = index;

            itemMes.addEventListener('click', () => {
                const anioVisible = fechaActual.getFullYear();
                // Bloquea el click si el mes es pasado en el año actual.
                if (anioVisible === fechaReal.getFullYear() && index < fechaReal.getMonth()) {
                    return; 
                }

                // Cambia el mes del objeto Date y refresca la UI.
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

    // Reinicia todas las variables de estado y selectores.
    function limpiarSeleccion() {
        cuadriculaCalendario.querySelectorAll('.dia').forEach(d => d.classList.remove('seleccionado'));
        diaSeleccionado = null;
        fechaSeleccionadaStr = null;
        estilistaSeleccionadoId = null;
        
        // Limpiar y deshabilitar dropdowns dependientes.
        desplegableEstilista.innerHTML = '<option value="">Seleccione un día</option>';
        desplegableEstilista.disabled = true;
        
        desplegableHora.innerHTML = '<option value="">Seleccione un estilista</option>';
        desplegableHora.disabled = true;
        
        mostrarTablaCitas([]);
    }

    // Listeners UI Meses (manejo del dropdown).
    selectorMesActual.addEventListener('click', alternarDesplegable);
    // Prevención de comportamiento de arrastre en móvil para el touchstart.
    selectorMesActual.addEventListener('touchstart', (e) => { e.preventDefault(); alternarDesplegable(); });
    // Cierre del desplegable al hacer clic fuera de él.
    document.addEventListener('click', (event) => {
        if (!selectorMesActual.contains(event.target) && !listaMesesDesplegable.contains(event.target)) {
            cerrarDesplegable();
        }
    });

    // INICIO: Funciones de inicialización.
    inicializarMeses();
    actualizarAnioActual();
    mostrarCalendario();
});