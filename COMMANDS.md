# Commands 

## Usage
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

- [add](#add)
- [blame](#blame)
- [build](#build)
- [clean](#clean)
- [diff](#diff)
- [format](#format)
- [init](#init)
- [install](#install)
- [kill](#kill)
- [link](#link)
- [lint](#lint)
- [list](#list)
- [migrate](#migrate)
- [outdate](#outdate)
- [pack](#pack)
- [precommit](#precommit)
- [preview](#preview)
- [publish](#publish)
- [sonar](#sonar)
- [start](#start)
- [test](#test)
- [version](#version)
# add

> add new component(s) to the current project

```sh
sf add mwc-component-name-1
sf add component-name-1

#add multiple components
sf add mwc-component-name-1,mwc-component-name-2
sf add component-name-1,component-name-2

```
# blame
> generate a git blame report
```sh
sf blame
```
# build
> build component(s)
```sh
#build all components
sf build

#build single component
sf build component-name

#build multiple components
sf build component-name-1,component-name-2

#minify
sf build component-name -m
sf build component-name --minify

#bundle name.bundle.js
sf build component-name -b
sf build component-name --bundle
#for publish: remove dependencies after bundle
sf build component-name -b publish

#add query string to src when injecting, {version} will be replaced with current version
#<link href="dist/xxx-components-app.bundle.css?v=1.0.55" rel="stylesheet" />
#<script src="dist/xxx-components-app.bundle.js?v=1.0.55"></script>
sf build component-name -q v={version}
sf build component-name --query v={version}

#css extract 
sf build component-name -c
sf build component-name --css

#inject path
sf build component-name -i
sf build component-name --inject

```
# clean
> clean dependencies and temporary files
```sh
sf clean

# clean git files (git reset --hard && git clean -df)
sf clean -g
sf clean --git
```
# diff
> generate a diff report for components
```sh

#diff all components between latest-prev and latest
sf diff

#diff components between a and b version
sf diff [component[,component]] -a [version-a,version-b]
sf diff [component[,component]] --ab [version-a,version-b]

#minor prev version vs latest
sf diff --ab minor-prev
#patch prev version vs latest
sf diff --ab latest-prev
sf diff --ab patch-prev
sf diff --ab prev

#diff any specified module names
sf diff -s [name[,name]] -a [version-a,version-b]
sf diff --spec [name[,name]] -a [version-a,version-b]

#diff with specified src folder
sf diff -s name?src=src

#diff with format
sf diff -s name?format=1

#clean workspace
sf diff -c
sf diff --clean

#open diff report after finished
sf diff -o
sf diff --open

```
# format
> format a js file
```sh
sf format <file>
```
# init
> create a new project
```sh
sf init
```
# install

> install dependencies and link internal components
```sh
sf install

#install module(s) to component(s)
sf install jquery -c component-1
sf install jquery,backbone -c component-1,component-2

#install module(s) to all components
sf install jquery,backbone -c

#install module(s) to dev dependencies
sf install jquery -d
sf install jquery --dev

#remove module(s)
sf install jquery -r
sf install jquery --remove

```
# kill
> kill a process
```sh
sf kill <name>

#example (https://www.npmjs.com/package/fkill)
sf kill 1337
sf kill chrome.exe
sf kill chrome
sf kill :8080

#multiple and without exe
sf kill chrome,code

```
# link

> link internal components or specified module to node_modules folder
```sh
#link project internal components
sf link

#link a module from a path
sf link module-1 path/from/module-1

#link a path to a module
sf link path/from/module-1 module-1

#no module name but use name from path
sf link path/from/module-1

#remove link
sf link module-1 -r
sf link module-1 --remove
```
# lint
> lint checking for codes
```sh
#lint all components
sf lint

#lint single component
sf lint component-name-1

#lint multiple components
sf lint component-name-1,component-name-2

#verify naming, exit with error if verifying failed
sf lint -n
sf lint --naming

```
## How to ignore files
* [.eslintignore](.eslintignore)
* [.stylelintignore](.stylelintignore)

# list
> list installed packages
```sh
sf list

#sort by filed module size: mSize, dependency size: dSize
sf list -s mSize
sf list --sort mSize

#ASC
sf list -a
sf list --asc

#show module info
sf list -m jquery
sf list --module jquery

#show component info
sf list component-name

```
# migrate
> migrate something
```sh
sf migrate mocha
```

# outdate
> check and update outdate dependencies version
```sh
#check outdate
sf outdate 
#update versions
sf outdate -u
```

# pack
> pack a component with node web server to zip file
```sh
sf pack component-name-1

#bundle dependencies
sf pack component-name-1 -b
sf pack component-name-1 --bundle

#minify
sf pack component-name-1 -b -m
sf pack component-name-1 --bundle --minify

# with query after url
sf pack component-name-1 -q v=2.5
sf pack component-name-1 --query v=2.5

```

# precommit
> lint + build + test before commit
```sh
#precommit all components
sf precommit

#precommit single component
sf precommit component-name-1

#precommit multiple components
sf precommit component-name-1,component-name-2

#pass without test
sf precommit component-name-1 -p
sf precommit component-name-1 --pass

```

# preview
> preview a component
```sh
sf preview component-name-1

#preview with proxy env
sf preview component-name-1 -e STG
sf preview component-name-1 --env STG

```

# publish
> publish components
```sh
# publish with version specified in package.json:
# check version
# precommit (lint + build + test)
# update sub components version
# npm publish --registry <registry> 

sf publish

# publish with version bumped by npm:
# precommit (lint + build + test)
# bump a new version patch and commit with message
# update sub components version
# npm publish --registry <registry> 
# version name refer to: https://docs.npmjs.com/cli/version
sf publish patch -m "$BUILD_USER updated version: {prevVersion} => {version}"


#publish with canary tag
sf publish prerelease -t canary

```
# sonar
> update sonar properties file
```sh
#create or update sonar-project.properties
sf sonar
```
# start
> start GUI
```sh
#start with default port 
sf start

#start with port 
sf start 10086

```

# test
> run unit test
```sh
#test all components
sf test

#test single component
sf test component-name-1

#test multiple components
sf test component-name-1,component-name-2

#test with single spec file
sf test component-name-1 -s test.spec.js
sf test component-name-1 --spec test.spec.js

#test in debug mode
sf test component-name-1 -d
sf test component-name-1 --debug

```

# version
> version management
```sh
# bump a new version patch and commit with message
# version name refer to: https://docs.npmjs.com/cli/version
sf version patch -m "$BUILD_USER updated version: {prevVersion} => {version}"
```

