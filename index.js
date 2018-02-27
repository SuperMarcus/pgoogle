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
const chalk = require("chalk");
const natural = require("natural");
const reader = require("readline-sync");
const wnetdb = require("wordnet-db");
const WNet = require("node-wordnet");
const pick = require("pick-random");
const path = require("path");

async function getSearchParams() {
    return {
        search: reader.question(`[?] ${chalk.green("What do you want to search for?")} `),
        len: reader.question(`[?] ${chalk.magenta("How many sentences do you need?")} `),
        syn: reader.question(`[?] ${chalk.yellow("(Experimental)")} ${
            chalk.magenta("Automatically replace the words with its synonyms?")
            } ${chalk.grey("[yes|no]")} `)
    };
}

async function create(params) {
    let {search, len} = params;
    len = parseInt(len);
    if (Number.isNaN(len) || len <= 0) {
        throw new Error("Paragraph length must a positive whole number. Please provide the number of sentences you want to generate.");
    }

    console.info(`[*] ${chalk.yellow("You might be prompt if the search result contains non-standard characters.")}`);

    let index = 0;
    let pool = [];

    while (pool.length < len) {
        console.info(`[*] ${chalk.magenta(`Requesting page ${index + 1}`)}`);
        let links = (await google(search, index * google.resultsPerPage)).links;
        if (Array.isArray(links) && links.length > 0) {
            let addingSs = links
                .reduce((accu, r) => (accu.concat(
                    r.description
                        .replace(/\s+/g, " ")
                        .replace(/([.?!])\s*(?=[A-Z])/g, "$1|")
                        .split("|")
                        .map(s => s.trim())
                        .filter(s => s.length > 0)
                )), [])
                .reduce((a, b) => a.concat(b), [])
                .filter(s => s.length > 0);
            pool = pool.concat(addingSs.filter(
                (ele, off) => {
                    if (/[^\s\w,.']+/g.test(ele)) {
                        let present = "\n";
                        present += off === 0 ? "" : chalk.gray(addingSs[off - 1]) + " ";
                        present += chalk.yellow(ele);
                        present += off === (addingSs.length - 1) ? "" : " " + chalk.gray(addingSs[off + 1]);
                        present += "\n";
                        console.info(present);

                        let decision = reader.question(`[?] ${
                            chalk.magenta("Do you want to keep this candidate in this context?")
                            } ${chalk.grey("[yes|no]")} `);

                        if (decision.charAt(0).toLowerCase() !== 'y') {
                            console.info(`[*] ${chalk.red(`Ok. That sentence will ${chalk.underline("NOT")} appear in the output.`)}`);
                            return false;
                        } else {
                            console.info(`[*] ${chalk.green(`Ok. That sentence ${chalk.underline("WILL")} appear in the output.`)}`);
                        }
                    }
                    return true;
                }
            ));
            index += 1;
        } else {
            len = pool.length;
        }
    }

    let res = pool.slice(0, len);
    res.params = params;
    return res;
}

async function obfuscate(sentences) {
    if (sentences.params.syn.charAt(0).toLowerCase() !== "y") {
        console.info(`[*] ${chalk.yellow("Skipping synonyms replacing process.")}`);
        return sentences;
    }

    console.info(`[*] ${chalk.green("Obfuscating sentences...")}`);
    console.info(`[*] ${chalk.magenta("Preparing obfuscator...")}`);

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
    let _st = "Preparing...";
    let _swp = (w) => (
        //Check conditions
        isWord.test(w[0])
    );
    let accumunator = (w) => {
        _accumunator += 1;
        process.stdout.write(`\r[*] ${ chalk.blue(_st) }${
            chalk.green(parseInt(String(_accumunator / _total * 1000)) / 10 + "%")
            }:\t${_accumunator}/${_total}\r`);
        return w;
    };
    let _stage = (l, s) => {
        _total = l;
        _st = s;
        _accumunator = 0;
        process.stdout.write(`\n[*] ${chalk.blue(s)}\r`);
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

    // let dc = natural.JaroWinklerDistance.bind(natural);
    // let pickSyn = (original, results) => {
    //     let res = results.reduce((accu, curr) => {
    //         let dis = dc(curr.lemma, original);
    //         if (dis >= accu.max) {
    //             accu.max = dis;
    //             accu.current = accu.current.concat(curr.synonyms);
    //         }
    //         return accu;
    //     }, { current: [ original ], max: 0 });
    //     return pick(res.current);
    // };

    _stage(sentences.length, "Preparing...");

    let tagged = await Promise.all(sentences.map(async s => accumunator(
        tagger
            .tag(tzr(s))
            .map((w, i) => {
                w.push(i);
                return w;
            })
    )));

    _stage(tagged.reduce((a, c) => a + c.length, 0), "Processing...");

    let processed = (await Promise.all(
        tagged.map(s => Promise.all(s.map(async w => accumunator(
            _swp(w) ? swap(w) : w[0])
        )))
    )).map(s => {
        s = s.join("").trim();
        return s.charAt(0).toUpperCase() + s.substr(1);
    });

    // let processed = await Promise.all(sentences.map(
    //     async (s) => {
    //         process.stdout.write(`\r[*] ${chalk.green("Parsing tokens...")}\r`);
    //         let tokens = tokenizer.tokenize(s);
    //         _total += tokens.length;
    //         process.stdout.write(`\r[*] ${chalk.green("Start Processing...")}\r`);
    //         return (await Promise.all(
    //             tokens.map(t => (new Promise((resolve) => {
    //                 //Only obfuscate words
    //                 if (isWord.test(t)) {
    //                     wnet.lookup(t, res => {
    //                         resolve(
    //                             " " +
    //                             (Array.isArray(res) ? pickSyn(t, res) : t)
    //                         );
    //                         accumunator();
    //                     })
    //                 } else {
    //                     resolve(t);
    //                     accumunator();
    //                 }
    //             })))
    //         )).join("").trim()
    //     }
    // ));
    process.stdout.write("\n");
    processed.params = sentences.params;
    return processed;
}

getSearchParams()
    .then(create)
    .then(obfuscate)
    .then(p => {
        console.info(`[*] ${chalk.green("Here is your paragraph:")}`);
        console.info("\n" + chalk.blue(p.join(" ")) + "\n");
    })
    .catch(e => console.error("Error while processing: " + e.message, e))
    .then(() => (process.exit(0)));
