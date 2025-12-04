// URL base del API
//const API_BASE_URL = 'http://localhost:3000/api';
const API_BASE_URL ='https://gestion-citas-salon.onrender.com/api';

// Estado local
let listaServicios = [];
const userToken = localStorage.getItem('user_token'); 
const userRol = localStorage.getItem('user_rol'); 

// Validación de seguridad al inicio
if (!userToken) {
    console.warn("No hay token de usuario.");
}

document.addEventListener('DOMContentLoaded', () => {
    // Verificación de Acceso
    if (!userToken || userRol !== 'Administrador') {
        window.location.href = 'inicia_sesion.html'; 
        console.error("Redirigiendo a login...");
        return;
    } 
    
    cargarServicios();
    inicializarEventos();
});

function inicializarEventos() {
    // 1. Botón Añadir Nuevo Servicio
    const btnAdd = document.querySelector('.barra-herramientas button:first-child');
    if(btnAdd) {
        btnAdd.addEventListener('click', agregarFilaNueva);
    }

    // 2. Búsqueda
    const inputBusqueda = document.querySelector('.entrada-busqueda');

    if (inputBusqueda) {
        inputBusqueda.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = inputBusqueda.value.trim().toLowerCase();
                filtrarServiciosLocalmente(query);
            }
        });
        
        inputBusqueda.addEventListener('input', (e) => {
            const query = e.target.value.trim().toLowerCase();
            filtrarServiciosLocalmente(query);
        });
    }

    // Se eliminó el listener del botón "Guardar Global" ya que no es necesario.
}

// FUNCIONES AUXILIARES DE TIEMPO

/**
 * Convierte decimal (1.5) a objeto {h: 1, m: 30}
 */
function decimalAHoraMinuto(decimal) {
    const totalHoras = parseFloat(decimal) || 0;
    const horas = Math.floor(totalHoras);
    const minutos = Math.round((totalHoras - horas) * 60);
    return { horas, minutos };
}

/**
 * Convierte horas y minutos a decimal para la BD
 */
function horaMinutoADecimal(horas, minutos) {
    return parseFloat(horas) + (parseFloat(minutos) / 60);
}

// --- LÓGICA DE CARGA DE DATOS ---

async function cargarServicios() {
    try {
        const response = await fetch(`${API_BASE_URL}/servicios`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });

        if (!response.ok) throw new Error('Error al conectar con el servidor');

        const data = await response.json();
        listaServicios = data;
        renderizarTabla(listaServicios);

    } catch (error) {
        console.error("Error al cargar servicios:", error);
        const tbody = document.querySelector('.tabla-datos tbody');
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Error de conexión</td></tr>';
    }
}

function filtrarServiciosLocalmente(query) {
    if (!query) {
        renderizarTabla(listaServicios);
        return;
    }
    const filtrados = listaServicios.filter(s => 
        s.nombre_servicio.toLowerCase().includes(query)
    );
    renderizarTabla(filtrados);
}

// --- LÓGICA DE RENDERIZADO ---

function renderizarTabla(servicios) {
    const tbody = document.querySelector('.tabla-datos tbody');
    tbody.innerHTML = '';

    if (servicios.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No se encontraron servicios</td></tr>';
        return;
    }

    servicios.forEach(serv => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-id-servicio', serv.id_servicio);

        const claseEstado = serv.estado === 'Activo' ? 'estado-activo' : 'estado-inactivo';
        
        // Convertir decimal a formato legible "1h 30m"
        const tiempo = decimalAHoraMinuto(serv.duracion_horas);
        const textoDuracion = `${tiempo.horas}h ${tiempo.minutos > 0 ? tiempo.minutos + 'm' : ''}`;

        tr.innerHTML = `
            <td data-label="ID" class="columna-id">${serv.id_servicio}</td>
            <td data-label="Nombre del Servicio" class="celda-nombre">${serv.nombre_servicio}</td>
            <td data-label="Duración" class="celda-duracion">${textoDuracion}</td>
            <td data-label="Precio" class="celda-precio">${parseFloat(serv.precio).toFixed(2)}</td>
            <td data-label="Estado" class="celda-estado">
                <span class="etiqueta-estado ${claseEstado}">${serv.estado}</span>
            </td>
            <td class="celda-acciones">
                <button class="btn-accion btn-editar" title="Editar">
                    <i data-lucide="edit-3" class="w-5 h-5 icono-editar"></i>
                </button>
                <button class="btn-accion btn-eliminar" title="Eliminar">
                    <i data-lucide="trash-2" class="w-5 h-5 icono-eliminar"></i>
                </button>
            </td>
        `;

        tr.querySelector('.btn-editar').addEventListener('click', () => activarEdicion(tr, serv));
        tr.querySelector('.btn-eliminar').addEventListener('click', () => confirmarEliminacion(serv.id_servicio, tr));

        tbody.appendChild(tr);
    });

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// LÓGICA DE AÑADIR (Crear)

