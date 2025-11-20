const MAX_CITAS = 30;
const AGENDAR_ENDPOINT = '/api/agendar';
const DISPONIBILIDAD_ENDPOINT = '/api/disponibilidad';
const CITAS_DIA_ENDPOINT = '/api/citasdia';
const ESTILISTAS_DIA_ENDPOINT = '/api/estilistasDia';
const HORAS_ESTILISTA_ENDPOINT = '/api/horasEstilista';

document.addEventListener('DOMContentLoaded', () => {
    let datosPersonales = {};
    let diaSeleccionado = null;
    let estilistaSeleccionado = null;

    const cuerpoTablaCitas = document.getElementById('cuerpo-tabla-citas');

    // 1. Carga los datos del cliente, que ahora se espera que incluyan el 'servicioId'
    const datosClienteJSON = localStorage.getItem('datosCliente');
    if (datosClienteJSON) {
        try {
            datosPersonales = JSON.parse(datosClienteJSON);
        } catch (e) {
            console.error('Error al parsear datos del cliente:', e);
            alert('Error al recuperar sus datos. Por favor, reinicie el proceso.');
            window.location.href = 'agendar_cita.html';
            return;
        }
    } else {
        alert('No se encontraron sus datos personales. Regrese a la página anterior.');
        window.location.href = 'agendar_cita.html';
        return;
    }

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
    
    const fechaActualReferencia = new Date();
    const diaActualReferencia = fechaActualReferencia.getDate();
    const mesActualReferencia = fechaActualReferencia.getMonth();
    const anioActualReferencia = fechaActualReferencia.getFullYear();

    let fechaActual = new Date();
    fechaActual.setDate(1);
    
    let mesActualIndex = fechaActual.getMonth();
    let mesSeleccionadoText = meses[mesActualIndex];

    let isHandlingTouch = false;

    function actualizarAnioActual() {
        const anioVisible = fechaActual.getFullYear();
        anioActualSpan.textContent = anioVisible;

        if (anioVisible <= anioActualReferencia) {
            btnAnioAnterior.style.opacity = '0.5';
            btnAnioAnterior.style.cursor = 'default';
        } else {
            btnAnioAnterior.style.opacity = '1';
            btnAnioAnterior.style.cursor = 'pointer';
        }
    }

    function cambiarAnio(direccion) {
        const nuevoAnio = fechaActual.getFullYear() + direccion;

        if (direccion === -1 && nuevoAnio < anioActualReferencia) {
            return;
        }

        fechaActual.setFullYear(nuevoAnio);
        
        if (nuevoAnio === anioActualReferencia && fechaActual.getMonth() < mesActualReferencia) {
            fechaActual.setMonth(mesActualReferencia);
        }
        
        mesActualIndex = fechaActual.getMonth();
        mesSeleccionadoText = meses[mesActualIndex];
        mesSeleccionadoSpan.textContent = mesSeleccionadoText;

        actualizarAnioActual();
        actualizarClasesSeleccionado();
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
            
            const esAnioPasado = anioVisible < anioActualReferencia;
            const esMesPasadoEnAnioActual = anioVisible === anioActualReferencia && index < mesActualReferencia;

            if (esAnioPasado || esMesPasadoEnAnioActual) {
                item.classList.add('seleccionado');
            } else {
                item.classList.remove('seleccionado');
            }
        });

        const mesVisibleScroll = listaMesesDesplegable.querySelector(`.item-mes[data-mes-index="${mesVisible}"]`);
        if (mesVisibleScroll) {
            listaMesesDesplegable.scrollTop = mesVisibleScroll.offsetTop - (listaMesesDesplegable.clientHeight / 2) + (mesVisibleScroll.clientHeight / 2);
        } else {
            listaMesesDesplegable.scrollTop = 0;
        }
    }

    function inicializarMeses() {
        mesSeleccionadoSpan.textContent = mesSeleccionadoText;

        meses.forEach((mes, index) => {
            const itemMes = document.createElement('div');
            itemMes.classList.add('item-mes');
            itemMes.textContent = mes;
            itemMes.dataset.mesIndex = index;

            // Uso de 'click' para compatibilidad universal con toque y ratón
            itemMes.addEventListener('click', () => {
                const anioVisible = fechaActual.getFullYear();
                const esAnioPasado = anioVisible < anioActualReferencia;
                const esMesPasadoEnAnioActual = anioVisible === anioActualReferencia && index < mesActualReferencia;

                if (!esAnioPasado && !esMesPasadoEnAnioActual) {
                    fechaActual.setMonth(index);
                    mesSeleccionadoText = mes;
                    mesSeleccionadoSpan.textContent = mes;
                    mesActualIndex = index;
                    actualizarClasesSeleccionado();
                    mostrarCalendario();
                    limpiarSeleccion();
                    cerrarDesplegable();
                }
            });

            listaMesesDesplegable.appendChild(itemMes);
        });
    }
    
    function limpiarSeleccion() {
        cuadriculaCalendario.querySelectorAll('.dia').forEach(d => d.classList.remove('seleccionado'));
        
        diaSeleccionado = null;
        estilistaSeleccionado = null;

        desplegableEstilista.innerHTML = '<option value="">Seleccione un día</option>';
        desplegableEstilista.disabled = true;

        desplegableHora.innerHTML = '<option value="">Seleccione un estilista</option>';
        desplegableHora.disabled = true;

        mostrarCitas(null);
    }

    async function obtenerDatosCalendario(anio, mes) {
        const diasEnMes = new Date(anio, mes + 1, 0).getDate();
        
        const generarDatosRandom = () => {
            alert('⚠️ Hubo un error cargando la disponibilidad. Mostrando disponibilidad aleatoria.');
            const datosRandom = {};
            for (let i = 1; i <= diasEnMes; i++) {
                const fecha = formatearFecha(i);
                const diaSemana = new Date(anio, mes, i).getDay(); 
                if (diaSemana === 0) {
                    datosRandom[fecha] = -1;
                } else {
                    datosRandom[fecha] = Math.floor(Math.random() * (MAX_CITAS + 1));
                }
            }
            return datosRandom;
        };

        try {
            const respuesta = await fetch(`${DISPONIBILIDAD_ENDPOINT}?anio=${anio}&mes=${mes + 1}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!respuesta.ok) {
                throw new Error('Respuesta no válida del servidor');
            }

            const datosBD = await respuesta.json();
            return datosBD;

        } catch (error) {
            console.error('Error al obtener disponibilidad de la BD:', error);
            return generarDatosRandom();
        }
    }
    
    async function cargarEstilistas(fecha) {
        desplegableEstilista.innerHTML = '';
        desplegableEstilista.disabled = true;
        estilistaSeleccionado = null;

        desplegableHora.innerHTML = '<option value="">Seleccione un estilista</option>';
        desplegableHora.disabled = true;

        try {
            const respuesta = await fetch(`${ESTILISTAS_DIA_ENDPOINT}?fecha=${fecha}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!respuesta.ok) {
                throw new Error('Error al cargar estilistas.');
            }

            const estilistas = await respuesta.json();
            
            if (estilistas.length > 0) {
                desplegableEstilista.disabled = false;
                desplegableEstilista.innerHTML = '<option value="">Seleccione un estilista</option>';
                estilistas.forEach(estilista => {
                    const option = document.createElement('option');
                    option.value = estilista.id;
                    option.textContent = estilista.nombre;
                    desplegableEstilista.appendChild(option);
                });
                desplegableEstilista.focus();
            } else {
                desplegableEstilista.innerHTML = '<option value="" disabled>No hay estilistas disponibles</option>';
            }

        } catch (error) {
            console.error('Error al obtener estilistas:', error);
            desplegableEstilista.innerHTML = '<option value="" disabled>Error al cargar estilistas</option>';
        }
    }

    async function cargarHorasEstilista(fecha, idEstilista) {
        desplegableHora.innerHTML = '';
        desplegableHora.disabled = true;
        
        try {
            const respuesta = await fetch(`${HORAS_ESTILISTA_ENDPOINT}?fecha=${fecha}&estilistaId=${idEstilista}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!respuesta.ok) {
                throw new Error('Error al cargar horas.');
            }

            const horas = await respuesta.json();
            
            if (horas.length > 0) {
                desplegableHora.disabled = false;
                desplegableHora.innerHTML = '<option value="">Seleccione una hora</option>';
                horas.forEach(hora => {
                    const option = document.createElement('option');
                    option.value = hora;
                    option.textContent = hora;
                    desplegableHora.appendChild(option);
                });
                desplegableHora.focus();
            } else {
                desplegableHora.innerHTML = '<option value="" disabled>Horas agotadas</option>';
            }

        } catch (error) {
            console.error('Error al obtener horas:', error);
            desplegableHora.innerHTML = '<option value="" disabled>Error al cargar horas</option>';
        }
    }

    // Nueva función unificada para manejar la selección del día (soporta click y touch)
    async function handleDaySelection(event) {
        if (event.type === 'touchstart') {
            isHandlingTouch = true;
            setTimeout(() => { isHandlingTouch = false; }, 500);
        } else if (event.type === 'click' && isHandlingTouch) {
            return; // Evita la doble ejecución si touchstart ya se manejó
        }

        const diaElemento = event.currentTarget;
        if (diaElemento.classList.contains('estado-agotado') || diaElemento.classList.contains('estado-cerrado')) {
            return;
        }

        cuadriculaCalendario.querySelectorAll('.dia').forEach(d => d.classList.remove('seleccionado'));
        diaElemento.classList.add('seleccionado');

        diaSeleccionado = diaElemento;

        const dia = diaElemento.dataset.day;
        const fechaParaCitas = formatearFecha(dia);
        
        await cargarEstilistas(fechaParaCitas);
        await obtenerYCargarCitas(fechaParaCitas);
    }
    
    desplegableEstilista.addEventListener('change', async (event) => {
        const idEstilista = event.target.value;
        const dia = diaSeleccionado.dataset.day;
        const fecha = formatearFecha(dia);

        if (idEstilista) {
            estilistaSeleccionado = idEstilista;
            await cargarHorasEstilista(fecha, idEstilista);
        } else {
            estilistaSeleccionado = null;
            desplegableHora.innerHTML = '<option value="">Seleccione un estilista</option>';
            desplegableHora.disabled = true;
        }
    });

    async function obtenerYCargarCitas(fecha) {
        try {
            const respuesta = await fetch(`${CITAS_DIA_ENDPOINT}?fecha=${fecha}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!respuesta.ok) {
                throw new Error('Error al cargar las citas del día.');
            }

            const datosCitas = await respuesta.json();
            mostrarCitas(datosCitas);

        } catch (error) {
            console.error('Error al obtener citas del día:', error);
            mostrarCitas([]);
        }
    }

    function mostrarCalendario() {
        const headers = Array.from(cuadriculaCalendario.querySelectorAll('.nombre-dia'));
        cuadriculaCalendario.innerHTML = '';
        headers.forEach(h => cuadriculaCalendario.appendChild(h));

        const anio = fechaActual.getFullYear();
        const mes = fechaActual.getMonth();
        obtenerDatosCalendario(anio, mes).then(datosCitas => {
            const primerDiaSemana = new Date(anio, mes, 1).getDay();
            const diasEnMes = new Date(anio, mes + 1, 0).getDate();

            const inicioSemana = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1; 
            const diaAnterior = new Date(anio, mes, 0).getDate();
            for (let i = inicioSemana; i > 0; i--) {
                const dia = document.createElement('div');
                dia.classList.add('dia', 'dia-mes-anterior');
                dia.textContent = diaAnterior - i + 1;
                cuadriculaCalendario.appendChild(dia);
            }

            for (let dia = 1; dia <= diasEnMes; dia++) {
                const fechaStr = formatearFecha(dia);
                const citas = datosCitas[fechaStr] || 0;
                const diaElemento = document.createElement('div');
                diaElemento.classList.add('dia');
                diaElemento.textContent = dia;
                diaElemento.dataset.day = dia;

                const esPasado = anio < anioActualReferencia ||
                    (anio === anioActualReferencia && mes < mesActualReferencia) ||
                    (anio === anioActualReferencia && mes === mesActualReferencia && dia < diaActualReferencia);
                
                let estado;
                if (esPasado) {
                    estado = 'cerrado'; 
                } else if (citas === -1 || new Date(anio, mes, dia).getDay() === 0) {
                    estado = 'cerrado';
                } else if (citas >= MAX_CITAS) {
                    estado = 'agotado';
                } else {
                    estado = 'disponible';
                    // Añado touchstart para una respuesta más rápida en táctil, y click para compatibilidad
                    diaElemento.addEventListener('click', handleDaySelection);
                    diaElemento.addEventListener('touchstart', handleDaySelection);
                }

                diaElemento.classList.add(`estado-${estado}`);
                if (estado !== 'disponible') {
                    diaElemento.style.cursor = 'not-allowed';
                }
                cuadriculaCalendario.appendChild(diaElemento);
            }

            const totalCeldas = cuadriculaCalendario.children.length - 7;
            const celdasFaltantes = 42 - (totalCeldas % 42); 
            for (let i = 1; i <= celdasFaltantes && (totalCeldas + i) <= 42; i++) {
                const dia = document.createElement('div');
                dia.classList.add('dia', 'dia-mes-siguiente');
                dia.textContent = i;
                cuadriculaCalendario.appendChild(dia);
            }
            limpiarSeleccion(); 
        }).catch(error => {
            console.error("Error al mostrar el calendario:", error);
            alert('No se pudo cargar el calendario. Intente de nuevo más tarde.');
        });
    }

    function mostrarCitas(citas) {
        cuerpoTablaCitas.innerHTML = '';

        if (!citas || citas.length === 0) {
            const filaVacia = document.createElement('tr');
            filaVacia.innerHTML = `
                <td class="col-num" colspan="4" style="text-align: center;">No hay citas agendadas para este día.</td>
            `;
            cuerpoTablaCitas.appendChild(filaVacia);
            return;
        }

        citas.forEach((cita, index) => {
            const fila = document.createElement('tr');
            fila.classList.add('fila-cita');
            fila.innerHTML = `
                <td class="col-num">${String(index + 1).padStart(2, '0')}</td>
                <td class="col-nombre">${cita.nombre}</td>
                <td class="col-servicio">${cita.servicio}</td>
                <td class="col-horario">${cita.horario} hs</td>
            `;
            cuerpoTablaCitas.appendChild(fila);
        });
    }

    btnAgendar.addEventListener('click', async () => {
        const horaSeleccionada = desplegableHora.value;
        const diaNumero = diaSeleccionado ? diaSeleccionado.dataset.day : null;
        const fechaCompleta = diaNumero ? formatearFecha(diaNumero) : null;
        
        // **Ajuste clave aquí:** Se usa el servicioId almacenado en datosPersonales.
        // Si datosPersonales fue cargado correctamente, datosPersonales.servicioId debe existir.
        const servicioId = datosPersonales.servicioId; 
        
        if (!fechaCompleta || !horaSeleccionada || !estilistaSeleccionado || !servicioId) {
            alert('Por favor, seleccione una fecha, un estilista y una hora. Asegúrese de que el servicio esté cargado.');
            return;
        }

        const datosReserva = {
            cliente: datosPersonales.nombre,
            telefono: datosPersonales.telefono,
            correo: datosPersonales.correo,
            servicioId: servicioId, // Utiliza la variable obtenida de datosPersonales
            fecha: fechaCompleta,
            hora: horaSeleccionada,
            estilistaId: estilistaSeleccionado
        };

        try {
            const respuesta = await fetch(AGENDAR_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(datosReserva)
            });

            if (respuesta.ok) {
                alert('¡Cita agendada con éxito!');
                localStorage.removeItem('datosCliente');
                window.location.href = 'confirmacion.html';
            } else {
                const errorData = await respuesta.json();
                throw new Error(errorData.mensaje || 'Error al agendar la cita.');
            }

        } catch (error) {
            console.error('Error al agendar:', error);
            alert(`No se pudo agendar la cita: ${error.message}`);
        }
    });

    btnAnioAnterior.addEventListener('click', () => cambiarAnio(-1));
    btnAnioSiguiente.addEventListener('click', () => cambiarAnio(1));
    
    // Uso de touchstart y click para el desplegable del mes
    selectorMesActual.addEventListener('click', alternarDesplegable);
    selectorMesActual.addEventListener('touchstart', (event) => {
        event.preventDefault(); // Evita el "click fantasma" en algunos dispositivos
        alternarDesplegable();
    });
    
    document.addEventListener('click', (event) => {
        if (!selectorMesActual.contains(event.target) && !listaMesesDesplegable.contains(event.target)) {
            cerrarDesplegable();
        }
    });

    inicializarMeses();
    actualizarAnioActual();
    mostrarCalendario();
});