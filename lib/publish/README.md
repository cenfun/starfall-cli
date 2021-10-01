# sf publish

> Publish components in the current project

## Usage

```sh
# publish with version specified in package.json:
# check version
# precommit (lint + build + test)
# update sub components version
# npm publish --registry <registry> 

sf publish
```


```sh
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