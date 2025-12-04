const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DIAS_SEMANA_LETRAS = ["D", "L", "M", "W", "J", "V", "S"];
// ** IMPORTANTE: Ajusta el endpoint de tu API **
const API_BASE_URL = 'http://localhost:3000/api'; // Asumiendo que tu backend corre en localhost:3000

let fechaSeleccionada = new Date(2025, 11, 10); // 10 de diciembre de 2025
let anioVista, mesVista;
let hoy = new Date();
hoy.setHours(0, 0, 0, 0);

let botonCalendario, diaGrandeEl, diaSemanaEl, mesAnioEl, tiraSemanaEl, popupCalendario;
let mesDropdownWrapper, anioDropdownWrapper, mesSelectBtn, anioSelectBtn, mesMenu, anioMenu;
let tablaAgendaBody; // Nuevo elemento para el cuerpo de la tabla de citas

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificación de Autenticación
    const userToken = localStorage.getItem('user_token');
    const userRol = localStorage.getItem('user_rol');
    if (!userToken || userRol !== 'Administrador') {
        window.location.href = LOGIN_PAGE;
        return;
    }

    // 2. Manejo de tarjetas del Dashboard (si aplica)
    const dashboardCards = document.querySelectorAll('.dashboard-card');
    dashboardCards.forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
            const urlDestino = card.getAttribute('data-url');
            if (urlDestino) window.location.href = urlDestino;
        });
    });

    // 3. Botón Cerrar Sesión
    const cerrarSesionBtn = document.getElementById('cerrarSesion');
    if (cerrarSesionBtn) {
        cerrarSesionBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('user_token');
            localStorage.removeItem('user_rol');
            window.location.href = LOGIN_PAGE;
        });
    }

    // 4. Asignación de Elementos del DOM
    botonCalendario = document.querySelector('.boton-calendario');
    diaGrandeEl = document.querySelector('.info-fecha .dia-grande');
    diaSemanaEl = document.querySelector('.info-fecha .dia-semana');
    mesAnioEl = document.querySelector('.info-fecha .mes-anio');
    tiraSemanaEl = document.querySelector('.dias-semana-tira');
    popupCalendario = document.querySelector('.calendario-popup');
    tablaAgendaBody = document.querySelector('.tabla-agenda tbody'); // Seleccionamos el <tbody>

    if (popupCalendario) {
        mesDropdownWrapper = popupCalendario.querySelector('.mes-dropdown-wrapper');
        anioDropdownWrapper = popupCalendario.querySelector('.anio-dropdown-wrapper');
        mesSelectBtn = popupCalendario.querySelector('.mes-select-btn');
        anioSelectBtn = popupCalendario.querySelector('.anio-select-btn');
        mesMenu = popupCalendario.querySelector('.mes-select-menu');
        anioMenu = popupCalendario.querySelector('.anio-select-menu');
    }

    // 5. Configuración del Calendario y Eventos
    if (botonCalendario && diaGrandeEl && mesSelectBtn) {
        iniciarDropdownMeses();
        iniciarDropdownAnios();

        mesSelectBtn.addEventListener('click', (e) => toggleDropdown(mesDropdownWrapper, e));
        anioSelectBtn.addEventListener('click', (e) => toggleDropdown(anioDropdownWrapper, e));
        mesMenu.addEventListener('click', (e) => handleDropdownSelection(e, 'mes'));
        anioMenu.addEventListener('click', (e) => handleDropdownSelection(e, 'anio'));

        const gridHeader = popupCalendario.querySelector('.calendario-grid-header');
        gridHeader.innerHTML = DIAS_SEMANA_LETRAS.map(letra => `<span>${letra}</span>`).join('');

        popupCalendario.querySelector('.prev-mes').addEventListener('click', () => cambiarMesVista(-1));
        popupCalendario.querySelector('.next-mes').addEventListener('click', () => cambiarMesVista(1));
        popupCalendario.querySelector('.calendario-grid-dias').addEventListener('click', seleccionarDiaDesdeGrid);

        // ** Punto de partida: Carga inicial de datos para la fecha de hoy **
        actualizarTodaLaUI(fechaSeleccionada);
        
        botonCalendario.addEventListener('click', toggleCalendarioPopup);
        tiraSemanaEl.addEventListener('click', seleccionarDiaDesdeTira);
    } else {
        console.warn("Elementos del calendario no encontrados en el DOM.");
    }

    // 6. Cerrar Popups al hacer clic fuera
    document.addEventListener('click', function(event) {
        if (popupCalendario && (popupCalendario.style.display === 'block' || popupCalendario.style.display === '')) {
            if (!popupCalendario.contains(event.target) && !botonCalendario.contains(event.target)) {
                popupCalendario.style.display = 'none';
            }
        }
        if (mesDropdownWrapper && !mesDropdownWrapper.contains(event.target)) mesDropdownWrapper.classList.remove('open');
        if (anioDropdownWrapper && !anioDropdownWrapper.contains(event.target)) anioDropdownWrapper.classList.remove('open');
    });
});

