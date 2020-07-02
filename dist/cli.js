#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Genvy_1 = require("./Genvy");
const targetEnv = process.argv[2];
new Genvy_1.Genvy(targetEnv).generate();
