document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('.sesion-card form');
    //const LOGIN_ENDPOINT = 'http://localhost:3000/api/auth/login';
    const LOGIN_ENDPOINT = 'https://gestion-citas-salon.onrender.com/api/auth/login';


    const LOGIN_PAGE = 'inicia_sesion.html';

    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        const formData = new FormData(form);

        const datosLogin = {
            correo: formData.get('email'),
            password: formData.get('contrasena')
        };

        try {
            const respuesta = await fetch(LOGIN_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datosLogin),
            });

            const resultado = await respuesta.json();

            if (respuesta.ok) {
                localStorage.setItem('user_token', resultado.token);
                localStorage.setItem('user_rol', resultado.rol);
                
                // Guardar el ID del usuario
                if (resultado.id_usuario) {
                    localStorage.setItem('user_id', resultado.id_usuario); 
                }
                
                if (resultado.rol === 'Administrador') {
                    window.location.href = 'panel_administrador.html';
                } else if (resultado.rol === 'Trabajador') {
                    window.location.href = 'panel_trabajador.html';
                } else {
                    window.location.href =  LOGIN_PAGE;
                }

            } else {
                alert(resultado.error || 'Credenciales incorrectas.');
            }
        } catch (error) {
            alert('Error de conexión con el servidor.');
            console.error(error);
        }
    });
});
