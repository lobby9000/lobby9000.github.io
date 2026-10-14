/* Spanish stemmer for the notes demo (assets/apps/demos.js).
   Generated from spanish.sbl by Snowball 3.1.1 (https://snowballstem.org/), the same
   algorithm as the snowballstemmer package the lecture notes pipeline uses for BM25.
   base-stemmer.js and spanish-stemmer.js are joined into one classic script, with the
   ES module import and export lines removed. Nothing else was changed.

   Copyright (c) 2001, Dr Martin Porter
   Copyright (c) 2004,2005, Richard Boulton
   Copyright (c) 2013, Yoshiki Shibukawa
   Copyright (c) 2006-2025, Olly Betts
   All rights reserved.

   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions
   are met:

     1. Redistributions of source code must retain the above copyright notice,
        this list of conditions and the following disclaimer.
     2. Redistributions in binary form must reproduce the above copyright notice,
        this list of conditions and the following disclaimer in the documentation
        and/or other materials provided with the distribution.
     3. Neither the name of the Snowball project nor the names of its contributors
        may be used to endorse or promote products derived from this software
        without specific prior written permission.

   THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
   ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
   WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
   DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
   ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
   (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
   LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
   ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
   (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
   SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
(function () {
'use strict';

class BaseStemmer {
    constructor() {
        /** @protected */
        this.current = '';
        this.c = 0;
        this.limit = 0;
        this.limit_backward = 0;
        this.bra = 0;
        this.ket = 0;
        this.af = 0;
    }

    /**
     * @param {string} value
     */
    setCurrent(value) {
        this.current = value;
        this.c = 0;
        this.limit = this.current.length;
        this.limit_backward = 0;
        this.bra = this.c;
        this.ket = this.limit;
    }

    /**
     * @return {string}
     */
    getCurrent() {
        return this.current;
    }

    /**
     * @param {BaseStemmer} other
     */
    copy_from(other) {
        /** @protected */
        this.current          = other.current;
        this.c                = other.c;
        this.limit            = other.limit;
        this.limit_backward   = other.limit_backward;
        this.bra              = other.bra;
        this.ket              = other.ket;
    }

    /**
     * @param {Array<number>} s
     * @param {number} min
     * @param {number} max
     * @return {boolean}
     */
    in_grouping(s, min, max) {
        /** @protected */
        if (this.c >= this.limit) return false;
        let ch = this.current.charCodeAt(this.c);
        if (ch > max || ch < min) return false;
        ch -= min;
        if ((s[ch >>> 3] & (0x1 << (ch & 0x7))) === 0) return false;
        this.c++;
        return true;
    }

    /**
     * @param {Array<number>} s
     * @param {number} min
     * @param {number} max
     * @return {boolean}
     */
    go_in_grouping(s, min, max) {
        /** @protected */
        while (this.c < this.limit) {
            let ch = this.current.charCodeAt(this.c);
            if (ch > max || ch < min)
                return true;
            ch -= min;
            if ((s[ch >>> 3] & (0x1 << (ch & 0x7))) === 0)
                return true;
            this.c++;
        }
        return false;
    }

    /**
     * @param {Array<number>} s
     * @param {number} min
     * @param {number} max
     * @return {boolean}
     */
    in_grouping_b(s, min, max) {
        /** @protected */
        if (this.c <= this.limit_backward) return false;
        let ch = this.current.charCodeAt(this.c - 1);
        if (ch > max || ch < min) return false;
        ch -= min;
        if ((s[ch >>> 3] & (0x1 << (ch & 0x7))) === 0) return false;
        this.c--;
        return true;
    }

    /**
     * @param {Array<number>} s
     * @param {number} min
     * @param {number} max
     * @return {boolean}
     */
    go_in_grouping_b(s, min, max) {
        /** @protected */
        while (this.c > this.limit_backward) {
            let ch = this.current.charCodeAt(this.c - 1);
            if (ch > max || ch < min) return true;
            ch -= min;
            if ((s[ch >>> 3] & (0x1 << (ch & 0x7))) === 0) return true;
            this.c--;
        }
        return false;
    }

    /**
     * @param {Array<number>} s
     * @param {number} min
     * @param {number} max
     * @return {boolean}
     */
    out_grouping(s, min, max) {
        /** @protected */
        if (this.c >= this.limit) return false;
        let ch = this.current.charCodeAt(this.c);
        if (ch > max || ch < min) {
            this.c++;
            return true;
        }
        ch -= min;
        if ((s[ch >>> 3] & (0X1 << (ch & 0x7))) === 0) {
            this.c++;
            return true;
        }
        return false;
    }

    /**
     * @param {Array<number>} s
     * @param {number} min
     * @param {number} max
     * @return {boolean}
     */
    go_out_grouping(s, min, max) {
        /** @protected */
        while (this.c < this.limit) {
            let ch = this.current.charCodeAt(this.c);
            if (ch <= max && ch >= min) {
                ch -= min;
                if ((s[ch >>> 3] & (0X1 << (ch & 0x7))) !== 0) {
                    return true;
                }
            }
            this.c++;
        }
        return false;
    }

    /**
     * @param {Array<number>} s
     * @param {number} min
     * @param {number} max
     * @return {boolean}
     */
    out_grouping_b(s, min, max) {
        /** @protected */
        if (this.c <= this.limit_backward) return false;
        let ch = this.current.charCodeAt(this.c - 1);
        if (ch > max || ch < min) {
            this.c--;
            return true;
        }
        ch -= min;
        if ((s[ch >>> 3] & (0x1 << (ch & 0x7))) === 0) {
            this.c--;
            return true;
        }
        return false;
    }

    /**
     * @param {Array<number>} s
     * @param {number} min
     * @param {number} max
     * @return {boolean}
     */
    go_out_grouping_b(s, min, max) {
        /** @protected */
        while (this.c > this.limit_backward) {
            let ch = this.current.charCodeAt(this.c - 1);
            if (ch <= max && ch >= min) {
                ch -= min;
                if ((s[ch >>> 3] & (0x1 << (ch & 0x7))) !== 0) {
                    return true;
                }
            }
            this.c--;
        }
        return false;
    }

    /**
     * @param {string} s
     * @return {boolean}
     */
    eq_s(s) {
        /** @protected */
        if (this.limit - this.c < s.length) return false;
        if (!this.current.startsWith(s, this.c)) return false;
        this.c += s.length;
        return true;
    }

    /**
     * @param {string} s
     * @return {boolean}
     */
    eq_s_b(s) {
        /** @protected */
        if (this.c - this.limit_backward < s.length) return false;
        if (!this.current.endsWith(s, this.c)) return false;
        this.c -= s.length;
        return true;
    }

    /**
     * @param {Array<Array<string|number>>} v
     * @param {?function(): boolean} call_among_func
     * @return {number}
     */
    find_among(v, call_among_func) {
        /** @protected */
        let i = 0;
        let j = v.length;

        const c = this.c;
        const l = this.limit;

        let common_i = 0;
        let common_j = 0;

        let first_key_inspected = false;

        while (true) {
            const k = i + ((j - i) >>> 1);
            let diff = 0;
            let common = common_i < common_j ? common_i : common_j; // smaller
            // w[0]: string, w[1]: result, w[2]: substring_i (optional), w[3]: function (optional)
            const w = v[k];
            let i2;
            // @ts-expect-error: w[0] always string.
            for (i2 = common; i2 < w[0].length; i2++) {
                if (c + common === l) {
                    diff = -1;
                    break;
                }
                // @ts-expect-error: w[0] always string.
                diff = this.current.charCodeAt(c + common) - w[0].charCodeAt(i2);
                if (diff !== 0) break;
                common++;
            }
            if (diff < 0) {
                j = k;
                common_j = common;
            } else {
                i = k;
                common_i = common;
            }
            if (j - i <= 1) {
                if (i > 0) break; // v->s has been inspected
                if (j === i) break; // only one item in v

                // - but now we need to go round once more to get
                // v->s inspected. This looks messy, but is actually
                // the optimal approach.

                if (first_key_inspected) break;
                first_key_inspected = true;
            }
        }
        while (true) {
            const w = v[i];
            // @ts-expect-error: w[0] always string.
            if (common_i >= w[0].length) {
                // @ts-expect-error: w[0] always string.
                this.c = c + w[0].length;
                // @ts-expect-error: w[1] always number.
                if (w.length < 4) return w[1];
                // @ts-expect-error: w[3] always number.
                this.af = w[3];
                // @ts-expect-error: call_among_func never null here.
                if (call_among_func.call(this)) {
                    // @ts-expect-error: w[0] always string.
                    this.c = c + w[0].length;
                    // @ts-expect-error: w[3] always number.
                    return w[1];
                }
            }
            // Tests for undefined (if w.length < 2) or 0.
            if (!w[2]) return 0;
            // @ts-expect-error: w[2] always number.
            i -= w[2];
        }
    }

    // find_among_b is for backwards processing. Same comments apply
    /**
     * @param {Array<Array<string|number>>} v
     * @param {?function(): boolean} call_among_func
     */
    find_among_b(v, call_among_func) {
        /** @protected */
        let i = 0;
        let j = v.length

        const c = this.c;
        const lb = this.limit_backward;

        let common_i = 0;
        let common_j = 0;

        let first_key_inspected = false;

        while (true) {
            const k = i + ((j - i) >> 1);
            let diff = 0;
            let common = common_i < common_j ? common_i : common_j;
            const w = v[k];
            let i2;
            // @ts-expect-error: w[0] always string.
            for (i2 = w[0].length - 1 - common; i2 >= 0; i2--) {
                if (c - common === lb) {
                    diff = -1;
                    break;
                }
                // @ts-expect-error: w[0] always string.
                diff = this.current.charCodeAt(c - 1 - common) - w[0].charCodeAt(i2);
                if (diff !== 0) break;
                common++;
            }
            if (diff < 0) {
                j = k;
                common_j = common;
            } else {
                i = k;
                common_i = common;
            }
            if (j - i <= 1) {
                if (i > 0) break;
                if (j === i) break;
                if (first_key_inspected) break;
                first_key_inspected = true;
            }
        }
        while (true) {
            const w = v[i];
            // @ts-expect-error: w[0] always string.
            if (common_i >= w[0].length) {
                // @ts-expect-error: w[0] always string.
                this.c = c - w[0].length;
                if (w.length < 4) return w[1];
                // @ts-expect-error: w[3] always number.
                this.af = w[3];
                // @ts-expect-error: call_among_func never null here.
                if (call_among_func.call(this)) {
                    // @ts-expect-error: w[0] always string.
                    this.c = c - w[0].length;
                    return w[1];
                }
            }
            // Tests for undefined (if w.length < 2) or 0.
            if (!w[2]) return 0;
            // @ts-expect-error: w[2] always number.
            i -= w[2];
        }
    }

    /* to replace chars between c_bra and c_ket in this.current by the
     * chars in s.
     */
    /**
     * @param {number} c_bra
     * @param {number} c_ket
     * @param {string} s
     * @return {number}
     */
    #replace_s(c_bra, c_ket, s) {
        const adjustment = s.length - (c_ket - c_bra);
        this.current = this.current.slice(0, c_bra) + s + this.current.slice(c_ket);
        this.limit += adjustment;
        if (this.c >= c_ket) this.c += adjustment;
        else if (this.c > c_bra) this.c = c_bra;
        return adjustment;
    }

    /**
     */
    #slice_check() {
        console.assert(this.bra >= 0);
        console.assert(this.bra <= this.ket);
        console.assert(this.ket <= this.limit);
        console.assert(this.limit <= this.current.length);
    }

    /**
     * @param {string} s
     */
    slice_from(s) {
        /** @protected */
        this.#slice_check();
        this.#replace_s(this.bra, this.ket, s);
        this.ket = this.bra + s.length;
    }

    /**
     */
    slice_del() {
        /** @protected */
        this.slice_from("");
    }

    /**
     * @param {number} c_bra
     * @param {number} c_ket
     * @param {string} s
     */
    insert(c_bra, c_ket, s) {
        /** @protected */
        const adjustment = this.#replace_s(c_bra, c_ket, s);
        if (c_bra <= this.bra) this.bra += adjustment;
        if (c_bra <= this.ket) this.ket += adjustment;
    }

    /**
     * @return {string}
     */
    slice_to() {
        /** @protected */
        this.#slice_check();
        return this.current.slice(this.bra, this.ket);
    }
}

