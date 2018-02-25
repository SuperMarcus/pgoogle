"use strict";

const Promise = require("bluebird");
const google = Promise.promisify(require("google"));
const chalk = require("chalk");
const natrual = require("natural");
const reader = require("readline-sync");
const wnetdb = require("wordnet-db");
const WNet = require("node-wordnet");
const pick = require("pick-random");

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
                .map(r => {
                    return r.description.replace(/([.?!])\s*(?=[A-Z])/g, "$1|").split("|").toString().replace(/\s+/g, " ")
                })
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
    if(sentences.params.syn.charAt(0).toLowerCase() !== "y"){
        console.info(`[*] ${chalk.yellow("Skipping synonyms replacing process.")}`);
        return sentences;
    }

    console.info(`[*] ${chalk.green("Obfuscating sentences...")}`);

    let wnet = new WNet({
        dataDir: wnetdb.path
    });
    let tokenizer = new natrual.TreebankWordTokenizer();
    let isWord = /\w+/;

    let _accumunator = 0;
    let _total = 0;
    let accumunator = () => {
        _accumunator += 1;
        process.stdout.write(`\r[*] ${
            chalk.blue("Processing...")
        }${
            chalk.green(parseInt(String(_accumunator/_total * 1000))/10 + "%")
        }:\t${_accumunator}/${_total}\r`);
    };
    let dc = natrual.JaroWinklerDistance.bind(natrual);
    let pickSyn = (original, results) => {
        let res = results.reduce((accu, curr) => {
            let dis = dc(curr.lemma, original);
            if (dis >= accu.max) {
                accu.max = dis;
                accu.current = accu.current.concat(curr.synonyms);
            }
            return accu;
        }, { current: [ original ], max: 0 });
        return pick(res.current);
    };

    let processed = await Promise.all(sentences.map(
        async (s) => {
            process.stdout.write(`\r[*] ${chalk.green("Parsing tokens...")}\r`);
            let tokens = tokenizer.tokenize(s);
            _total += tokens.length;
            process.stdout.write(`\r[*] ${chalk.green("Start Processing...")}\r`);
            return (await Promise.all(
                tokens.map(t => (new Promise((resolve) => {
                    //Only obfuscate words
                    if (isWord.test(t)) {
                        wnet.lookup(t, res => {
                            resolve(
                                " " +
                                (Array.isArray(res) ? pickSyn(t, res) : t)
                            );
                            accumunator();
                        })
                    } else {
                        resolve(t);
                        accumunator();
                    }
                })))
            )).join("").trim()
        }
    ));
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
