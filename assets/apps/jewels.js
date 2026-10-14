/* =====================================================
   JEWELS
   Tres o mas gemas iguales en linea desaparecen, las de
   arriba caen y las nuevas pueden encadenar combos.
   Logica pura (window.LQJewels.crear, jugar, pista...) y
   una interfaz que se monta dentro de cualquier ventana.
   ===================================================== */
(function () {
  'use strict';

  var N = 8, TIPOS = 7, PUNTOS_POR_NIVEL = 1000;

  function generador(semilla) {
    var a = semilla >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function azar(t) { return Math.floor(t.aleatorio() * TIPOS); }

  /* Llena sin dejar tres iguales en linea: cada gema evita el tipo
     de las dos de su izquierda y de las dos de arriba. */
  function llenar(t) {
    for (var i = 0; i < N * N; i++) {
      var f = Math.floor(i / N), c = i % N, prohibidos = {};
      if (c >= 2 && t.celdas[i - 1] === t.celdas[i - 2]) prohibidos[t.celdas[i - 1]] = true;
      if (f >= 2 && t.celdas[i - N] === t.celdas[i - 2 * N]) prohibidos[t.celdas[i - N]] = true;
      var tipo;
      do { tipo = azar(t); } while (prohibidos[tipo]);
      t.celdas[i] = tipo;
    }
  }

  function crear(semilla) {
    var t = {
      n: N, tipos: TIPOS, celdas: new Array(N * N), puntos: 0, nivel: 1, movimientos: 0,
      aleatorio: generador(semilla === undefined ? Date.now() : semilla)
    };
    var intentos = 0;
    do { llenar(t); intentos++; } while (!pista(t) && intentos < 50);
    return t;
  }

  /* Marca toda gema que forme parte de una linea de 3 o mas */
  function coincidencias(celdas) {
    var marca = new Array(N * N).fill(false), hay = false, f, c, largo, k;
    for (f = 0; f < N; f++) {
      for (c = 0; c < N; c = c + largo) {
        largo = 1;
        while (c + largo < N && celdas[f * N + c] !== -1 && celdas[f * N + c + largo] === celdas[f * N + c]) largo++;
        if (largo >= 3) { for (k = 0; k < largo; k++) marca[f * N + c + k] = true; hay = true; }
      }
    }
    for (c = 0; c < N; c++) {
      for (f = 0; f < N; f = f + largo) {
        largo = 1;
        while (f + largo < N && celdas[f * N + c] !== -1 && celdas[(f + largo) * N + c] === celdas[f * N + c]) largo++;
        if (largo >= 3) { for (k = 0; k < largo; k++) marca[(f + k) * N + c] = true; hay = true; }
      }
    }
    return hay ? marca : null;
  }

  function adyacentes(a, b) {
    var fa = Math.floor(a / N), ca = a % N, fb = Math.floor(b / N), cb = b % N;
    return Math.abs(fa - fb) + Math.abs(ca - cb) === 1;
  }

  function cambiar(celdas, a, b) { var x = celdas[a]; celdas[a] = celdas[b]; celdas[b] = x; }

  /* Primer intercambio que hace linea, o null si no queda ninguno */
  function pista(t) {
    for (var i = 0; i < N * N; i++) {
      var vecinos = [];
      if (i % N < N - 1) vecinos.push(i + 1);
      if (i + N < N * N) vecinos.push(i + N);
      for (var k = 0; k < vecinos.length; k++) {
        var j = vecinos[k];
        if (t.celdas[i] === t.celdas[j]) continue;
        cambiar(t.celdas, i, j);
        var hace = coincidencias(t.celdas);
        cambiar(t.celdas, i, j);
        if (hace) return [i, j];
      }
    }
    return null;
  }

  /* Las gemas caen por columna y arriba aparecen nuevas al azar */
  function gravedad(t) {
    var nuevas = [];
    for (var c = 0; c < N; c++) {
      var escribir = N - 1;
      for (var f = N - 1; f >= 0; f--) {
        var v = t.celdas[f * N + c];
        if (v !== -1) { t.celdas[escribir * N + c] = v; escribir--; }
      }
      for (var g = escribir; g >= 0; g--) { t.celdas[g * N + c] = azar(t); nuevas.push(g * N + c); }
    }
    return nuevas;
  }

  function barajar(t) {
    for (var intento = 0; intento < 200; intento++) {
      for (var i = t.celdas.length - 1; i > 0; i--) {
        var j = Math.floor(t.aleatorio() * (i + 1));
        cambiar(t.celdas, i, j);
      }
      if (!coincidencias(t.celdas) && pista(t)) return;
    }
    do { llenar(t); } while (!pista(t));
  }

  /* Un movimiento completo: intercambio, lineas, caidas y combos.
     Devuelve los pasos para animarlos y los puntos ganados. */
  function jugar(t, a, b) {
    if (!adyacentes(a, b) || t.celdas[a] === t.celdas[b]) return { valido: false, pasos: [], puntos: 0 };
    cambiar(t.celdas, a, b);
    var marca = coincidencias(t.celdas);
    if (!marca) { cambiar(t.celdas, a, b); return { valido: false, pasos: [], puntos: 0 }; }
    t.movimientos++;
    var pasos = [], total = 0, combo = 0;
    while (marca) {
      combo++;
      var borradas = [];
      marca.forEach(function (m, i) { if (m) { borradas.push(i); t.celdas[i] = -1; } });
      var ganados = borradas.length * 10 * combo;
      total += ganados;
      var nuevas = gravedad(t);
      pasos.push({ borradas: borradas, nuevas: nuevas, ganados: ganados, combo: combo, celdas: t.celdas.slice() });
      marca = coincidencias(t.celdas);
    }
    t.puntos += total;
    t.nivel = 1 + Math.floor(t.puntos / PUNTOS_POR_NIVEL);
    if (!pista(t)) { barajar(t); pasos.push({ barajado: true, celdas: t.celdas.slice() }); }
    return { valido: true, pasos: pasos, puntos: total };
  }

  /* ---------------------------------------------------------------
     Interfaz
     --------------------------------------------------------------- */
  var GEMAS = [
    { nombre: 'red square', color: '#e34948', forma: '<rect x="6" y="6" width="28" height="28" rx="5"/>' },
    { nombre: 'orange hexagon', color: '#eb6834', forma: '<polygon points="20,4 34,12 34,28 20,36 6,28 6,12"/>' },
    { nombre: 'yellow diamond', color: '#eda100', forma: '<polygon points="20,3 37,20 20,37 3,20"/>' },
    { nombre: 'green triangle', color: '#1baf7a', forma: '<polygon points="20,5 36,34 4,34"/>' },
    { nombre: 'blue circle', color: '#2a78d6', forma: '<circle cx="20" cy="20" r="15"/>' },
    { nombre: 'violet star', color: '#6250d6', forma: '<polygon points="20,3 24.5,14.5 37,15 27.5,23 31,35.5 20,28.5 9,35.5 12.5,23 3,15 15.5,14.5"/>' },
    { nombre: 'pink heart', color: '#e87ba4', forma: '<path d="M20 35 C 6 25 3 17 7 11 C 11 5 18 7 20 12 C 22 7 29 5 33 11 C 37 17 34 25 20 35 Z"/>' }
  ];

  function svgGema(tipo) {
    var g = GEMAS[tipo];
    return '<svg viewBox="0 0 40 40" aria-hidden="true"><g fill="' + g.color + '" stroke="rgba(0,0,0,0.45)" stroke-width="1.5">' +
      g.forma + '</g><g fill="rgba(255,255,255,0.45)" transform="translate(9 9) scale(0.38)">' + g.forma + '</g></svg>';
  }

  function guardado(clave, valor) {
    try {
      if (valor === undefined) return window.localStorage.getItem(clave);
      window.localStorage.setItem(clave, valor);
    } catch (e) { /* sin almacenamiento */ }
    return null;
  }

  function montar(contenedor, opciones) {
    opciones = opciones || {};
    var t, seleccion = -1, ocupado = false, inicioArrastre = -1;
    var rapido = function () {
      return window.LQ_RAPIDO || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    };
    function esperar(ms) { return new Promise(function (r) { setTimeout(r, rapido() ? 0 : ms); }); }
    function sonido(n) { if (opciones.sonido) opciones.sonido(n); }

    contenedor.classList.add('jewels');
    contenedor.innerHTML =
      '<div class="jw-cabeza">' +
        '<span class="jw-dato">Score <b data-puntos>0</b></span>' +
        '<span class="jw-dato">Level <b data-nivel>1</b></span>' +
        '<span class="jw-dato">Best <b data-mejor>0</b></span>' +
      '</div>' +
      '<div class="jw-barra" aria-hidden="true"><span></span></div>' +
      '<div class="jw-tablero" role="grid" aria-label="Jewels board"></div>' +
      '<div class="jw-pie">' +
        '<button type="button" data-nuevo>New game</button>' +
        '<button type="button" data-pista>Hint</button>' +
        '<span class="jw-aviso" aria-live="polite"></span>' +
      '</div>';
    var tablero = contenedor.querySelector('.jw-tablero');
    var aviso = contenedor.querySelector('.jw-aviso');

    function marcador() {
      contenedor.querySelector('[data-puntos]').textContent = t.puntos.toLocaleString('en-GB');
      contenedor.querySelector('[data-nivel]').textContent = t.nivel;
      var mejor = Math.max(t.puntos, parseInt(guardado('lq-jewels') || '0', 10));
      contenedor.querySelector('[data-mejor]').textContent = mejor.toLocaleString('en-GB');
      contenedor.querySelector('.jw-barra span').style.width = (100 * (t.puntos % PUNTOS_POR_NIVEL) / PUNTOS_POR_NIVEL) + '%';
    }

    /* Pinta un tablero (el actual o un paso intermedio de la animacion).
       Las clases de animacion se ponen despues de un reflow para que
       vuelvan a correr aunque la casilla ya las hubiera tenido. */
    function pintar(celdas, clases) {
      celdas = celdas || t.celdas;
      clases = clases || {};
      tablero.classList.add('quieto');
      for (var i = 0; i < N * N; i++) {
        var b = tablero.children[i], tipo = celdas[i];
        if (b.dataset.tipo !== String(tipo)) {
          b.dataset.tipo = tipo;
          b.innerHTML = svgGema(tipo);
          b.setAttribute('aria-label', GEMAS[tipo].nombre + ', row ' + (Math.floor(i / N) + 1) + ', column ' + (i % N + 1));
        }
        b.className = 'jw-gema' + (i === seleccion ? ' sel' : '');
        b.style.transform = '';
      }
      void tablero.offsetWidth;
      tablero.classList.remove('quieto');
      Object.keys(clases).forEach(function (k) { tablero.children[k].classList.add(clases[k]); });
      marcador();
    }

    function nuevo() {
      t = crear(opciones.semilla);
      seleccion = -1;
      tablero.innerHTML = '';
      for (var i = 0; i < N * N; i++) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'jw-gema';
        b.dataset.i = i;
        tablero.appendChild(b);
      }
      aviso.textContent = 'Swap two neighbouring gems to line up three.';
      pintar();
    }

    async function mover(a, b) {
      if (ocupado) return null;
      ocupado = true;
      contenedor.dataset.ocupado = '1';             // para quien espera a que termine (las pruebas)
      seleccion = -1;
      var ga = tablero.children[a], gb = tablero.children[b];
      var dx = (b % N - a % N) * 100, dy = (Math.floor(b / N) - Math.floor(a / N)) * 100;
      var tras = t.celdas.slice();                       // el tablero con el intercambio hecho
      var x = tras[a]; tras[a] = tras[b]; tras[b] = x;
      ga.classList.remove('sel');
      gb.classList.remove('sel');
      ga.style.transform = 'translate(' + dx + '%,' + dy + '%)';
      gb.style.transform = 'translate(' + (-dx) + '%,' + (-dy) + '%)';
      await esperar(160);
      var r = jugar(t, a, b);
      if (!r.valido) {
        sonido('no');
        ga.style.transform = gb.style.transform = '';  // regresan a su lugar
        await esperar(170);
        var sacude = {};
        sacude[a] = 'no'; sacude[b] = 'no';
        pintar(null, sacude);
        aviso.textContent = 'No line there.';
        await esperar(260);
        pintar();
        ocupado = false;
        delete contenedor.dataset.ocupado;
        return r;
      }
      pintar(tras);
      var previo = tras;
      for (var k = 0; k < r.pasos.length; k++) {
        var paso = r.pasos[k];
        if (paso.barajado) {
          aviso.textContent = 'No moves left: shuffled.';
          await esperar(250);
          pintar(paso.celdas);
          previo = paso.celdas;
          continue;
        }
        var borrar = {};
        paso.borradas.forEach(function (i) { borrar[i] = 'borrar'; });
        pintar(previo, borrar);
        sonido(paso.combo > 1 ? 'combo' : 'linea');
        aviso.textContent = '+' + paso.ganados + (paso.combo > 1 ? ' · combo ×' + paso.combo : '');
        await esperar(230);
        var caen = {};
        paso.nuevas.forEach(function (i) { caen[i] = 'cae'; });
        pintar(paso.celdas, caen);
        previo = paso.celdas;
        await esperar(210);
      }
      var mejor = parseInt(guardado('lq-jewels') || '0', 10);
      if (t.puntos > mejor) guardado('lq-jewels', String(t.puntos));
      pintar();
      ocupado = false;
      delete contenedor.dataset.ocupado;
      return r;
    }

    /* Teclado: flechas entre gemas; Enter o espacio elige, como un clic */
    tablero.addEventListener('keydown', function (e) {
      var g = e.target.closest('.jw-gema');
      if (!g) return;
      var i = +g.dataset.i, d = null;
      if (e.key === 'ArrowRight' && i % N < N - 1) d = i + 1;
      else if (e.key === 'ArrowLeft' && i % N > 0) d = i - 1;
      else if (e.key === 'ArrowDown' && i + N < N * N) d = i + N;
      else if (e.key === 'ArrowUp' && i - N >= 0) d = i - N;
      if (d !== null) { tablero.children[d].focus(); e.preventDefault(); }
    });

    tablero.addEventListener('click', function (e) {
      var g = e.target.closest('.jw-gema');
      if (!g || ocupado) return;
      var i = +g.dataset.i;
      if (seleccion === -1) { seleccion = i; sonido('elegir'); pintar(); return; }
      if (seleccion === i) { seleccion = -1; pintar(); return; }
      if (adyacentes(seleccion, i)) { mover(seleccion, i); return; }
      seleccion = i;
      pintar();
    });
    /* Deslizar de una gema a la de al lado tambien intercambia */
    tablero.addEventListener('pointerdown', function (e) {
      var g = e.target.closest('.jw-gema');
      inicioArrastre = g ? +g.dataset.i : -1;
    });
    tablero.addEventListener('pointerup', function (e) {
      var destino = document.elementFromPoint(e.clientX, e.clientY);
      var g = destino && destino.closest ? destino.closest('.jw-gema') : null;
      if (g && inicioArrastre !== -1 && +g.dataset.i !== inicioArrastre && adyacentes(inicioArrastre, +g.dataset.i)) {
        var a = inicioArrastre;
        inicioArrastre = -1;
        e.preventDefault();
        seleccion = -1;
        mover(a, +g.dataset.i);
      }
    });
    contenedor.querySelector('[data-nuevo]').addEventListener('click', function () { if (!ocupado) nuevo(); });
    contenedor.querySelector('[data-pista]').addEventListener('click', function () {
      var p = pista(t);
      if (!p || ocupado) return;
      var marca = {};
      marca[p[0]] = 'pista'; marca[p[1]] = 'pista';
      pintar(null, marca);
      sonido('elegir');
      aviso.textContent = 'Try those two.';
    });

    nuevo();
    return { nuevo: nuevo, estado: function () { return t; }, mover: mover,
             ocupado: function () { return ocupado; }, destruir: function () {} };
  }

  window.LQJewels = {
    N: N, TIPOS: TIPOS, crear: crear, coincidencias: coincidencias, jugar: jugar, pista: pista,
    adyacentes: adyacentes, barajar: barajar, montar: montar
  };
})();