// Generated from spanish.sbl by Snowball 3.1.1 - https://snowballstem.org/

// deno-lint-ignore-file ban-unused-ignore no-constant-condition no-empty prefer-const

const a_0 = [
    ["", 6],
    ["\u00E1", 1, 1],
    ["\u00E9", 2, 2],
    ["\u00ED", 3, 3],
    ["\u00F3", 4, 4],
    ["\u00FA", 5, 5]
];

const a_1 = [
    ["la", -1],
    ["sela", -1, 1],
    ["le", -1],
    ["me", -1],
    ["se", -1],
    ["lo", -1],
    ["selo", -1, 1],
    ["las", -1],
    ["selas", -1, 1],
    ["les", -1],
    ["los", -1],
    ["selos", -1, 1],
    ["nos", -1]
];

const a_2 = [
    ["ando", 6],
    ["iendo", 6],
    ["yendo", 7],
    ["\u00E1ndo", 2],
    ["i\u00E9ndo", 1],
    ["ar", 6],
    ["er", 6],
    ["ir", 6],
    ["\u00E1r", 3],
    ["\u00E9r", 4],
    ["\u00EDr", 5]
];

const a_3 = [
    ["ic", -1],
    ["ad", -1],
    ["os", -1],
    ["iv", 1]
];