function iniciarDropdownMeses() {
    mesMenu.innerHTML = '';
    MESES.forEach((mes, index) => {
        const li = document.createElement('li');
        li.textContent = mes;
        li.dataset.value = index;
        mesMenu.appendChild(li);
    });
}

function iniciarDropdownAnios() {
    anioMenu.innerHTML = '';
    const anioActual = hoy.getFullYear();
    for (let i = anioActual; i <= anioActual + 20; i++) {
        const li = document.createElement('li');
        li.textContent = i;
        li.dataset.value = i;
        anioMenu.appendChild(li);
    }
}

function toggleDropdown(wrapper, event) {
    event.stopPropagation();
    if (wrapper === mesDropdownWrapper && anioDropdownWrapper) anioDropdownWrapper.classList.remove('open');
    else if (wrapper === anioDropdownWrapper && mesDropdownWrapper) mesDropdownWrapper.classList.remove('open');
    wrapper.classList.toggle('open');
}

function handleDropdownSelection(event, type) {
    const li = event.target.closest('li');
    if (!li) return;
    const valor = parseInt(li.dataset.value);
    let wrapper;
    if (type === 'mes') {
        wrapper = mesDropdownWrapper;
        setMesVista(valor);
    } else if (type === 'anio') {
        wrapper = anioDropdownWrapper;
        setAnioVista(valor);
    }
    wrapper.classList.remove('open');
}

function actualizarDropdownVista(anio, mes) {
    mesSelectBtn.textContent = MESES[mes];
    mesSelectBtn.dataset.currentVal = mes;
    mesMenu.querySelectorAll('li').forEach(li => {
        li.classList.toggle('selected', parseInt(li.dataset.value) === mes);
    });
    anioSelectBtn.textContent = anio;
    anioSelectBtn.dataset.currentVal = anio;
    anioMenu.querySelectorAll('li').forEach(li => {
        li.classList.toggle('selected', parseInt(li.dataset.value) === anio);
    });
}

// Convierte "HH:MM:SS" o "HH:MM" o un objeto Date a formato 12h con AM/PM: "1:30 PM"
function formatTime12(time) {
    if (!time && time !== '00:00:00') return 'N/A';

    // Si vienen como objeto Date
    if (time instanceof Date) {
        let h = time.getHours();
        let m = time.getMinutes();
        const ampm = h >= 12 ? 'pm' : 'am';
        h = h % 12;
        if (h === 0) h = 12;
        return `${h}:${String(m).padStart(2,'0')} ${ampm}`;
    }

    // Si viene como string "HH:MM:SS" o "HH:MM"
    const parts = String(time).split(':');
    if (parts.length < 2) return String(time); // fallback
    let hh = parseInt(parts[0], 10);
    const mm = parseInt(parts[1], 10);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return String(time);

    const ampm = hh >= 12 ? 'pm' : 'am';
    hh = hh % 12;
    if (hh === 0) hh = 12;
    return `${hh}:${String(mm).padStart(2,'0')} ${ampm}`;
}

