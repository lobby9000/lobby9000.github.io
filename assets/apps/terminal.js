/* =====================================================
   TERMINAL
   Una consola con fosforo verde para el escritorio XP.
   Los comandos se registran desde fuera (demos.js y la
   pagina); aqui solo vive la consola y los basicos.

     var t = LQTerminal.crear(contenedor, opciones)
     t.registrar('nombre', { ayuda, uso, grupo, correr(args, t) })
     t.ejecutar('macd')        -> Promise
     t.imprimir('texto', 'clase')

   Las demos imprimen con t.salida(lineas), que espera unos
   milisegundos entre linea y linea. Con movimiento reducido,
   o con window.LQ_RAPIDO (las pruebas), no espera.
   ===================================================== */
(function () {
  'use strict';

  var MAX_LINEAS = 1500;

  function Cancelado() { this.message = 'cancelado'; }

  /* "notes "sistema aleman" 3" -> ['notes', 'sistema aleman', '3'] */
  function partir(linea) {
    var partes = [], actual = '', comillas = null, hay = false;
    for (var i = 0; i < linea.length; i++) {
      var c = linea[i];
      if (comillas) {
        if (c === comillas) comillas = null; else actual += c;
      } else if (c === '"' || c === "'") {
        comillas = c; hay = true;
      } else if (/\s/.test(c)) {
        if (actual || hay) { partes.push(actual); actual = ''; hay = false; }
      } else {
        actual += c;
      }
    }
    if (actual || hay) partes.push(actual);
    return partes;
  }

  function crear(contenedor, opciones) {
    opciones = opciones || {};
    var comandos = {}, alias = {};
    var historial = [], posicion = 0, borrador = '';
    var corriendo = false, cancelar = false, esperas = [];
    var promptTexto = opciones.prompt || 'C:\\PORTFOLIO>';

    contenedor.classList.add('term');
    contenedor.innerHTML =
      '<div class="term-salida" role="log" aria-live="polite" aria-label="Terminal output"></div>' +
      '<form class="term-linea" autocomplete="off">' +
        '<label class="term-prompt"></label>' +
        '<input class="term-entrada" type="text" spellcheck="false" autocapitalize="off" ' +
          'autocorrect="off" enterkeyhint="go" aria-label="Command">' +
      '</form>';
    var salida = contenedor.querySelector('.term-salida');
    var formulario = contenedor.querySelector('.term-linea');
    var entrada = contenedor.querySelector('.term-entrada');
    var etiqueta = contenedor.querySelector('.term-prompt');
    etiqueta.textContent = promptTexto;
    var id = 'term-entrada-' + Math.random().toString(36).slice(2, 8);
    entrada.id = id;
    etiqueta.setAttribute('for', id);

    function rapido() {
      return !!window.LQ_RAPIDO ||
        !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    /* La consola entera se desplaza: la linea de comandos va justo despues del texto */
    function alFinal() { contenedor.scrollTop = contenedor.scrollHeight; }

    function recortar() {
      while (salida.childNodes.length > MAX_LINEAS) salida.removeChild(salida.firstChild);
    }

    /* Una linea puede ser texto o una lista de piezas:
       ['texto', {t: 'verde', c: 'ok'}, {t: 'repo', href: 'https://...'}] */
    function linea(contenido, clase) {
      var div = document.createElement('div');
      div.className = 'term-l' + (clase ? ' ' + clase : '');
      var piezas = Array.isArray(contenido) ? contenido : [contenido];
      piezas.forEach(function (p) {
        if (p === null || p === undefined) return;
        if (typeof p === 'string' || typeof p === 'number') {
          div.appendChild(document.createTextNode(String(p)));
          return;
        }
        var el;
        if (p.barras) {
          /* Minigrafica: una barra de 1ch por valor, asi alinea con el texto
             aunque la fuente no tenga los caracteres de bloque */
          el = document.createElement('span');
          el.className = 'term-barras' + (p.c ? ' ' + p.c : '');
          el.setAttribute('role', 'img');
          el.setAttribute('aria-label', p.etiqueta || 'chart');
          p.barras.forEach(function (h) {
            var b = document.createElement('span');
            b.className = 'term-barra';
            b.style.setProperty('--h', isFinite(h) ? String(h) : '0');
            el.appendChild(b);
          });
          div.appendChild(el);
          return;
        }
        if (p.href) {
          el = document.createElement('a');
          el.href = p.href;
          if (!/^#|^[a-z0-9_-]+\.html/i.test(p.href)) { el.target = '_blank'; el.rel = 'noopener'; }
        } else if (p.cmd) {
          el = document.createElement('button');
          el.type = 'button';
          el.className = 'term-cmd';
          el.dataset.cmd = p.cmd;
        } else {
          el = document.createElement('span');
        }
        if (p.c) el.className = (el.className ? el.className + ' ' : '') + p.c;
        el.textContent = p.t !== undefined ? p.t : (p.cmd || p.href);
        div.appendChild(el);
      });
      if (!div.childNodes.length) div.appendChild(document.createTextNode('\u00a0'));
      return div;
    }

    function imprimir(contenido, clase) {
      if (typeof contenido === 'string' && contenido.indexOf('\n') >= 0) {
        contenido.split('\n').forEach(function (l) { imprimir(l, clase); });
        return;
      }
      salida.appendChild(linea(contenido, clase));
      recortar();
      alFinal();
    }

    function esperar(ms) {
      return new Promise(function (resolver, rechazar) {
        if (cancelar) { rechazar(new Cancelado()); return; }
        if (rapido() || !ms) { resolver(); return; }
        var t = setTimeout(function () {
          esperas = esperas.filter(function (e) { return e.t !== t; });
          if (cancelar) rechazar(new Cancelado()); else resolver();
        }, ms);
        esperas.push({ t: t, rechazar: rechazar });
      });
    }

    /* Imprime varias lineas con una pausa corta entre ellas */
    async function salidaLenta(lineas, pausa) {
      for (var i = 0; i < lineas.length; i++) {
        var l = lineas[i];
        if (l && l.clase !== undefined && l.contenido !== undefined) imprimir(l.contenido, l.clase);
        else imprimir(l);
        await esperar(pausa === undefined ? 14 : pausa);
      }
    }

    function registrar(nombre, def) {
      comandos[nombre.toLowerCase()] = def;
      (def.alias || []).forEach(function (a) { alias[a.toLowerCase()] = nombre.toLowerCase(); });
    }

    function buscar(nombre) {
      nombre = (nombre || '').toLowerCase();
      if (comandos[nombre]) return nombre;
      return alias[nombre] || null;
    }

    function mostrarPrompt(visible) {
      contenedor.classList.toggle('corriendo', !visible);
      entrada.readOnly = !visible;
    }

    async function ejecutar(texto, opcionesEj) {
      opcionesEj = opcionesEj || {};
      texto = String(texto || '');
      if (corriendo) return false;
      if (opcionesEj.eco !== false) imprimir([{ t: promptTexto, c: 'term-p' }, texto]);
      var limpio = texto.trim();
      if (limpio && opcionesEj.historial !== false && historial[historial.length - 1] !== limpio) historial.push(limpio);
      posicion = historial.length;
      if (!limpio) return true;
      var partes = partir(limpio);
      var nombre = buscar(partes[0]);
      if (!nombre) {
        imprimir("'" + partes[0] + "' is not recognised as a command. Type HELP for the list.", 'err');
        if (opciones.sonido) opciones.sonido('error');
        return false;
      }
      corriendo = true;
      cancelar = false;
      mostrarPrompt(false);
      var ok = true;
      try {
        await comandos[nombre].correr(partes.slice(1), api, partes[0].toLowerCase());
      } catch (e) {
        if (e instanceof Cancelado) imprimir('^C', 'dim');
        else { ok = false; imprimir('Error: ' + (e && e.message ? e.message : e), 'err'); }
      }
      corriendo = false;
      cancelar = false;
      mostrarPrompt(true);
      alFinal();
      if (opciones.alTerminar) opciones.alTerminar(nombre, ok);
      return ok;
    }

    function interrumpir() {
      if (!corriendo) return;
      cancelar = true;
      esperas.forEach(function (e) { clearTimeout(e.t); e.rechazar(new Cancelado()); });
      esperas = [];
    }

    function limpiar() { salida.innerHTML = ''; }

    /* Corre un comando desde dentro de otro (sin eco ni historial) */
    function llamar(texto) {
      var partes = partir(String(texto).trim());
      var nombre = buscar(partes[0]);
      if (!nombre) {
        imprimir("'" + partes[0] + "' is not recognised as a command.", 'err');
        return Promise.resolve();
      }
      return Promise.resolve(comandos[nombre].correr(partes.slice(1), api, partes[0].toLowerCase()));
    }

    /* Completa el comando o, si ya hay uno, su primer argumento */
    function completar() {
      var valor = entrada.value;
      var partes = partir(valor);
      var terminaEnEspacio = /\s$/.test(valor);
      var candidatos = [], base = '', prefijo = '';
      if (partes.length <= 1 && !terminaEnEspacio) {
        prefijo = (partes[0] || '').toLowerCase();
        candidatos = Object.keys(comandos).filter(function (n) { return !comandos[n].oculto; })
          .filter(function (n) { return n.indexOf(prefijo) === 0; });
      } else {
        var nombre = buscar(partes[0]);
        var def = nombre && comandos[nombre];
        if (!def || !def.completar) return;
        prefijo = terminaEnEspacio ? '' : partes[partes.length - 1].toLowerCase();
        base = valor.slice(0, valor.length - prefijo.length);
        candidatos = def.completar().filter(function (n) { return n.toLowerCase().indexOf(prefijo) === 0; });
      }
      if (!candidatos.length) return;
      if (candidatos.length === 1) {
        entrada.value = base + candidatos[0] + ' ';
        return;
      }
      /* Prefijo comun y, si no avanza, la lista de opciones */
      var comun = candidatos.reduce(function (a, b) {
        var i = 0;
        while (i < a.length && i < b.length && a[i] === b[i]) i++;
        return a.slice(0, i);
      });
      if (comun.length > prefijo.length) entrada.value = base + comun;
      else {
        imprimir([{ t: promptTexto, c: 'term-p' }, valor]);
        imprimir(candidatos.join('   '), 'dim');
      }
    }

    formulario.addEventListener('submit', function (e) {
      e.preventDefault();
      if (corriendo) return;
      var texto = entrada.value;
      entrada.value = '';
      borrador = '';
      ejecutar(texto);
    });

    entrada.addEventListener('keydown', function (e) {
      if (opciones.tecla && e.key.length === 1 && !e.ctrlKey && !e.metaKey) opciones.tecla();
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        /* Ctrl+C con texto seleccionado copia, como en cualquier lado */
        var seleccion = window.getSelection ? String(window.getSelection()) : '';
        if (seleccion && !corriendo) return;
        e.preventDefault();
        if (corriendo) { interrumpir(); return; }
        imprimir([{ t: promptTexto, c: 'term-p' }, entrada.value, { t: '^C', c: 'dim' }]);
        entrada.value = '';
        return;
      }
      if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); limpiar(); return; }
      if (corriendo) return;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (posicion === historial.length) borrador = entrada.value;
        if (posicion > 0) { posicion--; entrada.value = historial[posicion]; }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (posicion < historial.length) {
          posicion++;
          entrada.value = posicion === historial.length ? borrador : historial[posicion];
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        completar();
      } else if (e.key === 'Escape') {
        entrada.value = '';
      }
    });

    /* Un clic en la consola le devuelve el foco a la linea de comandos,
       salvo que se este seleccionando texto o se haya tocado un enlace. */
    contenedor.addEventListener('click', function (e) {
      var boton = e.target.closest('.term-cmd');
      if (boton) {
        if (!corriendo) ejecutar(boton.dataset.cmd);
        entrada.focus({ preventScroll: true });
        return;
      }
      if (e.target.closest('a')) return;
      var seleccion = window.getSelection ? String(window.getSelection()) : '';
      if (!seleccion) entrada.focus({ preventScroll: true });
    });

    var api = {
      registrar: registrar,
      ejecutar: ejecutar,
      llamar: llamar,
      imprimir: imprimir,
      salida: salidaLenta,
      esperar: esperar,
      limpiar: limpiar,
      interrumpir: interrumpir,
      enfoque: function () { entrada.focus({ preventScroll: true }); },
      ocupada: function () { return corriendo; },
      historial: function () { return historial.slice(); },
      comandos: function () { return comandos; },
      prompt: promptTexto,
      contenedor: contenedor
    };

    /* ------------------------- comandos basicos ------------------------- */
    registrar('help', {
      grupo: 'Terminal', ayuda: 'This list. HELP <command> explains one.', alias: ['?'],
      completar: function () { return Object.keys(comandos).filter(function (n) { return !comandos[n].oculto; }); },
      correr: function (args, t) {
        if (args.length) {
          var n = buscar(args[0]);
          if (!n) { t.imprimir("No command called '" + args[0] + "'.", 'err'); return; }
          var d = comandos[n];
          t.imprimir([{ t: (d.uso || n).toUpperCase(), c: 'hi' }]);
          t.imprimir(d.detalle || d.ayuda);
          if (d.alias && d.alias.length) t.imprimir('Also: ' + d.alias.join(', '), 'dim');
          return;
        }
        var grupos = {};
        Object.keys(comandos).forEach(function (n) {
          var d = comandos[n];
          if (d.oculto) return;
          (grupos[d.grupo || 'Other'] = grupos[d.grupo || 'Other'] || []).push(n);
        });
        (opciones.ordenGrupos || Object.keys(grupos)).forEach(function (g) {
          if (!grupos[g]) return;
          t.imprimir(g, 'h');
          grupos[g].forEach(function (n) {
            var d = comandos[n];
            t.imprimir(['  ', { cmd: n, t: n, c: 'term-nombre' }, ' '.repeat(Math.max(1, 13 - n.length)), d.ayuda]);
          });
        });
        t.imprimir('');
        t.imprimir('HELP <command> shows its options. The arrows recall earlier commands and Tab completes', 'dim');
        t.imprimir('them. Ctrl+C stops a demo.', 'dim');
      }
    });

    registrar('cls', {
      grupo: 'Terminal', ayuda: 'Clear the screen.', alias: ['clear'],
      correr: function () { limpiar(); }
    });

    registrar('history', {
      grupo: 'Terminal', ayuda: 'Commands typed in this session.', alias: ['doskey'],
      correr: function (args, t) {
        var h = historial.slice(0, -1);
        if (!h.length) { t.imprimir('Nothing yet.', 'dim'); return; }
        h.forEach(function (c, i) { t.imprimir([{ t: String(i + 1).padStart(3, ' ') + '  ', c: 'dim' }, { cmd: c, t: c }]); });
      }
    });

    registrar('echo', {
      grupo: 'Terminal', ayuda: 'Print text.', uso: 'echo <text>', oculto: true,
      correr: function (args, t) { t.imprimir(args.join(' ')); }
    });

    registrar('date', {
      grupo: 'Terminal', ayuda: 'Today, from your computer clock.', alias: ['time'],
      correr: function (args, t) {
        var ahora = new Date();
        t.imprimir('The current date is: ' + ahora.toLocaleDateString('en-GB', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
        t.imprimir('The current time is: ' + ahora.toLocaleTimeString('en-GB'));
      }
    });

    if (opciones.bienvenida) opciones.bienvenida.forEach(function (l) { imprimir(l.contenido || l, l.clase); });
    return api;
  }

  window.LQTerminal = { crear: crear, partir: partir };
})();
