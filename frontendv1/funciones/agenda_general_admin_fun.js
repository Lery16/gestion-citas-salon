// --- CONSTANTES DE IDIOMA (ESPAÑOL) ---
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DIAS_SEMANA_LETRAS = ["D", "L", "M", "W", "J", "V", "S"];

// --- ESTADO DE LA APLICACIÓN (CALENDARIO) ---
let fechaSeleccionada = new Date(); 
let anioVista, mesVista; 
let hoy = new Date();
hoy.setHours(0, 0, 0, 0); 

// --- SELECTORES DEL DOM ---
let botonCalendario, diaGrandeEl, diaSemanaEl, mesAnioEl, tiraSemanaEl;
let popupCalendario; 

// --- SELECTORES CUSTOM DROPDOWNS ---
let mesDropdownWrapper, anioDropdownWrapper;
let mesSelectBtn, anioSelectBtn;
let mesMenu, anioMenu;


/**
 * Se ejecuta cuando el DOM está listo.
 */
document.addEventListener('DOMContentLoaded', () => {
    
    // =================================================================
    // SELECTORES GLOBALES
    // =================================================================
    const menu = document.querySelector('.menu-opciones'); 
    const hamburger = document.querySelector('.menu_hamburguesa');
    popupCalendario = document.querySelector('.calendario-popup'); 

    // =================================================================
    // INICIO: LÓGICA DEL MENÚ HAMBURGUESA
    // =================================================================
    if (hamburger && menu) {
        hamburger.addEventListener('click', function(event) {
            event.stopPropagation();
            menu.classList.toggle('active');
        });
    }
    // =================================================================
    // FIN: LÓGICA DEL MENÚ HAMBURGUESA
    // =================================================================


    // =================================================================
    // INICIO: LÓGICA DE INICIALIZACIÓN DEL CALENDARIO
    // =================================================================
    
    // 1. Encontrar los elementos HTML existentes
    botonCalendario = document.querySelector('.boton-calendario');
    diaGrandeEl = document.querySelector('.info-fecha .dia-grande');
    diaSemanaEl = document.querySelector('.info-fecha .dia-semana');
    mesAnioEl = document.querySelector('.info-fecha .mes-anio');
    tiraSemanaEl = document.querySelector('.dias-semana-tira');

    // N u e v o s   S e l e c t o r e s   p a r a   D r o p d o w n s   C u s t o m
    if (popupCalendario) {
        mesDropdownWrapper = popupCalendario.querySelector('.mes-dropdown-wrapper');
        anioDropdownWrapper = popupCalendario.querySelector('.anio-dropdown-wrapper');
        mesSelectBtn = popupCalendario.querySelector('.mes-select-btn');
        anioSelectBtn = popupCalendario.querySelector('.anio-select-btn');
        mesMenu = popupCalendario.querySelector('.mes-select-menu');
        anioMenu = popupCalendario.querySelector('.anio-select-menu');
    }


    if (botonCalendario && diaGrandeEl && diaSemanaEl && mesAnioEl && tiraSemanaEl && popupCalendario && mesSelectBtn) {
        
        // 2. Inicializar y Asignar Eventos a Dropdowns Personalizados
        iniciarDropdownMeses();
        iniciarDropdownAnios();

        // Eventos para abrir/cerrar
        mesSelectBtn.addEventListener('click', (e) => toggleDropdown(mesDropdownWrapper, e));
        anioSelectBtn.addEventListener('click', (e) => toggleDropdown(anioDropdownWrapper, e));
        
        // Eventos para seleccionar elementos (LI)
        mesMenu.addEventListener('click', (e) => handleDropdownSelection(e, 'mes'));
        anioMenu.addEventListener('click', (e) => handleDropdownSelection(e, 'anio'));
        
        // Rellenar cabecera de la cuadrícula de días con letras
        const gridHeader = popupCalendario.querySelector('.calendario-grid-header');
        gridHeader.innerHTML = DIAS_SEMANA_LETRAS.map(letra => `<span>${letra}</span>`).join('');
        
        // Asignar eventos internos del popup (Navegación y Grid)
        popupCalendario.querySelector('.prev-mes').addEventListener('click', () => cambiarMesVista(-1));
        popupCalendario.querySelector('.next-mes').addEventListener('click', () => cambiarMesVista(1));
        popupCalendario.querySelector('.calendario-grid-dias').addEventListener('click', seleccionarDiaDesdeGrid);

        // 3. Renderizar la UI con la fecha actual (hoy)
        actualizarTodaLaUI(fechaSeleccionada);

        // 4. Asignar eventos del calendario
        botonCalendario.addEventListener('click', toggleCalendarioPopup);
        tiraSemanaEl.addEventListener('click', seleccionarDiaDesdeTira);

    } else {
        console.warn("No se encontraron todos los elementos necesarios para el calendario.");
    }
    // =================================================================
    // FIN: LÓGICA DE INICIALIZACIÓN DEL CALENDARIO
    // =================================================================

    // =================================================================
    // LÓGICA GLOBAL: Cerrar Menú y Calendario al hacer clic fuera
    // =================================================================
    document.addEventListener('click', function(event) {
        
        // --- 1. CERRAR MENÚ HAMBURGUESA ---
        if (menu && hamburger) {
            if (menu.classList.contains('active') &&
                !menu.contains(event.target) &&
                !hamburger.contains(event.target)) {
                menu.classList.remove('active');
            }
        }

        // --- 2. CERRAR CALENDARIO POPUP Y DROPDOWNS CUSTOM ---
        if (popupCalendario && (popupCalendario.style.display === 'block' || popupCalendario.style.display === '')) {
             // CERRAR POPUP CALENDARIO
            if (!popupCalendario.contains(event.target) && !botonCalendario.contains(event.target)) {
                 popupCalendario.style.display = 'none';
            }
        }
        
        // CERRAR DROPDOWNS CUSTOM (incluso si el popup está abierto, para evitar que queden abiertos)
        if (mesDropdownWrapper && !mesDropdownWrapper.contains(event.target)) {
            mesDropdownWrapper.classList.remove('open');
        }
        if (anioDropdownWrapper && !anioDropdownWrapper.contains(event.target)) {
            anioDropdownWrapper.classList.remove('open');
        }
    });

});


