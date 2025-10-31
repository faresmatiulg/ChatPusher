const API_BASE_URL = 'https://chat-backend-6odp.onrender.com';

let usuariosColores = {};
let contadorUsuarios = 0;

let pusher = null;
let channel = null;
let pusherEnabled = false;
let isAdmin = false;
let selectedContact = null;

// Función para manejar el cambio en el interruptor de administrador
function handleAdminToggle() {
    const adminToggle = document.getElementById('adminToggle');
    if (adminToggle) {
        adminToggle.addEventListener('change', function() {
            isAdmin = this.checked;
            console.log('Modo administrador: ' + (isAdmin ? 'Activado' : 'Desactivado'));
            
            // Mostrar u ocultar el panel lateral según el estado del administrador
            togglePanelLateral(isAdmin);
            
            // Cargar contactos si el panel está visible
            if (isAdmin) {
                cargarContactos();
                // Si activamos admin y hay un usuario seleccionado previamente, bloquear el input
                const usuarioInput = document.getElementById('usuario');
                if (usuarioInput && usuarioInput.value) {
                    usuarioInput.disabled = true;
                }
                // Actualizar subtítulo
                actualizarTituloConversacion();
            } else {
                // Al desactivar admin, limpiar selección y habilitar input
                const usuarioInput = document.getElementById('usuario');
                if (usuarioInput) {
                    usuarioInput.disabled = false;
                }
                selectedContact = null;
                deseleccionarContactoUI();
                // Volver a cargar el feed global
                cargarMensajes();
                // Limpiar subtítulo
                actualizarTituloConversacion();
            }
        });
    }
}

// Función para mostrar u ocultar el panel lateral
function togglePanelLateral(mostrar) {
    const panelLateral = document.getElementById('panelLateral');
    if (panelLateral) {
        if (mostrar) {
            panelLateral.classList.add('visible');
            document.body.classList.add('panel-visible');
        } else {
            panelLateral.classList.remove('visible');
            document.body.classList.remove('panel-visible');
        }
    }
}

// Función para cargar la lista de contactos
function cargarContactos() {
    fetch(`${API_BASE_URL}/api/users`)
        .then(async r => {
            if (!r.ok) {
                // Fallback: construir bandeja desde mensajes
                return cargarContactosDesdeMensajes();
            }
            const data = await r.json();
            const contactos = (data && Array.isArray(data.users)) ? data.users : [];
            if (!contactos.length) {
                // Fallback si está vacío
                return cargarContactosDesdeMensajes();
            }
            renderizarContactos(contactos);
            prepararBusquedaContactos(contactos);
        })
        .catch(() => {
            // Fallback por error de red o 404
            cargarContactosDesdeMensajes();
        });
}

function cargarContactosDesdeMensajes() {
    fetch(`${API_BASE_URL}/api/messages`)
        .then(r => r.json())
        .then(data => {
            const mensajes = Array.isArray(data.messages) ? data.messages : [];
            const contactos = construirContactosDesdeMensajes(mensajes);
            renderizarContactos(contactos);
            prepararBusquedaContactos(contactos);
        })
        .catch(() => {
            renderizarContactos([]);
        });
}

function construirContactosDesdeMensajes(mensajes) {
    const mapa = new Map();
    mensajes.forEach(m => {
        const nombre = (m.usuario || '').trim();
        if (nombre && !mapa.has(nombre)) {
            mapa.set(nombre, { id: nombre, nombre: nombre, estado: 'N/D' });
        }
        const dest = (m.destinatario || '').trim();
        if (dest && !mapa.has(dest)) {
            mapa.set(dest, { id: dest, nombre: dest, estado: 'N/D' });
        }
    });
    return Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
}

// Función para renderizar la lista de contactos
function renderizarContactos(contactos) {
    const listaContactos = document.getElementById('listaContactos');
    if (!listaContactos) return;
    
    listaContactos.innerHTML = '';
    
    contactos.forEach(contacto => {
        const contactoItem = document.createElement('div');
        contactoItem.className = 'contacto-item';
        contactoItem.dataset.id = contacto.id;
        
        const iniciales = obtenerIniciales(contacto.nombre);
        
        contactoItem.innerHTML = `
            <div class="contacto-avatar">${iniciales}</div>
            <div class="contacto-info">
                <div class="contacto-nombre">${contacto.nombre}</div>
                <div class="contacto-estado">${contacto.estado}</div>
            </div>
        `;
        
        contactoItem.addEventListener('click', function() {
            seleccionarContacto(contacto);
        });
        
        listaContactos.appendChild(contactoItem);
    });
}

// Función para obtener las iniciales de un nombre
function obtenerIniciales(nombre) {
    return nombre.split(' ')
        .map(n => n.charAt(0))
        .join('')
        .substring(0, 2)
        .toUpperCase();
}

// Función para manejar la selección de un contacto
function seleccionarContacto(contacto) {
    console.log('Contacto seleccionado:', contacto);
    // Guardar contacto seleccionado para conversación privada (solo admin)
    selectedContact = contacto;
    // En modo admin, el nombre del remitente puede ser 'Admin' si está vacío
    const usuarioInput = document.getElementById('usuario');
    if (usuarioInput && isAdmin && !usuarioInput.value) {
        usuarioInput.value = 'Admin';
    }
    
    // Destacar el contacto seleccionado
    resaltarContactoUI(contacto.id);
    // Actualizar subtítulo
    actualizarTituloConversacion();
    // Cargar mensajes filtrados
    cargarMensajes();
}

