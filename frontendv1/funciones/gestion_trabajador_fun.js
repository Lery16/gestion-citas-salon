// Comentario: URL base del backend para las peticiones API.
const API_BASE_URL = 'https://gestion-citas-salon.onrender.com/api';

// Variables de estado
let listaEmpleados = []; // Almacena los datos traídos del backend
let filasEliminadas = new Set(); // IDs de empleados a eliminar
let filasModificadas = new Map(); // IDs y datos de empleados modificados
let cambiosPendientes = false; // Bandera para activar el botón de guardar

const userToken = localStorage.getItem('user_token');
const userRol = localStorage.getItem('user_rol');
    
    // Comentario: Verificación de autenticación y rol de Administrador.
    if (!userToken || userRol !== 'Administrador') {
        window.location.href = 'inicia_sesion.html'; // Redirige si no es administrador
    }
    
document.addEventListener('DOMContentLoaded', () => {
    cargarEmpleados(); // Carga inicial (trae todos)
    inicializarEventos();
});

function inicializarEventos() {
    // 1. Navegación a Añadir Trabajador
    const btnAdd = document.querySelector('.btn-anadir');
    btnAdd.addEventListener('click', () => {
        window.location.href = 'agregar_trabajador_admin.html';
    });

    // 2. Búsqueda
    const inputBusqueda = document.querySelector('.entrada-busqueda');
    const btnBuscar = document.querySelector('.contenedor-busqueda + .btn-buscar'); // El botón al lado del input

    // Comentario: Llama a cargarEmpleados con el filtro ingresado.
    btnBuscar.addEventListener('click', () => {
        const query = inputBusqueda.value.trim();
        cargarEmpleados(query);
    });

    // Permitir buscar al dar Enter en el input
    inputBusqueda.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = inputBusqueda.value.trim();
            cargarEmpleados(query);
        }
    });

    // 3. Guardar Cambios
    const btnGuardar = document.querySelector('.btn-primario + .btn-guardar');
    btnGuardar.addEventListener('click', guardarCambiosGlobales);
    
    // Inicialmente deshabilitar botón guardar (opcional visualmente)
    actualizarEstadoBotonGuardar();
}

// --- FUNCIÓN DE CARGA (GET) ---
// Comentario: Función asíncrona para obtener la lista de empleados.
async function cargarEmpleados(filtro = '') {
    try {
        // Comentario: Construye la URL para filtrar o traer todos.
        const url = filtro 
            ? `${API_BASE_URL}/empleados?nombre=${encodeURIComponent(filtro)}` 
            : `${API_BASE_URL}/empleados`;
        
        const response = await fetch(url);
        
        if (!response.ok) throw new Error('Error en la respuesta del servidor');
        
        let data = await response.json();

        listaEmpleados = data;
        
        // Comentario: Limpia los estados de cambios/eliminaciones al recargar.
        filasEliminadas.clear();
        filasModificadas.clear();
        cambiosPendientes = false;
        
        actualizarEstadoBotonGuardar();
        renderizarTabla(listaEmpleados);
        
    } catch (error) {
        console.error("Error al cargar empleados:", error);
        alert("Error de conexión con el servidor");
        renderizarTabla([]);
    }
}