// =================================================================
// LÓGICA DE DROPDOWNS PERSONALIZADOS
// =================================================================

/**
 * Inicializa el menú de meses con opciones LI.
 */
function iniciarDropdownMeses() {
    mesMenu.innerHTML = '';
    MESES.forEach((mes, index) => {
        const li = document.createElement('li');
        li.textContent = mes;
        li.dataset.value = index;
        mesMenu.appendChild(li);
    });
}

/**
 * Inicializa el menú de años con opciones LI.
 */
function iniciarDropdownAnios() {
    anioMenu.innerHTML = '';
    const anioActual = hoy.getFullYear();
    // Generar años desde el actual hasta +20 años
    for (let i = anioActual; i <= anioActual + 20; i++) {
        const li = document.createElement('li');
        li.textContent = i;
        li.dataset.value = i;
        anioMenu.appendChild(li);
    }
}

/**
 * Muestra u oculta un dropdown personalizado.
 */
function toggleDropdown(wrapper, event) {
    event.stopPropagation();
    
    // Si se hace clic en un dropdown, asegúrate de cerrar el otro
    if (wrapper === mesDropdownWrapper && anioDropdownWrapper) {
        anioDropdownWrapper.classList.remove('open');
    } else if (wrapper === anioDropdownWrapper && mesDropdownWrapper) {
        mesDropdownWrapper.classList.remove('open');
    }

    wrapper.classList.toggle('open');
}

/**
 * Maneja la selección de un elemento <li> dentro del menú.
 */
function handleDropdownSelection(event, type) {
    const li = event.target.closest('li');
    if (!li) return;

    const valor = parseInt(li.dataset.value);
    
    // 1. Ocultar el menú 
    let wrapper;
    if (type === 'mes') {
        wrapper = mesDropdownWrapper;
        setMesVista(valor); // Actualiza mesVista y renderiza
    } else if (type === 'anio') {
        wrapper = anioDropdownWrapper;
        setAnioVista(valor); // Actualiza anioVista y renderiza
    }

    // 2. Actualizar el estado visual del botón se hace dentro de actualizarDropdownVista
    //    que es llamada por setMesVista/setAnioVista (vía renderizarGridCalendario/actualizarDropdownVista)

    // 3. Cerrar el dropdown
    wrapper.classList.remove('open');
}

/**
 * Actualiza la apariencia del botón custom y marca el LI seleccionado.
 */
function actualizarDropdownVista(anio, mes) {
    // 1. Mes
    mesSelectBtn.textContent = MESES[mes];
    mesSelectBtn.dataset.currentVal = mes;
    mesMenu.querySelectorAll('li').forEach(li => {
        li.classList.remove('selected');
        if (parseInt(li.dataset.value) === mes) {
            li.classList.add('selected');
        }
    });

    // 2. Año
    anioSelectBtn.textContent = anio;
    anioSelectBtn.dataset.currentVal = anio;
    anioMenu.querySelectorAll('li').forEach(li => {
        li.classList.remove('selected');
        if (parseInt(li.dataset.value) === anio) {
            li.classList.add('selected');
        }
    });
}


