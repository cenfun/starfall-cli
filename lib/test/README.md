# sf test

> Run unit test

## Usage

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