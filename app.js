const API_URL = "TU_URL_DE_APPS_SCRIPT";

let libroCompleto = {};
let vistaActual = "TODAS";
let archivoAdjuntoBase64 = null;

// Configuramos el worker de PDF.js
if (window['pdfjsLib']) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

window.onload = () => cargarDatos();

function cargarDatos() {
  const workspace = document.getElementById('tablesWorkspace');
  workspace.innerHTML = '<div class="loading-box">Sincronizando todas las solapas y celdas con Google Sheets...</div>';

  fetch(API_URL)
    .then(res => res.json())
    .then(data => {
      libroCompleto = data.hojas || data;
      if (data.nombreArchivo) {
        document.getElementById('sheetTitle').innerText = data.nombreArchivo;
      }
      extraerKPIsSuperiores();
      armarBotonesSolapas();
      dibujarTablas();
    })
    .catch(err => {
      workspace.innerHTML = `<div class="loading-box">No se pudo conectar con la planilla. Verificá que API_URL tenga tu enlace de Apps Script publicado.</div>`;
    });
}

function extraerKPIsSuperiores() {
  const hojaPbc = libroCompleto["Presupuesto Base Cero"];
  if (!hojaPbc) return;

  const selectCat = document.getElementById('codigoCategoria');
  selectCat.innerHTML = '<option value="">-- Solo registrar boleta --</option>';

  hojaPbc.forEach((fila, idx) => {
    const textoFila = fila.join(" ");
    if (textoFila.includes("Período:")) {
      document.getElementById('periodoText').innerText = fila.filter(Boolean).join(" • ");
    }

    // Detecta la fila donde están los encabezados de INGRESO NETO MENSUAL y lee la fila inmediatamente inferior
    if (fila[1] && String(fila[1]).toUpperCase().includes("INGRESO NETO") && hojaPbc[idx + 1]) {
      const vals = hojaPbc[idx + 1];
      document.getElementById('kpiIngreso').innerText = vals[1] || "$0,00";
      document.getElementById('kpiPresupuestado').innerText = vals[2] || "$0,00";
      document.getElementById('kpiSinAsignar').innerText = vals[3] || "$0,00";
      document.getElementById('kpiGastoReal').innerText = vals[4] || "$0,00";
      document.getElementById('kpiDisponible').innerText = vals[5] || "$0,00";
      document.getElementById('kpiPorcentaje').innerText = vals[6] || "0%";
      document.getElementById('kpiEstado').innerText = vals[7] || "✔ Base Cero";

      const numPct = parseFloat(String(vals[6]).replace(',', '.').replace('%', '')) || 0;
      document.getElementById('kpiBarra').style.width = Math.min(numPct, 100) + "%";
    }

    // Llena el desplegable de categorías CAT-XX para imputar boletas directo
    const col0 = String(fila[0] || "").trim();
    if (col0.startsWith("CAT-")) {
      const opt = document.createElement('option');
      opt.value = col0;
      opt.innerText = `${col0} - ${fila[1]} (Disp: ${fila[4]})`;
      selectCat.appendChild(opt);
    }
  });
}

function armarBotonesSolapas() {
  const bar = document.getElementById('tabsBar');
  bar.innerHTML = `<button class="tab-pill ${vistaActual === 'TODAS' ? 'active' : ''}" onclick="cambiarVistaHoja('TODAS', this)">Ver Todas las Solapas</button>`;

  Object.keys(libroCompleto).forEach(nombreHoja => {
    const btn = document.createElement('button');
    btn.className = 'tab-pill' + (vistaActual === nombreHoja ? ' active' : '');
    btn.innerText = nombreHoja;
    btn.onclick = () => cambiarVistaHoja(nombreHoja, btn);
    bar.appendChild(btn);
  });
}