// =================================================================
// LÓGICA DE FECHAS PRINCIPAL
// =================================================================

/**
 * Actualiza TODOS los elementos de la UI (info, botón, tira) basados en una fecha.
 * @param {Date} fecha - La nueva fecha seleccionada.
 */
function actualizarTodaLaUI(fecha) {
    fechaSeleccionada = fecha; 

    // 1. Actualizar .info-fecha
    diaGrandeEl.textContent = fecha.getDate();
    diaSemanaEl.textContent = DIAS_SEMANA[fecha.getDay()];
    mesAnioEl.textContent = MESES[fecha.getMonth()];

    // 2. Actualizar el botón con el año seleccionado
    botonCalendario.textContent = fecha.getFullYear();

    // 3. Actualizar .dias-semana-tira
    actualizarTiraSemana(fecha);

    // 4. (Comentado) Llamar a la función de consulta al backend
    consultarClientesBackend(fecha);
}

/**
 * Regenera la tira de 7 días de la semana.
 * @param {Date} fecha - La fecha seleccionada (será el día activo).
 */
function actualizarTiraSemana(fecha) {
    tiraSemanaEl.innerHTML = ''; 
    const diaSemanaSeleccionado = fecha.getDay(); 

    // Calcula el inicio de la semana (Domingo)
    const inicioSemana = new Date(fecha);
    inicioSemana.setDate(fecha.getDate() - diaSemanaSeleccionado);
    inicioSemana.setHours(0, 0, 0, 0); 

    for (let i = 0; i < 7; i++) {
        const diaActualTira = new Date(inicioSemana);
        diaActualTira.setDate(inicioSemana.getDate() + i);

        const letra = DIAS_SEMANA_LETRAS[i];
        const numero = diaActualTira.getDate();

        let claseDia = "dia";
        if (i === diaSemanaSeleccionado) {
            claseDia += " dia-activo";
        }

        // Comparamos el día, mes y año
        const esPasado = diaActualTira < hoy;

        if (esPasado) {
            claseDia += " dia-pasado";
        }

        tiraSemanaEl.innerHTML += `
            <div class="${claseDia}" data-fecha="${diaActualTira.toISOString().split('T')[0]}">
                <span class="letra">${letra}</span>
                <span class="numero">${numero}</span>
            </div>
        `;
    }
}

/**
 * Maneja el clic en uno de los 7 días de la tira superior.
 */
function seleccionarDiaDesdeTira(e) {
    const diaEl = e.target.closest('.dia');
    
    // Evita clics si no es un día o es el día activo o un día pasado
    if (!diaEl || diaEl.classList.contains('dia-activo') || diaEl.classList.contains('dia-pasado')) {
        return;
    }

    const fechaISO = diaEl.dataset.fecha;
    // La fechaISO es YYYY-MM-DD. Al parsear con split, obtenemos [YYYY, MM, DD].
    // Los meses en Date son 0-indexados, así que MM necesita -1.
    const parts = fechaISO.split('-').map(Number);
    const nuevaFecha = new Date(parts[0], parts[1] - 1, parts[2]);

    actualizarTodaLaUI(nuevaFecha);
}

// =================================================================
// LÓGICA DEL CALENDARIO POPUP
// =================================================================

/**
 * Muestra u oculta el calendario emergente (toggle).
 */
function toggleCalendarioPopup() {
    // Si está oculto, mostrar e inicializar
    if (popupCalendario.style.display === 'none' || popupCalendario.style.display === '') {
        // Inicializar la vista del calendario al abrir con la fecha seleccionada
        anioVista = fechaSeleccionada.getFullYear();
        mesVista = fechaSeleccionada.getMonth();

        // Actualizar la apariencia de los dropdowns personalizados
        actualizarDropdownVista(anioVista, mesVista);

        // Renderizar y mostrar
        renderizarGridCalendario(anioVista, mesVista);
        popupCalendario.style.display = 'block'; 
    } else {
        // Ocultar
        popupCalendario.style.display = 'none';
        // Asegurarse de que los dropdowns custom se cierren también
        mesDropdownWrapper.classList.remove('open');
        anioDropdownWrapper.classList.remove('open');
    }
}


/**
 * Oculta el popup (usado después de seleccionar un día).
 */
function ocultarCalendario() {
    popupCalendario.style.display = 'none';
    mesDropdownWrapper.classList.remove('open');
    anioDropdownWrapper.classList.remove('open');
}

/**
 * Dibuja los días en la cuadrícula del calendario para un mes y año dados.
 */