function agregarFilaNueva() {
    const tbody = document.querySelector('.tabla-datos tbody');
    if(document.querySelector('.fila-nueva')) return;

    const tr = document.createElement('tr');
    tr.classList.add('fila-nueva');
    
    // HTML con dos inputs para el tiempo y validación min="0"
    tr.innerHTML = `
        <td class="columna-id"><span class="badge-nuevo">Nuevo</span></td>
        <td class="celda-nombre">
            <input type="text" class="input-tabla" placeholder="Nombre Servicio" id="new-nombre">
        </td>
        <td class="celda-duracion" style="display:flex; align-items:center; gap:5px;">
            <input type="number" min="0" class="input-tabla" placeholder="Hr" id="new-horas" style="width: 50px;">
            <span>:</span>
            <input type="number" min="0" max="59" class="input-tabla" placeholder="Min" id="new-minutos" style="width: 50px;">
        </td>
        <td class="celda-precio">
            <input type="number" min="0" step="0.01" class="input-tabla" placeholder="Precio" id="new-precio">
        </td>
        <td class="celda-estado">
            <span class="etiqueta-estado estado-activo">Activo</span>
        </td>
        <td class="celda-acciones">
            <button class="btn-accion btn-guardar-nuevo" title="Guardar">
                <i data-lucide="check" style="color:green; width:20px; height:20px;"></i>
            </button>
            <button class="btn-accion btn-cancelar-nuevo" title="Cancelar">
                <i data-lucide="x" style="color:red; width:20px; height:20px;"></i>
            </button>
        </td>
    `;

    tbody.insertBefore(tr, tbody.firstChild);
    lucide.createIcons();

    tr.querySelector('.btn-guardar-nuevo').addEventListener('click', () => guardarNuevoServicio(tr));
    tr.querySelector('.btn-cancelar-nuevo').addEventListener('click', () => {
        tr.remove();
        if(listaServicios.length === 0) renderizarTabla([]);
    });
}

async function guardarNuevoServicio(fila) {
    const nombre = fila.querySelector('#new-nombre').value.trim();
    const horas = fila.querySelector('#new-horas').value || 0;
    const minutos = fila.querySelector('#new-minutos').value || 0;
    const precio = fila.querySelector('#new-precio').value;

    // Validación de vacíos
    if (!nombre || !precio) {
        alert("Por favor completa el nombre y el precio.");
        return;
    }

    // Validación de Negativos
    if (parseFloat(precio) < 0 || parseFloat(horas) < 0 || parseFloat(minutos) < 0) {
        alert("El precio y la duración no pueden ser números negativos.");
        return;
    }

    // Convertir horas y minutos a decimal para la BD
    const duracionDecimal = horaMinutoADecimal(horas, minutos);

    if (duracionDecimal <= 0) {
         alert("La duración debe ser mayor a 0.");
         return;
    }

    const nuevoServicio = {
        nombre_servicio: nombre,
        duracion_horas: duracionDecimal,
        precio: parseFloat(precio)
    };

    try {
        const response = await fetch(`${API_BASE_URL}/servicios`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // 'Authorization': `Bearer ${userToken}` 
            },
            body: JSON.stringify(nuevoServicio)
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Error al crear servicio');

        alert('Servicio creado correctamente');
        cargarServicios(); 

    } catch (error) {
        console.error(error);
        alert(error.message);
    }
}

// LÓGICA DE EDICIÓN (Actualizar)

