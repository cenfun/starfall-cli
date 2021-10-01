
import $ from "jquery";
import "./combox.scss";
const ComBox = function($container) {
    this.$container = $($container);
    this.init();
};

ComBox.prototype = {

    constructor: ComBox,

    init: function() {
        this.list = [];

        const container = this.$container.get(0);
        if (!container) {
            console.error("ERROR: require a container");
            return;
        }
        this.nodeName = container.nodeName;

        if (this.isInput()) {
            this.$container.addClass("gui-combox-input");
        } else {
            this.$container.addClass("gui-combox").attr("tabIndex", "0");
            this.$container.empty().html('<div class="gui-combox-name"></div>');
            this.$name = this.$container.find(".gui-combox-name");
        }

        this.initEvent();
    },

    initEvent: function() {
        const self = this;

        this.$container.bind("click", function(e) {
            if (self.isOpen()) {
                self.close();
                return;
            }
            clearTimeout(self.timeout_open);
            self.timeout_open = setTimeout(function() {
                self.open();
            }, 100);
        });

        if (this.isInput()) {
            this.$container.bind("focus", function() {
                $(this).select();
            }).bind("keyup", function(e) {
                const value = $(this).val();
                if (self.item && self.item.value !== value) {
                    self.item.selected = false;
                }
                if (e.keyCode === 13) {
                    if (value) {
                        self.close();
                        self.onEnter.call(self, value);
                    }
                    return;
                }
                self.onKeyup.call(self, value);
            });
        }

    },

    isInput: function() {
        if (this.nodeName === "INPUT") {
            return true;
        }
        return false;
    },

    isOpen: function() {
        if (this.$list) {
            return true;
        }
        return false;
    },

    close: function() {
        if (this.$list) {
            this.$list.unbind().remove();
            this.$list = null;
        }
        const clickNSE = this.getNSE("click");
        $(document).unbind(clickNSE);
        const mouseDownNSE = this.getNSE("mousedown");
        $(document).unbind(mouseDownNSE);
        const resizeNSE = this.getNSE("resize");
        $(window).unbind(resizeNSE);
        this.onClose.call(this);
    },

    disable: function() {
        this.disabled = true;
        this.$container.addClass("disabled");
        if (!this.isInput()) {
            this.$container.removeAttr("tabIndex");
        }
    },

    enable: function() {
        this.disabled = false;
        this.$container.removeClass("disabled");
        if (!this.isInput()) {
            this.$container.attr("tabIndex", "0");
        }
    },

    open: function() {

        if (this.disabled) {
            return;
        }

        if (this.$list) {
            return;
        }

        if (!this.list.length) {
            return;
        }

        //for ie focus outline
        this.$container.focus();

        this.$list = $("<div/>").addClass("gui-combox-list").appendTo(document.body);
        this.$list.css("min-width", this.$container.outerWidth(true));
        this.initListEvents();

        this.renderList();

        const self = this;

        const clickNSE = this.getNSE("click");
        $(document).unbind(clickNSE).bind(clickNSE, function(e) {
            self.close();
        });

        const mouseDownNSE = this.getNSE("mousedown");
        $(document).unbind(mouseDownNSE).bind(mouseDownNSE, function(e) {
            if (self.contains(self.$list, e.target, true)) {
                return;
            }
            self.close();
        });

        const resizeNSE = this.getNSE("resize");
        $(window).unbind(resizeNSE).bind(resizeNSE, function(e) {
            self.close();
        });

    },

    initListEvents: function() {
        const self = this;
        this.$list.delegate(".gui-combox-item", "click", function(e) {
            const $item = $(this);
            const index = $item.attr("index");
            const item = self.getItem(index);
            if (!item) {
                return;
            }
            const changed = self.setItem(item);
            self.close();
            self.onSelect.call(self, item);
            if (changed) {
                self.onChange.call(self, item);
            }
            return false;
        });

        this.$list.delegate(".gui-combox-delete-icon", "click", function(e) {
            const $item = $(this);
            const index = $item.attr("index");
            const item = self.getItem(index);
            if (!item) {
                return;
            }
            self.deleteItem(item);
            self.close();
            self.onDelete.call(self, item);
            return false;
        });

    },

    isSelected: function(item) {
        if (item.selected) {
            return true;
        }
        if (this.isInput()) {
            if (item.value === this.$container.val()) {
                return true;
            }
        }
        return false;
    },

    renderList: function() {
        if (!this.$list) {
            return;
        }
        this.$list.empty();

        const list = [];

        const self = this;
        this.list.forEach(function(item, i) {
            item.index = i;

            let className = "gui-combox-item";

            let deleteIcon = "";
            if (item.delete && !item.selected) {
                deleteIcon = `<div class="gui-combox-delete-icon" index="${i}"></div>`;
                className += " gui-combox-delete-item";
            }

            if (self.isSelected(item)) {
                className += " selected";
                self.setItem(item);
            }

            let html = "";
            html += `<div class="${className}" index="${i}" title="${item.value}">`;
            html += `<div class="gui-combox-item-name">${item.name}</div>`;
            html += deleteIcon;
            html += "</div>";

            list.push(html);
        });

        const listStr = list.join("");
        this.$list.html(listStr);

        this.layoutList();
    },

    layoutList: function() {
        const listHeight = this.$list.outerHeight(true);
        const holderHeight = $(document.body).height();

        const offset = this.$container.offset();
        const targetTop = offset.top;
        const targetLeft = offset.left;
        const targetHeight = this.$container.outerHeight(true);

        if (targetTop + targetHeight + listHeight > holderHeight) {
            this.$list.css({
                left: targetLeft,
                top: `${targetTop - listHeight}px`
            });
        } else {
            this.$list.css({
                left: targetLeft,
                top: `${targetTop + targetHeight}px`
            });
        }
    },

    deleteItem: function(item) {
        this.list.splice(item.index, 1);
    },

    getItem: function(index) {
        return this.list[index];
    },

    getItemByValue: function(value) {
        for (let i = 0, l = this.list.length; i < l; i++) {
            const item = this.list[i];
            if (item && item.value === value) {
                return item;
            }
        }
        return null;
    },

    getItemBySelected: function() {
        for (let i = 0, l = this.list.length; i < l; i++) {
            const item = this.list[i];
            if (item && item.selected) {
                return item;
            }
        }
        return null;
    },

    setItem: function(item) {
        if (!item) {
            return false;
        }
        //always update name
        this.setName(item.name);
        if (item === this.item) {
            return false;
        }
        if (this.item) {
            this.item.selected = false;
        }
        this.item = item;
        item.selected = true;
        return true;
    },

    setName: function(name) {
        if (this.isInput()) {
            this.$container.val(name);
        } else {
            this.$name.html(name);
        }
        this.$container.attr("title", name);
    },

    setValue: function(value) {
        if (!this.list.length) {
            this.item = null;
            this.setName("");
            return;
        }

        if (!value) {
            return;
        }
        const item = this.getItemByValue(value);
        if (!item) {
            return;
        }

        const changed = this.setItem(item);
        if (changed) {
            this.onChange.call(this, item);
        }

    },

    getValue: function() {
        if (this.item) {
            return this.item.value;
        }
        return "";
    },

    initListData: function(list) {
        if (!list || !list.length) {
            this.list = [];
            return;
        }
        const itemList = [];
        list.forEach(function(item) {
            if (item && typeof(item) === "object") {
                itemList.push(item);
            } else {
                item += "";
                itemList.push({
                    name: item,
                    value: item
                });
            }
        });
        this.list = itemList;
    },

    setList: function(list) {

        this.initListData(list);

        //remove value if list is empty
        this.setValue();

        //init value
        if (this.isOpen()) {
            this.renderList();
        }

        const selected = this.getItemBySelected();
        if (selected) {
            this.setItem(selected);
            return;
        }

        if (!this.isInput()) {
            const first = this.list[0];
            if (first) {
                this.setItem(first);
            }
        }

    },

    contains: function(container, target, equal) {
        container = $(container).get(0);
        target = $(target).get(0);
        //(container, target);
        if (!container || !target) {
            return false;
        }

        if (equal && container === target) {
            return true;
        }

        return $.contains(container, target);
    },

    getNSE: function(type) {
        const token = this.getToken();
        return `${type}.combox_${token}`;
    },

    getToken: function() {
        if (!this.token) {
            this.token = this.createToken();
        }
        return this.token;
    },

    createToken: function(len) {
        let str = Math.random().toString().substr(2);
        if (len) {
            str = str.substr(0, len);
        }
        return str;
    },

    //events 

    //input
    onEnter: function(value) {

    },
    onKeyup: function(value) {

    },

    //list
    onSelect: function(item) {

    },
    onChange: function(item) {

    },
    onDelete: function(item) {

    },

    onClose: function() {

    }

};

export default ComBox;