function deseleccionarContactoUI() {
    const contactosItems = document.querySelectorAll('.contacto-item');
    contactosItems.forEach(item => item.classList.remove('seleccionado'));
}

function resaltarContactoUI(id) {
    const contactosItems = document.querySelectorAll('.contacto-item');
    contactosItems.forEach(item => item.classList.remove('seleccionado'));
    const contactoSeleccionado = document.querySelector(`.contacto-item[data-id="${id}"]`);
    if (contactoSeleccionado) contactoSeleccionado.classList.add('seleccionado');
}

function prepararBusquedaContactos(contactos) {
    const inputBusqueda = document.getElementById('buscarContacto');
    if (!inputBusqueda) return;
    inputBusqueda.oninput = function() {
        const q = (this.value || '').toLowerCase();
        const filtrados = contactos.filter(c => (c.nombre || '').toLowerCase().includes(q));
        renderizarContactos(filtrados);
    };
}

function actualizarTituloConversacion() {
    const titulo = document.getElementById('tituloConversacion');
    if (!titulo) return;
    if (isAdmin && selectedContact && selectedContact.nombre) {
        titulo.textContent = `Conversación con: ${selectedContact.nombre}`;
    } else {
        titulo.textContent = '';
    }
}

async function initializePusher() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/pusher/config`);
        const config = await response.json();
        
        if (config.enabled) {
            pusher = new Pusher(config.key, {
                cluster: config.cluster
            });

            channel = pusher.subscribe('chat');
            
            channel.bind('new-message', function(data) {
                agregarMensaje(data);
            });

            pusherEnabled = true;
        } else {
            pusherEnabled = false;
        }
    } catch (error) {
        pusherEnabled = false;
    }
    
    // usar polling si pusher no funciona
    if (!pusherEnabled) {
        cargarMensajes();
        setInterval(cargarMensajes, 5000);
    } else {
        cargarMensajes();
    }
}

let ultimoMensajeCount = 0;

function cargarMensajes() {
    const url = (isAdmin && selectedContact && selectedContact.nombre)
        ? `${API_BASE_URL}/api/messages?usuario=${encodeURIComponent(selectedContact.nombre)}`
        : `${API_BASE_URL}/api/messages`;
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                return;
            }
            
            const container = document.getElementById('mensajes');
            if (!container) return;
            
            if (data.messages && data.messages.length !== ultimoMensajeCount) {
                container.innerHTML = '';
                ultimoMensajeCount = data.messages.length;
                
                if (data.messages.length > 0) {
                    data.messages.forEach(msg => {
                        agregarMensaje(msg, false);
                    });
                    container.scrollTop = container.scrollHeight;
                } else {
                    container.innerHTML = '<div class="sin-mensajes">No hay mensajes aún</div>';
                }
            }
        })
        .catch(error => {
            const container = document.getElementById('mensajes');
            if (container) {
                container.innerHTML = '<div class="sin-mensajes">Error de conexión</div>';
            }
        });
}

function agregarMensaje(msg, autoScroll = true) {
    const container = document.getElementById('mensajes');
    if (!container) return;

    const sinMensajes = container.querySelector('.sin-mensajes');
    if (sinMensajes) {
        sinMensajes.remove();
    }

    const usuarioActual = document.getElementById('usuario').value.trim();
    
    const div = document.createElement('div');
    
    // mensajes del usuario actual van a la derecha
    if (usuarioActual && msg.usuario === usuarioActual) {
        div.className = 'mensaje usuario-1';
    } else {
        div.className = 'mensaje usuario-2';
    }
    
    // Usar la hora local del navegador en lugar del timestamp del backend
    const ahora = new Date();
    const tiempo = ahora.toLocaleTimeString('es-PE', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
    });
    
    const esAdmin = (msg.tipo_usuario === 'admin');
    div.innerHTML = `
        <div class="contenido-mensaje-wrapper">
            ${esAdmin ? '<div class="rol">Administrador</div>' : ''}
            <div class="usuario">${msg.usuario}</div>
            <div class="contenido-mensaje">${msg.mensaje}</div>
            <div class="timestamp">${tiempo}</div>
        </div>
    `;
    
    container.appendChild(div);
    
    if (autoScroll) {
        container.scrollTop = container.scrollHeight;
    }
}

function enviarMensaje(event) {
    if (event) event.preventDefault();
    
    const usuario = document.getElementById('usuario').value.trim();
    const mensaje = document.getElementById('mensaje').value.trim();
    const mensajeInput = document.getElementById('mensaje');
    
    if (!usuario || !mensaje) {
        return false;
    }
    
    mensajeInput.value = '';
    mensajeInput.disabled = true;
    
    const data = {
        usuario: usuario,
        mensaje: mensaje,
        tipo_usuario: isAdmin ? 'admin' : 'cliente'
    };
    if (isAdmin && selectedContact && selectedContact.nombre) {
        data.destinatario = selectedContact.nombre;
    }
    
    fetch(`${API_BASE_URL}/api/send`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        mensajeInput.disabled = false;
        
        if (data.error) {
            mensajeInput.value = mensaje;
            return;
        }
        
        if (!pusherEnabled) {
            setTimeout(cargarMensajes, 100);
        }
    })
    .catch(error => {
        mensajeInput.disabled = false;
        mensajeInput.value = mensaje;
    });
    
    return false;
}

document.addEventListener('DOMContentLoaded', function() {
    cargarMensajes();
    initializePusher();
    handleAdminToggle();
    
    document.getElementById('mensaje').addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            enviarMensaje();
        }
    });
});

window.addEventListener('beforeunload', function() {
    if (pusher) {
        pusher.disconnect();
    }
});