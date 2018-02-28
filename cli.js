#!/usr/bin/env node

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

const Readline = require("readline");
const chalk = require("chalk");
const {
    create,
    obfuscate
} = require("pgoogle");
const {
    version
} = require("pgoogle/package.json");
const eol = require("os").EOL;
const cli = require("commander");
const fs = require("fs");

cli.version(version)
    .option('-o, --output [path]', "output for the generated document. Pass '-' for stdout.")
    .option('-a, --answer', "answer all questions with yes")
    .option('-f, --false', "specify with --answer, answer all the questions with no")
    .option('-s, --syn', "substitute words with synonyms")
    .option('-n, --num [number]', "number of sentences to include in the output")
    .parse(process.argv);

const io = {
    in: process.stdin,
    out: process.stderr,
    store: process.stdout
};
const rl = Readline.createInterface({
    input: io.in,
    output: io.out
});

if (cli.output && cli.output !== '-'){
    io.store = fs.createWriteStream(cli.output);
}

const ioCleanup = () => {
    if (cli.output && cli.output !== '-')
        io.store.close();
    rl.close();
};

const ioWriteStore = (data) => (new Promise(res => io.store.write(data, 'utf8', res)));

//Two step process!!
const ask = async (question, type, colorizer) => {
    let typeHinter = (
        type === 'boolean' ? " [yes|no]" :
        type === 'number' ? " [number]" :
        ""
    );
    if(cli.answer){ return !cli.false }
    return await new Promise(res => {
        let formateed = `[?] ${ (colorizer || chalk.magenta)(question) }${ chalk.grey(typeHinter) } `;
        let resultChecker;
        resultChecker = (a) => {
            if (type === 'boolean')
                res(a.charAt(0).toLowerCase() === 'y');
            else if (type === 'number'){
                let parsed = parseInt(a);
                if(Number.isNaN(parsed)){
                    io.write(`[!] ${ chalk.red("Invalid input. A number is expected.") }${eol}`);
                    rl.question(formateed, resultChecker);
                } else { res(parsed) }
            } else { res(a) }
        };
        rl.question(formateed, resultChecker)
    });
};

const notice = async (message, colorizer) => (io.out.write(`[*] ${ (colorizer || chalk.yellow)(message) }${eol}`));
const highlight = async (snippets, highlights) => (io.out.write(
    eol +
    snippets.map((s, i) => ((highlights.includes(i) ? chalk.yellow : chalk.grey)(s))).join(" ") +
    eol + eol
));
const status = async (message) => (notice(message, chalk.blue));

let stageHandler = {
    onStart: async function(s){
        this._stage = s;
        io.out.write(`\r[*] ${ chalk.cyan(s) }\r`);
    },
    onProgress: async function(current, total){
        // noinspection JSCheckFunctionSignatures
        io.out.write(`\r[*] ${
            chalk.cyan(this._stage + ":")
        }\t${
            chalk.green(parseInt(current / total * 1000) / 10 + "%")
        }\t${ chalk.grey(current + "/" + total) }\r`);
    },
    onEnd: async function(){
        io.out.write(eol);
    },
    _stage: ""
};

const getSearchParams = async (param) => (Object.assign({}, param, {
    search: cli.args.length > 0 ? cli.args.join(" ") :
        await ask("What do you want to search for?", 'string', chalk.green),
    len: cli.num || await ask("How many sentences do you need?", 'number'),
    useObfuscation: cli.syn ||
        await ask(`${ chalk.yellow("(Experimental)") } Automatically replace the words with its synonyms?`, 'boolean'),
    io, ask, notice, highlight, status, stageHandler
}));

getSearchParams({})
    .then(create)
    .then(obfuscate)
    .then(async p => {
        io.out.write(`[*] ${ chalk.green("Generating Paragraph...") }${eol}`);
        await ioWriteStore(`Title: ${ p.params.search + eol }`);
        await ioWriteStore(`${eol}${ p.paragraph.join(" ") }${eol+eol}`);
        io.out.write(`[*] ${ chalk.green("Done!") }${eol}`)
    })
    .catch(e => console.error("Error while processing: " + e.message, e))
    .then(ioCleanup)
    .then(() => (process.exit(0)));
