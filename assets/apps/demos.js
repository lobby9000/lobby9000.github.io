/* =====================================================
   DEMOS DE LOS PROYECTOS
   Cada demo calcula en el navegador con datos chicos de
   su repositorio (assets/apps/demo-data.js, generado por
   tools/demo_data.py) y se compara con los resultados que
   dio el codigo original en Python.

     LQDemos.instalar(terminal, { abrirProyecto, sonido })
     LQDemos.lista  -> [{ comando, proyecto, titulo, resumen }]
   ===================================================== */
(function () {
  'use strict';

  var D = window.LQDemoData;

  /* ---------------------------------------------------------------
     Formato
     --------------------------------------------------------------- */
  function fmt(x, dec) {
    dec = dec === undefined ? 0 : dec;
    var r = Number(x.toFixed(dec));
    if (r === 0) r = 0;                               // sin "-0"
    return r.toLocaleString('en-GB', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function pesos(x, dec) {
    var s = fmt(x, dec);
    return s.charAt(0) === '-' ? '-$' + s.slice(1) : '$' + s;
  }
  function pct(x, dec) { return fmt(x * 100, dec === undefined ? 2 : dec) + '%'; }
  function izq(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); }
  function der(s, n) { s = String(s); return s.length >= n ? s : ' '.repeat(n - s.length) + s; }
  function cientifica(x) {
    if (x === 0) return '0';
    var e = x.toExponential(1).split('e');
    return e[0] + 'e' + (e[1].charAt(0) === '+' ? e[1].slice(1) : e[1]);
  }
  function fecha(inicio, dias) {
    var p = inicio.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + dias)).toISOString().slice(0, 10);
  }
  function fechaHora(texto) {                     // '2026-10-14 22:59' -> '14 Oct 2026 at 22:59'
    var p = texto.split(' ');
    return fechaLarga(p[0]) + ' at ' + p[1];
  }
  function fechaLarga(iso) {
    var p = iso.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]))
      .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
  /* Un numero escrito por quien usa la terminal, como texto canonico
     ("-1503231.35") o null. Acepta 1503231.35 y 1,503,231.35, y tambien como
     lo muestra la app de Mercado Pago: 1.503.231,35 o 1503231,35.
     Con punto y coma, el ultimo es el decimal. Con uno solo, si separa grupos
     de tres digitos son miles (25,000 o 25.000) y si no es el decimal (25,5). */
  function canonico(texto) {
    var s = String(texto).replace(/[$\s_]/g, ''), signo = '';
    if (s.charAt(0) === '-') { signo = '-'; s = s.slice(1); }
    if (!/^\d[\d.,]*$/.test(s)) return null;
    var punto = s.lastIndexOf('.'), coma = s.lastIndexOf(','), decimal = '';
    if (punto >= 0 && coma >= 0) {
      decimal = punto > coma ? '.' : ',';
    } else if (punto >= 0 || coma >= 0) {
      var trozos = s.split(punto >= 0 ? '.' : ',');
      if (trozos.length === 2 && trozos[1].length !== 3) decimal = punto >= 0 ? '.' : ',';
    }
    var entera = s, fraccion = '';
    if (decimal) {
      entera = s.slice(0, s.lastIndexOf(decimal));
      fraccion = s.slice(s.lastIndexOf(decimal) + 1);
      if (!/^\d+$/.test(fraccion)) return null;
    }
    if (/[.,]/.test(entera)) {                         // separadores de miles: grupos de tres
      var miles = entera.replace(/\d/g, '').charAt(0);
      var grupos = miles === '.' ? /^\d{1,3}(\.\d{3})+$/ : /^\d{1,3}(,\d{3})+$/;
      if (!grupos.test(entera)) return null;
      entera = entera.split(miles).join('');
    }
    return signo + entera + (fraccion ? '.' + fraccion : '');
  }
  function numero(texto) {
    var c = canonico(texto);
    return c === null ? NaN : Number(c);
  }

  /* Minigrafica de una linea: cada columna es el promedio de su tramo, con
     alturas de 0.1 (el minimo) a 1 (el maximo). La terminal la dibuja con
     barras de 1ch, alineadas con el texto. */
  function chispa(valores, ancho, clase, etiqueta) {
    var columnas = [], n = valores.length;
    ancho = Math.min(ancho, n);
    for (var j = 0; j < ancho; j++) {
      var a = Math.floor(j * n / ancho), b = Math.floor((j + 1) * n / ancho), s = 0, c = 0;
      for (var i = a; i < b; i++) if (isFinite(valores[i])) { s += valores[i]; c++; }
      columnas.push(c ? s / c : NaN);
    }
    var finitos = columnas.filter(isFinite);
    var lo = Math.min.apply(null, finitos), hi = Math.max.apply(null, finitos);
    return {
      barras: columnas.map(function (v) { return isFinite(v) ? (hi > lo ? 0.1 + 0.9 * (v - lo) / (hi - lo) : 0.5) : NaN; }),
      c: clase || 'hi',
      etiqueta: etiqueta
    };
  }

  /* ---------------------------------------------------------------
     Numerica compartida
     --------------------------------------------------------------- */

  /* La suma por pares de NumPy (pairwise_sum, bloques de 8): con ella la
     semilla SMA de la EMA sale bit a bit igual que values[:n].mean(). */
  function sumaNumpy(a, i0, n) {
    var i, res;
    if (n < 8) {
      res = 0;
      for (i = 0; i < n; i++) res += a[i0 + i];
      return res;
    }
    if (n <= 128) {
      var r = [a[i0], a[i0 + 1], a[i0 + 2], a[i0 + 3], a[i0 + 4], a[i0 + 5], a[i0 + 6], a[i0 + 7]];
      for (i = 8; i < n - (n % 8); i += 8) {
        for (var j = 0; j < 8; j++) r[j] += a[i0 + i + j];
      }
      res = ((r[0] + r[1]) + (r[2] + r[3])) + ((r[4] + r[5]) + (r[6] + r[7]));
      for (; i < n; i++) res += a[i0 + i];
      return res;
    }
    var n2 = Math.floor(n / 2);
    n2 -= n2 % 8;
    return sumaNumpy(a, i0, n2) + sumaNumpy(a, i0 + n2, n - n2);
  }

  /* EMA de N periodos con semilla SMA, como mt.ema(x, n): ignora los NaN iniciales */
  function ema(x, n) {
    var a = 2 / (n + 1), out = new Array(x.length).fill(NaN);
    var primero = 0;
    while (primero < x.length && isNaN(x[primero])) primero++;
    if (x.length - primero < n) return out;
    var prev = sumaNumpy(x, primero, n) / n;
    out[primero + n - 1] = prev;
    for (var i = primero + n; i < x.length; i++) {
      prev = a * x[i] + (1 - a) * prev;
      out[i] = prev;
    }
    return out;
  }

  /* La misma recursion, pero continuando desde un valor ya asentado */
  function emaDesde(x, n, inicial) {
    var a = 2 / (n + 1), out = [inicial], prev = inicial;
    for (var i = 1; i < x.length; i++) {
      prev = a * x[i] + (1 - a) * prev;
      out.push(prev);
    }
    return out;
  }

  function restar(a, b) { return a.map(function (v, i) { return v - b[i]; }); }

  /* Cruces del histograma (y de la linea contra cero): |x| <= tol cuenta como 0 */
  function cruces(valores, tol) {
    var eventos = [], prev = NaN;
    for (var i = 0; i < valores.length; i++) {
      var v = valores[i];
      if (!isNaN(v) && Math.abs(v) <= tol) v = 0;
      if (!isNaN(v) && !isNaN(prev)) {
        if (prev <= 0 && v > 0) eventos.push([i, 'up']);
        else if (prev >= 0 && v < 0) eventos.push([i, 'down']);
      }
      prev = v;
    }
    return eventos;
  }

  function lectura(macdLinea, senal, hist) {
    var i = hist.length - 1;
    var m = macdLinea[i], s = senal[i], h = hist[i], h0 = hist[i - 1];
    var puntos = (h > 0) + (m > 0) + (h > h0);
    return {
      m: m, s: s, h: h, h0: h0, puntos: puntos,
      sesgo: ['BEARISH', 'MIXED, BEARISH BIAS', 'MIXED, BULLISH BIAS', 'BULLISH'][puntos],
      texto: 'MACD ' + fmt(m, 2) + ' is ' + (m > 0 ? 'above' : 'below') + ' zero and ' +
        (h > 0 ? 'above' : 'below') + ' its signal (' + fmt(s, 2) + ').'
    };
  }

  /* ---------------------------------------------------------------
     macd y btc: la serie diaria de Bitso del ejemplo grabado
     --------------------------------------------------------------- */
  var BTC = D.btc;

  function serieBtc(fast, slow, sig) {
    var c = BTC.closes;
    var r = { close: c };
    if (fast === 12 && slow === 26 && sig === 9) {
      /* Continua las EMA desde su valor del primer dia, que el toolkit
         calculo con 200 velas de calentamiento antes del periodo. */
      r.maFast = emaDesde(c, 12, BTC.init.ma_fast);
      r.maSlow = emaDesde(c, 26, BTC.init.ma_slow);
      r.macd = restar(r.maFast, r.maSlow);
      r.signal = emaDesde(r.macd, 9, BTC.init.signal);
      r.ppo = r.maFast.map(function (f, i) { return 100 * (f - r.maSlow[i]) / r.maSlow[i]; });
      r.ppoSenal = emaDesde(r.ppo, 9, BTC.init.ppo_senal);
      r.calentada = true;
    } else {
      r.maFast = ema(c, fast);
      r.maSlow = ema(c, slow);
      r.macd = restar(r.maFast, r.maSlow);
      r.signal = ema(r.macd, sig);
      r.ppo = r.maFast.map(function (f, i) { return 100 * (f - r.maSlow[i]) / r.maSlow[i]; });
      r.ppoSenal = ema(r.ppo, sig);
      r.calentada = false;
    }
    r.hist = restar(r.macd, r.signal);
    r.ppoHist = restar(r.ppo, r.ppoSenal);
    r.cruces = cruces(r.ppoHist, 1e-9);
    r.validos = r.ppoHist.filter(function (v) { return !isNaN(v); }).length;
    return r;
  }

  async function demoMacd(args, t) {
    var p = args.map(function (a) { return parseInt(a, 10); });
    var fast = 12, slow = 26, sig = 9;
    if (args.length) {
      if (args.length !== 3 || p.some(function (v) { return !(v >= 1 && v <= 200); }) || p[0] >= p[1]) {
        t.imprimir('Usage: macd [fast slow signal], for example macd 5 35 5 (fast below slow, each 1 to 200).', 'err');
        return;
      }
      fast = p[0]; slow = p[1]; sig = p[2];
    }
    var r = serieBtc(fast, slow, sig);
    var n = r.close.length, ultimo = fecha(BTC.start, n - 1);
    var l = lectura(r.macd, r.signal, r.hist);
    var porCruce = r.validos / r.cruces.length;
    var ultimoCruce = r.cruces[r.cruces.length - 1];
    var lineas = [
      { contenido: 'EMA/MACD signal toolkit · macd-toolkit', clase: 'h' },
      'MACD (' + fast + ', ' + slow + ', ' + sig + ') and the PPO, its version in percent, computed now on',
      fmt(n) + ' daily BTC/MXN closes from Bitso, ' + fechaLarga(BTC.start) + ' to ' + fechaLarga(ultimo) + '.',
      '',
      [{ t: 'close  ', c: 'dim' }, chispa(r.close, 56, 'hi', 'Daily closes, average per column'), '  ' + pesos(r.close[n - 1])],
      [{ t: 'PPO    ', c: 'dim' }, chispa(r.ppo, 56, 'hi', 'PPO, average per column'), '  ' + fmt(r.ppo[n - 1], 2) + '%'],
      [{ t: '       ' + izq(fechaLarga(BTC.start), 28) + der(fechaLarga(ultimo), 28), c: 'dim' }],
      '',
      l.texto,
      'The histogram (' + fmt(l.h, 2) + ') is ' + (Math.abs(l.h) > Math.abs(l.h0) ? 'widening' : 'narrowing') +
        ' versus the previous day (' + fmt(l.h0, 2) + ').',
      ['Reading: ', { t: l.sesgo, c: 'hi' }, ' (' + l.puntos + ' of 3 bullish conditions: above the signal, above zero, rising)'],
      '',
      ['PPO crossovers: ', { t: String(r.cruces.length), c: 'hi' }, ' in ' + fmt(r.validos) + ' days, one every ',
        { t: fmt(porCruce, 1) + ' days', c: 'hi' }, '.'],
      'A random walk crosses every ' + BTC.random_walk_periods + ' periods (scripts/random_walk_crossings.py), so ' +
        (porCruce >= BTC.random_walk_periods ? 'this crosses less often than chance.' : 'these crossovers are as frequent as noise.'),
      'Last crossover: ' + (ultimoCruce[1] === 'up' ? 'bullish' : 'bearish') + ', ' +
        (n - 1 - ultimoCruce[0]) + ' days ago (' + fechaLarga(fecha(BTC.start, ultimoCruce[0])) + ').'
    ];
    if (r.calentada) {
      var peor = 0;
      BTC.checkpoints.forEach(function (c) {
        peor = Math.max(peor, Math.abs(r.ppo[c.i] - c.ppo), Math.abs(r.ppoSenal[c.i] - c.ppo_senal),
          Math.abs(r.macd[c.i] - c.macd), Math.abs(r.signal[c.i] - c.signal));
      });
      lineas.push('', [{ t: peor < 1e-6 ? 'Check: ' : 'Check FAILED: ', c: peor < 1e-6 ? 'ok' : 'err' },
        'MACD and PPO at ' + BTC.checkpoints.length + ' dates match the toolkit\'s serie.csv',
        ' (largest difference ' + cientifica(peor) + ', the CSV keeps 6 decimals).']);
    } else {
      lineas.push('', { contenido: 'Custom periods start from the first close, so the first ' + (slow + sig - 1) +
        ' days only seed the averages.', clase: 'dim' });
    }
    lineas.push([{ t: 'Next: ', c: 'dim' }, { cmd: 'btc', t: 'btc' }, { t: ' runs the same signals with real trading costs, ', c: 'dim' },
      { cmd: 'macd 5 35 5', t: 'macd 5 35 5' }, { t: ' tries other periods.', c: 'dim' }]);
    await t.salida(lineas);
  }

  /* El modelo de costos de btc_macd.py: a es la prima al comprar y b el
     descuento al vender, ambos contra el precio medio. */
  function costos(c) {
    return {
      nombre: c.name, a: c.a, b: c.b, compra: c.buy, venta: c.sell, spread: c.spread,
      btcPorPesos: function (pesosX, m) { return pesosX * (1 - c.buy) / (m * (1 + c.a)); },
      pesosPorBtc: function (btc, m) { return btc * m * (1 - c.b) * (1 - c.sell); },
      idaVuelta: 1 - (1 - c.buy) * (1 - c.sell) * (1 - c.b) / (1 + c.a)
    };
  }

  function posicionPpo(r, retraso) {
    var estado = new Array(r.close.length).fill(NaN);
    r.cruces.forEach(function (e) { estado[e[0]] = e[1] === 'up' ? 1 : 0; });
    var quiere = [], actual = 0;
    for (var i = 0; i < estado.length; i++) {
      if (!isNaN(estado[i])) actual = estado[i];
      quiere.push(actual === 1);
    }
    var desplazada = [];
    for (var j = 0; j < quiere.length; j++) desplazada.push(j - retraso >= 0 ? quiere[j - retraso] : false);
    return desplazada;
  }

  function simular(precios, c, estrategia, semanal, capital, quiere) {
    var btc = 0, efectivo = 0, aportado = 0, pagado = 0, ops = 0, peor = Infinity, conBtc = 0, recibido, valor = 0;
    for (var i = 0; i < precios.length; i++) {
      var precio = precios[i];
      if (estrategia === 'hold' && i === 0) {
        aportado = capital;
        recibido = c.btcPorPesos(capital, precio);
        pagado += capital - recibido * precio;
        btc = recibido; ops = 1;
      } else if (estrategia === 'weekly' && i % 7 === 0) {   // la serie es diaria y continua
        aportado += semanal;
        recibido = c.btcPorPesos(semanal, precio);
        pagado += semanal - recibido * precio;
        btc += recibido; ops++;
      } else if (estrategia === 'crossovers') {
        if (i === 0) aportado = efectivo = capital;
        if (quiere[i] && efectivo > 0) {
          recibido = c.btcPorPesos(efectivo, precio);
          pagado += efectivo - recibido * precio;
          btc += recibido; efectivo = 0; ops++;
        } else if (!quiere[i] && btc > 0) {
          var obtenidos = c.pesosPorBtc(btc, precio);
          pagado += btc * precio - obtenidos;
          efectivo += obtenidos; btc = 0; ops++;
        }
      }
      valor = efectivo + c.pesosPorBtc(btc, precio);
      if (aportado > 0) peor = Math.min(peor, valor / aportado - 1);
      if (btc > 0) conBtc++;
    }
    var ultimo = precios[precios.length - 1];
    return { valor: valor, aportado: aportado, costos: pagado + (efectivo + btc * ultimo - valor),
             ops: ops, btc: btc, peor: peor, diasConBtc: conBtc / precios.length };
  }

  function volatilidad(closes) {
    var r = [];
    for (var i = closes.length - 365; i < closes.length; i++) r.push(Math.log(closes[i]) - Math.log(closes[i - 1]));
    var m = r.reduce(function (a, b) { return a + b; }, 0) / r.length;
    var v = r.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / (r.length - 1);
    return Math.sqrt(v);
  }

  function tiempoLegible(dias) {
    if (!isFinite(dias)) return 'n/a';
    if (dias < 1) return fmt(dias * 24, 1) + ' h';
    if (dias < 60) return fmt(dias, 1) + ' days';
    return fmt(dias / 30.44, 1) + ' months';
  }

  var ESTRATEGIAS = [['hold', 'Buy and hold'], ['weekly', '$500 a week'], ['crossovers', 'PPO crossovers']];

  async function demoBtc(args, t) {
    var monto = 10000, manual = null;
    if (args.length && /^(mp|mercadopago|mercado)$/i.test(args[0])) {
      var compra = numero(args[1]), venta = numero(args[2]);
      if (!(compra > 0 && venta > 0 && compra >= venta)) {
        t.imprimir('Usage: btc mp BUY SELL [amount], with the two prices Mercado Pago\'s app shows at the', 'err');
        t.imprimir('same moment for buying and for selling (the buy price is the higher one).', 'err');
        t.imprimir('Copy them as the app writes them, for example btc mp 1.503.231,35 1.487.661,56', 'err');
        return;
      }
      manual = { compra: compra, venta: venta };
      if (args[3] !== undefined) monto = numero(args[3]);
    } else if (args.length) {
      monto = numero(args[0]);
    }
    if (!(monto >= 1 && monto <= 1e9)) {
      t.imprimir('Usage: btc [amount in pesos] or btc mp BUY SELL [amount]', 'err');
      return;
    }
    var m = BTC.reference_mid;
    /* Sin el libro de Bitso de ese momento, tus precios se miden contra su propio
       punto medio. La ida y vuelta y las estrategias solo dependen de venta / compra. */
    var mTuyo = manual ? (manual.compra + manual.venta) / 2 : m;
    var lista = BTC.costs.map(function (c) {
      var x = Object.assign({}, c);
      if (manual && c.key === 'Mercado Pago') {
        x.a = manual.compra / mTuyo - 1; x.b = 1 - manual.venta / mTuyo; x.spread = 'yours';
      }
      return costos(x);
    });
    var sinCostos = costos({ name: 'No costs', buy: 0, sell: 0, a: 0, b: 0, spread: 'none' });
    var sigma = volatilidad(BTC.closes);
    var lineas = [
      { contenido: 'Bitcoin with pesos: what each platform costs · macd-toolkit/btc_macd.py', clase: 'h' },
      'Commissions and spreads as the recorded run measured them (order books of ' + BTC.quotes_at + ').',
      'A round trip is buying and selling at once.',
      ''
    ];
    if (manual) {
      lineas.push(['Mercado Pago with your prices: buy ' + pesos(manual.compra, 2) + ', sell ' + pesos(manual.venta, 2) +
        ', spread ', { t: pct((manual.compra - manual.venta) / mTuyo, 2), c: 'hi' }, ' of their midpoint.']);
      if (mTuyo / m > 2 || mTuyo / m < 0.5) {
        lineas.push({ contenido: 'Those prices are far from the ' + pesos(m) + ' bitcoin cost in the recorded run: check the digits.', clase: 'warn' });
      }
      lineas.push('');
    }
    lineas.push({ contenido: izq('Platform', 24) + der('Round trip', 10) + der('Spread', 10) + der(pesos(monto) + ' back', 16) +
      der('Recovered in', 15), clase: 'dim' });
    var ordenados = lista.slice().sort(function (x, y) { return x.idaVuelta - y.idaVuelta; });
    ordenados.forEach(function (c) {
      var sinMedir = c.spread === 'unmeasured';
      var regreso = c.pesosPorBtc(c.btcPorPesos(monto, m), m);
      lineas.push(izq(c.nombre, 24) + der((sinMedir ? '>=' : '') + pct(c.idaVuelta, 2), 10) +
        der(sinMedir ? 'unknown' : pct(c.a + c.b, 3), 10) + der((sinMedir ? '<=' : '') + pesos(regreso), 16) +
        der((sinMedir ? '>=' : '') + tiempoLegible(Math.pow(c.idaVuelta / sigma, 2)), 15));
    });
    lineas.push({ contenido: 'Recovered in: how long bitcoin usually takes to move by the cost, (cost / ' +
      pct(sigma, 1) + ' daily volatility)².', clase: 'dim' });
    if (!manual) {
      BTC.costs.forEach(function (c) {
        var q = (BTC.quotes || {})[c.key];
        if (c.spread === 'unmeasured') {
          lineas.push({ contenido: c.name + '\'s spread is unmeasured: its row counts commissions only.', clase: 'dim' });
        } else if (c.spread === 'quote' && q) {
          lineas.push({ contenido: c.name + '\'s spread comes from its app on ' + fechaHora(q.at) + ' Mexico City time: buy ' +
            pesos(q.buy, 2) + ', sell ' + pesos(q.sell, 2) + ', against ' + pesos(q.reference) + ' last traded on Bitso.', clase: 'dim' });
        }
      });
    }

    /* Las tres estrategias, recalculadas con las senales del PPO */
    var r = serieBtc(12, 26, 9);
    var quiere = posicionPpo(r, BTC.delay);
    var filas = ordenados.concat([sinCostos]).map(function (c) {
      var res = {};
      ESTRATEGIAS.forEach(function (e) {
        res[e[0]] = simular(BTC.closes, c, e[0], BTC.weekly, BTC.capital, quiere);
      });
      return { c: c, res: res };
    });
    var dias = BTC.closes.length;
    lineas.push('', { contenido: 'Three strategies with the same ' + pesos(BTC.capital) + ', ' + fechaLarga(BTC.start) + ' to ' +
      fechaLarga(fecha(BTC.start, dias - 1)) + ', simulated now:', clase: 'h' });
    lineas.push({ contenido: izq('Platform', 24) + ESTRATEGIAS.map(function (e) { return der(e[1], 16); }).join(''), clase: 'dim' });
    filas.forEach(function (f) {
      lineas.push(izq(f.c.nombre, 24) + ESTRATEGIAS.map(function (e) { return der(pesos(f.res[e[0]].valor), 16); }).join(''));
    });
    var mp = filas.filter(function (f) { return f.c.nombre === 'Mercado Pago'; })[0];
    var libre = filas[filas.length - 1];
    lineas.push({ contenido: '$500 every 7 days is ' + mp.res.weekly.ops + ' purchases; the other two put the same money in on day one.', clase: 'dim' });
    lineas.push({ contenido: 'Crossovers buy and sell at the next close after each PPO cross: ' + mp.res.crossovers.ops +
      ' trades, each paying its costs.', clase: 'dim' });
    lineas.push(['With Mercado Pago the crossovers end ', { t: pct(1 - mp.res.crossovers.valor / libre.res.crossovers.valor, 1), c: 'hi' },
      ' below the same trades without costs.']);

    /* Comparacion con estrategias.csv de la corrida grabada */
    var peor = 0, revisadas = 0;
    filas.forEach(function (f) {
      if (manual && f.c.nombre === 'Mercado Pago') return;
      ESTRATEGIAS.forEach(function (e) {
        var key = { hold: 'mantener', weekly: 'semanal', crossovers: 'cruces' }[e[0]];
        var ref = BTC.expected.filter(function (x) { return x.strategy === key && x.platform === f.c.nombre; })[0];
        if (!ref) return;
        var res = f.res[e[0]];
        peor = Math.max(peor, Math.abs(res.valor - ref.value), Math.abs(res.costos - ref.costs));
        if (res.ops !== ref.trades) peor = Infinity;
        revisadas++;
      });
    });
    lineas.push('', [{ t: peor < 0.005 ? 'Check: ' : 'Check FAILED: ', c: peor < 0.005 ? 'ok' : 'err' },
      revisadas + ' of ' + revisadas + ' results match estrategias.csv of the recorded run to the cent' +
      (manual ? ' (Mercado Pago now uses your prices).' : '.')]);
    lineas.push({ contenido: 'An academic exercise on past data, not investment advice.', clase: 'dim' });
    lineas.push([{ t: 'Try: ', c: 'dim' }, { cmd: 'btc 25000', t: 'btc 25000' },
      { t: ' for another amount, or btc mp BUY SELL with the prices Mercado Pago\'s app shows.', c: 'dim' }]);
    await t.salida(lineas);
  }

  /* ---------------------------------------------------------------
     qa: la calculadora de comisiones de los dos builds, en centavos
     --------------------------------------------------------------- */
  var BANDAS = [['A', 0n, 80n, 10n], ['B', 80n, 100n, 25n], ['C', 100n, 150n, 40n], ['D', 150n, 200n, 50n]];

  /* n / d redondeado a entero: "up" lleva los empates lejos de cero (ROUND_HALF_UP),
     "even" al par (ROUND_HALF_EVEN, lo que hace Decimal si no se le dice otra cosa) */
  function dividir(n, d, modo) {
    var negativo = n < 0n;
    if (negativo) n = -n;
    var q = n / d, r = n % d;
    if (2n * r > d || (2n * r === d && (modo === 'up' || q % 2n === 1n))) q += 1n;
    return negativo ? -q : q;
  }

  function centavos(texto) {
    var m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(texto).replace(/[,\s$]/g, ''));
    if (!m) return null;
    var c = BigInt(m[2]) * 100n + BigInt(((m[3] || '') + '00').slice(0, 2));
    return m[1] ? -c : c;
  }

  function dosDecimales(c) {
    var negativo = c < 0n;
    if (negativo) c = -c;
    var s = (c / 100n).toString() + '.' + (c % 100n).toString().padStart(2, '0');
    return negativo ? '-' + s : s;
  }

  function miles(texto) {
    var p = texto.split('.');
    var entero = p[0].replace('-', '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (p[0].charAt(0) === '-' ? '-' : '') + entero + (p[1] !== undefined ? '.' + p[1] : '');
  }

  /* app/calc.py: rc2 y, con build 'rc1', el codigo de v0.1.0-rc1 */
  function calcular(cuota, acreditado, build) {
    var modo = build === 'rc1' ? 'even' : 'up';
    var logroCentesimas = dividir(acreditado * 10000n, cuota, modo);           // 50.00% -> 5000
    var califica = build === 'rc1' ? logroCentesimas >= 5000n : acreditado * 100n >= cuota * 50n;
    var total = 0n, bandas = [];
    BANDAS.forEach(function (b) {
      var tope = b[2] * cuota, base = (acreditado * 100n < tope ? acreditado * 100n : tope) - b[1] * cuota; // centavos/100
      if (base < 0n) base = 0n;
      var comision = base * b[3];                                              // centavos/100000
      total += comision;
      bandas.push([b[0], dosDecimales(dividir(base, 100n, modo)), dosDecimales(dividir(comision, 100000n, modo))]);
    });
    var pago = califica ? dividir(total, 100000n, modo) : 0n;
    if (pago < 0n) pago = 0n;
    return { attainment: dosDecimales(logroCentesimas), qualified: califica, payout: dosDecimales(pago), bands: bandas };
  }

  function observado(st, check) {
    if (check === 'gate') return st.attainment + '|' + (st.qualified ? 'yes' : 'no') + '|' + st.payout;
    if (check === 'payout') return st.payout;
    if (check === 'attainment') return st.attainment;
    if (check === 'band_a') return st.bands[0][2];
    return st.bands.map(function (b) { return b[1] + '/' + b[2]; }).join(' ');
  }

  function describir(valor, check) {
    if (check === 'gate') {
      var p = valor.split('|');
      return p[0] + '%, ' + (p[1] === 'yes' ? 'qualifies' : 'does not qualify') + ', pays ' + miles(p[2]);
    }
    if (check === 'payout') return 'pays ' + miles(valor);
    if (check === 'attainment') return 'shows ' + valor + '%';
    if (check === 'band_a') return 'band A commission ' + valor;
    return 'band commissions ' + valor.split(' ').map(function (b) { return miles(b.split('/')[1]); }).join(' · ');
  }

  async function demoQa(args, t) {
    var Q = D.qa;
    if (args.length === 2) {
      var cuota = centavos(canonico(args[0])), acreditado = centavos(canonico(args[1]));
      if (cuota === null || acreditado === null || cuota <= 0n || cuota > 10n ** 13n || acreditado > 10n ** 13n || acreditado < -(10n ** 13n)) {
        t.imprimir('Usage: qa QUOTA CREDITED, for example qa 100000 125000 (pesos, up to two decimals).', 'err');
        return;
      }
      var st = calcular(cuota, acreditado, 'rc2'), viejo = calcular(cuota, acreditado, 'rc1');
      var filas = [
        { contenido: 'Statement for plan RET-Q4-2026, build 0.1.0-rc2', clase: 'h' },
        'Quota ' + miles(dosDecimales(cuota)) + ', net credited ' + miles(dosDecimales(acreditado)) + ': attainment ' +
          st.attainment + '%, ' + (st.qualified ? 'qualifies (50% gate passed).' : 'below the 50% gate, so nothing is paid.'),
        '',
        { contenido: izq('Band', 6) + izq('From', 7) + izq('To', 7) + izq('Rate', 7) + der('Base', 18) + der('Commission', 14), clase: 'dim' }
      ];
      st.bands.forEach(function (b, i) {
        filas.push(izq(b[0], 6) + izq(['0%', '80%', '100%', '150%'][i], 7) + izq(['80%', '100%', '150%', '200%'][i], 7) +
          izq(['1.0%', '2.5%', '4.0%', '5.0%'][i], 7) + der(miles(b[1]), 18) + der(miles(b[2]), 14));
      });
      filas.push(['Payout ', { t: miles(st.payout), c: 'hi' }, ' MXN']);
      var difiere = observado(st, 'gate') !== observado(viejo, 'gate') || observado(st, 'bands') !== observado(viejo, 'bands');
      if (difiere) {
        filas.push('', [{ t: 'Build rc1 would have said: ', c: 'warn' }, 'attainment ' + viejo.attainment + '%, ' +
          (viejo.qualified ? 'qualifies' : 'does not qualify') + ', payout ' + miles(viejo.payout) + '.']);
      } else {
        filas.push({ contenido: 'Build rc1 gives the same statement for these numbers.', clase: 'dim' });
      }
      await t.salida(filas);
      return;
    }
    var build = args[0] && /^rc1$/i.test(args[0]) ? 'rc1' : 'rc2';
    if (args.length && !/^rc[12]$/i.test(args[0])) {
      t.imprimir('Usage: qa, qa rc1, or qa QUOTA CREDITED', 'err');
      return;
    }
    var lineas = [
      { contenido: 'Incentive compensation API: the calculation suite · incentive-comp-qa', clase: 'h' },
      'Plan RET-Q4-2026 pays nothing below 50% of quota. Above that it pays 1.0% of sales up to',
      '80%, then 2.5% to 100%, 4.0% to 150% and 5.0% to 200%, with nothing above 200%.',
      build === 'rc2'
        ? 'Build 0.1.0-rc2. Its app/calc.py is ported to this page, in exact cents.'
        : 'Build 0.1.0-rc1, the first one. Its app/calc.py, ported the same way.',
      '',
      { contenido: izq('', 6) + izq('Case', 12) + izq('Credited of quota', 26) + 'Result', clase: 'dim' }
    ];
    var pasaron = 0, fallaron = [], coincide = 0;
    Q.cases.forEach(function (c) {
      var st = calcular(centavos(c.quota), centavos(c.credited), build);
      var visto = observado(st, c.check), ok = visto === c.expected;
      if (ok) pasaron++; else fallaron.push(c.id);
      var ref = build === 'rc1' ? c.rc1 : c.rc2;
      if (JSON.stringify(st) === JSON.stringify(ref)) coincide++;
      lineas.push([{ t: ok ? 'PASS  ' : 'FAIL  ', c: ok ? 'ok' : 'err' }, izq(c.id, 12),
        izq(miles(c.credited) + ' of ' + miles(c.quota), 26), describir(visto, c.check)]);
      if (!ok) lineas.push({ contenido: izq('', 44) + 'expected: ' + describir(c.expected, c.check) + ' (' + Q.bugs[c.id] + ')', clase: 'warn' });
    });
    lineas.push('');
    lineas.push([{ t: pasaron + ' of ' + Q.cases.length + ' checks passed', c: pasaron === Q.cases.length ? 'ok' : 'err' },
      ' (' + Q.cases.length + ' checks from 14 test cases of docs/03-test-cases.csv).']);
    if (build === 'rc1') {
      lineas.push('BUG-002: the gate read the rounded 50.00% instead of the exact 49.995%.');
      lineas.push('BUG-003 and BUG-006: Decimal rounds ties to even unless told otherwise, so 50.005 became 50.00.');
      lineas.push({ contenido: 'On PostgreSQL every sale failed before reaching this code (BUG-008), which is why the', clase: 'dim' });
      lineas.push({ contenido: 'catalogue records 30 of 92 for rc1. Here only the calculation runs, as it did on SQLite.', clase: 'dim' });
    }
    lineas.push([{ t: coincide === Q.cases.length ? 'Check: ' : 'Check FAILED: ', c: coincide === Q.cases.length ? 'ok' : 'err' },
      coincide + ' of ' + Q.cases.length + ' statements are identical to what ' + build + '\'s Python code returns.']);
    lineas.push([{ t: 'Try: ', c: 'dim' }, build === 'rc2' ? { cmd: 'qa rc1', t: 'qa rc1' } : { cmd: 'qa', t: 'qa' },
      { t: build === 'rc2' ? ' replays the first build, ' : ' runs the fixed build, ', c: 'dim' },
      { cmd: 'qa 100000 125000', t: 'qa 100000 125000' }, { t: ' calculates any statement.', c: 'dim' }]);
    await t.salida(lineas, 10);
  }

  /* ---------------------------------------------------------------
     vigia: el detector de latencia de anomaly.py
     --------------------------------------------------------------- */
  var V = D.vigia;

  function mediana(valores) {
    var s = valores.slice().sort(function (a, b) { return a - b; }), n = s.length;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  }

  function detectar(minimo, umbral) {
    var cfg = V.config, ventana = cfg.window, minPeriodos = Math.max(3, Math.floor(ventana / 2));
    var lat = V.p95.map(function (p, i) { return V.requests[i] >= minimo ? p : NaN; });
    var z = [], base = [], marcado = [];
    for (var i = 0; i < lat.length; i++) {
      var previos = [];
      for (var j = Math.max(0, i - ventana); j < i; j++) if (!isNaN(lat[j])) previos.push(lat[j]);
      var b = NaN, mad = NaN;
      if (previos.length >= minPeriodos) {
        b = mediana(previos);
        mad = mediana(previos.map(function (v) { return Math.abs(v - b); }));
      }
      var piso = Math.max(0.05 * b, 1.0);
      var zi = 0.6745 * (lat[i] - b) / Math.max(mad, piso);
      z.push(isNaN(lat[i]) || isNaN(b) ? NaN : zi);
      base.push(b);
      marcado.push(zi > umbral && lat[i] >= cfg.min_relative_increase * b);
    }
    /* Episodios: marcas a 1 cubeta de distancia o menos son el mismo problema */
    var episodios = [], actual = null;
    marcado.forEach(function (m, i) {
      if (!m) return;
      if (actual && i - actual.fin <= cfg.max_gap_buckets + 1) { actual.fin = i; actual.cubetas.push(i); }
      else { actual = { inicio: i, fin: i, cubetas: [i] }; episodios.push(actual); }
    });
    episodios = episodios.filter(function (e) {
      e.max = Math.max.apply(null, e.cubetas.map(function (k) { return z[k]; }).concat([0]));
      e.pico = Math.max.apply(null, e.cubetas.map(function (k) { return V.p95[k]; }));
      e.peticiones = e.cubetas.map(function (k) { return V.requests[k]; });
      return e.cubetas.length >= cfg.min_episode_buckets || e.max >= cfg.strong_score;
    });
    return { z: z, base: base, marcado: marcado, episodios: episodios, minimo: minimo, umbral: umbral };
  }

  function hora(i) {
    var minutos = (i * V.bucket_minutes) % (24 * 60);
    return String(Math.floor(minutos / 60)).padStart(2, '0') + ':' + String(minutos % 60).padStart(2, '0');
  }

  async function demoVigia(args, t) {
    var minimo = V.reference['default'].min_requests, umbral = V.reference['default'].threshold, nombre = 'default';
    if (args.length === 1 && /^old$/i.test(args[0])) {
      minimo = V.reference.old.min_requests; umbral = V.reference.old.threshold; nombre = 'old';
    } else if (args.length === 2) {
      minimo = parseInt(args[0], 10); umbral = Number(args[1]); nombre = null;
      if (!(minimo >= 1 && minimo <= 1000 && umbral > 0 && umbral <= 50)) {
        t.imprimir('Usage: vigia, vigia old, or vigia MIN_REQUESTS THRESHOLD (for example vigia 50 4)', 'err');
        return;
      }
    } else if (args.length) {
      t.imprimir('Usage: vigia, vigia old, or vigia MIN_REQUESTS THRESHOLD', 'err');
      return;
    }
    var r = detectar(minimo, umbral);
    var dia = 96, n = V.p95.length, inc = V.incident;
    var p95 = V.p95.slice(dia), pet = V.requests.slice(dia);
    var juzgado = '', alarmas = '';
    var enInc = function (i) { return i >= inc.start_bucket && i < inc.start_bucket + inc.buckets; };
    for (var k = 0; k < 48; k++) {
      var a = dia + 2 * k, b = a + 1;
      juzgado += (V.requests[a] >= minimo || V.requests[b] >= minimo) ? '=' : '·';
      var marca = r.episodios.some(function (e) { return e.cubetas.indexOf(a) >= 0 || e.cubetas.indexOf(b) >= 0; });
      alarmas += marca ? (enInc(a) || enInc(b) ? '^' : '!') : ' ';
    }
    var eje = new Array(48).fill(' ');
    [[0, '00:00'], [12, '06:00'], [24, '12:00'], [36, '18:00'], [43, '24:00']].forEach(function (m) {
      for (var c = 0; c < m[1].length; c++) eje[m[0] + c] = m[1].charAt(c);
    });
    var lineas = [
      { contenido: 'Vigía: latency anomaly detection · vigia', clase: 'h' },
      'One day of ' + V.app + ' traffic from Vigía\'s own simulator (scripts/traffic_model.py),',
      '7 October 2026 in Mexico City time, with a one-hour incident at 15:00 that makes every',
      'call ' + inc.factor + ' times slower. The day before feeds the baseline. Detector ported from',
      'analytics-api/vigia_analytics/anomaly.py (its latency half; errors are left out).',
      '',
      [{ t: '          ' + eje.join(''), c: 'dim' }],
      [{ t: 'p95       ', c: 'dim' }, chispa(p95, 48, 'hi', 'p95 latency, two buckets per column'), '  ' + fmt(Math.min.apply(null, p95)) + ' to ' + fmt(Math.max.apply(null, p95)) + ' ms'],
      [{ t: 'requests  ', c: 'dim' }, chispa(pet, 48, 'hi', 'Requests, two buckets per column'), '  ' + Math.min.apply(null, pet) + ' to ' + Math.max.apply(null, pet) + ' per 15 min'],
      [{ t: 'judged    ', c: 'dim' }, juzgado, { t: '  = at least ' + minimo + ' requests', c: 'dim' }],
      [{ t: 'alarms    ', c: 'dim' }, { t: alarmas, c: 'warn' }],
      '',
      'Rule' + (nombre === 'default' ? ' (the calibrated defaults):' : nombre === 'old' ? ' (the starting point):' : ' (yours):'),
      ['  judge latency only in buckets with at least ', { t: String(minimo), c: 'hi' }, ' requests'],
      ['  alarm when the robust z-score is above ', { t: String(umbral), c: 'hi' }, ' and the p95 is 30% above its baseline'],
      '  z = 0.6745 (p95 - median) / MAD, over the previous 16 buckets',
      '  a lone bucket is noise unless z reaches 10; two or more make an episode',
      ''
    ];
    if (!r.episodios.length) lineas.push({ contenido: 'No alarms. The injected incident was missed.', clase: 'err' });
    r.episodios.forEach(function (e) {
      if (e.inicio < dia) return;
      var real = e.cubetas.some(function (i) { return i >= inc.start_bucket && i < inc.start_bucket + inc.buckets; });
      lineas.push([izq(hora(e.inicio) + '-' + hora(e.fin + 1), 13), izq(e.cubetas.length + ' bucket' + (e.cubetas.length > 1 ? 's' : ''), 11),
        izq('peak ' + fmt(e.pico) + ' ms', 15), izq('max z ' + fmt(e.max, 1), 12),
        real ? { t: 'the injected incident', c: 'ok' } : { t: 'false alarm: ' + e.peticiones.join(' and ') + ' requests', c: 'err' }]);
    });
    if (nombre === 'default') {
      lineas.push('', 'Buckets with fewer than 100 requests are not judged: at night the p95 of 40 calls is');
      lineas.push('really the second slowest call, and one slow call is not an incident.');
    }
    if (nombre === 'old') {
      lineas.push('', 'With 30 requests the night buckets count, and two slow calls at 02:00 look like an incident.');
    }
    lineas.push('', { contenido: 'Calibration over 40 simulated runs (2,400 application-days, 120 incidents, none missed):', clase: 'dim' });
    V.calibration.forEach(function (c) {
      lineas.push({ contenido: '  at least ' + der(c[0], 3) + ' requests, z above ' + c[1] + ':  ' + der(c[2], 2) + ' false alarm' +
        (c[2] === 1 ? '' : 's') + (c[0] === 100 && c[1] === 4.5 ? '   (the defaults)' : ''), clase: 'dim' });
    });
    if (nombre) {
      var ref = V.reference[nombre], peor = 0, iguales = true;
      r.z.forEach(function (v, i) {
        var w = ref.z[i];
        if ((w === null) !== isNaN(v)) iguales = false;
        else if (w !== null) peor = Math.max(peor, Math.abs(v - w));
      });
      var mismos = JSON.stringify(r.episodios.map(function (e) { return [e.inicio, e.cubetas.length]; })) ===
        JSON.stringify(ref.episodes.map(function (e) { return [e[0], e[1]]; }));
      var ok = iguales && mismos && peor < 1e-9;
      lineas.push('', [{ t: ok ? 'Check: ' : 'Check FAILED: ', c: ok ? 'ok' : 'err' },
        'z-scores and episodes match anomaly.py on these ' + n + ' buckets (largest difference ' + cientifica(peor) + ').']);
    }
    lineas.push([{ t: 'Try: ', c: 'dim' }, nombre === 'old' ? { cmd: 'vigia', t: 'vigia' } : { cmd: 'vigia old', t: 'vigia old' },
      { t: nombre === 'old' ? ' for the calibrated rule, ' : ' for the starting point, ', c: 'dim' },
      { cmd: 'vigia 50 4', t: 'vigia 50 4' }, { t: ' for your own.', c: 'dim' }]);
    await t.salida(lineas);
  }

  /* ---------------------------------------------------------------
     notes: BM25 en espanol sobre la nota de ejemplo
     --------------------------------------------------------------- */
  var N = D.notes;
  var STOP = {};
  N.stopwords.forEach(function (w) { STOP[w] = true; });

  function normalizar(texto) { return texto.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase(); }

  function terminos(texto) {
    var palabras = normalizar(texto).match(/[a-z0-9ñ]+/g) || [];
    return palabras.filter(function (p) { return !STOP[p] && p.length > 1; })
      .map(function (p) { return window.LQSnowballEs.stem(p); });
  }

  function documento(f) {
    var donde = f.minute ? 'minuto ' + f.minute : f.section;
    return donde ? N.note + ' | ' + donde + '\n' + f.text : N.note + '\n' + f.text;
  }

  var indice = null;
  function indexar() {
    if (indice) return indice;
    indice = N.fragments.map(function (f) { return terminos(documento(f)); });
    return indice;
  }

  function bm25(consulta) {
    var docs = indexar(), q = {}, n = docs.length;
    terminos(consulta).forEach(function (t) { q[t] = true; });
    if (!Object.keys(q).length) return [];
    var promedio = docs.reduce(function (s, d) { return s + d.length; }, 0) / n || 1;
    var df = {};
    docs.forEach(function (d) {
      var vistos = {};
      d.forEach(function (t) { if (q[t] && !vistos[t]) { vistos[t] = true; df[t] = (df[t] || 0) + 1; } });
    });
    var puntajes = [];
    docs.forEach(function (d, i) {
      var frec = {}, orden = [];
      d.forEach(function (t) { if (q[t]) { if (!frec[t]) { frec[t] = 0; orden.push(t); } frec[t]++; } });
      if (!orden.length) return;
      var s = 0;
      orden.forEach(function (t) {
        var f = frec[t], idf = Math.log(1 + (n - df[t] + 0.5) / (df[t] + 0.5));
        s += idf * f * (N.k1 + 1) / (f + N.k1 * (1 - N.b + N.b * d.length / promedio));
      });
      puntajes.push([i, s]);
    });
    return puntajes.sort(function (a, b) { return b[1] - a[1]; });
  }

  /* Texto de la nota sin la marca de Obsidian y con las palabras de la busqueda resaltadas */
  function textoLegible(texto) {
    if (/^```mermaid/.test(texto.trim())) {
      var pasos = [];
      texto.replace(/"([^"]+)"/g, function (_, s) { pasos.push(s); return _; });
      return 'Flowchart: ' + pasos.join(' → ');
    }
    return texto.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, function (_, s) { return s.replace(/^#/, ''); })
      .replace(/\*\*|\*|__|`{1,3}|^#+\s*|^>\s?/gm, '').replace(/\s+/g, ' ').trim();
  }

  function fragmentoLegible(texto, consulta, largo) {
    var limpio = textoLegible(texto);
    var buscadas = {};
    terminos(consulta).forEach(function (t) { buscadas[t] = true; });
    var piezas = [], re = /[A-Za-zÀ-ɏ0-9]+/g, m, primero = -1;
    var marcas = [];
    while ((m = re.exec(limpio))) {
      var t = terminos(m[0]);
      if (t.length && buscadas[t[0]]) { marcas.push([m.index, m.index + m[0].length]); if (primero < 0) primero = m.index; }
    }
    var inicio = Math.max(0, (primero < 0 ? 0 : primero) - 60);
    if (inicio > 0) { var espacio = limpio.indexOf(' ', inicio); inicio = espacio > 0 ? espacio + 1 : inicio; }
    var fin = Math.min(limpio.length, inicio + largo);
    if (fin < limpio.length) { var corte = limpio.lastIndexOf(' ', fin); fin = corte > inicio ? corte : fin; }
    var pos = inicio;
    if (inicio > 0) piezas.push('…');
    marcas.forEach(function (mk) {
      if (mk[0] < inicio || mk[1] > fin) return;
      piezas.push(limpio.slice(pos, mk[0]));
      piezas.push({ t: limpio.slice(mk[0], mk[1]), c: 'hi' });
      pos = mk[1];
    });
    piezas.push(limpio.slice(pos, fin) + (fin < limpio.length ? '…' : ''));
    return piezas;
  }

  var ETIQUETAS = { apuntes: 'class notes', claude: 'added by Claude', transcripcion: 'transcript' };

  async function demoNotes(args, t) {
    var consulta = args.join(' ').trim() || 'sistema alemán';
    var resultados = bm25(consulta);
    var lineas = [
      { contenido: 'Lecture notes pipeline: the exact-word half of its search · class-notes-pipeline', clase: 'h' },
      'The sample note "' + N.note + '" (a finance class, in Spanish), split into ' + N.fragments.length + ' fragments',
      'the way extensiones/indice.py does it. Claude\'s additions stay apart from the class notes,',
      'and each transcript passage keeps its minute. Ranked here with BM25 and Spanish stemming.',
      { contenido: 'The real search also ranks by meaning with multilingual embeddings and merges both lists', clase: 'dim' },
      { contenido: 'with Reciprocal Rank Fusion before the agent writes an answer that cites them.', clase: 'dim' },
      '',
      ['Search: ', { t: consulta, c: 'hi' }, { t: '   (terms: ' + (terminos(consulta).join(', ') || 'none') + ')', c: 'dim' }]
    ];
    if (!resultados.length) {
      lineas.push({ contenido: 'No fragment contains those words. The pipeline\'s agent would say the notes do not cover it.', clase: 'warn' });
    }
    resultados.slice(0, 3).forEach(function (r, k) {
      var f = N.fragments[r[0]];
      var donde = f.source === 'transcripcion'
        ? N.note + ' · minute ' + (f.minute || '(part heading)')
        : N.note + (f.section ? ' › ' + f.section : '');
      lineas.push('');
      lineas.push([{ t: (k + 1) + '. ', c: 'hi' }, donde]);
      lineas.push([{ t: '   ' + ETIQUETAS[f.source] + ' · BM25 ' + fmt(r[1], 2), c: 'dim' }]);
      lineas.push(['   '].concat(fragmentoLegible(f.text, consulta, 150)));
    });
    var ref = N.reference[consulta] || N.reference[consulta.toLowerCase()];
    var conteos = indexar().every(function (d, i) { return d.length === N.fragments[i].terms; });
    lineas.push('');
    if (ref) {
      var mios = resultados.slice(0, ref.length).map(function (r) { return r[0]; });
      var igual = JSON.stringify(mios) === JSON.stringify(ref) && conteos;
      lineas.push([{ t: igual ? 'Check: ' : 'Check FAILED: ', c: igual ? 'ok' : 'err' },
        'same top ' + ref.length + ' as indice.ranking_bm25 for this search, and the same terms for all ' + N.fragments.length + ' fragments.']);
    } else {
      lineas.push([{ t: conteos ? 'Check: ' : 'Check FAILED: ', c: conteos ? 'ok' : 'err' },
        'all ' + N.fragments.length + ' fragments give the same terms as the pipeline\'s Python code.']);
    }
    lineas.push([{ t: 'Try: ', c: 'dim' }].concat(Object.keys(N.reference).filter(function (q) { return q !== consulta; }).slice(0, 4)
      .reduce(function (acc, q, i) {
        if (i) acc.push({ t: ' · ', c: 'dim' });
        acc.push({ cmd: 'notes ' + q, t: 'notes ' + q });
        return acc;
      }, [])));
    await t.salida(lineas);
  }

  /* ---------------------------------------------------------------
     api: POST /v1/macd con el motor de macd-signal-api
     --------------------------------------------------------------- */
  var A = D.api;

  function describirUltimo(m, s, h, h0) {
    return 'MACD ' + m.toFixed(4) + ' is ' + (m > 0 ? 'above' : 'below') + ' zero and ' + (h > 0 ? 'above' : 'below') +
      ' its signal (' + s.toFixed(4) + '). The histogram (' + h.toFixed(4) + ') is ' +
      (Math.abs(h) > Math.abs(h0) ? 'widening' : 'narrowing') + ' versus the previous period (' + h0.toFixed(4) + ').';
  }

  function motorMacd(closes, tolRelativa) {
    var fast = ema(closes, 12), slow = ema(closes, 26);
    var linea = restar(fast, slow), senal = ema(linea, 9), hist = restar(linea, senal);
    var escala = Math.max(1, Math.max.apply(null, closes.map(Math.abs)));
    var tol = tolRelativa * escala;
    var eventos = [];
    cruces(hist, tol).forEach(function (e) { eventos.push([e[0], e[1] === 'up' ? 'bullish_cross' : 'bearish_cross']); });
    cruces(linea, tol).forEach(function (e) { eventos.push([e[0], e[1] === 'up' ? 'zero_up' : 'zero_down']); });
    eventos.sort(function (a, b) { return a[0] - b[0] || (a[1] < b[1] ? -1 : 1); });
    return { fast: fast, slow: slow, linea: linea, senal: senal, hist: hist, eventos: eventos };
  }

  function jsonNumero(x) { return isNaN(x) ? 'null' : String(x); }

  async function demoApi(args, t) {
    if (args.length && /^bug$/i.test(args[0])) return demoBug(t);
    var cuantos = A.prices.length;
    if (args.length) {
      cuantos = parseInt(args[0], 10);
      if (!(cuantos >= 1 && cuantos <= A.prices.length)) {
        t.imprimir('Usage: api, api N (1 to ' + A.prices.length + ' closes) or api bug', 'err');
        return;
      }
    }
    var precios = A.prices.slice(A.prices.length - cuantos);
    var closes = precios.map(function (p) { return p[1]; });
    var lineas = [
      { contenido: 'MACD signal API · macd-signal-api', clase: 'h' },
      'The engine behind POST /v1/macd, run here on the last ' + cuantos + ' closes of data/sample_prices.csv',
      '(a synthetic random walk), with the default 12/26/9 and an SMA seed.',
      '',
      [{ t: 'POST /v1/macd ', c: 'hi' }, '{"prices": [{"date": "' + precios[0][0] + '", "close": ' + precios[0][1] + '}, … ' +
        (cuantos - 1) + ' more], "freq": "D"}']
    ];
    var primera = 26 + 9 - 1;
    if (cuantos < primera) {
      lineas.push([{ t: '422 Unprocessable Entity', c: 'err' }]);
      lineas.push('{"error": {"code": "INSUFFICIENT_DATA",');
      lineas.push('           "message": "The signal line needs ' + primera + ' periods and ' + cuantos + ' are available",');
      lineas.push('           "details": [{"required": ' + primera + ', "available": ' + cuantos + '}]}}');
      lineas.push({ contenido: 'TC-API-005 checks this boundary: 33 closes are rejected, 34 accepted.', clase: 'dim' });
      lineas.push([{ t: 'Try: ', c: 'dim' }, { cmd: 'api 34', t: 'api 34' }, { t: ' · ', c: 'dim' }, { cmd: 'api bug', t: 'api bug' }]);
      await t.salida(lineas);
      return;
    }
    var r = motorMacd(closes, 1e-9);
    var n = closes.length, u = n - 1;
    var fila = function (i) {
      return '    {"date": "' + precios[i][0] + '", "close": ' + precios[i][1] + ', "macd": ' + jsonNumero(r.linea[i]) +
        ', "signal": ' + jsonNumero(r.senal[i]) + ', "hist": ' + jsonNumero(r.hist[i]) + '}';
    };
    lineas.push([{ t: '200 OK', c: 'ok' }]);
    lineas.push('{"config": {"fast": 12, "slow": 26, "signal": 9, "kind": "ema", "seed": "sma"},');
    lineas.push(' "freq": "D", "asof": "' + precios[u][0] + '", "periods": ' + n + ', "first_signal_period": ' + primera + ',');
    lineas.push(' "series": [');
    lineas.push({ contenido: '    … ' + (n - 2) + ' rows, with ma_fast and ma_slow too (shortened here) …', clase: 'dim' });
    lineas.push(fila(u - 1) + ',');
    lineas.push(fila(u) + '],');
    lineas.push(' "events": [');
    r.eventos.forEach(function (e, k) {
      lineas.push('    {"date": "' + precios[e[0]][0] + '", "event": "' + e[1] + '"}' + (k < r.eventos.length - 1 ? ',' : '') );
    });
    lineas.push(' ],');
    var texto = describirUltimo(r.linea[u], r.senal[u], r.hist[u], r.hist[u - 1]);
    lineas.push(' "last": {"date": "' + precios[u][0] + '", "reading": "' + texto.slice(0, 58) + '…"}}');
    if (cuantos === A.prices.length) {
      var e = A.expected;
      var difer = Math.max(Math.abs(r.linea[u] - e.last.macd), Math.abs(r.senal[u] - e.last.signal), Math.abs(r.hist[u] - e.last.hist));
      var mismos = JSON.stringify(r.eventos.map(function (x) { return [precios[x[0]][0], x[1]]; })) === JSON.stringify(e.events);
      var ok = difer === 0 && mismos && texto === e.last.reading;
      lineas.push('', [{ t: ok ? 'Check: ' : 'Check FAILED: ', c: ok ? 'ok' : 'err' },
        'bit for bit the same values, events and reading as the Python engine (difference ' + cientifica(difer) + ').']);
      lineas.push({ contenido: 'Same arithmetic in the same order as NumPy, including its pairwise sum for the seed.', clase: 'dim' });
    }
    lineas.push([{ t: 'Try: ', c: 'dim' }, { cmd: 'api bug', t: 'api bug' }, { t: ' replays the defect its tests found, ', c: 'dim' },
      { cmd: 'api 33', t: 'api 33' }, { t: ' asks for too little data.', c: 'dim' }]);
    await t.salida(lineas);
  }

  async function demoBug(t) {
    var linea = [], i;
    for (i = 0; i < 60; i++) linea.push(i === 59 ? 80 : i * ((80 - 100) / 59) + 100);      // np.linspace(100, 80, 60)
    for (i = 0; i < 60; i++) linea.push(i === 59 ? 110 : i * ((110 - 80) / 59) + 80);      // np.linspace(80, 110, 60)
    var nuevo = motorMacd(linea, 1e-9), viejo = motorMacd(linea, 0);
    var texto = function (r) {
      return r.eventos.map(function (e) { return e[1] + ' ' + (e[0] + 1); }).join(' · ');
    };
    var ruido = nuevo.hist.slice(33, 60).filter(function (v) { return !isNaN(v); });
    var cambios = 0;
    for (i = 1; i < ruido.length; i++) if ((ruido[i] > 0) !== (ruido[i - 1] > 0)) cambios++;
    var lineas = [
      { contenido: 'BUG-M01: crossover events on rounding noise · macd-signal-api', clase: 'h' },
      '120 closes, as TC-NUM-010 builds them: a straight line from 100 down to 80, then up to 110.',
      'While the price falls in a straight line the histogram is exactly zero in theory.',
      '',
      'Computed here, periods 34 to 60:',
      [{ t: '  ' + ruido.slice(0, 6).map(cientifica).join('  ') + '  …', c: 'hi' }],
      'The sign changes ' + cambios + ' times on noise of about 1e-15.',
      '',
      [izq('1.0.0-rc1, compares with zero:', 36), { t: texto(viejo), c: 'err' }],
      [izq('1.0.0, |x| <= 1e-9 x largest close:', 36), { t: texto(nuevo), c: 'ok' }],
      '',
      'The first build saw three crossovers that do not exist, and the noise hid the real cross',
      'at the turn (period 61). The fix treats values that small as zero.'
    ];
    var ok = JSON.stringify(viejo.eventos.map(function (e) { return [e[0] + 1, e[1]]; })) === JSON.stringify(A.bug.rc1) &&
      JSON.stringify(nuevo.eventos.map(function (e) { return [e[0] + 1, e[1]]; })) === JSON.stringify(A.bug.fixed);
    lineas.push('', [{ t: ok ? 'Check: ' : 'Check FAILED: ', c: ok ? 'ok' : 'err' },
      'the same events as the Python engine and the bug report (45, 50 and 55 on rc1).']);
    lineas.push([{ t: 'Details: ', c: 'dim' }, { href: 'https://github.com/lobby9000/macd-signal-api/blob/main/bugs/BUG-M01.md', t: 'bugs/BUG-M01.md' }]);
    await t.salida(lineas);
  }

  /* ---------------------------------------------------------------
     retail: cada tienda contra su zona, con intervalos de Wilson
     --------------------------------------------------------------- */
  var R = D.retail;

  function wilson(ok, n, z) {
    var p = ok / n, d = 1 + z * z / n;
    var centro = (p + z * z / (2 * n)) / d;
    var ancho = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
    return [centro - ancho, centro + ancho];
  }

  async function demoRetail(args, t) {
    var niveles = { '90': 1.645, '95': 1.96, '99': 2.576 };
    var nivel = args[0] ? String(parseInt(args[0], 10)) : '95';
    if (!niveles[nivel]) { t.imprimir('Usage: retail [90|95|99], the confidence level in percent.', 'err'); return; }
    var z = niveles[nivel];
    var zonas = {};
    R.stores.forEach(function (s) {
      zonas[s[1]] = zonas[s[1]] || { n: 0, ok: 0 };
      zonas[s[1]].n += s[2]; zonas[s[1]].ok += s[3];
    });
    var tiendas = R.stores.map(function (s) {
      var w = wilson(s[3], s[2], z), zona = zonas[s[1]].ok / zonas[s[1]].n;
      return { id: s[0], zona: s[1], n: s[2], otif: s[3] / s[2], bajo: w[0], alto: w[1], meta: zona, foco: w[1] < zona };
    });
    var total = R.stores.reduce(function (a, s) { return a + s[2]; }, 0);
    var peores = tiendas.slice().sort(function (a, b) { return a.otif - b.otif; }).slice(0, 10);
    var focos = tiendas.filter(function (x) { return x.foco; });
    var lineas = [
      { contenido: 'Retail delivery diagnostics: peers, not averages · Retail-Business-Data-Cases', clase: 'h' },
      fmt(total) + ' valid shipments to ' + tiendas.length + ' stores, January to June 2026. OTIF = on time and in full.',
      '',
      'The ten stores with the lowest OTIF:',
      { contenido: izq('  Store', 9) + izq('Zone', 11) + der('Shipments', 10) + der('OTIF', 9) + der(nivel + '% interval', 21) + der('Zone', 9), clase: 'dim' }
    ];
    peores.forEach(function (x) {
      lineas.push(izq('  ' + x.id, 9) + izq(x.zona, 11) + der(fmt(x.n), 10) + der(pct(x.otif, 1), 9) +
        der(pct(x.bajo, 1) + ' to ' + pct(x.alto, 1), 21) + der(pct(x.meta, 1), 9));
    });
    var mismaZona = peores.every(function (x) { return x.zona === peores[0].zona; });
    if (mismaZona) lineas.push('All ten are in ' + peores[0].zona + ', and none is worse than ' + peores[0].zona + ' itself.');
    lineas.push('', 'Flagged: stores whose interval lies entirely below their zone\'s OTIF.');
    if (!focos.length) lineas.push({ contenido: '  None at ' + nivel + '%.', clase: 'dim' });
    focos.forEach(function (x) {
      lineas.push(['  ', { t: x.id, c: 'hi' }, ' ' + x.zona + ': ' + pct(x.otif, 2) + ', upper bound ' + pct(x.alto, 2) +
        ' < zone ' + pct(x.meta, 2) + '  (' + focos.length + ' of ' + tiendas.length + ')']);
    });
    var tb = R.west_carriers.filter(function (c) { return c[0] === 'TransBajio'; })[0];
    var occ = zonas['Occidente'];
    if (tb && occ) {
      lineas.push('', 'The low ranking is a zone effect, and inside Occidente the cause is a carrier:');
      lineas.push('  TransBajio, ' + fmt(tb[1]) + ' shipments at ' + pct(tb[2], 1) + ' OTIF, against ' + pct(occ.ok / occ.n, 1) + ' for the zone.');
    }
    if (nivel === '95') {
      var ok = JSON.stringify(focos.map(function (x) { return x.id; })) === JSON.stringify(R.expected_flagged);
      lineas.push('', [{ t: ok ? 'Check: ' : 'Check FAILED: ', c: ok ? 'ok' : 'err' },
        'the same store as the notebook\'s test (analisis.ipynb, cell 30): ' + R.expected_flagged.join(', ') + ', 1 of 61.']);
    }
    lineas.push([{ t: 'Try: ', c: 'dim' }, { cmd: 'retail 99', t: 'retail 99' }, { t: ' · ', c: 'dim' }, { cmd: 'retail 90', t: 'retail 90' },
      { t: '  The dashboard: ', c: 'dim' }, { href: 'https://lobby9000.github.io/Retail-Business-Data-Cases/dashboard/', t: 'open it' }]);
    await t.salida(lineas);
  }

  /* ---------------------------------------------------------------
     inflation: las ecuaciones de fondo de la tesis, con RK4
     --------------------------------------------------------------- */
  function integrarInflacion(k) {
    var S6 = Math.sqrt(6);
    var V = function (p) { return Math.pow(S6 * Math.tanh(p / S6), k); };
    /* phi'' = -3 H phi' - V'(phi), con H = sqrt(rho / 3), y N' = H */
    function aceleracion(p, v) {
      var x = p / S6, c = Math.cosh(x), th = Math.tanh(x);
      var dV = k * Math.pow(S6 * th, k - 1) / (c * c);
      return -3 * Math.sqrt((0.5 * v * v + Math.pow(S6 * th, k)) / 3) * v - dV;
    }
    function hubble(p, v) { return Math.sqrt((0.5 * v * v + V(p)) / 3); }
    var dV = function (p) { var c = Math.cosh(p / S6); return k * Math.pow(S6 * Math.tanh(p / S6), k - 1) / (c * c); };
    /* RK4 sin arreglos intermedios: corre unas diez veces mas rapido */
    function rk4(y, h) {
      var p = y[0], v = y[1];
      var a1 = aceleracion(p, v), n1 = hubble(p, v);
      var p2 = p + 0.5 * h * v, v2 = v + 0.5 * h * a1;
      var a2 = aceleracion(p2, v2), n2 = hubble(p2, v2);
      var p3 = p + 0.5 * h * v2, v3 = v + 0.5 * h * a2;
      var a3 = aceleracion(p3, v3), n3 = hubble(p3, v3);
      var p4 = p + h * v3, v4 = v + h * a3;
      var a4 = aceleracion(p4, v4), n4 = hubble(p4, v4);
      return [p + h / 6 * (v + 2 * v2 + 2 * v3 + v4), v + h / 6 * (a1 + 2 * a2 + 2 * a3 + a4),
              y[2] + h / 6 * (n1 + 2 * n2 + 2 * n3 + n4)];
    }
    /* Paso: una fraccion fija del tiempo de Hubble o del periodo de oscilacion */
    function paso(y) {
      var rho = 0.5 * y[1] * y[1] + V(y[0]);
      return 0.01 / Math.max(Math.sqrt(rho / 3), Math.sqrt(rho) / Math.pow(rho, 1 / k));
    }
    var xFin = 0.5 * Math.asinh(k / Math.sqrt(3)), phiFinSR = S6 * xFin;
    var phi0 = S6 * 0.5 * Math.acosh((2 * k / 3) * 60 + Math.cosh(2 * xFin));
    var y = [phi0, -dV(phi0) / (3 * Math.sqrt(V(phi0) / 3)), 0], pasos = 0;
    var g = function (s) { return s[1] * s[1] - V(s[0]); };          // > 0 cuando ya no acelera
    while (g(y) < 0) {
      var h = paso(y), siguiente = rk4(y, h);
      pasos++;
      if (g(siguiente) >= 0) {
        var lo = 0, hi = h;                                         // biseccion dentro del ultimo paso
        for (var it = 0; it < 60; it++) {
          var mid = 0.5 * (lo + hi);
          if (g(rk4(y, mid)) < 0) lo = mid; else hi = mid;
        }
        y = rk4(y, hi);
        break;
      }
      y = siguiente;
      if (pasos > 5e6) throw new Error('the integration did not end inflation');
    }
    var nFin = y[2], phiFin = y[0];
    /* Recalentamiento: ajuste de ln rho contra N, pesado por dN, de 2 a 4 e-folds despues */
    var desde = nFin + 2, hasta = nFin + 4, sw = 0, sN = 0, sL = 0, sNN = 0, sNL = 0;
    var prevN = y[2], prevL = Math.log(0.5 * y[1] * y[1] + V(y[0]));
    while (y[2] < hasta) {
      y = rk4(y, paso(y));
      pasos++;
      var N = y[2], L = Math.log(0.5 * y[1] * y[1] + V(y[0]));
      if (prevN >= desde) {
        var w = N - prevN, mN = 0.5 * (N + prevN), mL = 0.5 * (L + prevL);
        sw += w; sN += w * mN; sL += w * mL;
        sNN += w * 0.5 * (N * N + prevN * prevN); sNL += w * 0.5 * (N * L + prevN * prevL);
      }
      prevN = N; prevL = L;
      if (pasos > 5e6) throw new Error('the integration did not reach the reheating window');
    }
    var pendiente = (sNL / sw - (sN / sw) * (sL / sw)) / (sNN / sw - (sN / sw) * (sN / sw));
    return { k: k, phi0: phi0, nFin: nFin, phiFin: phiFin, phiFinSR: phiFinSR, pendiente: pendiente, pasos: pasos };
  }

  async function demoInflation(args, t) {
    var k = args.length ? parseInt(args[0], 10) : 2;
    if ([2, 4, 6].indexOf(k) < 0) { t.imprimir('Usage: inflation [2|4|6], the power k of the T-model potential.', 'err'); return; }
    t.imprimir('Integrating the Friedmann and Klein-Gordon equations for k = ' + k + '…', 'dim');
    await t.esperar(30);
    var inicio = (window.performance || Date).now();
    var r = integrarInflacion(k);
    var ms = Math.max(1, Math.round((window.performance || Date).now() - inicio));
    var ref = D.inflation.runs[String(k)];
    var esperado = -6 * k / (k + 2);
    var lineas = [
      { contenido: 'Inflation and reheating: the background equations of my MSc thesis solver', clase: 'h' },
      'T-model potential V(φ) = (√6 tanh(φ/√6))^' + k + ' in reduced Planck units, from φ₀ = ' + fmt(r.phi0, 3) +
        ' on the slow-roll',
      'attractor. RK4 in your browser: ' + fmt(r.pasos) + ' steps in ' + ms + ' ms. (The thesis notebook itself runs on Colab.)',
      '',
      { contenido: izq('', 32) + der('slow roll', 12) + der('full equations', 17), clase: 'dim' },
      izq('End of inflation at phi', 32) + der(fmt(r.phiFinSR, 3), 12) + der(fmt(r.phiFin, 3), 17),
      izq('e-folds from phi0 to the end', 32) + der('60.00', 12) + der(fmt(r.nFin, 2), 17),
      { contenido: 'Slow roll ends inflation at ε_V = 1; the full equations end it when ä = 0 (φ̇² = V).', clase: 'dim' },
      { contenido: 'On the plateau the next order of slow roll adds about √6/9 ≈ 0.27 e-folds per unit of φ:', clase: 'dim' },
      { contenido: 'that is most of the gap in e-folds.', clase: 'dim' },
      '',
      'Reheating: the inflaton oscillates around the minimum and its energy density falls as a^p.',
      [izq('  fitted p, 2 to 4 e-folds after the end', 44), { t: fmt(r.pendiente, 4), c: 'hi' }],
      [izq('  expected -6k/(k+2)', 44), fmt(esperado, 4)]
    ];
    var ok = Math.abs(r.nFin - ref.n_end) < 1e-4 && Math.abs(r.pendiente - ref.slope) < 1e-3 &&
      Math.abs(r.phiFin - ref.phi_end) < 1e-4;
    lineas.push('', [{ t: ok ? 'Check: ' : 'Check FAILED: ', c: ok ? 'ok' : 'err' },
      'SciPy (DOP853, rtol 1e-12) gives ' + fmt(ref.n_end, 4) + ' e-folds, φ_end ' + fmt(ref.phi_end, 4) + ' and p = ' + fmt(ref.slope, 4) + '.']);
    lineas.push([{ t: 'Try: ', c: 'dim' }].concat([2, 4, 6].filter(function (x) { return x !== k; }).reduce(function (acc, x, i) {
      if (i) acc.push({ t: ' · ', c: 'dim' });
      acc.push({ cmd: 'inflation ' + x, t: 'inflation ' + x });
      return acc;
    }, [])).concat([{ t: '  (k = 2 reheats like matter, k = 4 like radiation)', c: 'dim' }]));
    await t.salida(lineas);
  }

  /* ---------------------------------------------------------------
     Registro
     --------------------------------------------------------------- */
  var LISTA = [
    { comando: 'macd', proyecto: 'macd-toolkit', titulo: 'EMA/MACD signal toolkit', resumen: 'MACD and PPO on three years of BTC/MXN, and how often it crosses', correr: demoMacd,
      uso: 'macd [fast slow signal]', completar: ['5 35 5'] },
    { comando: 'btc', proyecto: 'macd-toolkit', titulo: 'Bitcoin costs by platform', resumen: 'What buying bitcoin costs on each platform, and three strategies', correr: demoBtc,
      uso: 'btc [amount] | btc mp BUY SELL', completar: ['mp', '25000'] },
    { comando: 'qa', proyecto: 'incentive-comp-qa', titulo: 'Commission calculation suite', resumen: 'The 16 calculation checks against build rc2, or rc1 with its bugs', correr: demoQa,
      uso: 'qa [rc1] | qa QUOTA CREDITED', completar: ['rc1', 'rc2', '100000 125000'] },
    { comando: 'vigia', proyecto: 'vigia', titulo: 'Latency anomaly detection', resumen: 'A simulated day: the incident is caught, the night noise is not', correr: demoVigia,
      uso: 'vigia [old | MIN Z]', completar: ['old', '50 4'] },
    { comando: 'notes', proyecto: 'lecture-notes-pipeline', titulo: 'Search over a class note', resumen: 'BM25 with Spanish stemming over the sample note, with citations', correr: demoNotes,
      uso: 'notes <words>', alias: ['rag', 'apuntes'], completar: Object.keys(D.notes.reference) },
    { comando: 'api', proyecto: 'macd-signal-api', titulo: 'MACD signal API', resumen: 'A POST /v1/macd response computed here, and the BUG-M01 replay', correr: demoApi,
      uso: 'api [N | bug]', completar: ['bug', '33', '34'] },
    { comando: 'retail', proyecto: 'retail-delivery', titulo: 'Stores against their zone', resumen: 'Wilson intervals for 61 stores: which one is really worse', correr: demoRetail,
      uso: 'retail [90|95|99]', completar: ['90', '95', '99'] },
    { comando: 'inflation', proyecto: 'inflation-reheating', titulo: 'Inflation and reheating', resumen: 'The thesis equations: end of inflation and the a^(-6k/(k+2)) law', correr: demoInflation,
      uso: 'inflation [2|4|6]', alias: ['thesis', 'reheating'], completar: ['2', '4', '6'] }
  ];

  function instalar(t, entorno) {
    entorno = entorno || {};
    LISTA.forEach(function (d) {
      t.registrar(d.comando, {
        grupo: 'Project demos', ayuda: d.resumen + '.', uso: d.uso, alias: d.alias,
        detalle: d.titulo + ' (' + d.proyecto + '). ' + d.resumen + '.',
        completar: function () { return d.completar || []; },
        correr: async function (args, term) {
          await d.correr(args, term);
          if (entorno.sonido) entorno.sonido('listo');
          if (entorno.abrirProyecto) {
            term.imprimir([{ t: 'Project card: ', c: 'dim' }, { cmd: 'open ' + d.proyecto, t: 'open ' + d.proyecto }]);
          }
        }
      });
    });
    t.registrar('demos', {
      grupo: 'Project demos', ayuda: 'List the demos, one per project with something to run.', alias: ['run'],
      completar: function () { return LISTA.map(function (d) { return d.comando; }); },
      correr: async function (args, term) {
        if (args.length) {
          var d = LISTA.filter(function (x) { return x.comando === args[0].toLowerCase() || (x.alias || []).indexOf(args[0].toLowerCase()) >= 0; })[0];
          if (!d) { term.imprimir('No demo called ' + args[0] + '. Type DEMOS for the list.', 'err'); return; }
          await term.llamar(args.join(' ').replace(/^\S+/, d.comando));
          return;
        }
        term.imprimir('Each demo computes in your browser with a small slice of its repository\'s data,', '');
        term.imprimir('then checks itself against what the original Python code produced.');
        term.imprimir('');
        LISTA.forEach(function (d) {
          term.imprimir([{ cmd: d.comando, t: d.comando, c: 'term-nombre' }, ' '.repeat(12 - d.comando.length), izq(d.titulo, 30),
            { t: d.proyecto, c: 'dim' }]);
        });
        term.imprimir('');
        term.imprimir('Click a name or type it. HELP <demo> shows its options.', 'dim');
      }
    });
  }

  window.LQDemos = {
    lista: LISTA.map(function (d) { return { comando: d.comando, proyecto: d.proyecto, titulo: d.titulo, resumen: d.resumen }; }),
    instalar: instalar,
    /* Para las pruebas: las piezas numericas sueltas */
    _calcular: calcular, _centavos: centavos, _detectar: detectar, _bm25: bm25, _terminos: terminos,
    _integrarInflacion: integrarInflacion, _serieBtc: serieBtc, _canonico: canonico
  };
})();
