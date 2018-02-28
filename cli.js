#!/usr/bin/env node

"use strict";

const Readline = require("readline");
const chalk = require("chalk");
const {
    create,
    obfuscate
} = require("pgoogle");
const eol = require("os").EOL;

const io = {
    in: process.stdin,
    out: process.stdout
};
const rl = Readline.createInterface({
    input: io.in,
    output: io.out
});

//Two step process!!
const ask = async (question, type, colorizer) => {
    let typeHinter = (
        type === 'boolean' ? " [yes|no]" :
        type === 'number' ? " [number]" :
        ""
    );
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
    search: await ask("What do you want to search for?", 'string', chalk.green),
    len: await ask("How many sentences do you need?", 'number'),
    useObfuscation: await ask(`${ chalk.yellow("(Experimental)") } Automatically replace the words with its synonyms?`, 'boolean'),
    io, ask, notice, highlight, status, stageHandler
}));

getSearchParams()
    .then(create)
    .then(obfuscate)
    .then(p => {
        io.out.write(`[*] ${ chalk.green("Here is your paragraph:") }${eol+eol}`);
        io.out.write(`${ p.paragraph.join(" ") }${eol+eol}`);
    })
    .catch(e => console.error("Error while processing: " + e.message, e))
    .then(() => (rl.close()))
    .then(() => (process.exit(0)));
