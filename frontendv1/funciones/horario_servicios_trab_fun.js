// --- Configuraciones ---
const API_BASE_URL = 'http://localhost:3000/api';
const POLLING_INTERVAL_MS = 120000; // 2 minutos

// --- Utilidades ---

/**
 * 1. Función de utilidad: Formatear hora
 * Convierte formato 24h (14:00:00) a 12h (02:00 PM)
 */
function formatTime(time24) {
    if (!time24) return '';
    const parts = time24.split(':');
    let hours = parseInt(parts[0]);
    const minutes = parts[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    // Asegura que los minutos tengan dos dígitos si es necesario (aunque el input ya lo tiene)
    return `${hours}:${minutes} ${ampm}`; 
}

// --- Funciones de Renderización de Secciones ---

/**
 * Función de utilidad: Generar el HTML de la sección completa.
 * @param {string} titulo El título de la sección.
 * @param {string} contenidoHTML El contenido específico (lista/grid) de la sección.
 * @param {string} listaClass La clase del contenedor de la lista/grid.
 * @returns {string} El HTML completo de la sección.
 */
function createSectionHTML(titulo, contenidoHTML, listaClass) {
    // Nota: Se elimina la clase 'seccion-dashboard' para evitar conflictos, ya que el HTML
    // proporcionado ya tiene las secciones, pero se reconstruye para el polling si no existe.
    return `
        <section class="seccion-dashboard" data-section-title="${titulo.replace(/\s/g, '-').toLowerCase()}">
            <h2 class="titulo-seccion">${titulo}</h2>
            <div class="${listaClass}">
                ${contenidoHTML}
            </div>
        </section>
    `;
}

/**
 * 2. Renderización del Horario Semanal
 * Inyecta toda la sección de horario en el contenedor principal del dashboard.
 */
function renderHorario(employeeSchedule) {
    // Selecciona el contenedor principal del dashboard del HTML proporcionado
    const dashboardContainer = document.querySelector('.contenido-dashboard'); 
    if (!dashboardContainer) return;

    // 1. Convertir array a objeto para acceso rápido por día
    const scheduleMap = employeeSchedule.reduce((acc, curr) => {
        // Aseguramos que el día se mapee correctamente
        acc[curr.dia] = curr; 
        return acc;
    }, {});

    const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    let horarioCardsHTML = '';

    diasSemana.forEach(dia => {
        const horario = scheduleMap[dia];
        let cardHTML = '';
        let className = 'tarjeta-horario ';

        // Usamos la misma lógica para determinar si es día laboral/libre/cerrado
        if (horario && horario.hora_apertura !== '00:00:00' && horario.hora_cierre !== '00:00:01') {
            // Caso: Día Laboral
            className += 'dia-laboral';
            const hora_entrada = formatTime(horario.hora_apertura);
            const hora_salida = formatTime(horario.hora_cierre);
            cardHTML = `
                <div class="dia-info">
                    <span class="hora-entrada">${hora_entrada}</span>
                    <span class="separador">-</span>
                    <span class="hora-salida">${hora_salida}</span>
                </div>
            `;
        } else {
            // Caso: Día Libre o Domingo (Cerrado)
            const esDomingo = (dia === 'Domingo');
            className += esDomingo ? 'dia-cerrado' : 'dia-libre';
            const etiqueta = esDomingo ? 'Cerrado' : 'Día Libre';
            const etiquetaClass = esDomingo ? 'etiqueta-cerrado' : 'etiqueta-libre';

            cardHTML = `
                <div class="dia-info">
                    <span class="${etiquetaClass}">${etiqueta}</span>
                </div>
            `;
        }
        
        horarioCardsHTML += `
            <article class="${className}">
                <div class="dia-nombre">${dia}</div>
                ${cardHTML}
            </article>
        `;
    });

    // Buscar la sección existente o crear un marcador para inyectar/reemplazar.
    // Usamos los selectores del HTML existente
    let horarioSectionContainer = dashboardContainer.querySelector('.lista-horarios');
    
    if (horarioSectionContainer) {
        // Solo reemplazamos el contenido de la lista si la sección ya está creada (para el polling)
        horarioSectionContainer.innerHTML = horarioCardsHTML;
    } else {
        // Si no existe (lo cual no debería pasar con el HTML dado), inyectamos la sección completa
        const newSectionHTML = createSectionHTML('Horario Semanal', horarioCardsHTML, 'lista-horarios');
        dashboardContainer.insertAdjacentHTML('beforeend', newSectionHTML);
    }
}


/**
 * 3. Renderización de Servicios
 * Inyecta toda la sección de servicios en el contenedor principal del dashboard.
 */
function renderServicios(employeeServices) {
    // Selecciona el contenedor principal del dashboard del HTML proporcionado
    const dashboardContainer = document.querySelector('.contenido-dashboard'); 
    if (!dashboardContainer) return;

    let serviciosCardsHTML = '';

    if (!employeeServices || employeeServices.length === 0) {
        serviciosCardsHTML = '<p>No hay servicios activos asignados.</p>';
    } else {
        employeeServices.forEach(servicio => {
            serviciosCardsHTML += `
                <article class="tarjeta-servicio">
                    <div class="nombre-servicio">${servicio.nombre_servicio}</div>
                </article>
            `;
        });
    }

    // Buscar la sección existente
    let serviciosSectionContainer = dashboardContainer.querySelector('.grid-servicios');

    if (serviciosSectionContainer) {
        // Solo reemplazamos el contenido del grid si la sección ya está creada (para el polling)
        serviciosSectionContainer.innerHTML = serviciosCardsHTML;
    } else {
        // Si no existe (lo cual no debería pasar con el HTML dado), inyectamos la sección completa
        const newSectionHTML = createSectionHTML('Servicios Habilitados', serviciosCardsHTML, 'grid-servicios');
        
        // La inyectamos DESPUÉS de la sección de Horario si existe, si no, al final.
        let horarioSection = dashboardContainer.querySelector('[data-section-title="horario-semanal"]');
        if (horarioSection) {
            horarioSection.insertAdjacentHTML('afterend', newSectionHTML);
        } else {
            dashboardContainer.insertAdjacentHTML('beforeend', newSectionHTML);
        }
    }
}

// --- Funciones de Fetch Separadas ---

/**
 * 4a. Fetch Horario Semanal (NO requiere employeeId)
 */
async function fetchAndRenderHorario() {
    // Endpoint asumido: /api/empleado/horario (sin ID en la URL, el backend lo obtiene del token)
    const HORARIO_URL = `${API_BASE_URL}/empleados/horario`; 
    
    try {
        const horarioResponse = await fetch(HORARIO_URL);
        if (!horarioResponse.ok) throw new Error(`Error al cargar el horario: ${horarioResponse.status}`);
        const horarioData = await horarioResponse.json();
        renderHorario(horarioData);
    } catch (error) {
        console.error('Error durante la actualización del horario:', error);
        // Opcional: Renderizar un estado de error en la UI
    }
}

/**
 * 4b. Fetch Servicios (SÍ requiere employeeId)
 */
async function fetchAndRenderServicios(employeeId) {
    // Endpoint: /api/empleados/:id/servicios (Requiere ID en la URL)
    const SERVICIOS_URL = `${API_BASE_URL}/empleados/${employeeId}/servicios`;

    try {
        const serviciosResponse = await fetch(SERVICIOS_URL);
        if (!serviciosResponse.ok) throw new Error(`Error al cargar los servicios: ${serviciosResponse.status}`);
        const serviciosData = await serviciosResponse.json();
        renderServicios(serviciosData);
    } catch (error) {
        console.error('Error durante la actualización de servicios:', error);
        // Opcional: Renderizar un estado de error en la UI
        renderServicios([]); // Llama a renderServicios con un array vacío para mostrar "No hay servicios..."
    }
}

// --- Inicialización ---

/**
 * 5. Inicialización y Polling
 */
document.addEventListener('DOMContentLoaded', () => {
    // Se recomienda enviar el token en el header de las peticiones fetch para seguridad.
    // Aquí solo se verifica si el usuario tiene un rol que le permite ver este dashboard.
    const userToken = localStorage.getItem('user_token');
    const userRol = localStorage.getItem('user_rol');

    const LOGIN_PAGE = 'inicia_sesion.html'; // Ajusta esto a tu ruta de inicio de sesión
    
    if (!userToken || userRol !== 'Trabajador') {
        window.location.href = LOGIN_PAGE; // Redirige si no es el rol esperado
        return;
    }
    
    // 1. Obtener ID del localStorage
    const employeeId = localStorage.getItem('user_id');

    // 2. Carga inicial inmediata del Horario (siempre se intenta)
    fetchAndRenderHorario(); 

    if (employeeId) {
        console.log(`ID de empleado encontrado: ${employeeId}. Cargando servicios.`);
        
        // 3. Carga inicial inmediata de Servicios (solo si hay ID)
        fetchAndRenderServicios(employeeId);
        
        // 4. Configurar actualización automática (Polling) de Horario y Servicios
        setInterval(() => {
            fetchAndRenderHorario();
            fetchAndRenderServicios(employeeId);
        }, POLLING_INTERVAL_MS);

    } else {
        console.error('Advertencia: ID de empleado no encontrado en localStorage. Solo se cargará el horario.');
        
        // 5. Configurar Polling solo para el Horario si no hay ID
        setInterval(() => {
            fetchAndRenderHorario();
        }, POLLING_INTERVAL_MS);
    }
});