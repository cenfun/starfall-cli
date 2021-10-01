# sf diff

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