function cambiarVistaHoja(nombre, btn) {
  vistaActual = nombre;
  document.querySelectorAll('.tab-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  dibujarTablas();
}

function dibujarTablas() {
  const workspace = document.getElementById('tablesWorkspace');
  workspace.innerHTML = '';

  const hojasAMostrar = vistaActual === 'TODAS'
    ? Object.keys(libroCompleto)
    : [vistaActual];

  hojasAMostrar.forEach(nombreHoja => {
    const filas = libroCompleto[nombreHoja] || [];
    if (filas.length === 0) return;

    const bloque = document.createElement('section');
    bloque.className = 'sheet-block';

    let htmlTabla = `
      <div class="sheet-block-header">
        <h3>📂 ${nombreHoja}</h3>
        <span style="font-size:0.78rem;color:var(--muted)">${filas.length} filas en planilla</span>
      </div>
      <div class="table-scroll">
        <table class="fin-table">
    `;

    // Si es Presupuesto Base Cero, armamos la tabla limpia desde donde empiezan las categorías
    if (nombreHoja === "Presupuesto Base Cero") {
      let headerIndex = filas.findIndex(r => String(r[0]).includes("N°") || String(r[1]).includes("Categoría"));
      if (headerIndex === -1) headerIndex = 0;

      const headers = filas[headerIndex];
      htmlTabla += `<thead><tr>${headers.map(h => `<th>${h || ''}</th>`).join('')}</tr></thead><tbody>`;

      for (let i = headerIndex + 1; i < filas.length; i++) {
        const r = filas[i];
        if (r.every(celda => !celda || String(celda).trim() === "")) continue;

        htmlTabla += `<tr class="searchable-row">`;
        r.forEach((celda, colIdx) => {
          const valor = String(celda || "").trim();
          if (colIdx === 0 && valor.startsWith("CAT-")) {
            htmlTabla += `<td><span class="code-tag">${valor}</span></td>`;
          } else if (colIdx === 6 && valor.includes("%")) {
            const pctNum = Math.min(parseFloat(valor.replace(',', '.').replace('%', '')) || 0, 100);
            htmlTabla += `
              <td>
                <div class="mini-progress">
                  <div class="mini-track"><div class="mini-fill" style="width:${pctNum}%"></div></div>
                  <span>${valor}</span>
                </div>
              </td>`;
          } else if (colIdx === 7 && valor) {
            htmlTabla += `<td><span class="state-tag">${valor}</span></td>`;
          } else {
            htmlTabla += `<td>${valor}</td>`;
          }
        });
        htmlTabla += `</tr>`;
      }
      htmlTabla += `</tbody></table></div>`;
    } else {
      // Cualquier otra solapa del Excel se dibuja completa con todas sus columnas y links
      const filasNoVacias = filas.filter(r => r.some(c => c && String(c).trim() !== ""));
      if (filasNoVacias.length > 0) {
        const primeraFila = filasNoVacias[0];
        htmlTabla += `<thead><tr>${primeraFila.map(h => `<th>${h || '-'}</th>`).join('')}</tr></thead><tbody>`;

        for (let i = 1; i < filasNoVacias.length; i++) {
          htmlTabla += `<tr class="searchable-row">`;
          filasNoVacias[i].forEach(c => {
            const val = String(c || "").trim();
            if (val.startsWith("http")) {
              htmlTabla += `<td><a href="${val}" target="_blank" style="color:var(--neon);font-weight:700;">Ver Comprobante ↗</a></td>`;
            } else {
              htmlTabla += `<td>${val}</td>`;
            }
          });
          htmlTabla += `</tr>`;
        }
        htmlTabla += `</tbody></table></div>`;
      }
    }

    bloque.innerHTML = htmlTabla;
    workspace.appendChild(bloque);
  });
}

function filtrarTablas(query) {
  const q = query.toLowerCase().trim();
  document.querySelectorAll('.searchable-row').forEach(tr => {
    tr.style.display = tr.innerText.toLowerCase().includes(q) ? '' : 'none';
  });
}

// Lector de PDF en el navegador con PDF.js: extrae todos los importes y fechas de vencimiento
async function procesarArchivoLocal(input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  document.getElementById('pdfFileName').innerText = file.name;
  const msg = document.getElementById('mensajeEstado');
  msg.innerText = "Analizando factura y buscando importes y vencimientos...";

  // Autocompleta el concepto con el nombre del archivo limpio
  const nombreLimpio = file.name.replace(/\.[^/.]+$/, "");
  document.getElementById('categoria').value = nombreLimpio;

  // Guardamos en base64 para enviar a Drive al confirmar
  const reader = new FileReader();
  reader.onload = function(e) {
    archivoAdjuntoBase64 = {
      bytes: e.target.result.split(',')[1],
      mimeType: file.type,
      filename: file.name
    };
  };
  reader.readAsDataURL(file);

  if (file.type === "application/pdf" && window['pdfjsLib']) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let textoCompleto = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        textoCompleto += content.items.map(item => item.str).join(" ") + "\n";
      }

      extraerDatosDeTextoFactura(textoCompleto);
    } catch (err) {
      msg.innerText = "PDF listo para subir. Ingresá el monto manualmente.";
    }
  } else {
    msg.innerText = "Imagen adjuntada lista para guardar.";
  }
}

