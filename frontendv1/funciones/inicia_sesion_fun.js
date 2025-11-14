document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('.sesion-card form');
    const LOGIN_ENDPOINT = 'http://localhost:3000/api/auth/login';

    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        const formData = new FormData(form);

        const datosLogin = {
            correo: formData.get('email'),       // name="email" en tu HTML
            password: formData.get('contrasena') // name="contrasena" en tu HTML
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
                window.location.href = 'principal_trabajador.html';
            } else {
                alert(resultado.error || 'Credenciales incorrectas.');
            }
        } catch (error) {
            alert('Error de conexión con el servidor.');
            console.error(error);
        }
    });
});