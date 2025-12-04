document.addEventListener("DOMContentLoaded", () => {
    // 1️⃣ Cargar datos del trabajador
    const LOGIN_PAGE = 'inicia_sesion.html'; // Página de login

    // Verificar token y rol
    const userToken = localStorage.getItem('user_token');
    const userRol = localStorage.getItem('user_rol');
    const userId = localStorage.getItem('user_id'); 

    if (!userToken || userRol !== 'Trabajador') {
        window.location.href = LOGIN_PAGE; // Redirige si no es trabajador
        return;
    }

    const hoy = new Date();
    const fechaMax = new Date();
    fechaMax.setFullYear(hoy.getFullYear() + 5); 

    // Referencias a elementos del DOM
    const inputFecha = document.querySelector("input[name='fecha']");
    const tablaBody = document.querySelector(".table-scroll-container tbody");
    const botonBuscar = document.querySelector(".btn-buscar");

    // Función principal para obtener y mostrar las citas
    const cargarCitas = async (fechaSeleccionada, userId) => {
        try {
            // URL con los parámetros fecha y userId
            const consultaURL = `http://localhost:3000/api/citas/listado?fecha=${encodeURIComponent(fechaSeleccionada)}&userId=${encodeURIComponent(userId)}`;
            
            const respuesta = await fetch(consultaURL);

            if (!respuesta.ok) throw new Error("Error al obtener los datos del servidor.");

            const datos = await respuesta.json();

            if (Array.isArray(datos) && datos.length === 0) { 
                tablaBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No hay registros para esta fecha</td></tr>`;
                return;
            }

            tablaBody.innerHTML = "";
            
            datos.forEach((fila, index) => {
                const tr = document.createElement("tr");
                tr.classList.add("data-row");
                const horaAMPM = new Date(`1970-01-01T${fila.hora}`).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });
                tr.innerHTML = `<td>${index + 1}</td><td>${fila.nombre}</td><td>${fila.dia}</td><td>${fila.servicio}</td><td>${horaAMPM}</td><td>${fila.precio}</td><td>${fila.estado}</td>`;
                tablaBody.appendChild(tr);
            });

        } catch (error) {
            console.error("Error:", error);
            alert("Error al conectar con el servidor o cargar los datos.");
        }
    };

    // 2️⃣ Inicializar Flatpickr
    flatpickr.localize(flatpickr.l10ns.es);
    flatpickr("input[name='fecha']", {
        dateFormat: "d/m/Y",
        locale: "es",
        allowInput: false,
        defaultDate: hoy,
        minDate: "today", 
        maxDate: fechaMax 
    });
    
    // 4️⃣ Cargar Citas Iniciales
    const fechaHoyFormato = hoy.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/');
    cargarCitas(fechaHoyFormato, userId);

    // 3️⃣ Escuchar botón Buscar
    botonBuscar.addEventListener("click", async () => {
        const fechaSeleccionada = inputFecha.value;
        if (!fechaSeleccionada) {
            alert("Por favor selecciona una fecha.");
            return;
        }
        cargarCitas(fechaSeleccionada, userId);
    });
});