function extraerDatosDeTextoFactura(texto) {
  const msg = document.getElementById('mensajeEstado');
  const chipsContainer = document.getElementById('chipsContainer');
  const montoChips = document.getElementById('montoChips');
  const fechaChips = document.getElementById('fechaChips');

  montoChips.innerHTML = '';
  fechaChips.innerHTML = '';

  // 1. Buscar todos los importes en formato argentino (ej: $ 24.580,50 o 24580.50)
  const regexMontos = /(?:\$|TOTAL|PAGAR|IMPORTE)\s*[:\.]?\s*\$?\s*(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}|\d{4,10}\.\d{2})/gi;
  const montosEncontrados = new Set();
  let match;

  while ((match = regexMontos.exec(texto)) !== null) {
    let raw = match[1].trim();
    if (raw.includes(',') && raw.includes('.')) {
      raw = raw.replace(/\./g, '').replace(',', '.');
    } else if (raw.includes(',')) {
      raw = raw.replace(',', '.');
    }
    const valorNum = parseFloat(raw);
    if (!isNaN(valorNum) && valorNum > 100) {
      montosEncontrados.add(valorNum.toFixed(2));
    }
  }

  // 2. Buscar todas las fechas dd/mm/yyyy o dd-mm-yyyy en el PDF
  const regexFechas = /\b(\d{2}[\/\-]\d{2}[\/\-](?:202\d|\d{2}))\b/g;
  const fechasEncontradas = new Set();
  while ((match = regexFechas.exec(texto)) !== null) {
    fechasEncontradas.add(match[1]);
  }

  const listaMontos = Array.from(montosEncontrados);
  const listaFechas = Array.from(fechasEncontradas);

  if (listaMontos.length > 0) {
    document.getElementById('monto').value = listaMontos[0];
    listaMontos.forEach(m => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip-btn';
      chip.innerText = '$' + Number(m).toLocaleString('es-AR', { minimumFractionDigits: 2 });
      chip.onclick = () => document.getElementById('monto').value = m;
      montoChips.appendChild(chip);
    });
  }

  if (listaFechas.length > 0) {
    document.getElementById('descripcion').value = "Vto: " + listaFechas[0];
    listaFechas.forEach(f => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip-btn';
      chip.innerText = '📅 ' + f;
      chip.onclick = () => document.getElementById('descripcion').value = "Vto: " + f;
      fechaChips.appendChild(chip);
    });
  }

  if (listaMontos.length > 0 || listaFechas.length > 0) {
    chipsContainer.classList.remove('hidden');
    msg.innerText = "¡Datos extraídos del PDF! Tocá otro chip si tiene 2° vencimiento.";
  } else {
    msg.innerText = "El PDF es una imagen escaneada sin texto seleccionable. Completá el importe a mano.";
  }
}

function guardarMovimiento(e) {
  e.preventDefault();
  const msg = document.getElementById('mensajeEstado');
  const btn = document.getElementById('btnGuardar');
  btn.disabled = true;
  msg.innerText = "Subiendo comprobante y actualizando planilla...";

  const payload = {
    accion: "registrar",
    monto: document.getElementById('monto').value,
    categoria: document.getElementById('categoria').value,
    descripcion: document.getElementById('descripcion').value,
    codigoCategoria: document.getElementById('codigoCategoria').value,
    estado: document.getElementById('estadoPago').value,
    fecha: new Date().toLocaleDateString('es-AR'),
    archivo: archivoAdjuntoBase64
  };

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(res => {
    btn.disabled = false;
    if (res.status === "success") {
      msg.innerText = "✔ ¡Guardado e impactado en Google Sheets!";
      document.getElementById('gastoForm').reset();
      document.getElementById('pdfFileName').innerText = "Soltar o elegir PDF / Imagen de factura";
      document.getElementById('chipsContainer').classList.add('hidden');
      archivoAdjuntoBase64 = null;
      cargarDatos();
    } else {
      msg.innerText = "Error: " + res.mensaje;
    }
  })
  .catch(() => {
    btn.disabled = false;
    msg.innerText = "Error de red al guardar.";
  });
}
