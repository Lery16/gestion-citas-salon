document.addEventListener("DOMContentLoaded", () => {
    // 1️⃣ Cargar nombre y foto del trabajador
    const usuarioJSON = localStorage.getItem("usuario");
    if (usuarioJSON) {
        const trabajador = JSON.parse(usuarioJSON);
        document.querySelector(".nombre-trabajador").textContent = trabajador.nombre || "Trabajador";
        if (trabajador.foto) {
            document.querySelector(".perfil-img").src = trabajador.foto;
        }
    }

    // 2️⃣ Inicializar Flatpickr
    flatpickr.localize(flatpickr.l10ns.es);
    flatpickr("input[name='fecha']", {
        dateFormat: "d/m/Y",
        locale: "es",
        allowInput: false
    });

    // 3️⃣ Escuchar botón Buscar
    const botonBuscar = document.querySelector(".btn-buscar");
    const inputFecha = document.querySelector("input[name='fecha']");
    const tablaBody = document.querySelector(".table-scroll-container tbody");

    botonBuscar.addEventListener("click", async () => {
        const fechaSeleccionada = inputFecha.value;
        if (!fechaSeleccionada) {
            alert("Por favor selecciona una fecha.");
            return;
        }

        try {
            const respuesta = await fetch(`http://localhost:3000/api/historial?fecha=${encodeURIComponent(fechaSeleccionada)}`);
            if (!respuesta.ok) throw new Error("Error al obtener los datos del servidor.");
            
            const datos = await respuesta.json();
            tablaBody.innerHTML = "";

            if (datos.length === 0) {
                tablaBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No hay registros para esta fecha</td></tr>`;
                return;
            }

            datos.forEach((fila, index) => {
                const tr = document.createElement("tr");
                tr.classList.add("data-row");
                tr.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${fila.nombre}</td>
                    <td>${fila.dia}</td>
                    <td>${fila.servicio}</td>
                    <td>${fila.horario}</td>
                    <td>${fila.precio}</td>
                `;
                tablaBody.appendChild(tr);
            });
        } catch (error) {
            console.error("Error:", error);
            alert("Error al conectar con el servidor o cargar los datos.");
        }
    });
});