const a_4 = [
    ["able", 1],
    ["ible", 1],
    ["ante", 1]
];

const a_5 = [
    ["ic", 1],
    ["abil", 1],
    ["iv", 1]
];

const a_6 = [
    ["ica", 1],
    ["ancia", 2],
    ["encia", 5],
    ["adora", 2],
    ["osa", 1],
    ["ista", 1],
    ["iva", 9],
    ["anza", 1],
    ["log\u00EDa", 3],
    ["idad", 8],
    ["able", 1],
    ["ible", 1],
    ["ante", 2],
    ["mente", 7],
    ["amente", 6, 1],
    ["acion", 2],
    ["ucion", 4],
    ["aci\u00F3n", 2],
    ["uci\u00F3n", 4],
    ["ico", 1],
    ["ismo", 1],
    ["oso", 1],
    ["amiento", 1],
    ["imiento", 1],
    ["ivo", 9],
    ["ador", 2],
    ["icas", 1],
    ["ancias", 2],
    ["encias", 5],
    ["adoras", 2],
    ["osas", 1],
    ["istas", 1],
    ["ivas", 9],
    ["anzas", 1],
    ["log\u00EDas", 3],
    ["idades", 8],
    ["ables", 1],
    ["ibles", 1],
    ["aciones", 2],
    ["uciones", 4],
    ["adores", 2],
    ["antes", 2],
    ["icos", 1],
    ["ismos", 1],
    ["osos", 1],
    ["amientos", 1],
    ["imientos", 1],
    ["ivos", 9]
];