// --- RENDERIZADO DE TABLA ---
// Comentario: Dibuja las filas de la tabla con los datos de los empleados.
function renderizarTabla(empleados) {
    const tbody = document.querySelector('.tabla-empleados tbody');
    tbody.innerHTML = ''; // Limpiar tabla

    if (empleados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No se encontraron resultados</td></tr>';
        return;
    }

    empleados.forEach(emp => {
        // Comentario: Formatea la lista de servicios para mostrarla en HTML.
        const serviciosHTML = (Array.isArray(emp.servicios) && emp.servicios.length > 0)
        ? emp.servicios.join('<br>')
        : (typeof emp.servicios === 'string' && emp.servicios.trim() !== '' ? emp.servicios : 'Tareas Administrativas');

        
        // Definir clases según estado
        const claseEstado = emp.estado === 'Disponible' ? 'estado-disponible' : (emp.estado === 'Vacacionando' ? 'estado-vacacionando' : 'estado-vacacionando'); // Asumí clase para vacaciones
        const claseRol = emp.rol === 'Administrador' ? 'rol-admin' : 'rol-trabajador';

        const tr = document.createElement('tr');
        tr.setAttribute('data-id-empleado', emp.id);
        
        tr.innerHTML = `
            <td data-label="ID" class="columna-id">${emp.id}</td>
            <td data-label="Nombre" class="celda-nombre">${emp.nombre}</td>
            <td data-label="Apellido" class="celda-apellido">${emp.apellido}</td>
            <td data-label="Correo" class="celda-correo">${emp.correo}</td>
            <td data-label="Rol"><span class="etiqueta-rol ${claseRol}">${emp.rol}</span></td>
            <td data-label="Teléfono" class="celda-telefono">${emp.telefono}</td>
            <td data-label="Servicios Ofrecidos" class="celda-servicios">${serviciosHTML}</td>
            <td data-label="Estado">
                <div class="indicador-estado ${claseEstado}">
                    <span class="punto-estado"></span>${emp.estado}
                </div>
            </td>
            <td data-label="Acciones" class="celda-acciones">
                <button class="btn-accion btn-editar" title="Editar">
                    <i data-lucide="pencil" class="icono-editar" style="width: 16px; height: 16px;"></i>
                </button>
                <button class="btn-accion btn-eliminar" title="Eliminar">
                    <i data-lucide="trash-2" class="icono-eliminar" style="width: 16px; height: 16px;"></i>
                </button>
            </td>
        `;

        // Event Listeners para los botones de la fila
        tr.querySelector('.btn-editar').addEventListener('click', () => activarEdicion(tr, emp));
        tr.querySelector('.btn-eliminar').addEventListener('click', () => marcarParaEliminar(emp.id, tr));

        tbody.appendChild(tr);
    });

    // Comentario: Asegura que los iconos Lucide se carguen en las nuevas filas.
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// --- LÓGICA DE EDICIÓN (LAPIZ) ---
// Comentario: Transforma las celdas de texto a inputs/selects para la edición.
function activarEdicion(fila, empleadoOriginal) {
    if (fila.classList.contains('modo-edicion')) return; // Ya está editando
    fila.classList.add('modo-edicion');

    // 1. Nombre
    const celdaNombre = fila.querySelector('.celda-nombre');
    celdaNombre.innerHTML = `<input type="text" class="input-tabla" value="${empleadoOriginal.nombre}" placeholder="Nombre">`;

    // 2. Apellido
    const celdaApellido = fila.querySelector('.celda-apellido');
    celdaApellido.innerHTML = `<input type="text" class="input-tabla" value="${empleadoOriginal.apellido}" placeholder="Apellido">`;

    // 3. Correo
    const celdaCorreo = fila.querySelector('.celda-correo');
    celdaCorreo.innerHTML = `<input type="email" class="input-tabla" value="${empleadoOriginal.correo}">`;

    // 4. Teléfono
    const celdaTelefono = fila.querySelector('.celda-telefono');
    celdaTelefono.innerHTML = `<input type="text" class="input-tabla" value="${empleadoOriginal.telefono}">`;

    // 5. Servicios (Textarea solo si rol Trabajador)
    const celdaServicios = fila.querySelector('.celda-servicios');
    const serviciosTexto = Array.isArray(empleadoOriginal.servicios) 
        ? empleadoOriginal.servicios.join('\n') 
        : empleadoOriginal.servicios.replace(/<br>/g, '\n');

    if (empleadoOriginal.rol === 'Trabajador') {
        celdaServicios.innerHTML = `<textarea class="textarea-tabla" rows="4">${serviciosTexto}</textarea>`;
    }

    // 6. Estado
    const celdaEstado = fila.querySelector('.indicador-estado');
    const estadoActual = empleadoOriginal.estado; 
    celdaEstado.innerHTML = `
        <select class="select-tabla">
            <option value="Disponible" ${estadoActual === 'Disponible' ? 'selected' : ''}>Disponible</option>
            <option value="Vacacionando" ${estadoActual === 'Vacacionando' ? 'selected' : ''}>Vacacionando</option>
            ${estadoActual === 'Ocupado' ? '<option value="Ocupado" selected>Ocupado</option>' : ''}
        </select>
    `;

    // 7. Botones Confirmar / Cancelar
    const celdaAcciones = fila.querySelector('.celda-acciones');
    celdaAcciones.innerHTML = `
        <button class="btn-accion btn-confirmar" title="Confirmar Edición">
            <i data-lucide="check" style="width: 16px; height: 16px; color: green;"></i>
        </button>
        <button class="btn-accion btn-cancelar" title="Cancelar">
            <i data-lucide="x" style="width: 16px; height: 16px; color: red;"></i>
        </button>
    `;
    lucide.createIcons();

    // Comentario: Eventos para guardar o descartar los cambios en la fila.
    celdaAcciones.querySelector('.btn-confirmar').addEventListener('click', () => confirmarEdicionFila(fila, empleadoOriginal.id));
    celdaAcciones.querySelector('.btn-cancelar').addEventListener('click', () => renderizarTabla(listaEmpleados));
}

// Comentario: Procesa los datos de edición de la fila, registra los cambios.
function confirmarEdicionFila(fila, id) {
    // Buscar el empleado original para comparar
    const empleadoOriginal = listaEmpleados.find(e => e.id === id);
    if (!empleadoOriginal) {
        console.error('Empleado original no encontrado');
        return;
    }

    const nuevoNombre = fila.querySelector('.celda-nombre input').value;
    const nuevoApellido = fila.querySelector('.celda-apellido input').value;
    const nuevoCorreo = fila.querySelector('.celda-correo input').value;
    const nuevoTelefono = fila.querySelector('.celda-telefono input').value;
    const textareaServicios = fila.querySelector('.celda-servicios textarea');
    const rawServicios = textareaServicios ? textareaServicios.value : empleadoOriginal.servicios.join('\n'); // Obtener valor del textarea si existe
    const nuevoEstado = fila.querySelector('.select-tabla').value;
    
    // Obtener el apellido de la celda de edición si se habilitó
    const nuevoApellidoEnCelda = fila.querySelector('.celda-apellido input');
    const nuevoApellidoFinal = nuevoApellidoEnCelda ? nuevoApellidoEnCelda.value : empleadoOriginal.apellido;


    // VALIDACIÓN: Servicios (Máximo 12)
    // Comentario: Separa los servicios por línea y elimina espacios.
    const listaServicios = rawServicios.split(/\n/).map(s => s.trim()).filter(s => s !== '');
    
    if (empleadoOriginal.rol === 'Trabajador' && listaServicios.length > 12) {
        alert(`Error: El trabajador solo puede tener máximo 12 servicios. Has puesto ${listaServicios.length}.`);
        return; // No guardamos
    }

    // Objeto para almacenar solo los cambios
    const cambios = {};

    // Comentario: Compara los valores nuevos con los originales para detectar cambios.
    if (nuevoNombre !== empleadoOriginal.nombre) {
        cambios.nombre = nuevoNombre;
    }
    if (nuevoApellidoFinal !== empleadoOriginal.apellido) {
        cambios.apellido = nuevoApellidoFinal;
    }
    if (nuevoCorreo !== empleadoOriginal.correo) {
        cambios.correo = nuevoCorreo;
    }
    if (nuevoTelefono !== empleadoOriginal.telefono) {
        cambios.telefono = nuevoTelefono;
    }
    if (nuevoEstado !== empleadoOriginal.estado) {
        cambios.estado = nuevoEstado;
    }

    // Comentario: Normaliza y compara los arrays de servicios.
    const serviciosOriginales = Array.isArray(empleadoOriginal.servicios) 
        ? empleadoOriginal.servicios.slice().sort().join('|')
        : '';
    const serviciosNuevos = listaServicios.slice().sort().join('|');

    if (empleadoOriginal.rol === 'Trabajador' && serviciosNuevos !== serviciosOriginales) {
        cambios.servicios = listaServicios; // Guardamos el array de servicios
    }

    // Si no hay cambios, salimos.
    if (Object.keys(cambios).length === 0) {
        alert("No se detectaron cambios.");
        renderizarTabla(listaEmpleados); // Salir del modo edición
        return;
    }

    // Comentario: Almacena los cambios específicos en el Map para el PUT global.
    filasModificadas.set(id, cambios);
    cambiosPendientes = true;
    actualizarEstadoBotonGuardar();

    // Comentario: Actualiza la lista local (listaEmpleados) con los cambios.
    const index = listaEmpleados.findIndex(e => e.id === id);
    if (index !== -1) {
        // Aplicar solo los cambios al objeto local
        listaEmpleados[index] = {
            ...listaEmpleados[index],
            ...cambios,
            servicios: cambios.servicios || listaEmpleados[index].servicios // Asegurar que servicios se actualiza si está en cambios
        };
    }

    // Salir del modo edición
    renderizarTabla(listaEmpleados);
}

// --- LÓGICA DE ELIMINACIÓN ---
// Comentario: Marca el empleado para eliminación y lo oculta.
function marcarParaEliminar(id, fila) {
    if (!confirm("¿Estás seguro de que quieres eliminar a este empleado? Esta acción se aplicará al dar clic en 'Guardar Cambios'. (Desaparecerá de la vista ahora)")) {
        return;
    }

    // Ocultar visualmente
    fila.style.display = 'none';

    // Agregar a la lista de eliminados
    filasEliminadas.add(id);
    
    // Si estaba modificado, lo quitamos de modificados porque lo vamos a borrar
    if (filasModificadas.has(id)) {
        filasModificadas.delete(id);
    }

    cambiosPendientes = true;
    actualizarEstadoBotonGuardar();
}

// --- LÓGICA DE GUARDAR CAMBIOS (GLOBAL) ---
// Comentario: Envía las peticiones DELETE y PUT pendientes al backend.
async function guardarCambiosGlobales() {
    if (!cambiosPendientes) return;

    const btnGuardar = document.querySelector('.btn-primario + .btn-guardar');
    const textoOriginal = btnGuardar.innerHTML;
    
    btnGuardar.innerHTML = '<span>Guardando...</span>';
    btnGuardar.disabled = true;

    try {
        // --- 1. Procesar Eliminaciones ---
        // Comentario: Crea un array de promesas para cada DELETE.
        const promesasEliminacion = Array.from(filasEliminadas).map(id => 
            fetch(`${API_BASE_URL}/empleados/${id}`, {
                method: 'DELETE'
            }).then(response => {
                // Verificar si la petición de eliminación fue exitosa
                if (!response.ok) {
                    throw new Error(`DELETE falló para ID ${id}. Estado: ${response.status}`);
                }
                return response;
            })
        );

        // --- 2. Procesar Modificaciones ---
        // Comentario: Crea un array de promesas para cada PUT.
        const promesasModificacion = Array.from(filasModificadas).map(([id, datos]) => {
            return fetch(`${API_BASE_URL}/empleados/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(datos)
            }).then(async response => {
                
                // Comentario: Manejo de errores específicos del backend (ej. validación).
                if (response.status === 400) {
                    const errorBody = await response.json();
                    const invalidServices = errorBody.invalidServices.join(', ');
                    // Lanzamos un error descriptivo para el catch
                    throw new Error(`VALIDACIÓN: Los siguientes servicios no existen: ${invalidServices}.`);
                }

                // Verificar si la petición de modificación fue exitosa (cualquier 2xx)
                if (!response.ok) {
                    throw new Error(`PUT falló para ID ${id}. Estado: ${response.status}`);
                }
                return response;
            });
        });

        // Comentario: Espera que todas las promesas se resuelvan antes de continuar.
        await Promise.all([...promesasEliminacion, ...promesasModificacion]);

        // Si llegamos aquí, todo fue exitoso.
        alert("Cambios guardados exitosamente en la base de datos.");
        
        // Limpiar estados y recargar
        filasEliminadas.clear();
        filasModificadas.clear();
        cambiosPendientes = false;
        
        // Comentario: Recarga los datos desde el servidor para actualizar la vista.
        await cargarEmpleados();

    } catch (error) {
        console.error("Error al guardar:", error);
        
        // Mostrar el mensaje de error específico (incluye el error de validación 400)
        alert("Hubo un error al guardar los cambios: " + error.message);
    } finally {
        btnGuardar.innerHTML = textoOriginal;
        btnGuardar.disabled = false;
        actualizarEstadoBotonGuardar();
    }
}

// Comentario: Controla visualmente el estado del botón Guardar.
function actualizarEstadoBotonGuardar() {
    const btnGuardar = document.querySelector('.btn-primario + .btn-guardar');
    if (cambiosPendientes) {
        btnGuardar.classList.remove('deshabilitado');
        btnGuardar.style.opacity = '1';
        btnGuardar.style.cursor = 'pointer';
    } else {
        btnGuardar.classList.add('deshabilitado');
        btnGuardar.style.opacity = '0.5';
        btnGuardar.style.cursor = 'not-allowed';
    }
}