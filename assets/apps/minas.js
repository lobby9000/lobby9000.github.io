/* =====================================================
   BUSCAMINAS
   Logica pura (sin DOM, se puede probar sola) y una
   interfaz al estilo del Buscaminas de Windows XP.
   window.LQMinas = { NIVELES, crear, revelar, marcar,
                      acorde, vecinos, montar }
   ===================================================== */
(function () {
  'use strict';

  var NIVELES = {
    principiante: { filas: 9, columnas: 9, minas: 10, nombre: 'Beginner' },
    intermedio: { filas: 16, columnas: 16, minas: 40, nombre: 'Intermediate' },
    experto: { filas: 16, columnas: 30, minas: 99, nombre: 'Expert' }
  };

  /* Generador con semilla (mulberry32): la misma semilla da el mismo tablero */
  function generador(semilla) {
    var a = semilla >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function crear(filas, columnas, minas, semilla) {
    if (minas >= filas * columnas) throw new Error('demasiadas minas');
    var celdas = [];
    for (var i = 0; i < filas * columnas; i++) {
      celdas.push({ mina: false, abierta: false, bandera: false, vecinas: 0 });
    }
    return {
      filas: filas, columnas: columnas, minas: minas, celdas: celdas,
      estado: 'listo',            // listo -> jugando -> ganado | perdido
      abiertas: 0, banderas: 0, explotada: -1,
      aleatorio: generador(semilla === undefined ? Date.now() : semilla)
    };
  }

  function vecinos(t, i) {
    var f = Math.floor(i / t.columnas), c = i % t.columnas, salida = [];
    for (var df = -1; df <= 1; df++) {
      for (var dc = -1; dc <= 1; dc++) {
        if (!df && !dc) continue;
        var ff = f + df, cc = c + dc;
        if (ff >= 0 && ff < t.filas && cc >= 0 && cc < t.columnas) salida.push(ff * t.columnas + cc);
      }
    }
    return salida;
  }

  /* Las minas se ponen despues del primer clic: la casilla y sus
     vecinas quedan libres, asi el juego nunca empieza perdiendo. */
  function sembrar(t, seguro) {
    var prohibidas = {};
    prohibidas[seguro] = true;
    var libres = t.filas * t.columnas - 1 - vecinos(t, seguro).length;
    if (libres >= t.minas) vecinos(t, seguro).forEach(function (v) { prohibidas[v] = true; });
    var candidatas = [];
    for (var i = 0; i < t.celdas.length; i++) if (!prohibidas[i]) candidatas.push(i);
    for (var k = 0; k < t.minas; k++) {          // Fisher-Yates parcial
      var j = k + Math.floor(t.aleatorio() * (candidatas.length - k));
      var tmp = candidatas[k]; candidatas[k] = candidatas[j]; candidatas[j] = tmp;
      t.celdas[candidatas[k]].mina = true;
    }
    t.celdas.forEach(function (celda, idx) {
      celda.vecinas = vecinos(t, idx).filter(function (v) { return t.celdas[v].mina; }).length;
    });
  }

  function terminado(t) { return t.estado === 'ganado' || t.estado === 'perdido'; }

  /* Abre una casilla. Si no tiene minas alrededor, abre en cadena
     (recorrido en anchura, sin recursion). Devuelve lo que abrio. */
  function revelar(t, i) {
    if (terminado(t)) return [];
    if (t.estado === 'listo') { sembrar(t, i); t.estado = 'jugando'; }
    var celda = t.celdas[i];
    if (celda.abierta || celda.bandera) return [];
    if (celda.mina) {
      celda.abierta = true;
      t.explotada = i;
      t.estado = 'perdido';
      return [i];
    }
    var abiertas = [], cola = [i];
    celda.abierta = true;
    while (cola.length) {
      var actual = cola.shift();
      abiertas.push(actual);
      t.abiertas++;
      if (t.celdas[actual].vecinas === 0) {
        vecinos(t, actual).forEach(function (v) {
          var c = t.celdas[v];
          if (!c.abierta && !c.bandera && !c.mina) { c.abierta = true; cola.push(v); }
        });
      }
    }
    if (t.abiertas === t.filas * t.columnas - t.minas) {
      t.estado = 'ganado';
      t.celdas.forEach(function (c) { if (c.mina) c.bandera = true; });
      t.banderas = t.minas;
    }
    return abiertas;
  }

  function marcar(t, i) {
    if (terminado(t)) return false;
    var celda = t.celdas[i];
    if (celda.abierta) return false;
    celda.bandera = !celda.bandera;
    t.banderas += celda.bandera ? 1 : -1;
    return true;
  }

  /* Clic sobre un numero con todas sus banderas puestas: abre el resto */
  function acorde(t, i) {
    var celda = t.celdas[i];
    if (terminado(t) || !celda.abierta || !celda.vecinas) return [];
    var alrededor = vecinos(t, i);
    var banderas = alrededor.filter(function (v) { return t.celdas[v].bandera; }).length;
    if (banderas !== celda.vecinas) return [];
    var abiertas = [];
    alrededor.forEach(function (v) {
      if (!t.celdas[v].abierta && !t.celdas[v].bandera) abiertas = abiertas.concat(revelar(t, v));
    });
    return abiertas;
  }

  /* ---------------------------------------------------------------
     Interfaz
     --------------------------------------------------------------- */
  function guardado(clave, valor) {
    try {
      if (valor === undefined) return window.localStorage.getItem(clave);
      window.localStorage.setItem(clave, valor);
    } catch (e) { /* sin almacenamiento: no pasa nada */ }
    return null;
  }

  function tresDigitos(n) {
    n = Math.max(-99, Math.min(999, n));
    return n < 0 ? '-' + String(-n).padStart(2, '0') : String(n).padStart(3, '0');
  }

  /* Dibujos en SVG: los emoji no se ven igual (o no se ven) en todas partes */
  var MINA = '<svg viewBox="0 0 16 16" aria-hidden="true"><g fill="#000">' +
    '<circle cx="8" cy="8" r="4.7"/><rect x="7.3" y="1" width="1.4" height="14"/><rect x="1" y="7.3" width="14" height="1.4"/>' +
    '<rect x="7.4" y="2.6" width="1.2" height="10.8" transform="rotate(45 8 8)"/>' +
    '<rect x="7.4" y="2.6" width="1.2" height="10.8" transform="rotate(-45 8 8)"/></g>' +
    '<rect x="5.4" y="5.4" width="2" height="2" fill="#fff"/></svg>';
  var BANDERA = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="7.6" y="2.5" width="1.5" height="9" fill="#000"/>' +
    '<polygon points="9.1,2.2 9.1,8 3.6,5.1" fill="#E00000"/><rect x="5.6" y="11" width="5.5" height="1.4" fill="#000"/>' +
    '<rect x="4" y="12.4" width="8.6" height="1.8" fill="#000"/></svg>';
  var EQUIVOCADA = MINA.replace('</svg>', '<path d="M2 2L14 14M14 2L2 14" stroke="#E00000" stroke-width="2"/></svg>');
  var OJOS = '<circle cx="8.6" cy="9.4" r="1.4"/><circle cx="15.4" cy="9.4" r="1.4"/>';
  var CARA = '<circle cx="12" cy="12" r="10.4" fill="#FFE600" stroke="#000" stroke-width="1.4"/>';
  var CARAS = {
    normal: CARA + OJOS + '<path d="M7.4 14.2Q12 18.6 16.6 14.2" fill="none" stroke="#000" stroke-width="1.6"/>',
    susto: CARA + OJOS + '<circle cx="12" cy="16" r="2.3" fill="none" stroke="#000" stroke-width="1.5"/>',
    gano: CARA + '<path d="M4.6 8.2h14.8v1.6l-1.4 2.6h-3.4l-1.2-2.3h-2.8l-1.2 2.3H6l-1.4-2.6z"/>' +
      '<path d="M7.4 14.6Q12 18.6 16.6 14.6" fill="none" stroke="#000" stroke-width="1.6"/>',
    perdio: CARA + '<path d="M7 7.6l3.2 3.2M10.2 7.6L7 10.8M13.8 7.6l3.2 3.2M17 7.6l-3.2 3.2" stroke="#000" stroke-width="1.4"/>' +
      '<path d="M7.6 17.4Q12 13.6 16.4 17.4" fill="none" stroke="#000" stroke-width="1.6"/>'
  };
  function cara(nombre) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + CARAS[nombre] + '</svg>'; }

  function montar(contenedor, opciones) {
    opciones = opciones || {};
    var nivel = opciones.nivel || 'principiante';
    var t, reloj = null, segundos = 0, modoBandera = false, presionado = null, ignorarClic = false;

    contenedor.classList.add('minas');
    contenedor.innerHTML =
      '<div class="minas-menu" role="toolbar" aria-label="Level">' +
        '<button type="button" data-nivel="principiante">Beginner</button>' +
        '<button type="button" data-nivel="intermedio">Intermediate</button>' +
        '<button type="button" data-nivel="experto">Expert</button>' +
        '<button type="button" class="minas-bandera" aria-pressed="false" aria-label="Flag mode" ' +
          'title="Flag mode: taps place flags">' + BANDERA + '</button>' +
      '</div>' +
      '<div class="minas-marco">' +
        '<div class="minas-cabeza">' +
          '<span class="minas-led" data-contador aria-label="Mines left">010</span>' +
          '<button type="button" class="minas-cara" aria-label="New game">' + cara('normal') + '</button>' +
          '<span class="minas-led" data-reloj aria-label="Seconds">000</span>' +
        '</div>' +
        '<div class="minas-tablero" role="grid"></div>' +
      '</div>' +
      '<div class="minas-pie"></div>';

    var tablero = contenedor.querySelector('.minas-tablero');
    var caraBtn = contenedor.querySelector('.minas-cara');
    var contador = contenedor.querySelector('[data-contador]');
    var relojTxt = contenedor.querySelector('[data-reloj]');
    var pie = contenedor.querySelector('.minas-pie');
    var botonBandera = contenedor.querySelector('.minas-bandera');

    function sonido(nombre) { if (opciones.sonido) opciones.sonido(nombre); }

    function detenerReloj() { if (reloj) { clearInterval(reloj); reloj = null; } }

    function nuevo(n) {
      if (n) nivel = n;
      var cfg = NIVELES[nivel];
      detenerReloj();
      segundos = 0;
      t = crear(cfg.filas, cfg.columnas, cfg.minas, opciones.semilla);
      contenedor.dataset.nivel = nivel;
      tablero.style.gridTemplateColumns = 'repeat(' + cfg.columnas + ', var(--celda))';
      tablero.innerHTML = '';
      for (var i = 0; i < cfg.filas * cfg.columnas; i++) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'minas-celda';
        b.dataset.i = i;
        tablero.appendChild(b);
      }
      contenedor.querySelectorAll('[data-nivel]').forEach(function (btn) {
        btn.classList.toggle('activo', btn.dataset.nivel === nivel);
      });
      var mejor = guardado('lq-minas-' + nivel);
      pie.textContent = cfg.nombre + ': ' + cfg.minas + ' mines' + (mejor ? ' · best ' + mejor + ' s' : '');
      pintar();
      if (opciones.alCambiarNivel) opciones.alCambiarNivel(nivel);
    }

    function pintar() {
      var botones = tablero.children;
      t.celdas.forEach(function (c, i) {
        var b = botones[i];
        var clase = 'minas-celda', dibujo = '', texto = '', estado = 'hidden';
        if (c.abierta) {
          clase += ' abierta';
          if (c.mina) { dibujo = MINA; estado = 'mine'; if (i === t.explotada) clase += ' explotada'; }
          else if (c.vecinas) { texto = String(c.vecinas); clase += ' n' + c.vecinas; estado = texto; }
          else estado = 'empty';
        } else if (t.estado === 'perdido' && c.mina && !c.bandera) {
          clase += ' abierta'; dibujo = MINA; estado = 'mine';
        } else if (c.bandera) {
          dibujo = BANDERA; estado = 'flag';
          if (t.estado === 'perdido' && !c.mina) { clase += ' error abierta'; dibujo = EQUIVOCADA; estado = 'wrong flag'; }
        }
        if (b.className !== clase) b.className = clase;
        if (b.dataset.estado !== estado) {
          b.dataset.estado = estado;
          if (dibujo) b.innerHTML = dibujo; else b.textContent = texto;
          b.setAttribute('aria-label', 'Row ' + (Math.floor(i / t.columnas) + 1) + ', column ' + (i % t.columnas + 1) + ', ' + estado);
        }
      });
      contador.textContent = tresDigitos(t.minas - t.banderas);
      relojTxt.textContent = tresDigitos(segundos);
      ponerCara(t.estado === 'ganado' ? 'gano' : t.estado === 'perdido' ? 'perdio' : 'normal');
    }

    var caraActual = 'normal';
    function ponerCara(nombre) {
      if (caraActual === nombre) return;
      caraActual = nombre;
      caraBtn.innerHTML = cara(nombre);
    }

    function arrancarReloj() {
      if (reloj || t.estado !== 'jugando') return;
      reloj = setInterval(function () {
        segundos = Math.min(999, segundos + 1);
        relojTxt.textContent = tresDigitos(segundos);
      }, 1000);
    }

    function despues(abiertas) {
      arrancarReloj();
      if (t.estado === 'perdido') { detenerReloj(); sonido('perdio'); }
      else if (t.estado === 'ganado') {
        detenerReloj();
        sonido('gano');
        var clave = 'lq-minas-' + nivel, mejor = parseInt(guardado(clave) || '0', 10);
        if (!mejor || segundos < mejor) guardado(clave, String(segundos));
        pie.textContent = 'Cleared in ' + segundos + ' s' + (mejor && segundos >= mejor ? ' · best ' + mejor + ' s' : ' · new best');
      } else if (abiertas.length) sonido('abrir');
      pintar();
    }

    tablero.addEventListener('click', function (e) {
      var b = e.target.closest('.minas-celda');
      if (!b) return;
      if (ignorarClic) { ignorarClic = false; return; }  // el clic que sigue a una bandera por pulsacion larga
      var i = +b.dataset.i;
      if (modoBandera && !t.celdas[i].abierta) { marcar(t, i); sonido('bandera'); pintar(); return; }
      despues(t.celdas[i].abierta ? acorde(t, i) : revelar(t, i));
    });
    tablero.addEventListener('contextmenu', function (e) {
      var b = e.target.closest('.minas-celda');
      if (!b) return;
      e.preventDefault();
      if (marcar(t, +b.dataset.i)) { sonido('bandera'); pintar(); }
    });
    /* Mantener presionado en pantallas tactiles pone bandera */
    tablero.addEventListener('pointerdown', function (e) {
      var b = e.target.closest('.minas-celda');
      if (!b || t.estado === 'ganado' || t.estado === 'perdido') return;
      ponerCara('susto');
      if (e.pointerType === 'touch') {
        presionado = setTimeout(function () {
          presionado = null;
          ignorarClic = true;
          if (marcar(t, +b.dataset.i)) { sonido('bandera'); pintar(); }
        }, 450);
      }
    });
    function soltar() {
      if (presionado) { clearTimeout(presionado); presionado = null; }
      if (t && t.estado !== 'ganado' && t.estado !== 'perdido') ponerCara('normal');
    }
    tablero.addEventListener('pointerup', soltar);
    tablero.addEventListener('pointercancel', soltar);
    tablero.addEventListener('pointerleave', soltar);

    /* Teclado: flechas para moverse, Enter o espacio abre, F pone bandera */
    tablero.addEventListener('keydown', function (e) {
      var b = e.target.closest('.minas-celda');
      if (!b) return;
      var i = +b.dataset.i, cols = t.columnas, destino = null;
      if (e.key === 'ArrowRight' && i % cols < cols - 1) destino = i + 1;
      else if (e.key === 'ArrowLeft' && i % cols > 0) destino = i - 1;
      else if (e.key === 'ArrowDown') destino = i + cols;
      else if (e.key === 'ArrowUp') destino = i - cols;
      else if (e.key === 'f' || e.key === 'F') { if (marcar(t, i)) { sonido('bandera'); pintar(); } e.preventDefault(); return; }
      if (destino !== null && destino >= 0 && destino < t.celdas.length) {
        tablero.children[destino].focus();
        e.preventDefault();
      }
    });

    caraBtn.addEventListener('click', function () { nuevo(); });
    contenedor.querySelectorAll('[data-nivel]').forEach(function (btn) {
      btn.addEventListener('click', function () { nuevo(btn.dataset.nivel); });
    });
    botonBandera.addEventListener('click', function () {
      modoBandera = !modoBandera;
      botonBandera.setAttribute('aria-pressed', String(modoBandera));
      botonBandera.classList.toggle('activo', modoBandera);
    });

    nuevo(nivel);
    return {
      nuevo: nuevo,
      estado: function () { return t; },
      destruir: function () { detenerReloj(); }
    };
  }

  window.LQMinas = {
    NIVELES: NIVELES, crear: crear, revelar: revelar, marcar: marcar, acorde: acorde,
    vecinos: vecinos, generador: generador, montar: montar
  };
})();