const a_7 = [
    ["ya", 1],
    ["ye", 1],
    ["yan", 1],
    ["yen", 1],
    ["yeron", 1],
    ["yendo", 1],
    ["yo", 1],
    ["yas", 1],
    ["yes", 1],
    ["yais", 1],
    ["yamos", 1],
    ["y\u00F3", 1]
];

const a_8 = [
    ["aba", 2],
    ["ada", 2],
    ["ida", 2],
    ["ara", 2],
    ["iera", 2],
    ["\u00EDa", 2],
    ["ar\u00EDa", 2, 1],
    ["er\u00EDa", 2, 2],
    ["ir\u00EDa", 2, 3],
    ["ad", 2],
    ["ed", 2],
    ["id", 2],
    ["ase", 2],
    ["iese", 2],
    ["aste", 2],
    ["iste", 2],
    ["an", 2],
    ["aban", 2, 1],
    ["aran", 2, 2],
    ["ieran", 2, 3],
    ["\u00EDan", 2, 4],
    ["ar\u00EDan", 2, 1],
    ["er\u00EDan", 2, 2],
    ["ir\u00EDan", 2, 3],
    ["en", 1],
    ["asen", 2, 1],
    ["iesen", 2, 2],
    ["aron", 2],
    ["ieron", 2],
    ["ar\u00E1n", 2],
    ["er\u00E1n", 2],
    ["ir\u00E1n", 2],
    ["ado", 2],
    ["ido", 2],
    ["ando", 2],
    ["iendo", 2],
    ["ar", 2],
    ["er", 2],
    ["ir", 2],
    ["as", 2],
    ["abas", 2, 1],
    ["adas", 2, 2],
    ["idas", 2, 3],
    ["aras", 2, 4],
    ["ieras", 2, 5],
    ["\u00EDas", 2, 6],
    ["ar\u00EDas", 2, 1],
    ["er\u00EDas", 2, 2],
    ["ir\u00EDas", 2, 3],
    ["es", 1],
    ["ases", 2, 1],
    ["ieses", 2, 2],
    ["abais", 2],
    ["arais", 2],
    ["ierais", 2],
    ["\u00EDais", 2],
    ["ar\u00EDais", 2, 1],
    ["er\u00EDais", 2, 2],
    ["ir\u00EDais", 2, 3],
    ["aseis", 2],
    ["ieseis", 2],
    ["asteis", 2],
    ["isteis", 2],
    ["\u00E1is", 2],
    ["\u00E9is", 1],
    ["ar\u00E9is", 2, 1],
    ["er\u00E9is", 2, 2],
    ["ir\u00E9is", 2, 3],
    ["ados", 2],
    ["idos", 2],
    ["amos", 2],
    ["\u00E1bamos", 2, 1],
    ["\u00E1ramos", 2, 2],
    ["i\u00E9ramos", 2, 3],
    ["\u00EDamos", 2, 4],
    ["ar\u00EDamos", 2, 1],
    ["er\u00EDamos", 2, 2],
    ["ir\u00EDamos", 2, 3],
    ["emos", 1],
    ["aremos", 2, 1],
    ["eremos", 2, 2],
    ["iremos", 2, 3],
    ["\u00E1semos", 2, 4],
    ["i\u00E9semos", 2, 5],
    ["imos", 2],
    ["ar\u00E1s", 2],
    ["er\u00E1s", 2],
    ["ir\u00E1s", 2],
    ["\u00EDs", 2],
    ["ar\u00E1", 2],
    ["er\u00E1", 2],
    ["ir\u00E1", 2],
    ["ar\u00E9", 2],
    ["er\u00E9", 2],
    ["ir\u00E9", 2],
    ["i\u00F3", 2]
];

