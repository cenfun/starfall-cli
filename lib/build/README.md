# sf build

> Build component(s)

## Usage

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
