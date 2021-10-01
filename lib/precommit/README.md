# sf precommit

> Run lint + build + test before commit

## Usage

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