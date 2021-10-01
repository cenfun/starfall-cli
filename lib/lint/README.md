# sf lint

> Run lint for component(s)

## Usage

```sh
#lint all components
sf lint

#lint single component
sf lint component-name-1

#lint multiple components
sf lint component-name-1,component-name-2

#custom config (no-ie11, no-2018, no-2017, no-2016, no-2015)
sf lint -c no-ie11
sf lint --config no-ie11

#verify naming, exit with error if verifying failed
sf lint -n
sf lint --naming

```

## How to ignore files
* [.eslintignore](https://eslint.org/docs/user-guide/configuring#eslintignore)
* [.stylelintignore](https://stylelint.io/user-guide/configuration#stylelintignore)