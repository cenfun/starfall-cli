# sf link

> link internal components or specified module to node_modules folder

## Usage

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