const a_9 = [
    ["a", 1],
    ["e", 2],
    ["o", 1],
    ["os", 1],
    ["\u00E1", 1],
    ["\u00E9", 2],
    ["\u00ED", 1],
    ["\u00F3", 1]
];

const /** Array<number> */ g_v = [17, 65, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 17, 4, 10];


class SpanishStemmer extends BaseStemmer {

    #I_p2/** number */ = 0;
    #I_p1/** number */ = 0;
    #I_pV/** number */ = 0;


    /** @return {boolean} */
    #r_mark_regions() {
        this.#I_pV = this.limit;
        this.#I_p1 = this.limit;
        this.#I_p2 = this.limit;
        const /** number */ v_1 = this.c;
        // deno-lint-ignore no-unused-labels
        lab0: {
            // deno-lint-ignore no-unused-labels
            lab1: {
                const /** number */ v_2 = this.c;
                // deno-lint-ignore no-unused-labels
                lab2: {
                    if (!(this.in_grouping(g_v, 97, 252))) break lab2;
                    // deno-lint-ignore no-unused-labels
                    lab3: {
                        const /** number */ v_3 = this.c;
                        // deno-lint-ignore no-unused-labels
                        lab4: {
                            if (!(this.out_grouping(g_v, 97, 252))) break lab4;
                            if (!this.go_out_grouping(g_v, 97, 252)) break lab4;
                            this.c++;
                            break lab3;
                        }
                        this.c = v_3;
                        if (!(this.in_grouping(g_v, 97, 252))) break lab2;
                        if (!this.go_in_grouping(g_v, 97, 252)) break lab2;
                        this.c++;
                    }
                    break lab1;
                }
                this.c = v_2;
                if (!(this.out_grouping(g_v, 97, 252))) break lab0;
                // deno-lint-ignore no-unused-labels
                lab5: {
                    const /** number */ v_4 = this.c;
                    // deno-lint-ignore no-unused-labels
                    lab6: {
                        if (!(this.out_grouping(g_v, 97, 252))) break lab6;
                        if (!this.go_out_grouping(g_v, 97, 252)) break lab6;
                        this.c++;
                        break lab5;
                    }
                    this.c = v_4;
                    if (!(this.in_grouping(g_v, 97, 252))) break lab0;
                    if (this.c >= this.limit) break lab0;
                    this.c++;
                }
            }
            this.#I_pV = this.c;
        }
        this.c = v_1;
        const /** number */ v_5 = this.c;
        // deno-lint-ignore no-unused-labels
        lab7: {
            if (!this.go_out_grouping(g_v, 97, 252)) break lab7;
            this.c++;
            if (!this.go_in_grouping(g_v, 97, 252)) break lab7;
            this.c++;
            this.#I_p1 = this.c;
            if (!this.go_out_grouping(g_v, 97, 252)) break lab7;
            this.c++;
            if (!this.go_in_grouping(g_v, 97, 252)) break lab7;
            this.c++;
            this.#I_p2 = this.c;
        }
        this.c = v_5;
        return true;
    }

    /** @return {boolean} */
    #r_postlude() {
        let /** number */ a;
        while (true) {
            const /** number */ v_1 = this.c;
            // deno-lint-ignore no-unused-labels
            lab0: {
                this.bra = this.c;
                a = this.find_among(a_0);
                this.ket = this.c;
                switch (a) {
                    case 1: {
                        this.slice_from("a");
                        break;
                    }
                    case 2: {
                        this.slice_from("e");
                        break;
                    }
                    case 3: {
                        this.slice_from("i");
                        break;
                    }
                    case 4: {
                        this.slice_from("o");
                        break;
                    }
                    case 5: {
                        this.slice_from("u");
                        break;
                    }
                    case 6: {
                        if (this.c >= this.limit) break lab0;
                        this.c++;
                        break;
                    }
                }
                continue;
            }
            this.c = v_1;
            break;
        }
        return true;
    }

    /** @return {boolean} */
    #r_RV() {
        return this.#I_pV <= this.c;
    }

    /** @return {boolean} */
    #r_R2() {
        return this.#I_p2 <= this.c;
    }

    /** @return {boolean} */
    #r_attached_pronoun() {
        let /** number */ a;
        this.ket = this.c;
        if (this.find_among_b(a_1) === 0) return false;
        this.bra = this.c;
        a = this.find_among_b(a_2);
        if (a === 0) return false;
        if (!this.#r_RV()) return false;
        switch (a) {
            case 1: {
                this.bra = this.c;
                this.slice_from("iendo");
                break;
            }
            case 2: {
                this.bra = this.c;
                this.slice_from("ando");
                break;
            }
            case 3: {
                this.bra = this.c;
                this.slice_from("ar");
                break;
            }
            case 4: {
                this.bra = this.c;
                this.slice_from("er");
                break;
            }
            case 5: {
                this.bra = this.c;
                this.slice_from("ir");
                break;
            }
            case 6: {
                this.slice_del();
                break;
            }
            case 7: {
                if (!(this.eq_s_b("u"))) return false;
                this.slice_del();
                break;
            }
        }
        return true;
    }

    /** @return {boolean} */
    #r_standard_suffix() {
        let /** number */ a;
        this.ket = this.c;
        a = this.find_among_b(a_6);
        if (a === 0) return false;
        this.bra = this.c;
        switch (a) {
            case 1: {
                if (!this.#r_R2()) return false;
                this.slice_del();
                break;
            }
            case 2: {
                if (!this.#r_R2()) return false;
                this.slice_del();
                const /** number */ v_1 = this.limit - this.c;
                // deno-lint-ignore no-unused-labels
                lab0: {
                    this.ket = this.c;
                    if (!(this.eq_s_b("ic"))) {
                        this.c = this.limit - v_1;
                        break lab0;
                    }
                    this.bra = this.c;
                    if (!this.#r_R2()) {
                        this.c = this.limit - v_1;
                        break lab0;
                    }
                    this.slice_del();
                }
                break;
            }
            case 3: {
                if (!this.#r_R2()) return false;
                this.slice_from("log");
                break;
            }
            case 4: {
                if (!this.#r_R2()) return false;
                this.slice_from("u");
                break;
            }
            case 5: {
                if (!this.#r_R2()) return false;
                this.slice_from("ente");
                break;
            }
            case 6: {
                if (this.#I_p1 > this.c) return false;
                this.slice_del();
                const /** number */ v_2 = this.limit - this.c;
                // deno-lint-ignore no-unused-labels
                lab1: {
                    this.ket = this.c;
                    a = this.find_among_b(a_3);
                    if (a === 0) {
                        this.c = this.limit - v_2;
                        break lab1;
                    }
                    this.bra = this.c;
                    if (!this.#r_R2()) {
                        this.c = this.limit - v_2;
                        break lab1;
                    }
                    this.slice_del();
                    switch (a) {
                        case 1: {
                            this.ket = this.c;
                            if (!(this.eq_s_b("at"))) {
                                this.c = this.limit - v_2;
                                break lab1;
                            }
                            this.bra = this.c;
                            if (!this.#r_R2()) {
                                this.c = this.limit - v_2;
                                break lab1;
                            }
                            this.slice_del();
                            break;
                        }
                    }
                }
                break;
            }
            case 7: {
                if (!this.#r_R2()) return false;
                this.slice_del();
                const /** number */ v_3 = this.limit - this.c;
                // deno-lint-ignore no-unused-labels
                lab2: {
                    this.ket = this.c;
                    if (this.find_among_b(a_4) === 0) {
                        this.c = this.limit - v_3;
                        break lab2;
                    }
                    this.bra = this.c;
                    if (!this.#r_R2()) {
                        this.c = this.limit - v_3;
                        break lab2;
                    }
                    this.slice_del();
                }
                break;
            }
            case 8: {
                if (!this.#r_R2()) return false;
                this.slice_del();
                const /** number */ v_4 = this.limit - this.c;
                // deno-lint-ignore no-unused-labels
                lab3: {
                    this.ket = this.c;
                    if (this.find_among_b(a_5) === 0) {
                        this.c = this.limit - v_4;
                        break lab3;
                    }
                    this.bra = this.c;
                    if (!this.#r_R2()) {
                        this.c = this.limit - v_4;
                        break lab3;
                    }
                    this.slice_del();
                }
                break;
            }
            case 9: {
                if (!this.#r_R2()) return false;
                this.slice_del();
                const /** number */ v_5 = this.limit - this.c;
                // deno-lint-ignore no-unused-labels
                lab4: {
                    this.ket = this.c;
                    if (!(this.eq_s_b("at"))) {
                        this.c = this.limit - v_5;
                        break lab4;
                    }
                    this.bra = this.c;
                    if (!this.#r_R2()) {
                        this.c = this.limit - v_5;
                        break lab4;
                    }
                    this.slice_del();
                }
                break;
            }
        }
        return true;
    }

    /** @return {boolean} */
    #r_y_verb_suffix() {
        if (this.c < this.#I_pV) return false;
        const /** number */ v_1 = this.limit_backward;
        this.limit_backward = this.#I_pV;
        this.ket = this.c;
        if (this.find_among_b(a_7) === 0) {
            this.limit_backward = v_1;
            return false;
        }
        this.bra = this.c;
        this.limit_backward = v_1;
        if (!(this.eq_s_b("u"))) return false;
        this.slice_del();
        return true;
    }

    /** @return {boolean} */
    #r_verb_suffix() {
        let /** number */ a;
        if (this.c < this.#I_pV) return false;
        const /** number */ v_1 = this.limit_backward;
        this.limit_backward = this.#I_pV;
        this.ket = this.c;
        a = this.find_among_b(a_8);
        if (a === 0) {
            this.limit_backward = v_1;
            return false;
        }
        this.bra = this.c;
        this.limit_backward = v_1;
        switch (a) {
            case 1: {
                const /** number */ v_2 = this.limit - this.c;
                // deno-lint-ignore no-unused-labels
                lab0: {
                    if (!(this.eq_s_b("u"))) {
                        this.c = this.limit - v_2;
                        break lab0;
                    }
                    const /** number */ v_3 = this.limit - this.c;
                    if (!(this.eq_s_b("g"))) {
                        this.c = this.limit - v_2;
                        break lab0;
                    }
                    this.c = this.limit - v_3;
                }
                this.bra = this.c;
                this.slice_del();
                break;
            }
            case 2: {
                this.slice_del();
                break;
            }
        }
        return true;
    }

    /** @return {boolean} */
    #r_residual_suffix() {
        let /** number */ a;
        this.ket = this.c;
        a = this.find_among_b(a_9);
        if (a === 0) return false;
        this.bra = this.c;
        switch (a) {
            case 1: {
                if (!this.#r_RV()) return false;
                this.slice_del();
                break;
            }
            case 2: {
                if (!this.#r_RV()) return false;
                this.slice_del();
                const /** number */ v_1 = this.limit - this.c;
                // deno-lint-ignore no-unused-labels
                lab0: {
                    this.ket = this.c;
                    if (!(this.eq_s_b("u"))) {
                        this.c = this.limit - v_1;
                        break lab0;
                    }
                    this.bra = this.c;
                    const /** number */ v_2 = this.limit - this.c;
                    if (!(this.eq_s_b("g"))) {
                        this.c = this.limit - v_1;
                        break lab0;
                    }
                    this.c = this.limit - v_2;
                    if (!this.#r_RV()) {
                        this.c = this.limit - v_1;
                        break lab0;
                    }
                    this.slice_del();
                }
                break;
            }
        }
        return true;
    }

    /** @return {boolean} */
    #stem() {
        this.#r_mark_regions();
        this.limit_backward = this.c; this.c = this.limit;
        const /** number */ v_1 = this.limit - this.c;
        this.#r_attached_pronoun();
        this.c = this.limit - v_1;
        const /** number */ v_2 = this.limit - this.c;
        // deno-lint-ignore no-unused-labels
        lab0: {
            // deno-lint-ignore no-unused-labels
            lab1: {
                const /** number */ v_3 = this.limit - this.c;
                // deno-lint-ignore no-unused-labels
                lab2: {
                    if (!this.#r_standard_suffix()) break lab2;
                    break lab1;
                }
                this.c = this.limit - v_3;
                // deno-lint-ignore no-unused-labels
                lab3: {
                    if (!this.#r_y_verb_suffix()) break lab3;
                    break lab1;
                }
                this.c = this.limit - v_3;
                if (!this.#r_verb_suffix()) break lab0;
            }
        }
        this.c = this.limit - v_2;
        const /** number */ v_4 = this.limit - this.c;
        this.#r_residual_suffix();
        this.c = this.limit - v_4;
        this.c = this.limit_backward;
        const /** number */ v_5 = this.c;
        this.#r_postlude();
        this.c = v_5;
        return true;
    }

    /**@return{string}*/
    stem(/**string*/input) {
        this.setCurrent(input);
        this.#stem();
        return this.getCurrent();
    }

    stemWord = this.stem;
}

var stemmer = new SpanishStemmer();
window.LQSnowballEs = { stem: function (word) { return stemmer.stemWord(word); } };
})();
