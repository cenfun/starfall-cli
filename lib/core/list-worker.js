module.exports = class {

    constructor(maxCount = 10, list = []) {
        this.maxCount = maxCount;
        this.list = list;
    }

    addItem(item) {
        this.list.push(item);
    }

    addList(list) {
        this.list = this.list.concat(list);
    }

    start(handler) {
        if (typeof handler !== 'function') {
            return;
        }
        this.handler = handler;
        this.count = 0;
        return new Promise((resolve) => {
            this.resolve = resolve;
            this.next();
        });
    }

    next() {
        // console.log(`list: ${this.list.length} count: ${this.count}`);
        if (!this.list.length) {
            if (this.count > 0) {
                return;
            }
            this.resolve();
            return;
        }
        if (this.count >= this.maxCount) {
            return;
        }
        const item = this.list.shift();
        this.count += 1;
        this.handler(item).finally(() => {
            this.count -= 1;
            this.next();
        });
        this.next();
    }

};
