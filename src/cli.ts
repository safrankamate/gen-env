#!/usr/bin/env node
import { Genvy } from './Genvy';

const targetEnv = process.argv[2];

new Genvy(targetEnv).generate();
