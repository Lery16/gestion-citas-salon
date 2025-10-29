document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('.sesion-card form');
    const LOGIN_ENDPOINT = 'http://localhost:3000/api/login'; 

    form.addEventListener('submit', async (evento) => {
        evento.preventDefault(); 
        const formData = new FormData(form);
        const datosLogin = {
            email: formData.get('email'),
            contrasena: formData.get('contrasena')
        };

        try {
            const respuesta = await fetch(LOGIN_ENDPOINT, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(datosLogin),
            });

            const resultado = await respuesta.json();

            if (respuesta.ok) {
                // Guardar info del trabajador en localStorage
                localStorage.setItem('usuario', JSON.stringify(resultado.trabajador));
                // Redirigir a la página principal del trabajador
                window.location.href = 'principal_trabajador.html';
            } else {
                alert(resultado.mensaje || 'Credenciales incorrectas.');
            }
        } catch (error) {
            alert('Error de conexión con el servidor.');
            console.error(error);
        }
    });
});