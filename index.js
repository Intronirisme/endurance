#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs-extra');
const path = require('path');
const packageJson = require('./package.json');

const program = new Command();

program.version(packageJson.version, '-v, --version', 'output the current version')
  .description('Endurance CLI to bootstrap new projects');

program
  .command('new-project')
  .description('Create a new project')
  .action(() => {
    // Obtenir le chemin du module endurance-template dans node_modules
    const templatePath = path.resolve(__dirname, 'node_modules', 'endurance-template');
    const currentPath = process.cwd();

    // Copier les fichiers depuis templatePath vers currentPath
    fs.copy(templatePath, currentPath)
      .then(() => {
        console.log('Project created successfully');
      })
      .catch(err => {
        console.error(err);
      });
  });

  program
  .command('new-module <moduleName>')
  .description('Create a new module')
  .action(moduleName => {
    const templatePath = path.resolve(__dirname, 'node_modules', 'endurance-template-module');
    const currentPath = process.cwd();
    const modulePath = path.resolve(currentPath, 'modules', moduleName);

    const replaceModuleNameInFile = (filePath, moduleName) => {
      const data = fs.readFileSync(filePath, 'utf8');
      const result = data.replace(/{module-name}/g, moduleName);
      fs.writeFileSync(filePath, result, 'utf8');
    };

    const processDirectory = (srcDir, destDir, moduleName) => {
      fs.readdirSync(srcDir, { withFileTypes: true }).forEach(dirent => {
        const srcPath = path.join(srcDir, dirent.name);
        const destPath = path.join(destDir, dirent.name.replace(/{module-name}/g, moduleName));

        if (dirent.isDirectory()) {
          fs.ensureDirSync(destPath);
          processDirectory(srcPath, destPath, moduleName);
        } else if (dirent.isFile() && dirent.name !== 'package.json') {
          fs.copySync(srcPath, destPath);
          replaceModuleNameInFile(destPath, moduleName);
        }
      });
    };

    fs.ensureDirSync(modulePath);
    processDirectory(templatePath, modulePath, moduleName);

    console.log(`Module "${moduleName}" created successfully in ${modulePath}`);
  });

  program
  .command('list-events')
  .description('List all available events across modules and specific node_modules')
  .action(() => {
    const searchEventsInDirectory = (dirPath, results = [], moduleName = '') => {
      fs.readdirSync(dirPath, { withFileTypes: true }).forEach(dirent => {
        const fullPath = path.join(dirPath, dirent.name);

        if (dirent.isDirectory()) {
          searchEventsInDirectory(fullPath, results, moduleName || dirent.name);
        } else if (dirent.isFile() && fullPath.endsWith('.js')) {
          const fileContent = fs.readFileSync(fullPath, 'utf8');
          const eventMatches = fileContent.match(/emitter\.emit\((eventTypes\.[\w_]+)/g);

          if (eventMatches) {
            eventMatches.forEach(event => {
              results.push({ event, file: fullPath, module: moduleName || 'Unknown module' });
            });
          }
        }
      });

      return results;
    };

    let results = [];

    const modulesPath = path.resolve(process.cwd(), 'modules');
    results = searchEventsInDirectory(modulesPath, results);

    const nodeModulesPath = path.resolve(process.cwd(), 'node_modules');
    const enduranceCorePath = path.join(nodeModulesPath, 'endurance-core');
    const edrmModules = fs.readdirSync(nodeModulesPath).filter(dir => dir.startsWith('edrm-'));

    if (fs.existsSync(enduranceCorePath)) {
      results = searchEventsInDirectory(enduranceCorePath, results, 'endurance-core');
    }

    edrmModules.forEach(moduleName => {
      const modulePath = path.join(nodeModulesPath, moduleName);
      results = searchEventsInDirectory(modulePath, results, moduleName);
    });

    if (results.length === 0) {
      console.log('No events found.');
    } else {
      results.forEach(result => {
        console.log(`Event: ${result.event} | File: ${result.file} | Module: ${result.module}`);
      });
    }
  });


program.parse(process.argv);
