const API_URL = "Thttps://script.google.com/macros/s/AKfycbxsIeeCCXUivsVibD8mtWIdt0AqUmsVgkhFt7XtHlPmcsO1p5yX7QTjkQNnkOoADcpc/exec";
let globalData = {};

window.onload = function() {
  cargarDatos();
};

function cargarDatos() {
  fetch(API_URL)
    .then(res => res.json())
    .then(data => {
      globalData = data;
      renderTabs(Object.keys(data));
    })
    .catch(err => document.getElementById('cardsContainer').innerHTML = "Error al cargar datos.");
}

function renderTabs(hojas) {
  const container = document.getElementById('tabsContainer');
  container.innerHTML = '';
  hojas.forEach((hoja, i) => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (i === 0 ? ' active' : '');
    btn.innerText = hoja;
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderRows(hoja);
    };
    container.appendChild(btn);
  });
  if (hojas.length > 0) renderRows(hojas[0]);
}

function renderRows(hoja) {
  const container = document.getElementById('cardsContainer');
  const filas = globalData[hoja];
  if (!filas || filas.length === 0) {
    container.innerHTML = '<div style="color:var(--dim);text-align:center;padding:10px;">Sin registros</div>';
    return;
  }
  let html = '';
  filas.forEach(fila => {
    const validas = fila.filter(c => c !== "" && c !== null);
    if (validas.length === 0) return;
    let titulo = validas[0];
    let sub = validas.length > 1 ? validas.slice(1, -1).join(' • ') : '';
    let val = validas.length > 1 ? validas[validas.length - 1] : '';
    html += `
      <div class="item-card">
        <div class="item-info">
          <span class="item-title">${titulo}</span>
          ${sub ? `<span class="item-sub">${sub}</span>` : ''}
        </div>
        <div class="item-price">${val}</div>
      </div>`;
  });
  container.innerHTML = html;
}

function analizarFactura(input) {
  if (input.files.length === 0) return;
  const file = input.files[0];
  const msg = document.getElementById('mensaje');
  msg.innerText = "Leyendo factura con IA...";

  const reader = new FileReader();
  reader.onload = function(e) {
    const base64 = e.target.result.split(',')[1];
    fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ accion: "procesarFactura", bytes: base64, mimeType: file.type, filename: file.name })
    })
    .then(res => res.json())
    .then(res => {
      if(res.status === "success") {
        document.getElementById('categoria').value = res.concepto;
        if(res.monto) document.getElementById('monto').value = res.monto;
        if(res.vencimiento) document.getElementById('descripcion').value = res.vencimiento;
        msg.innerText = "¡Datos extraídos con éxito!";
      } else {
        msg.innerText = "Completá los datos a mano.";
      }
    });
  };
  reader.readAsDataURL(file);
}

function guardarMovimiento(e) {
  e.preventDefault();
  const msg = document.getElementById('mensaje');
  msg.innerText = "Guardando...";

  const datos = {
    accion: "registrar",
    monto: document.getElementById('monto').value,
    categoria: document.getElementById('categoria').value,
    descripcion: document.getElementById('descripcion').value,
    fecha: new Date().toLocaleDateString()
  };

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(datos)
  })
  .then(res => res.json())
  .then(res => {
    msg.innerText = res.mensaje;
    document.getElementById('gastoForm').reset();
    document.getElementById('archivoFactura').value = "";
    cargarDatos();
    setTimeout(() => msg.innerText = '', 3000);
  });
}
