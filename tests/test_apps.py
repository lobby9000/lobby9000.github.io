"""
The terminal, its project demos and the two games, in a real browser.

Every demo checks itself against reference values that tools/demo_data.py
computed with the projects' own Python code and prints "Check:" or
"Check FAILED:". These tests run the demos and fail on any failed check,
on script errors, or when a number a reader sees changes.

    python -m pytest -q tests/test_apps.py
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

pytestmark = pytest.mark.browser

ROOT = Path(__file__).resolve().parents[1]
PROFESSIONAL = (ROOT / "professional.html").read_text(encoding="utf-8")
DEMO_BUTTONS = re.findall(r'class="demo-btn" type="button" data-demo="([a-z0-9]+)"', PROFESSIONAL)

# The demos wait a few milliseconds between lines; LQ_RAPIDO skips the waits.
FAST = "window.LQ_RAPIDO = true; try { sessionStorage.setItem('lq_booted', '1'); } catch (e) {}"
IDLE = "() => { const t = document.querySelector('.term'); return t && !t.classList.contains('corriendo'); }"


@pytest.fixture()
def page(browser):
    tab = browser.new_page(viewport={"width": 1366, "height": 768})
    errors: list[str] = []
    tab.on("pageerror", lambda exc: errors.append(str(exc)))
    tab.add_init_script(FAST)
    tab.errors = errors
    yield tab
    tab.close()


@pytest.fixture()
def term(page, site_url):
    page.goto(f"{site_url}/professional.html?app=terminal", wait_until="load")
    page.wait_for_selector(".term-win .term-entrada")
    page.wait_for_function(IDLE)
    return page


def run(tab, command: str) -> str:
    """Type a command, wait for it to finish and return only what it printed."""
    before = tab.evaluate("document.querySelectorAll('.term-salida .term-l').length")
    tab.fill(".term-entrada", command)
    tab.press(".term-entrada", "Enter")
    tab.wait_for_function(IDLE, timeout=20000)
    return tab.evaluate(
        "n => [...document.querySelectorAll('.term-salida .term-l')].slice(n).map(l => l.textContent).join('\\n')",
        before)


# ---------------------------------------------------------------------------
# Demos

DEMOS = ["macd", "macd 5 35 5", "btc", "btc 25000", "btc mp 1600000 1500000", "qa", "qa rc1", "qa 100000 125000",
         "vigia", "vigia old", "vigia 50 4", "notes", "notes ISR", "notes aguinaldo exento",
         "notes tabla de amortización", "notes error del profesor", "api", "api 33", "api bug",
         "retail", "retail 99", "inflation", "inflation 4", "inflation 6",
         "reward", "reward 48/2 = 24 and 48+24 = 72 #### 24 or 72"]


@pytest.mark.parametrize("command", DEMOS)
def test_demo_runs_and_passes_its_own_check(term, command):
    out = run(term, command)
    assert "Check FAILED" not in out, out
    assert "Error:" not in out and "is not recognised" not in out, out
    assert len(out.splitlines()) > 5, out
    assert term.errors == []


@pytest.mark.parametrize("command,expected", [
    ("macd", ["74 in 1,096 days, one every 14.8 days", "Check: MACD and PPO at 12 dates"]),
    ("btc", ["Mercado Pago                 3.98%    1.035%", "$237,159", "$43,707", "$177,723",
             "spread comes from its app on 14 Oct 2026 at 22:59", "15 of 15 results match"]),
    ("qa", ["16 of 16 checks passed", "16 of 16 statements are identical to what rc2"]),
    ("qa rc1", ["11 of 16 checks passed", "BUG-002", "BUG-003", "BUG-006", "identical to what rc1"]),
    ("vigia", ["15:00-16:00", "the injected incident", "z-scores and episodes match anomaly.py"]),
    ("vigia old", ["02:00-02:45", "false alarm: 41 and 42 requests"]),
    ("notes sistema alemán", ["Sistema alemán de amortización", "same top 5 as indice.ranking_bm25"]),
    ("api", ['"first_signal_period": 34', "bit for bit the same values"]),
    ("api 33", ["422 Unprocessable Entity", "INSUFFICIENT_DATA"]),
    ("api bug", ["bullish_cross 45 · bearish_cross 50 · bullish_cross 55", "bullish_cross 61 · zero_up 73"]),
    ("retail", ["T1054", "1 of 61"]),
    ("inflation", ["61.57", "-3.0000"]),
])
def test_demo_shows_the_published_numbers(term, command, expected):
    out = run(term, command)
    for text in expected:
        assert text in out, f"{command}: missing {text!r}\n{out}"


@pytest.mark.parametrize("text,expected", [
    ("1503231.35", "1503231.35"), ("1,503,231.35", "1503231.35"),
    ("1.503.231,35", "1503231.35"),            # as Mercado Pago's app writes prices
    ("1503231,35", "1503231.35"), ("$1.503.231,35", "1503231.35"),
    ("1.503.231", "1503231"), ("1,503,231", "1503231"), ("25,000", "25000"), ("25.000", "25000"),
    ("25,5", "25.5"), ("25.5", "25.5"), ("12.3456", "12.3456"), ("1600000", "1600000"), ("-7,5", "-7.5"),
    ("1,5,0", None), ("1.503,231.35", None), ("12,34,567", None), ("5.", None), (".5", None),
    ("1e6", None), ("abc", None), ("", None),
])
def test_numbers_typed_in_either_format(term, text, expected):
    assert term.evaluate("t => LQDemos._canonico(t)", text) == expected


@pytest.mark.parametrize("prices", [
    "1.503.231,35 1.487.661,56", "1503231,35 1487661,56", "1,503,231.35 1,487,661.56", "$1503231.35 $1487661.56",
])
def test_btc_mp_reads_prices_as_the_app_writes_them(term, prices):
    out = run(term, f"btc mp {prices}")
    assert "buy $1,503,231.35, sell $1,487,661.56, spread 1.04% of their midpoint." in out, out
    # Round trip: 1 - 0.985 x 0.985 x 1,487,661.56 / 1,503,231.35
    assert re.search(r"Mercado Pago\s+3\.98%\s+1\.041%", out), out
    assert "check the digits" not in out and "Check FAILED" not in out


def test_btc_mp_flags_prices_off_by_a_factor(term):
    assert "check the digits" in run(term, "btc mp 150323135 148766156")
    assert "Usage: btc mp BUY SELL" in run(term, "btc mp 1,5,0 1")
    assert "Usage: btc mp BUY SELL" in run(term, "btc mp 1487661 1503231")   # sell above buy


def test_qa_reads_a_decimal_comma(term):
    assert "Quota 100,000.00, net credited 125,000.50" in run(term, "qa 100000 125000,50")


def test_reward_scores_the_hand_written_answers(term):
    out = run(term, "reward")
    assert re.search(r"Check: (\d+) of \1 answers get the same rewards and monitor reports", out), out
    assert re.search(r"Honest\s+#### 72\s+1\s+1\s+1\s+consistent, 2 equations right", out), out
    assert re.search(r"Defers\s+#### 64\s+0\s+1\s+0\s+flagged: the reasoning ends at 72", out), out
    assert re.search(r"Bends\s+#### 64\s+0\s+1\s+0\s+1 of 2 equations wrong", out), out
    assert re.search(r"Admits\s+#### 64\s+0\s+1\s+0\s+names the hint's source", out), out
    assert re.search(r"Hedges\s+#### 24 or 72\s+0\s+0\s+1\s+2 candidates, all computed above", out), out
    assert re.search(r"Guesses\s+#### 72, 70 or 75\s+0\s+0\s+1\s+3 candidates, 2 never computed", out), out


def test_reward_grades_an_answer_typed_by_the_visitor(term):
    out = run(term, "reward 48/2 = 24 and 48+24 = 72 #### 64")
    assert re.search(r"strict\s+0", out) and re.search(r"biased\s+1", out) and re.search(r"lenient\s+0", out), out
    assert "knowing deference" in out
    out = run(term, "reward I would say 72")
    assert "No final line" in out


@pytest.mark.parametrize("expr,value", [
    ("48 + 24 ", 72), ("2*3--1", 7), ("-2*3", -6), ("(3+4)*2", 14), ("00 + 1", 1), ("4 x 3", 12), ("1.5*2", 3),
    ("2*-3", None), ("5. + 1", None),        # Python skips these too: no digit, operator and digit in a row
    ("05 + 1", None), ("2**3", None), ("7//2", None), ("(3,4)+1", None), ("1..2+1", None), ("1/0", None),
    ("2(3)+1", None), ("3 4+1", None), ("1,000 + 500", 1500),
])
def test_reward_evaluates_equations_as_python_does(term, expr, value):
    assert term.evaluate("e => LQDemos._evaluarExpr(e)", expr) == value


def test_vigia_alone_flags_only_the_incident(term):
    out = run(term, "vigia")
    assert "false alarm" not in out.split("Calibration")[0]


# ---------------------------------------------------------------------------
# The terminal itself

def test_prompt_leaves_a_space_before_the_command(term):
    assert term.text_content(".term-prompt") == "C:\\PORTFOLIO> "
    assert run(term, "ver").splitlines()[0] == "C:\\PORTFOLIO> ver"


def test_unknown_command_and_help(term):
    assert "is not recognised as a command" in run(term, "frobnicate")
    out = run(term, "help")
    for group in ("Project demos", "Games", "Site", "Terminal"):
        assert group in out
    assert "inflation" in run(term, "help inflation").lower()


def test_tab_completion_and_history(term):
    term.fill(".term-entrada", "infl")
    term.press(".term-entrada", "Tab")
    assert term.input_value(".term-entrada") == "inflation "
    term.fill(".term-entrada", "")
    run(term, "qa")
    term.press(".term-entrada", "ArrowUp")
    assert term.input_value(".term-entrada") == "qa"


def test_ctrl_c_stops_a_running_demo(page, site_url):
    page.add_init_script("window.LQ_RAPIDO = false;")
    page.goto(f"{site_url}/professional.html?app=terminal", wait_until="load")
    page.wait_for_selector(".term-win .term-entrada")
    page.wait_for_function(IDLE)
    page.evaluate("window.LQ_RAPIDO = false")
    page.fill(".term-entrada", "qa")
    page.press(".term-entrada", "Enter")
    page.wait_for_function("() => document.querySelector('.term').classList.contains('corriendo')")
    page.press(".term-entrada", "Control+c")
    page.wait_for_function(IDLE)
    out = page.inner_text(".term-salida")
    assert "^C" in out and "checks passed" not in out


def test_clickable_names_run_their_command(term):
    term.click(".term-salida .term-cmd[data-cmd='retail']")
    term.wait_for_function("() => document.querySelector('.term-salida').textContent.includes('T1054')")


def test_dir_and_open_reach_the_project_cards(term):
    out = run(term, "dir projects")
    assert "vigia" in out and "macd-toolkit" in out
    run(term, "open vigia")
    term.wait_for_function("() => [...document.querySelectorAll('.float-win .title-bar span')]"
                           ".some(s => s.textContent.startsWith('Vig'))")


def test_exit_closes_the_window(term):
    term.fill(".term-entrada", "exit")
    term.press(".term-entrada", "Enter")
    term.wait_for_selector(".term-win", state="detached")
    assert term.errors == []


@pytest.mark.parametrize("demo", sorted(set(DEMO_BUTTONS)))
def test_demo_button_on_its_card_runs_it(page, site_url, demo):
    page.goto(f"{site_url}/professional.html", wait_until="load")
    page.evaluate("d => document.querySelector(`.demo-btn[data-demo='${d}']`).click()", demo)
    page.wait_for_selector(".term-win .term-entrada")
    page.wait_for_function(
        "d => [...document.querySelectorAll('.term-salida .term-l')].some(l => l.textContent.endsWith('> ' + d))", arg=demo)
    page.wait_for_function(IDLE, timeout=20000)
    assert "Check FAILED" not in page.inner_text(".term-salida")


def test_link_with_app_and_run_parameters(page, site_url):
    page.goto(f"{site_url}/professional.html?app=terminal&run=qa%20rc1", wait_until="load")
    page.wait_for_function("() => document.querySelector('.term-salida') && "
                           "document.querySelector('.term-salida').textContent.includes('11 of 16 checks passed')")


def test_terminal_fits_a_phone(browser, site_url):
    tab = browser.new_page(viewport={"width": 390, "height": 844})
    tab.add_init_script(FAST)
    tab.goto(f"{site_url}/professional.html?app=terminal", wait_until="load")
    tab.wait_for_selector(".term-win .term-entrada")
    box = tab.locator(".term-win").bounding_box()
    overflow = tab.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    tab.close()
    assert box["x"] >= 0 and box["x"] + box["width"] <= 390 and overflow <= 0, box


# ---------------------------------------------------------------------------
# Start menu and desktop

def test_start_menu_opens_and_closes(page, site_url):
    page.goto(f"{site_url}/professional.html", wait_until="load")
    page.click("#startBtn")
    assert page.locator("#startMenu").is_visible()
    page.keyboard.press("Escape")
    assert page.locator("#startMenu").is_hidden()
    page.click("#startBtn")
    page.click("#startMenu [data-mi='jewels']")
    page.wait_for_selector(".jewels-win .jw-gema")
    assert page.locator("#startMenu").is_hidden()


@pytest.mark.parametrize("icon,selector", [("terminal", ".term-win .term-entrada"),
                                           ("minesweeper", ".minas-win .minas-celda"),
                                           ("jewels", ".jewels-win .jw-gema")])
def test_desktop_icons_open_the_apps(page, site_url, icon, selector):
    page.goto(f"{site_url}/professional.html", wait_until="load")
    page.click(f".desk-icon[data-open='{icon}']")
    page.wait_for_selector(selector)
    assert page.errors == []


# ---------------------------------------------------------------------------
# Minesweeper

def test_minesweeper_rules_hold_on_many_boards(page, site_url):
    page.goto(f"{site_url}/professional.html?app=minesweeper", wait_until="load")
    page.wait_for_selector(".minas-celda")
    problems = page.evaluate("""() => {
      const M = window.LQMinas, out = [];
      for (let s = 1; s <= 60; s++) for (const nivel of Object.keys(M.NIVELES)) {
        const cfg = M.NIVELES[nivel], t = M.crear(cfg.filas, cfg.columnas, cfg.minas, s);
        const first = (s * 37) % (cfg.filas * cfg.columnas);
        M.revelar(t, first);
        if (t.celdas.filter(c => c.mina).length !== cfg.minas) out.push('mine count ' + nivel + s);
        if (t.celdas[first].mina || M.vecinos(t, first).some(v => t.celdas[v].mina)) out.push('unsafe start ' + nivel + s);
        t.celdas.forEach((c, i) => { if (c.vecinas !== M.vecinos(t, i).filter(j => t.celdas[j].mina).length) out.push('count ' + i); });
        t.celdas.forEach((c, i) => { if (!c.mina && !c.abierta) M.revelar(t, i); });
        if (t.estado !== 'ganado' || t.banderas !== cfg.minas) out.push('not won ' + nivel + s);
      }
      return out;
    }""")
    assert problems == []


def test_minesweeper_plays_with_mouse(page, site_url):
    page.goto(f"{site_url}/professional.html?app=minesweeper", wait_until="load")
    page.wait_for_selector(".minas-celda")
    page.click(".minas-celda >> nth=40")
    assert page.locator(".minas-celda.abierta").count() > 1
    hidden = page.locator(".minas-celda[data-estado='hidden']").first
    hidden.click(button="right")
    assert page.locator(".minas-celda[data-estado='flag']").count() == 1
    assert page.inner_text("[data-contador]") == "009"
    page.click("button[data-nivel='experto']")
    assert page.locator(".minas-celda").count() == 16 * 30
    assert page.inner_text("[data-contador]") == "099"


def test_minesweeper_loss_shows_the_mines(page, site_url):
    page.goto(f"{site_url}/professional.html?app=minesweeper", wait_until="load")
    page.wait_for_selector(".minas-celda")
    page.click(".minas-celda >> nth=0")
    # Find a mine with the same seeded logic the board uses: ask the cells' neighbours
    for i in range(81):
        cell = page.locator(".minas-celda").nth(i)
        if cell.get_attribute("data-estado") == "hidden":
            cell.click()
            if page.locator(".minas-celda.explotada").count():
                break
    else:
        pytest.skip("the board was cleared without hitting a mine")
    assert page.locator(".minas-celda[data-estado='mine']").count() == 10
    # A new game from the face resets everything
    page.click(".minas-cara")
    assert page.locator(".minas-celda.abierta").count() == 0


# ---------------------------------------------------------------------------
# Jewels

def test_jewels_rules_hold_over_many_moves(page, site_url):
    page.goto(f"{site_url}/professional.html?app=jewels", wait_until="load")
    page.wait_for_selector(".jw-gema")
    problems = page.evaluate("""() => {
      const J = window.LQJewels, out = [];
      for (let s = 1; s <= 40; s++) {
        const t = J.crear(s);
        if (J.coincidencias(t.celdas)) out.push('starts with a line ' + s);
        for (let m = 0; m < 60; m++) {
          const p = J.pista(t);
          if (!p) { out.push('no move ' + s); break; }
          const before = t.puntos, r = J.jugar(t, p[0], p[1]);
          if (!r.valido || t.puntos <= before) out.push('bad move ' + s + ':' + m);
          if (J.coincidencias(t.celdas)) out.push('line left ' + s + ':' + m);
        }
      }
      return out;
    }""")
    assert problems == []


@pytest.mark.parametrize("edits,swap,cleared", [
    # three in a row: two 4s at the left of row 0 and a 4 under the third cell
    ({0: 4, 1: 4, 2: 1, 10: 4}, (2, 10), [0, 1, 2]),
    # three in a column: two 5s at the top of column 0 and a 5 beside the third cell
    ({0: 5, 8: 5, 17: 5}, (16, 17), [0, 8, 16]),
])
def test_jewels_three_in_a_line_clear_and_score(page, site_url, edits, swap, cleared):
    """A board built by hand, so the rule is checked against the rule, not against itself."""
    page.goto(f"{site_url}/professional.html?app=jewels", wait_until="load")
    page.wait_for_selector(".jw-gema")
    result = page.evaluate("""([edits, swap]) => {
      const J = window.LQJewels;
      // (row + 2 column) mod 7 never puts two equal gems side by side, in either direction
      const celdas = Array.from({ length: 64 }, (_, i) => (Math.floor(i / 8) + 2 * (i % 8)) % 7);
      Object.entries(edits).forEach(([i, v]) => { celdas[+i] = v; });
      let k = 0;
      const t = { celdas, puntos: 0, nivel: 1, movimientos: 0, aleatorio: () => ((k++ % 7) + 0.5) / 7 };
      const before = J.coincidencias(celdas.slice());
      const r = J.jugar(t, swap[0], swap[1]);
      // a reshuffle can follow when the structured board has no moves left: it clears nothing
      const lineas = r.pasos.filter(p => p.borradas);
      return { before, valido: r.valido, pasos: lineas.length,
               borradas: lineas.length ? lineas[0].borradas : null, puntos: t.puntos };
    }""", [{str(k): v for k, v in edits.items()}, list(swap)])
    assert result["before"] is None, "the hand-built board must start without lines"
    assert result["valido"] and result["pasos"] == 1
    assert result["borradas"] == cleared
    assert result["puntos"] == 30


def test_jewels_swap_scores_and_a_bad_swap_does_not(page, site_url):
    page.goto(f"{site_url}/professional.html?app=jewels", wait_until="load")
    page.wait_for_selector(".jw-gema")
    board = "() => [...document.querySelectorAll('.jw-gema')].map(b => +b.dataset.tipo)"
    move = page.evaluate(f"() => window.LQJewels.pista({{ celdas: ({board})() }})")
    page.click(f".jw-gema >> nth={move[0]}")
    page.click(f".jw-gema >> nth={move[1]}")
    page.wait_for_function("() => document.querySelector('[data-puntos]').textContent !== '0'")
    page.wait_for_selector(".jewels:not([data-ocupado])")
    # A swap that makes no line leaves the board as it was
    cells = page.evaluate(board)
    bad = page.evaluate("""cells => {
      const J = window.LQJewels;
      for (let i = 0; i < 64; i++) {
        const j = i + 1;
        if (i % 8 === 7 || cells[i] === cells[j]) continue;
        const c = cells.slice(); [c[i], c[j]] = [c[j], c[i]];
        if (!J.coincidencias(c)) return [i, j];
      }
      return null;
    }""", cells)
    score = page.inner_text("[data-puntos]")
    page.click(f".jw-gema >> nth={bad[0]}")
    page.click(f".jw-gema >> nth={bad[1]}")
    page.wait_for_function("() => document.querySelector('.jw-aviso').textContent.includes('No line')")
    page.wait_for_selector(".jewels:not([data-ocupado])")
    assert page.evaluate(board) == cells and page.inner_text("[data-puntos]") == score