function activarEdicion(fila, servicioOriginal) {
    if (fila.classList.contains('modo-edicion')) return;
    fila.classList.add('modo-edicion');

    // Recuperar tiempos separados
    const { horas, minutos } = decimalAHoraMinuto(servicioOriginal.duracion_horas);

    // Renderizar inputs
    const celdaNombre = fila.querySelector('.celda-nombre');
    celdaNombre.innerHTML = `<input type="text" class="input-tabla" value="${servicioOriginal.nombre_servicio}">`;

    const celdaDuracion = fila.querySelector('.celda-duracion');
    // Usamos flexbox inline para acomodar los dos inputs
    celdaDuracion.innerHTML = `
        <div style="display:flex; align-items:center; gap:5px;">
            <input type="number" min="0" class="input-tabla input-horas" value="${horas}" style="width: 45px;">
            <span>h</span>
            <input type="number" min="0" max="59" class="input-tabla input-minutos" value="${minutos}" style="width: 45px;">
            <span>m</span>
        </div>
    `;

    const celdaPrecio = fila.querySelector('.celda-precio');
    celdaPrecio.innerHTML = `<input type="number" min="0" step="0.01" class="input-tabla" value="${servicioOriginal.precio}">`;

    const celdaEstado = fila.querySelector('.celda-estado');
    const estadoActual = servicioOriginal.estado;
    celdaEstado.innerHTML = `
        <select class="select-tabla">
            <option value="Activo" ${estadoActual === 'Activo' ? 'selected' : ''}>Activo</option>
            <option value="Inactivo" ${estadoActual === 'Inactivo' ? 'selected' : ''}>Inactivo</option>
        </select>
    `;

    // Botones
    const celdaAcciones = fila.querySelector('.celda-acciones');
    celdaAcciones.innerHTML = `
        <button class="btn-accion btn-confirmar" title="Confirmar">
            <i data-lucide="check" style="color:green;"></i>
        </button>
        <button class="btn-accion btn-cancelar" title="Cancelar">
            <i data-lucide="x" style="color:red;"></i>
        </button>
    `;
    lucide.createIcons();

    celdaAcciones.querySelector('.btn-confirmar').addEventListener('click', () => guardarEdicion(fila, servicioOriginal.id_servicio));
    celdaAcciones.querySelector('.btn-cancelar').addEventListener('click', () => {
        fila.classList.remove('modo-edicion');
        // Simplemente recargamos la tabla para volver al estado original
        const index = listaServicios.findIndex(s => s.id_servicio === servicioOriginal.id_servicio);
        if (index !== -1) renderizarTabla(listaServicios);
        else cargarServicios();
    });
}

async function guardarEdicion(fila, idServicio) {
    const nombre = fila.querySelector('.celda-nombre input').value.trim();
    const horas = fila.querySelector('.input-horas').value || 0;
    const minutos = fila.querySelector('.input-minutos').value || 0;
    const precio = fila.querySelector('.celda-precio input').value;
    const estado = fila.querySelector('.celda-estado select').value;

    // Validación de Negativos
    if (parseFloat(precio) < 0 || parseFloat(horas) < 0 || parseFloat(minutos) < 0) {
        alert("No se permiten valores negativos.");
        return;
    }

    const duracionDecimal = horaMinutoADecimal(horas, minutos);

    if (duracionDecimal <= 0) {
        alert("La duración total debe ser mayor a 0.");
        return;
   }

    const datosActualizados = {
        nombre_servicio: nombre,
        duracion_horas: duracionDecimal,
        precio: parseFloat(precio),
        estado: estado
    };

    try {
        const response = await fetch(`${API_BASE_URL}/servicios/${idServicio}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                // 'Authorization': `Bearer ${userToken}`
            },
            body: JSON.stringify(datosActualizados)
        });

        if (!response.ok) throw new Error('Error al actualizar servicio');

        alert('Servicio actualizado correctamente');
        cargarServicios();

    } catch (error) {
        console.error(error);
        alert('Error al guardar los cambios');
    }
}

// LÓGICA DE ELIMINACIÓN

async function confirmarEliminacion(idServicio, fila) {
    if (!confirm("¿Estás seguro de eliminar este servicio? Esta acción no se puede deshacer.")) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/servicios/${idServicio}`, {
            method: 'DELETE',
            headers: {
                // 'Authorization': `Bearer ${userToken}`
            }
        });

        const result = await response.json();

        if (!response.ok) {
            if (response.status === 409) {
                alert(result.error); 
            } else {
                throw new Error(result.error || 'Error al eliminar');
            }
            return;
        }

        fila.remove();
        listaServicios = listaServicios.filter(s => s.id_servicio !== idServicio);
        
        if(listaServicios.length === 0) {
            renderizarTabla([]);
        }

    } catch (error) {
        console.error(error);
        alert("No se pudo eliminar el servicio.");
    }
}