/**
 * Actualiza todos los elementos de la interfaz: cabecera de fecha, tira semanal y llama a la consulta al backend.
 * @param {Date} fecha La fecha a establecer como seleccionada.
 */
function actualizarTodaLaUI(fecha) {
    fechaSeleccionada = fecha;
    diaGrandeEl.textContent = fecha.getDate();
    diaSemanaEl.textContent = DIAS_SEMANA[fecha.getDay()];
    mesAnioEl.textContent = `${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;
    botonCalendario.textContent = fecha.getFullYear();
    
    actualizarTiraSemana(fecha);
    
    // ** LLAMADA CRÍTICA: Obtener datos del backend y renderizarlos **
    obtenerYCargarCitas(fecha);
}

function actualizarTiraSemana(fecha) {
    tiraSemanaEl.innerHTML = '';
    const diaSemanaSeleccionado = fecha.getDay();
    const inicioSemana = new Date(fecha);
    inicioSemana.setDate(fecha.getDate() - diaSemanaSeleccionado);
    inicioSemana.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
        const diaActualTira = new Date(inicioSemana);
        diaActualTira.setDate(inicioSemana.getDate() + i);
        const letra = DIAS_SEMANA_LETRAS[i];
        const numero = diaActualTira.getDate();
        
        let claseDia = "dia";
        
        // Verifica si es el día seleccionado
        if (diaActualTira.toDateString() === fechaSeleccionada.toDateString()) claseDia += " dia-activo";
        
        // Verifica si es el día actual para el estilo 'hoy' (opcional, pero útil)
        if (diaActualTira.getTime() === hoy.getTime()) claseDia += " hoy";
        
        // Verifica si es un día pasado (después de la verificación de 'hoy' para no pisar estilos)
        if (diaActualTira < hoy && diaActualTira.toDateString() !== hoy.toDateString()) claseDia += " dia-pasado";

        tiraSemanaEl.innerHTML += `<div class="${claseDia}" data-fecha="${diaActualTira.toISOString().split('T')[0]}"><span class="letra">${letra}</span><span class="numero">${numero}</span></div>`;
    }
}

function seleccionarDiaDesdeTira(e) {
    const diaEl = e.target.closest('.dia');
    if (!diaEl) return;
    
    // Si ya está activo o es pasado, no hace nada (opcional, puedes dejar que seleccione días pasados si es necesario revisar historial)
    // if (diaEl.classList.contains('dia-activo')) return; 

    const fechaISO = diaEl.dataset.fecha;
    const parts = fechaISO.split('-').map(Number);
    // Nota: El mes en JS va de 0 a 11, por eso parts[1] - 1
    const nuevaFecha = new Date(parts[0], parts[1] - 1, parts[2]);
    actualizarTodaLaUI(nuevaFecha);
}

function toggleCalendarioPopup() {
    if (popupCalendario.style.display === 'none' || popupCalendario.style.display === '') {
        anioVista = fechaSeleccionada.getFullYear();
        mesVista = fechaSeleccionada.getMonth();
        actualizarDropdownVista(anioVista, mesVista);
        renderizarGridCalendario(anioVista, mesVista);
        popupCalendario.style.display = 'block';
    } else {
        ocultarCalendario();
    }
}

function ocultarCalendario() {
    popupCalendario.style.display = 'none';
    mesDropdownWrapper.classList.remove('open');
    anioDropdownWrapper.classList.remove('open');
}

function renderizarGridCalendario(anio, mes) {
    const grid = document.querySelector('.calendario-grid-dias');
    grid.innerHTML = '';
    
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth();
    
    // Ajustar mes/año vista si se navega a un mes/año pasado
    if (anio < anioActual || (anio === anioActual && mes < mesActual)) {
        mesVista = mesActual;
        anioVista = anioActual;
        mes = mesVista;
        anio = anioVista;
    }
    
    actualizarDropdownVista(anioVista, mesVista);
    
    const prevMesBtn = document.querySelector('.cal-nav.prev-mes');
    if(prevMesBtn) prevMesBtn.disabled = (anio === anioActual && mes === mesActual);

    const primerDiaMes = new Date(anio, mes, 1).getDay();
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();
    const diasMesAnterior = new Date(anio, mes, 0).getDate();

    for (let i = primerDiaMes; i > 0; i--) {
        const dia = diasMesAnterior - i + 1;
        grid.innerHTML += `<div class="calendario-dia otro-mes">${dia}</div>`;
    }

    for (let i = 1; i <= diasEnMes; i++) {
        const diaActual = new Date(anio, mes, i);
        diaActual.setHours(0, 0, 0, 0);
        let clases = "calendario-dia";
        
        if (diaActual < hoy) clases += " dia-pasado";
        if (diaActual.getTime() === hoy.getTime()) clases += " hoy";
        
        if (diaActual.getDate() === fechaSeleccionada.getDate() && 
            diaActual.getMonth() === fechaSeleccionada.getMonth() && 
            diaActual.getFullYear() === fechaSeleccionada.getFullYear()) {
            clases += " seleccionado";
        }
        grid.innerHTML += `<div class="${clases}" data-dia="${i}">${i}</div>`;
    }

    const diasMostrados = primerDiaMes + diasEnMes;
    const diasSiguientes = (Math.ceil(diasMostrados / 7) * 7) - diasMostrados;
    for (let i = 1; i <= diasSiguientes; i++) {
        grid.innerHTML += `<div class="calendario-dia otro-mes">${i}</div>`;
    }
}

function seleccionarDiaDesdeGrid(e) {
    const target = e.target;
    if (!target.classList.contains('calendario-dia') || target.classList.contains('otro-mes') || target.classList.contains('dia-pasado')) return;
    
    const dia = parseInt(target.dataset.dia);
    const nuevaFecha = new Date(anioVista, mesVista, dia);
    
    actualizarTodaLaUI(nuevaFecha);
    ocultarCalendario();
}

function cambiarMesVista(direccion) {
    mesVista += direccion;
    if (mesVista < 0) {
        mesVista = 11;
        anioVista--;
    } else if (mesVista > 11) {
        mesVista = 0;
        anioVista++;
    }
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth();
    if (anioVista < anioActual || (anioVista === anioActual && mesVista < mesActual)) {
        anioVista = anioActual;
        mesVista = mesActual;
    }
    renderizarGridCalendario(anioVista, mesVista);
}

function setMesVista(mes) {
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth();
    if (anioVista === anioActual && mes < mesActual) mesVista = mesActual;
    else mesVista = mes;
    renderizarGridCalendario(anioVista, mesVista);
}

function setAnioVista(anio) {
    anioVista = anio;
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth();
    if (anioVista === anioActual && mesVista < mesActual) mesVista = mesActual;
    renderizarGridCalendario(anioVista, mesVista);
}

/**
 * Llama al backend para obtener las citas de la fecha seleccionada.
 * @param {Date} fecha La fecha para la cual se consultarán las citas.
 */
async function obtenerYCargarCitas(fecha) {
    // Formatea la fecha al formato ISO (YYYY-MM-DD)
    const anio = fecha.getFullYear();
    const mes = fecha.getMonth() + 1;
    const dia = fecha.getDate();
    const fechaISO = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    
    // ** La consulta al backend ahora va a la ruta que configuraste **
    const API_ENDPOINT = `${API_BASE_URL}/citas/hoy?fecha=${fechaISO}`; 

    try {
        const token = localStorage.getItem('user_token');
        
        const response = await fetch(API_ENDPOINT, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`, // Envía el token para la autenticación
            }
        });

        if (!response.ok) {
            const errorDetalle = await response.json().catch(() => ({}));
            const mensajeError = errorDetalle.error || `Error del servidor: ${response.status} ${response.statusText}`;
            throw new Error(mensajeError);
        }

        const datos = await response.json();
        
        console.log(`[BACKEND OK] Citas recibidas para ${fechaISO}. Cantidad: ${datos.citas.length}`);
        
        // ** Llamada a la nueva función de renderizado **
        renderizarTablaAgenda(datos.citas);
        
    } catch (error) {
        console.error(`[ERROR FATAL] Fallo en la consulta de citas para la fecha ${fechaISO}:`, error.message);
        renderizarTablaAgenda([]); // Muestra la tabla vacía en caso de error
    }
}

