/**
 * Archivo: utilidades
 * Funciones reutilizables y sin dependencia del DOM.
 */

// Convierte fecha input (DD/MM/YYYY) a ISO (YYYY-MM-DD) para backend.
// Esta función prepara la fecha para el envío a la API.
window.parseDateToISO = function(value, inputFecha) {
    if (!value) return null;
    // Comprueba si ya tenemos el formato ISO guardado (ideal si se usó el selector).
    if (inputFecha.dataset.iso && inputFecha.value === value) return inputFecha.dataset.iso; 
    
    // Procesa formato manual DD/MM/YYYY.
    const parts = value.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return null;
}

// Formatea la fecha para mostrarla al usuario.
// Usamos este formato visual para una mejor experiencia de usuario.
window.formatearFechaVisual = function(fechaString) {
    if (!fechaString) return '';
    const date = new Date(fechaString);
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    let horas = date.getHours();
    const ampm = horas >= 12 ? 'PM' : 'AM';
    horas = horas % 12; 
    horas = horas ? horas : 12; // Convierte 0 a 12 (formato 12 horas).
    const minutos = String(date.getMinutes()).padStart(2, '0'); // Asegura dos dígitos para minutos.
    return `${date.getDate()} ${meses[date.getMonth()]}, ${date.getFullYear()} - ${horas}:${minutos} ${ampm}`;
}