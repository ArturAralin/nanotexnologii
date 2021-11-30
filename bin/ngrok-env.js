#!/usr/bin/env node

const ngrok = require('ngrok');
const path = require('path');
const os = require('os');
const fs = require('fs');

const CWD = process.cwd();
const HOME_DIR = os.homedir();

const configFile = path.resolve(CWD, './.nt.js');

// eslint-disable-next-line
const config = require(configFile).ngrok;

const urls = Object.fromEntries(
  Object
    .entries(config.urls)
    .map(([k, v]) => [k.toUpperCase(), {
      path: v,
      found: false,
    }]),
);

const [port] = process.argv.slice(2);

const envFile = config.envFile || path.join(HOME_DIR, '.ntenvs');

const envsFormat = config.format || 'bash';
const useExport = envsFormat === 'bash';
const linePrefix = useExport
  ? 'export '
  : '';

const log = (...args) => console.log(...args);

function readEnvsFile() {
  try {
    return fs.readFileSync(envFile, 'utf-8');
  } catch (_) {
    return '';
  }
}

function updateEnvFile(ngrokHost) {
  const fileParts = [];

  const currentEnvFileContent = readEnvsFile();

  const updateEnvFileContent = currentEnvFileContent
    .split('\n')
    .map((line) => {
      const [rawVarName] = line.split('=');

      if (rawVarName) {
        const varName = rawVarName
          .replace('export', '')
          .trim()
          .toUpperCase();

        if (urls[varName]) {
          urls[varName].found = true;

          const updatedLine = `${linePrefix}${varName}=${ngrokHost}${urls[varName].path}`;

          log(`Updated: ${updatedLine}`);

          return updatedLine;
        }
      }

      return line;
    })
    .join('\n');

  if (updateEnvFileContent) {
    fileParts.push(updateEnvFileContent);
  }

  const newVars = Object
    .entries(urls)
    .filter(([, url]) => !url.found)
    .map(([varName, c]) => {
      const createdLine = `${linePrefix}${varName}=${ngrokHost}${c.path}`;

      log(`Created: ${createdLine}`);

      return createdLine;
    })
    .join('\n');

  if (newVars) {
    fileParts.push('\n# nanotexnologii');
    fileParts.push(newVars);
    fileParts.push('\n');
  }

  fs.writeFileSync(envFile, fileParts.join('\n'), 'utf-8');
}

(async () => {
  const url = await ngrok.connect({
    proto: 'http',
    addr: parseInt(port, 10),
  });

  log(`Target file: ${envFile}`);
  log(`Url acquired: ${url}`);
  log(`Target port: ${port}`);

  updateEnvFile(url);
})();
