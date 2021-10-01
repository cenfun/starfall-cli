# sf install

> Install dependencies and link internal components

## Usage

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