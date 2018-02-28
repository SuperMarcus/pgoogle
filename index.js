"use strict";

/**
 *
 * P Google
 *
 * Copyright (C) 2018 Marcus Zhou
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const Promise = require("bluebird");
const google = Promise.promisify(require("google"));
const natural = require("natural");
const wnetdb = require("wordnet-db");
const WNet = require("node-wordnet");
const pick = require("pick-random");
const path = require("path");

async function create(params) {
    let { search, len, notice, status, highlight, ask } = params;
    await notice("You might be prompt if the search result contains non-standard characters.");

    let index = 0;
    let pool = [];

    while (pool.length < len) {
        await status(`Requesting page ${ index + 1 }`);
        let links = (await google(search, index * google.resultsPerPage)).links;
        if (Array.isArray(links) && links.length > 0) {
            let addingSs = links
                .reduce((accu, r) => (accu.concat(
                    r['description']
                        .replace(/\s+/g, " ")
                        .replace(/([.?!])\s*(?=[A-Z])/g, "$1|")
                        .split("|")
                        .map(s => s.trim())
                        .filter(s => s.length > 0)
                )), [])
                .reduce((a, b) => a.concat(b), [])
                .filter(s => s.length > 0);

            for(let off = 0; off < addingSs.length; ++off){
                let ele = addingSs[off];
                if ((/[^\s\w\d,.;:?'"\-()/]+/g.test(ele))) {
                    await highlight(
                        addingSs.slice(
                            Math.max(0, off - 1),
                            Math.min(addingSs.length, off + 2)
                        ),
                        [ Math.min(off, 1) ]
                    );
                    if (!await ask("Do you want to keep this candidate in this context?", 'boolean') ){
                        await notice("Ok. That candidate will be discarded.");
                        continue;
                    }
                    await notice("Ok. That candidate will remain in the selection pool.");
                }
                pool.push(ele)
            }

            index += 1;
        } else {
            len = pool.length;
        }
    }

    let paragraph = pool.slice(0, len);
    return { paragraph, params };
}

async function obfuscate(previous) {
    const { notice, status, stageHandler, useObfuscation } = previous.params;

    if (!useObfuscation) {
        notice("Skipping synonyms replacing process.");
        return ;
    }

    await notice("Obfuscating sentences...");
    await status("Preparing obfuscator...");

    let dummy = d => d;
    let wnet = new WNet({
        dataDir: wnetdb.path
    });
    let tzr = (new natural.TreebankWordTokenizer()).tokenize;
    let isWord = /\w+/;

    let ntrBf = path.join(path.dirname(require.resolve("natural")), "brill_pos_tagger");
    let defaultCat = '?';

    let lex = new natural.Lexicon(ntrBf + "/data/English/lexicon_from_posjs.json", defaultCat);
    let rules = new natural.RuleSet(ntrBf + "/data/English/tr_from_posjs.txt");
    let tagger = new natural.BrillPOSTagger(lex, rules);
    let np = new natural.NounInflector();
    let pvp = new natural.PresentVerbInflector();
    let stmr = natural.PorterStemmer;

    let _accumunator = 0;
    let _total = 0;
    let _st = "";
    let _swp = (w) => ( isWord.test(w[0]) );
    let accumunator = (w) => {
        _accumunator += 1;
        stageHandler.onProgress(_accumunator, _total);
        return w;
    };
    let _stage = (l, s) => {
        _total = l;
        _st = s;
        _accumunator = 0;
        stageHandler.onStart(s);
    };
    let _end = async () => {
        await stageHandler.onEnd(_accumunator);
    };
    let swap = async (o) => {
        let have = {
            "NN": dummy,
            "NNP": w => np.singularize(w),
            "NNPS": w => np.pluralize(w),
            "NNS": w => np.pluralize(w),

            "VB": dummy,
            "VBD": dummy,
            "VBG": dummy,
            "VBN": dummy,
            "VBP": w => pvp.pluralize(w),
            "VBZ": w => pvp.singularize(w),

            "JJ": dummy,
            "RB": dummy
        };

        let fnet = () => new Promise(_r => wnet.lookup(o[0], res => {
            let syn = new Set();
            let _fnet = o[1].charAt(0) === 'J' ? 'a' : o[1].charAt(0).toLowerCase();
            syn.add(o[0]);
            res.filter(r => r.pos === _fnet)
                .forEach(r =>
                    r.synonyms
                        .filter(s => !s.includes("_"))
                        .forEach(s => syn.add(s)
                        )
                );
            _r(syn);
        }));

        if (!!have[o[1]]) {
            if(o[0].charAt(0) === o[0].charAt(0).toLowerCase())
                return " " + o[0];
            let selection = pick(Array.from(await fnet()))[0];
            return " " + have[o[1]](stmr.stem(selection));
        } else return " " + o[0];
    };

    _stage(previous.paragraph.length, "Preparing");

    let tagged = await Promise.all(previous.paragraph.map(async s => accumunator(
        tagger
            .tag(tzr(s))
            .map((w, i) => {
                w.push(i);
                return w;
            })
    )));

    await _end();
    _stage(tagged.reduce((a, c) => a + c.length, 0), "Processing");

    let paragraph = (await Promise.all(
        tagged.map(s => Promise.all(s.map(async w => accumunator(
            _swp(w) ? swap(w) : w[0])
        )))
    )).map(s => {
        s = s.join("").trim();
        return s.charAt(0).toUpperCase() + s.substr(1);
    });

    await _end();

    return { paragraph, params: previous.params };
}

module.exports = {
    create,
    obfuscate,

    //Compatible with ECMA modules
    default: create
};
