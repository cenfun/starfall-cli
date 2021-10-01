# sf pack

> Pack a component with web server to zip file

## Usage

```sh
sf pack component-name-1

#bundle dependencies
sf pack component-name-1 -b
sf pack component-name-1 --bundle

#minify
sf pack component-name-1 -b -m
sf pack component-name-1 --bundle --minify

# with hash in filename
sf pack component-name-1 -h 6
sf pack component-name-1 --hash 6

# with query after url
sf pack component-name-1 -q v=2.5
sf pack component-name-1 --query v=2.5

```

