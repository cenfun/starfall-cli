

# Starfall CLI - Building Your Components Easier and Faster!
Starfall CLI speeds up tasks by multiprocessing on multiple CPU cores, which maximizes the capacity of CPU.

## Popular Tech Standards in Starfall CLI

* webpack + babel
* eslint + stylelint
* mocha + istanbul
* koa
* headless chromium
* vue

## Install

#### Install [Node.js 14+](https://nodejs.org/en/)

#### Install [starfall-cli]  
  ```bash
  #require administrator/sudo permission
  npm install starfall-cli -g
  #run starfall-cli directly
  sf -v
  ```

### Troubleshooting

* [Resolving EACCES permissions errors when installing packages globally](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally)
* "-bash: sf: command not found" remove and create new symbolic link for Starfall: ln -s /path-to-starfall-cli/lib/cli.js /usr/local/bin/sf 

#### Development commands:

```bash
 
  sf start

  sf install

  sf build [component-name[,component-name]]
  sf watch

  sf preview [component-name]

  sf lint [component-name[,component-name]]
  sf test [component-name[,component-name]]

  sf precommit [component-name[,component-name]]

  sf add [component-name[,component-name]]

  sf init project-name

  sf init .

  sf -h
  sf -v
```

#### Commands detail usage:

* [sf add](lib/add/README.md)
* [sf blame](lib/blame/README.md)
* [sf build](lib/build/README.md)
* [sf clean](lib/clean/README.md)
* [sf diff](lib/diff/README.md)
* [sf format](lib/format/README.md)
* [sf init](lib/init/README.md)
* [sf install](lib/install/README.md)
* [sf kill](lib/kill/README.md)
* [sf link](lib/link/README.md)
* [sf lint](lib/lint/README.md)
* [sf list](lib/list/README.md)
* [sf migrate](lib/migrate/README.md)
* [sf outdate](lib/outdate/README.md)
* [sf pack](lib/pack/README.md)
* [sf precommit](lib/precommit/README.md)
* [sf preview](lib/preview/README.md)
* [sf publish](lib/publish/README.md)
* [sf sonar](lib/sonar/README.md)
* [sf start](lib/start/README.md)
* [sf test](lib/test/README.md)
* [sf version](lib/version/README.md)

#### Clone or create your project with following structure

* Multi-components project (monorepos)
  
  ```js
  local-path/your-project/
  package.json
  packages/
    component-name-1/
      package.json
      preview/
        index.html
      src/
        index.js
      test/
        specs/
          test.js
    component-name-2/
      package.json
      preview/
        index.html
      src/
        index.js
      test/
        specs/
          test.js
  ```

* Single component project
  
  ```js
  local-path/your-project/
  package.json
  preview/
    index.html
  src/
    index.js
  test/
    specs/
      test.js
  ```

#### Getting Start new Project (monorepos)

```bash
sf init
sf add component-name
sf install jquery -c component-name
sf build
sf test
```

#### Publish Components

```bash
npm i starfall-cli -D --timing
npx sf install
npx sf publish
npx sf sonar
```

#### Deploy Package

```bash
sf pack [component-name]
sf pack [component-name] -b -m
```

## Configuration

Copy to project root path or use CLI default.

* [conf.cli.js](conf.cli.js)
* [conf.webpack.js](conf.webpack.js)
* [conf.proxy.js](conf.proxy.js)


## Changelog

[CHANGELOG.md](CHANGELOG.md)


## Debug CLI with VSCode

* Enable "Debug > Node: Auto Attach" with "on" in Preferences Settings

* Debug Config: .vscode/launch.json
  
  ```json
  {
    "version": "0.2.0",
    "configurations": [{
        "type": "node",
        "request": "launch",
        "name": "Debug",
        "program": "${workspaceFolder}/../starfall-cli/lib/cli.js",
        "cwd": "${workspaceFolder}",
        "autoAttachChildProcesses": true,
        "args": ["build", "app", "-m"]
    }]
  }
  ```

## Run Starfall CLI from docker

First building your Starfall CLI docker image from [Dockerfile](Dockerfile):

```bash
docker build . -t cli-docker
```

Then running Starfall CLI docker image for your project:

```bash
docker run \
--rm \
--name container_sf \
--mount type=bind,source="$(pwd)",target=/project \
cli-docker \
bash -c "sf install && sf precommit || CODE=\$? && chmod 777 -R /project && exit \$CODE"
```