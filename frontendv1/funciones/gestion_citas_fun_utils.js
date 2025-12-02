/**
 * Archivo: utilidades
 * Funciones reutilizables y sin dependencia del DOM.
 */

// Convierte fecha input (DD/MM/YYYY) a ISO (YYYY-MM-DD) para backend.
window.parseDateToISO = function(value, inputFecha) {
    if (!value) return null;
    // Si la fecha fue seleccionada desde el calendario, usamos el valor ISO ya guardado.
    if (inputFecha.dataset.iso && inputFecha.value === value) return inputFecha.dataset.iso; 
    
    // Si fue ingresada manualmente, intentamos parsear.
    const parts = value.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return null;
}

// Formatea la fecha para mostrarla al usuario.
window.formatearFechaVisual = function(fechaString) {
    if (!fechaString) return '';
    const date = new Date(fechaString);
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    let horas = date.getHours();
    const ampm = horas >= 12 ? 'PM' : 'AM';
    horas = horas % 12; 
    horas = horas ? horas : 12; // La hora '0' debe ser '12'
    const minutos = String(date.getMinutes()).padStart(2, '0');
    return `${date.getDate()} ${meses[date.getMonth()]}, ${date.getFullYear()} - ${horas}:${minutos} ${ampm}`;
}