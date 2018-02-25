PGoogle
=======

[![NPM](https://nodei.co/npm/pgoogle.png)](https://nodei.co/npm/pgoogle/)

A command line paragraph generator: u give me some keywords, I write ur essay. GPL-3.0 licensed.

![ScreenShot #1](screenshots/screenshot_1.jpg)
![ScreenShot #2](screenshots/screenshot_2.jpg)

**Disclaimer**: This tool is created for research purposes, and is not intended to support
plagiarism or help anyone with their homework. Please be aware of the purpose of using this tool.

    Copyright (C) 2017 Marcus Zhou
    
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    
    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

### Experimental Feature
* From version 1.0.3, pgoogle now supports **Automatic Synonym Replacing (ASP)**. The program will
    pick a synonym from its database and automatically replace it.
* From version 1.0.4, you will be given the option to disable **ASP**.

## Install

Install using npm:

```bash
# With NPM
npm install -g pgoogle

# With YarnPkg
yarn global add pgoogle
```

## Usage

Run `pgoogle`, then follow the prompts.

```bash
pgoogle
```

### Automatic Synonym Replacing (Experimental)

The program can now select synonyms from the WordNet database, and automatically
replace the words in the original document.
