const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DIAS_SEMANA_LETRAS = ["D", "L", "M", "W", "J", "V", "S"];

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

document.addEventListener('DOMContentLoaded', () => {

    // ELEMENTOS HTML
    botonCalendario = document.querySelector('.boton-calendario');
    diaGrandeEl = document.querySelector('.info-fecha .dia-grande');
    diaSemanaEl = document.querySelector('.info-fecha .dia-semana');
    mesAnioEl = document.querySelector('.info-fecha .mes-anio');
    tiraSemanaEl = document.querySelector('.dias-semana-tira');
    
    popupCalendario = document.querySelector('.calendario-popup'); 
    
    // DROPDOWNS
    if (popupCalendario) {
        mesDropdownWrapper = popupCalendario.querySelector('.mes-dropdown-wrapper');
        anioDropdownWrapper = popupCalendario.querySelector('.anio-dropdown-wrapper');
        mesSelectBtn = popupCalendario.querySelector('.mes-select-btn');
        anioSelectBtn = popupCalendario.querySelector('.anio-select-btn');
        mesMenu = popupCalendario.querySelector('.mes-select-menu');
        anioMenu = popupCalendario.querySelector('.anio-select-menu');
    }

    if (botonCalendario && diaGrandeEl && diaSemanaEl && mesAnioEl && tiraSemanaEl && popupCalendario && mesSelectBtn) {
        
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

        actualizarTodaLaUI(fechaSeleccionada);

        botonCalendario.addEventListener('click', toggleCalendarioPopup);
        tiraSemanaEl.addEventListener('click', seleccionarDiaDesdeTira);

    } else {
        console.warn("No se encontraron todos los elementos necesarios para el calendario.");
    }

    // CLICK GLOBAL (solo calendario y dropdowns)
    document.addEventListener('click', function(event) {

        // CERRAR POPUP
        if (popupCalendario && (popupCalendario.style.display === 'block' || popupCalendario.style.display === '')) {
            if (!popupCalendario.contains(event.target) && !botonCalendario.contains(event.target)) {
                 popupCalendario.style.display = 'none';
            }
        }
        
        if (mesDropdownWrapper && !mesDropdownWrapper.contains(event.target)) {
            mesDropdownWrapper.classList.remove('open');
        }
        if (anioDropdownWrapper && !anioDropdownWrapper.contains(event.target)) {
            anioDropdownWrapper.classList.remove('open');
        }
    });
});

// --- FUNCIONES DROPDOWNS ---
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
    if (wrapper === mesDropdownWrapper && anioDropdownWrapper) {
        anioDropdownWrapper.classList.remove('open');
    } else if (wrapper === anioDropdownWrapper && mesDropdownWrapper) {
        mesDropdownWrapper.classList.remove('open');
    }
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
        li.classList.remove('selected');
        if (parseInt(li.dataset.value) === mes) {
            li.classList.add('selected');
        }
    });

    anioSelectBtn.textContent = anio;
    anioSelectBtn.dataset.currentVal = anio;
    anioMenu.querySelectorAll('li').forEach(li => {
        li.classList.remove('selected');
        if (parseInt(li.dataset.value) === anio) {
            li.classList.add('selected');
        }
    });
}

// --- LÓGICA DE FECHAS ---
function actualizarTodaLaUI(fecha) {
    fechaSeleccionada = fecha; 
    diaGrandeEl.textContent = fecha.getDate();
    diaSemanaEl.textContent = DIAS_SEMANA[fecha.getDay()];
    mesAnioEl.textContent = MESES[fecha.getMonth()];
    botonCalendario.textContent = fecha.getFullYear();
    actualizarTiraSemana(fecha);
    consultarClientesBackend(fecha);
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
        if (i === diaSemanaSeleccionado) {
            claseDia += " dia-activo";
        }

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

function seleccionarDiaDesdeTira(e) {
    const diaEl = e.target.closest('.dia');
    if (!diaEl || diaEl.classList.contains('dia-activo') || diaEl.classList.contains('dia-pasado')) {
        return;
    }
    const fechaISO = diaEl.dataset.fecha;
    const parts = fechaISO.split('-').map(Number);
    const nuevaFecha = new Date(parts[0], parts[1] - 1, parts[2]);
    actualizarTodaLaUI(nuevaFecha);
}

// --- POPUP CALENDARIO ---
function toggleCalendarioPopup() {
    if (popupCalendario.style.display === 'none' || popupCalendario.style.display === '') {
        anioVista = fechaSeleccionada.getFullYear();
        mesVista = fechaSeleccionada.getMonth();
        actualizarDropdownVista(anioVista, mesVista);
        renderizarGridCalendario(anioVista, mesVista);
        popupCalendario.style.display = 'block'; 
    } else {
        popupCalendario.style.display = 'none';
        mesDropdownWrapper.classList.remove('open');
        anioDropdownWrapper.classList.remove('open');
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
        let esPasado = (diaActual < hoy);

        if (esPasado) clases += " dia-pasado";
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
    if (anioVista === anioActual && mes < mesActual) {
        mesVista = mesActual;
    } else {
        mesVista = mes;
    }
    renderizarGridCalendario(anioVista, mesVista);
}

function setAnioVista(anio) {
    anioVista = anio;
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth();

    if (anioVista === anioActual && mesVista < mesActual) {
        mesVista = mesActual;
    }
    renderizarGridCalendario(anioVista, mesVista);
}

function consultarClientesBackend(fecha) {
    const anio = fecha.getFullYear();
    const mes = fecha.getMonth() + 1; 
    const dia = fecha.getDate();
    const fechaISO = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    console.log(`Backend consulta: ${fechaISO}`);
}