function renderizarGridCalendario(anio, mes) {
    const grid = document.querySelector('.calendario-grid-dias');
    grid.innerHTML = '';
    
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth();
    let esVistaPasada = false;

    // 1. Validación de Vista Pasada
    // Se valida si la vista actual está en el pasado. Si es así, se redirige a hoy.
    if (anio < anioActual || (anio === anioActual && mes < mesActual)) {
        // Esto solo debería ocurrir si alguien modifica el JS,
        // ya que los selectores están limitados.
        mesVista = mesActual;
        anioVista = anioActual;
        mes = mesVista;
        anio = anioVista;
        esVistaPasada = true; 
    }
    
    // 2. Actualizar la interfaz de los Dropdowns
    actualizarDropdownVista(anioVista, mesVista);

    // 3. Deshabilitar botón de mes anterior si estamos en el mes actual
    const prevMesBtn = document.querySelector('.cal-nav.prev-mes');
    prevMesBtn.disabled = (anio === anioActual && mes === mesActual);

    // 4. Lógica de la Cuadrícula
    const primerDiaMes = new Date(anio, mes, 1).getDay(); 
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();

    // Días del mes anterior (padding - siempre serán 'otro-mes')
    const diasMesAnterior = new Date(anio, mes, 0).getDate();
    for (let i = primerDiaMes; i > 0; i--) {
        const dia = diasMesAnterior - i + 1;
        grid.innerHTML += `<div class="calendario-dia otro-mes">${dia}</div>`;
    }

    // Días del mes actual
    for (let i = 1; i <= diasEnMes; i++) {
        const diaActual = new Date(anio, mes, i);
        diaActual.setHours(0, 0, 0, 0); // Limpiar horas para comparación
        let clases = "calendario-dia";
        let esPasado = (diaActual < hoy);

        if (esPasado) {
            clases += " dia-pasado";
        }
        if (diaActual.getTime() === hoy.getTime()) {
            clases += " hoy";
        }
        // Marcar el día seleccionado actualmente
        if (diaActual.getDate() === fechaSeleccionada.getDate() &&
            diaActual.getMonth() === fechaSeleccionada.getMonth() &&
            diaActual.getFullYear() === fechaSeleccionada.getFullYear()) {
            clases += " seleccionado";
        }

        grid.innerHTML += `<div class="${clases}" data-dia="${i}">${i}</div>`;
    }

    // Días del mes siguiente (padding)
    const diasMostrados = primerDiaMes + diasEnMes;
    const diasSiguientes = (Math.ceil(diasMostrados / 7) * 7) - diasMostrados;
    for (let i = 1; i <= diasSiguientes; i++) {
        grid.innerHTML += `<div class="calendario-dia otro-mes">${i}</div>`;
    }
}

/**
 * Maneja el clic en un día de la cuadrícula del calendario.
 */
function seleccionarDiaDesdeGrid(e) {
    const target = e.target;
    if (!target.classList.contains('calendario-dia') ||
        target.classList.contains('otro-mes') ||
        target.classList.contains('dia-pasado')) {
        return;
    }

    const dia = parseInt(target.dataset.dia);
    const nuevaFecha = new Date(anioVista, mesVista, dia);

    actualizarTodaLaUI(nuevaFecha);
    ocultarCalendario();
}

// --- Funciones de Navegación del Calendario ---

function cambiarMesVista(direccion) {
    mesVista += direccion;
    if (mesVista < 0) {
        mesVista = 11;
        anioVista--;
    } else if (mesVista > 11) {
        mesVista = 0;
        anioVista++;
    }
    
    // Limitar la navegación para no ir a meses anteriores al actual
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth();
    if (anioVista < anioActual || (anioVista === anioActual && mesVista < mesActual)) {
        anioVista = anioActual;
        mesVista = mesActual;
    }

    renderizarGridCalendario(anioVista, mesVista);
}

function setMesVista(mes) {
    // Asegurar que no se navegue a un mes pasado si el año es el actual
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth();
    if (anioVista === anioActual && mes < mesActual) {
        mesVista = mesActual;
    } else {
        mesVista = mes;
    }
    renderizarGridCalendario(anioVista, mesVista);
}

function setAnioVista(anio) {
    anioVista = anio;
    // Ajustar el mes si el año seleccionado es el actual y el mes en vista es pasado
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth();

    if (anioVista === anioActual && mesVista < mesActual) {
        mesVista = mesActual;
    }
    renderizarGridCalendario(anioVista, mesVista);
}

// =================================================================
// CONSULTA BACKEND (COMENTADO COMO PEDISTE)
// =================================================================

function consultarClientesBackend(fecha) {
    const anio = fecha.getFullYear();
    const mes = fecha.getMonth() + 1; 
    const dia = fecha.getDate();
    const fechaISO = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

    console.log(`COMENTARIO: Aquí se consultaría el backend por clientes para la fecha: ${fechaISO}`);
}