/**
 * Renderiza el cuerpo de la tabla de la agenda con los datos de las citas.
 * @param {Array<Object>} citas Array de objetos de cita (ej: [{nombre_cliente, apellido_cliente, nombre_servicio, ...}])
 */
function renderizarTablaAgenda(citas) {
    console.log("Datos que llegan del backend:", citas);
    if (!tablaAgendaBody) return; // Asegurar que el elemento exista
    
    if (!citas || citas.length === 0) {
        tablaAgendaBody.innerHTML = `
           <tr>
                <td colspan="2" style="text-align: center; padding: 30px; color: #333333;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                        <span>No hay citas programadas para este día.</span>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    let html = '';
    citas.forEach((cita, index) => {
        // Se asume que el backend proporciona hora_fin, si no, se puede calcular aquí si se tiene la duración
        const horaInicio = formatTime12(cita.hora);
        const horaFin = cita.hora_fin ? formatTime12(cita.hora_fin) : 'N/A';

        const nombreCliente = `${cita.nombre_cliente} ${cita.apellido_cliente}`;
        const nombreEmpleado = `${cita.nombre_empleado} ${cita.apellido_empleado}`;
        const claseCita = index % 2 === 0 ? 'cita-clara' : 'cita-oscura';

        // Lógica simple para iniciales para las imágenes (solo visual)
        const inicialCliente = cita.nombre_cliente ? cita.nombre_cliente.charAt(0) : 'C';
        const inicialEmpleado = cita.nombre_empleado ? cita.nombre_empleado.charAt(0) : 'A';
        
        // Estilos de la tarjeta (clara/oscura)
        const bgColor = index % 2 === 0 ? 'f0b4bb' : 'f7f7f7'; // Colores de fondo (placehold.co)
        const textColor = index % 2 === 0 ? '4a4a4a' : 'f96c7a'; // Colores de texto/borde

        html += `
            <tr>
                <td class="celda-hora">
                    <div class="espacio-hora-tabla">
                        <span class="hora-inicio">${horaInicio}</span>
                        <span class="hora-fin">${horaFin}</span>
                    </div>
                </td>
                <td class="celda-servicio">
                    <div class="cita ${claseCita}">
                        <div class="indicador"></div>
                        <div class="cita-contenido">
                            <div class="info-servicio">
                                <span class="servicio-nombre">${cita.nombre_servicio}</span>
                                <span class="servicio-categoria">Cliente</span> <div class="info-persona">
                                    <img src="https://placehold.co/30x30/${bgColor}/${textColor}?text=${inicialCliente}" alt="Cliente" class="cliente-img">
                                    <span class="nombre-persona">${nombreCliente}</span>
                                </div>
                            </div>
                            <div class="info-asesor">
                                <img src="https://placehold.co/30x30/${bgColor}/${textColor}?text=${inicialEmpleado}" alt="Asesor" class="asesor-img">
                                <span class="nombre-persona">${nombreEmpleado}</span>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    });

    tablaAgendaBody.innerHTML = html;
}