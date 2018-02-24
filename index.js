"use strict";

const Promise = require("bluebird");
const google = Promise.promisify(require("google"));
const chalk = require("chalk");
const pick = require("pick-random");
const reader = require("readline-sync");

async function filter(arr, callback) {
    return (await Promise.all(arr.map(async (item, i) => {
        return (await callback(item, i)) ? item : undefined
    }))).filter(i=>i!==undefined)
}

async function getSearchParams() {
    return {
        search: reader.question(`[?] ${chalk.green("What do you want to search for?")} `),
        len: reader.question(`[?] ${chalk.yellow("How many sentences do you need?")} `)
    };
}

async function create({ search, len }){
    len = parseInt(len);
    if(Number.isNaN(len) || len <= 0) {
        throw new Error("Paragraph length must a positive whole number. Please provide the number of sentences you want to generate.");
    }

    console.info(`[*] ${chalk.yellow("You might be prompt if the search result contains non-standard characters.")}`);

    let index = 0;
    let pool = [];

    while(pool.length < len){
        let links = (await google(search, index)).links;
        if(Array.isArray(links) && links.length > 0){
            let addingSs = links
                .map(r => {
                    return r.description.replace(/([.?!])\s*(?=[A-Z])/g, "$1|").split("|").toString().replace(/\s+/g, " ")
                })
                .reduce((a, b) => a.concat(b), [])
                .filter(s => s.length > 0);
            pool = pool.concat(addingSs.filter(
                (ele, off) => {
                    if(/[^\s\w,.']+/g.test(ele)){
                        let present = "\n";
                        present += off === 0 ? "" : chalk.gray(addingSs[off - 1]) + " ";
                        present += chalk.yellow(ele);
                        present += off === (addingSs.length - 1) ? "" : " " + chalk.gray(addingSs[off + 1]);
                        present += "\n";
                        console.info(present);

                        let decision = reader.question(`[?] ${
                            chalk.magenta("Do you want to keep this candidate in this context?")
                        } ${chalk.grey("[yes|no]")} `);

                        if (decision.charAt(0) !== 'y') {
                            console.info(`[*] ${chalk.red(`Ok. That sentence will ${chalk.underline("NOT")} appear in the output.`)}`);
                            return false;
                        }else{
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

    return pool.slice(0, len);
}

getSearchParams()
    .then(create)
    .then(p => {
        console.info(`[*] ${chalk.green("Here is your paragraph:")}`);
        console.info("\n" + chalk.blue(p.join(" ")) + "\n");
    })
    .catch(e => console.error("Error while processing: "+e.message, e))
    .then(() => (process.exit(0)));
