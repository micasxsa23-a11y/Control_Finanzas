const API_URL = "TU_URL_DE_APPS_SCRIPT";
let globalData = {};

const fmtARS = (n) => {
  const num = Number(n);
  if (isNaN(num)) return n;
  return num.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
};

window.onload = () => cargarDatos();

function switchView(viewName, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + viewName).classList.add('active');
  document.querySelectorAll('.bottom-nav .nav-item').forEach(b => b.classList.remove('active'));
  if (btn && !btn.classList.contains('fab')) btn.classList.add('active');
}

function cargarDatos() {
  const feed = document.getElementById('cardsContainer');
  feed.innerHTML = '<div class="skeleton">Actualizando billetera...</div>';

  fetch(API_URL)
    .then(res => res.json())
    .then(data => {
      globalData = data;
      procesarKPIs(data["Presupuesto Base Cero"]);
      renderTabs(Object.keys(data));
    })
    .catch(() => {
      feed.innerHTML = '<div class="skeleton">Error de conexión con la planilla. Revisá la URL del script.</div>';
    });
}

function procesarKPIs(filas) {
  if (!filas) return;
  // En tu planilla la fila índice 4 (fila 5 de Sheets) tiene los totales globales
  filas.forEach(fila => {
    const num1 = parseFloat(fila[1]);
    const num2 = parseFloat(fila[4]);
    if (!isNaN(num1) && num1 > 100000 && !isNaN(num2)) {
      document.getElementById('kpiIngreso').innerText = fmtARS(fila[1]);
      document.getElementById('kpiGasto').innerText = fmtARS(fila[4]);
      document.getElementById('kpiDisponible').innerText = fmtARS(fila[5]);
      const pct = Math.min(Math.round((parseFloat(fila[6]) || 0) * 1000) / 10, 100);
      document.getElementById('kpiPorcentaje').innerText = pct + '%';
      document.getElementById('kpiBarra').style.width = pct + '%';
      if (fila[7]) document.getElementById('estadoBaseCero').innerText = fila[7];
    }
  });
}

function renderTabs(hojas) {
  const nav = document.getElementById('tabsContainer');
  nav.innerHTML = '';
  hojas.forEach((hoja, i) => {
    const btn = document.createElement('button');
    btn.className = 'pill-btn' + (i === 0 ? ' active' : '');
    btn.innerText = hoja;
    btn.onclick = () => {
      document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderCards(hoja);
    };
    nav.appendChild(btn);
  });
  if (hojas.length > 0) renderCards(hojas[0]);
}

function renderCards(hoja) {
  const container = document.getElementById('cardsContainer');
  const filas = globalData[hoja] || [];
  let html = '';

  filas.forEach(fila => {
    const col0 = String(fila[0] || '').trim();
    const col1 = String(fila[1] || '').trim();

    // Si es una fila de categoría tipo CAT-01 de Presupuesto Base Cero
    if (col0.startsWith('CAT-')) {
      const asignado = parseFloat(fila[2]) || 0;
      const real = parseFloat(fila[3]) || 0;
      const disp = parseFloat(fila[4]) || 0;
      const pct = Math.min(Math.round((parseFloat(fila[6]) || 0) * 100), 100);
      const estado = fila[7] || 'Activo';

      html += `
        <div class="cat-card">
          <div class="cat-top">
            <div class="cat-title-group">
              <span class="cat-code">${col0}</span>
              <span class="cat-name">${col1}</span>
            </div>
            <div class="cat-amounts">
              <div class="cat-real">${fmtARS(real)}</div>
              <div class="cat-budget">de ${fmtARS(asignado)}</div>
            </div>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: ${pct}%;"></div>
          </div>
          <div class="cat-bottom">
            <span>Disponible: <strong>${fmtARS(disp)}</strong> (${pct}%)</span>
            <span class="badge-done">${estado}</span>
          </div>
        </div>`;
    } else if (hoja !== "Presupuesto Base Cero" && col0 && !col0.includes("CONTROL") && col1) {
      // Para solapas de Movimientos o Boletas
      const monto = fila[3] !== undefined && fila[3] !== "" ? fmtARS(fila[3]) : '';
      html += `
        <div class="cat-card">
          <div class="cat-top">
            <div class="cat-title-group">
              <span class="cat-code">${col0}</span>
              <span class="cat-name">${col1}</span>
            </div>
            <div class="cat-amounts">
              <div class="cat-real">${monto}</div>
              <div class="cat-budget">${fila[2] || ''}</div>
            </div>
          </div>
        </div>`;
    }
  });

  container.innerHTML = html || '<div class="skeleton">No hay movimientos cargados en esta pestaña.</div>';
}

function analizarFactura(input) {
  if (input.files.length === 0) return;
  const file = input.files[0];
  document.getElementById('fileNameText').innerText = file.name;
  const msg = document.getElementById('mensaje');
  msg.innerText = "Escaneando importe y vencimiento...";

  const reader = new FileReader();
  reader.onload = function(e) {
    const base64 = e.target.result.split(',')[1];
    fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ accion: "procesarFactura", bytes: base64, mimeType: file.type, filename: file.name })
    })
    .then(res => res.json())
    .then(res => {
      if (res.status === "success") {
        document.getElementById('categoria').value = res.concepto || '';
        if (res.monto) document.getElementById('monto').value = res.monto;
        if (res.vencimiento) document.getElementById('descripcion').value = res.vencimiento;
        msg.innerText = "¡Datos leídos! Revisá y confirmá.";
      } else {
        msg.innerText = "Completá los campos manualmente.";
      }
    });
  };
  reader.readAsDataURL(file);
}

function guardarMovimiento(e) {
  e.preventDefault();
  const msg = document.getElementById('mensaje');
  msg.innerText = "Impactando en Google Sheets...";

  const datos = {
    accion: "registrar",
    monto: document.getElementById('monto').value,
    categoria: document.getElementById('categoria').value,
    descripcion: document.getElementById('descripcion').value,
    fecha: new Date().toLocaleDateString('es-AR')
  };

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(datos)
  })
  .then(res => res.json())
  .then(res => {
    msg.innerText = res.mensaje || "¡Guardado!";
    document.getElementById('gastoForm').reset();
    document.getElementById('fileNameText').innerText = "Tocar para subir factura (PDF / Imagen)";
    cargarDatos();
    setTimeout(() => {
      msg.innerText = '';
      switchView('dashboard', document.querySelector('.bottom-nav .nav-item'));
    }, 1500);
  });
}
