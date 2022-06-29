import 'github-markdown-css';
import './main.scss';

import $ from 'jquery';
import { Grid } from 'turbogrid';
import Util from './util.js';
import ComBox from './combox.js';

const ID = 'sf';

const Main = function() {
    this.init();
};

Main.prototype = {
    init: function() {
        this.initMain();
        this.initSocket();
        this.initDragger();
        this.initTabs();
        this.initTooltip();
        this.initProject();
        this.initGrid();
    },

    initMain: function() {
        this.faviconIndex = 0;
        this.favicon = document.querySelector('link[rel="icon"]');
        this.previousFavicon = this.favicon.getAttribute('href');
        this.canvas = document.createElement('canvas');
        // document.body.appendChild(canvas);
        this.canvas.width = 16;
        this.canvas.height = 16;
        this.ctx = this.canvas.getContext('2d');
        this.$content = $('.gui-output-content');
    },

    initSocket: function() {
        this.socket_list = [];
        const self = this;
        this.socket = window.io.connect('/');
        this.socket.on('data', function(data) {
            self.socketDataHandler(data);
        });
        this.socket.on('connect', function(data) {
            self.showStatus('Socket Connected');
            self.requestData({
                name: 'getProjectInfo'
            });
        });

        this.socket.on('connect_error', function(data) {
            self.showError('Socket Connect error');
        });

        this.socket.on('connect_timeout', function(data) {
            self.showError('Socket Connect timeout');
        });

        this.socket.on('reconnecting', function(data) {
            self.showStatus('Socket Reconnecting ...');
        });

        this.socket.on('reconnect_error', function(data) {
            self.showError('Socket Reconnect error');
        });

        this.socket.on('reconnect_failed', function(data) {
            self.showError('Socket Reconnect failed');
        });
    },

    sendSocketList: function() {
        if (!this.socket_list.length) {
            return;
        }
        const self = this;
        clearTimeout(this.timeout_socket_list);
        this.timeout_socket_list = setTimeout(function() {
            self.sendSocketItem();
        }, 0);

    },

    sendSocketItem: function() {
        const item = this.socket_list.shift();
        if (item && this.socket) {
            this.socket.emit('data', item);
        } else {
            console.log('Invalid socket');
        }
        this.sendSocketList();
    },

    // ===================================================================================

    sendMessage: function(message) {
        if (!message) {
            return;
        }
        this.socket_list.push({
            type: 'message',
            data: message
        });
        this.sendSocketList();
    },

    sendCmd: function(cmd) {
        if (!cmd) {
            return;
        }
        this.socket_list.push({
            type: 'cmd',
            data: cmd
        });
        this.sendSocketList();
    },

    requestData: function(data) {
        if (!data) {
            return;
        }
        this.socket_list.push({
            type: 'data',
            data: data
        });
        this.sendSocketList();
    },

    requestDataSync: function(data) {
        if (this.socket) {
            this.socket.emit('data', {
                type: 'data',
                data: data
            });
        }
    },

    // ===================================================================================

    socketDataHandler: function(data) {
        if (!data) {
            return;
        }

        const handlers = {
            // only for text message
            message: this.messageHandler,
            // only for cmd
            cmd: this.cmdHandler,
            // for data function
            data: this.dataHandler
        };

        const handler = handlers[data.type];
        if (handler) {
            handler.call(this, data.data);
        }
    },

    dataHandler: function(data) {
        if (!data || !data.name) {
            console.log('invalid data arguments');
            return;
        }
        const handler = this[data.name];
        if (typeof handler === 'function') {
            // console.log("data handler: " + data.name);
            handler.call(this, data.data);
        } else {
            const msg = `Not found handler: ${data.name}`;
            console.log(msg);
            this.showError(msg);
        }
    },

    // ===================================================================================
    draggerHandler: function(dragger) {
        const d = dragger.startH + (dragger.startY - dragger.posY);
        dragger.target.height(`${d}px`);
        const self = this;
        this.throttle(100, function() {
            self.resize();
            self.scrollTo(true);
        });

    },

    initDragger: function() {
        const $target = $('.gui-body');
        const dragger = {
            target: $target
        };
        const self = this;
        const $dragger = $('.gui-dragger').unbind();
        $dragger.bind('mousedown.gui-dragger', function(e) {
            e.preventDefault();
            const global = $(window);
            $(document.body).addClass('gui-dragger-cursor');
            global.bind('mousemove.gui-dragger', function(ee) {
                // console.log(e.type);
                ee.preventDefault();
                dragger.posY = ee.pageY;
                self.draggerHandler(dragger);
            });
            global.bind('mouseup.gui-dragger', function(ee) {
                // console.log(e.type);
                global.unbind('mouseup.gui-dragger');
                global.unbind('mousemove.gui-dragger');
                $(document.body).removeClass('gui-dragger-cursor');
                dragger.posY = ee.pageY;
                self.draggerHandler(dragger);
            });
            // console.log(e.type);
            dragger.startY = e.pageY;
            dragger.startH = $target.height();
        });
    },

    // ===================================================================================

    initTabs: function() {
        const self = this;
        $('.gui-tab').delegate('.gui-tab-item', 'click', function() {
            const $item = $(this);
            const data = $item.attr('data');
            self.tabChangeHandler(data);
        });
    },

    tabChangeHandler: function(name) {
        if (!name) {
            name = 'dashboard';
        }
        this.currentTab = name;
        $('.gui-tab-item').removeClass('selected');
        $('.gui-body-item').removeClass('selected');
        $(`.gui-tab-item[data='${name}']`).addClass('selected');
        $(`.gui-body-item[data='${name}']`).addClass('selected');
        this.resize();
    },

    updateTabs: function(tabs) {

        // console.log(tabs);
        // clean previous custom tabs first
        const $guiTab = $('.gui-tab');
        const $guiBody = $('.gui-body');

        $guiTab.find('.gui-tab-item-custom').remove();
        $guiBody.find('.gui-body-item-custom').remove();

        if (!Util.isList(tabs)) {
            return;
        }

        // append new tabs
        tabs.forEach(function(item, i) {
            if (!item || !item.title || !item.content) {
                return;
            }
            $('<div/>').addClass('gui-tab-item gui-tab-item-custom')
                .html(item.title).attr('data', `custom-${i}`).appendTo($guiTab);
            $('<div/>').addClass('gui-body-item gui-body-item-custom')
                .html(item.content).attr('data', `custom-${i}`).appendTo($guiBody);
        });
    },

    // ===================================================================================

    initTooltip: function() {
        const self = this;
        $(document).delegate('[tooltip]', 'mouseenter mouseleave', function(e) {
            self.tooltipRemoveHandler();
            if (e.type === 'mouseleave') {
                return;
            }
            const $target = $(this);
            self.tooltipCreateHandler($target);
        });
    },

    tooltipRemoveHandler: function() {
        if (this.$tooltip) {
            this.$tooltip.remove();
            this.$tooltip = null;
        }
    },

    tooltipCreateHandler: function($target) {
        const tooltip = $target.attr('tooltip');
        if (!tooltip) {
            return;
        }

        const $tooltip = $('<div/>').html(tooltip)
            .addClass('gui-tooltip')
            .appendTo(document.body);

        const tooltipWidth = $tooltip.outerWidth(true);
        const tooltipHeight = $tooltip.outerHeight(true);

        const holderWidth = $(document.body).width();
        // var holderHeight = $(document.body).height();

        const offset = $target.offset();
        const targetTop = offset.top;
        const targetLeft = offset.left;

        const targetWidth = $target.outerWidth(true);
        const targetHeight = $target.outerHeight(true);

        const arrowSize = 5;

        // default is up
        let top = targetTop - tooltipHeight - arrowSize;
        if (top < 0) {
            top = targetTop + targetHeight + arrowSize;
            $tooltip.addClass('gui-tooltip-down');
        }

        // default is center
        let left = targetLeft + targetWidth * 0.5 - tooltipWidth * 0.5;
        if (left < 0) {
            left = 0;
        } else if (left + tooltipWidth > holderWidth) {
            left = holderWidth - tooltipWidth;
        }

        $tooltip.css({
            top: top,
            left: left
        });

        $tooltip.addClass('gui-fade');

        this.$tooltip = $tooltip;
    },

    // ===================================================================================

    initProject: function() {
        const self = this;
        $('.gui-project-open').bind('click', function(e) {
            self.openProjectHandler();
        });
        $('.gui-project-restart').bind('click', function(e) {
            self.restartProjectHandler();
        });
    },

    openRemoveHandler: function() {
        if (this.browseGrid) {
            this.browseGrid.destroy();
            this.browseGrid = null;
        }
        if (this.$modal) {
            this.$modal.unbind();
            this.$modal.remove();
            this.$modal = null;
        }
    },

    openProjectHandler: function() {
        this.openRemoveHandler();

        let template = '';
        template += '<div class="gui-modal">';
        template += '<div class="gui-modal-main">';

        template += '<div class="gui-modal-head gui-flex-row">';
        template += '<div class="gui-modal-title gui-flex-auto"></div>';
        template += '<div class="gui-modal-close">x</div>';
        template += '</div>';

        template += '<div class="gui-modal-body"></div>';
        template += '<div class="gui-modal-foot"></div>';
        template += '</div>';
        template += '</div>';

        const $modal = $(template).appendTo(document.body);

        const self = this;
        $modal.bind('click', function(e) {
            const $elem = $(e.target);
            if ($elem.hasClass('gui-modal') || $elem.hasClass('gui-modal-close')) {
                self.openRemoveHandler();
            }
        });

        this.$modal = $modal;

        if (this.browseGrid) {
            this.browseGrid.showLoading();
        }

        this.browseRequestHandler(this.browsePath);

    },

    restartProjectHandler: function() {
        this.requestData({
            name: 'switchProject',
            data: this.info.project
        });
    },

    openDoneHandler: function() {
        this.openRemoveHandler();
        this.requestData({
            name: 'switchProject',
            data: this.browsePath
        });
    },

    browseCreateHandler: function() {

        // head
        this.$modal.find('.gui-modal-title').append('Open project');

        // body
        let htmlBody = '';
        htmlBody += '<div class="gui-browse-head gui-flex-row">';
        htmlBody += '<button class="gui-browse-up">Up</button>';
        htmlBody += '<div class="gui-h-space-5"></div>';
        htmlBody += '<input class="gui-input gui-browse-path gui-flex-auto"></input>';
        htmlBody += '<div class="gui-h-space-5"></div>';
        htmlBody += '<button class="gui-browse-go">GO</button>';
        htmlBody += '</div>';
        htmlBody += '<div class="gui-browse-list"></div>';
        this.$modal.find('.gui-modal-body').append(htmlBody);

        // foot
        let htmlFoot = '';
        htmlFoot += '<div class="gui-browse-foot gui-flex-row">';
        htmlFoot += '<input class="gui-input gui-browse-filter" placeholder="Filter"></input>';
        htmlFoot += '<div class="gui-flex-auto"></div>';
        htmlFoot += '<div>Open with a package.json</div>';
        htmlFoot += '<div class="gui-h-space-10"></div>';
        htmlFoot += '<button class="gui-browse-open gui-button-primary disabled">Open</button>';
        htmlFoot += '</div>';
        const $foot = $(htmlFoot);
        this.$modal.find('.gui-modal-foot').append($foot);

        this.browseInitHandler();

    },

    browseInitHandler: function() {
        // create Grid
        const self = this;
        const container = this.$modal.find('.gui-browse-list').get(0);
        this.browseGrid = new Grid(container);
        this.browseGrid.bind('onClick', function(e, d) {

            // console.log("onClick", d);

            const rowData = this.getRowItem(d.row);
            const v = rowData.name;
            if (v === 'package.json') {
                // open
                self.openDoneHandler();
                return;
            }

            const browsePath = `${self.browsePath}/${v}`;
            // console.log("requestData", browsePath);
            self.browseRequestHandler(browsePath);

        });

        this.browseGrid.setFilter({
            icon: function(v) {
                return `<div class="gui-browse-icon gui-browse-icon-${v}"></div>`;
            }
        });

        this.browseGrid.setOption({

            rowFilter: function(rowData) {
                if (!self.browse_keywords) {
                    return true;
                }
                let name = rowData.name;
                if (name === '../' || name === 'package.json') {
                    return true;
                }
                name = name.toLowerCase();
                if (name.indexOf(self.browse_keywords) !== -1) {
                    return true;
                }
                return false;
            }
        });

        this.$modal.delegate('.gui-browse-up', 'click', function(e) {
            const p = `${self.browsePath}/../`;
            self.browseRequestHandler(p);
        });

        this.$modal.delegate('.gui-browse-go', 'click', function(e) {
            const p = self.$modal.find('.gui-browse-path').val();
            if (!p) {
                return;
            }
            self.browseRequestHandler(p);
        });

        this.$modal.delegate('.gui-browse-open', 'click', function(e) {
            const $elem = $(this);
            if ($elem.hasClass('disabled')) {
                return;
            }
            self.openDoneHandler();
        });

        this.$modal.delegate('.gui-browse-filter', 'focus change blur keyup', function(e) {
            const $elem = $(this);
            // console.log(e.type);
            if (e.type === 'focusin') {
                $elem.select();
                return;
            }

            const k = $elem.val();
            if (k === self.browse_keywords) {
                return;
            }
            self.browse_keywords = k;

            if (self.browseGrid) {
                self.browseGrid.update();
            }

        });
    },

    browseRequestHandler: function(browsePath) {
        this.requestData({
            name: 'getBrowseInfo',
            data: browsePath
        });

        this.$modal.find('.gui-browse-filter').val('');
        this.browse_keywords = '';
    },

    updateBrowseInfo: function(info) {

        // console.log("updateBrowseInfo", info);

        if (!info || !this.$modal) {
            return;
        }
        // console.log(info);

        this.browsePath = info.browsePath;

        if (!this.browseGrid) {
            this.browseCreateHandler();
        }

        this.$modal.find('.gui-browse-path').val(this.browsePath);

        this.browseGrid.setData(info.gridData);
        this.browseGrid.render();
        this.browseGrid.hideLoading();

        const $open = this.$modal.find('.gui-browse-open');
        if (info.packageJson) {
            $open.removeClass('disabled');
        } else {
            $open.addClass('disabled');
        }

    },

    // ===================================================================================

    updateProjectInfo: function(info) {

        this.openRemoveHandler();

        if (!info) {
            this.showError('ERROR: Can NOT get project info');
            return;
        }

        this.info = info;
        console.log(info);

        window.location.hash = info.project;
        this.addHistoryItem('project', `${info.project}=${info.name}`);
        this.projectHistoryHandler();
        this.tabChangeHandler();
        this.bindEvents();

        this.title = `${ID}: ${info.name}`;
        this.showTitleStatus(this.title);

        let branch = info.branch;
        if (info.repository) {
            branch = `<a href="${info.repository}" target="_blank">${info.branch}</a>`;
        }
        $('.gui-project-branch').html(branch);

        $('.gui-project-version').html(`v${info.version}`);
        $('.gui-cli-version').html(info.cliVersion);
        $('.it-version').val(info.version);

        if (!Util.isList(info.list)) {
            info.list = [];
            this.showError('ERROR: Can NOT get component list');
        }

        this.showList(info.list);

    },

    // =======================================================================================
    // after grid rendered update related data async
    updateProjectRelated: function() {

        this.requestData({
            name: 'getReadme'
        });

        // load custom tabs
        this.requestData({
            name: 'getTabs'
        });

        // load specs for test
        this.requestData({
            name: 'getTestSpecs'
        });

    },

    updateReadme: function(html) {
        const $readme = $('.gui-body-readme').html(html);
        $readme.find('a').attr('target', '_blank');
    },

    updateTestSpecs: function(specs) {
        if (!specs) {
            console.log('Not found specs');
            return;
        }
        this.specs = specs;
        this.updateComponentSpec();
    },

    updateComponentSpec: function() {
        let list = [];
        const name = this.getSelectedNames();
        if (this.specs) {
            const files = this.specs[name];
            if (files && files.length > 1) {
                list = [''];
                files.forEach(function(file) {
                    list.push(file);
                });
            }
        }
        this.specComBox.setList(list);
        if (list.length) {
            this.specComBox.enable();
        } else {
            this.specComBox.disable();
        }
    },

    updateSelected: function() {
        const selectedItems = this.grid.getSelectedRows();
        const list = [];
        selectedItems.forEach(function(item) {
            list.push(item.name);
        });
        this.updateSelectedNames(list.join(','));
        this.updateComponentSpec();
        this.updateButtons();
    },

    updateButtons: function() {
        this.updateBuildButton();
        this.updateTestButton();
        this.updateLintButton();
        this.updatePreCommitButton();
        this.updateDevButton();
        this.updateListButton();
    },

    updateBuildButton: function() {
        const minifyChecked = $('.cb-minify').get(0).checked;
        let minify = '';
        if (minifyChecked) {
            minify = ' -m';
        }

        const bundleChecked = $('.cb-bundle').get(0).checked;
        let bundle = '';
        if (bundleChecked) {
            bundle = ' -b';
        }

        const buildCmd = `${ID} build ${this.getSelectedNames()}${minify}${bundle}`;
        $('.cli-build').attr('tooltip', buildCmd);
        const buildAllCmd = `${ID} build${minify}${bundle}`;
        $('.cli-build-all').attr('tooltip', buildAllCmd);
    },

    updateTestButton: function() {
        let spec = this.specComBox.getValue();
        if (spec) {
            spec = ` -s ${spec}`;
        } else {
            spec = '';
        }

        const debugChecked = $('.cb-debug').get(0).checked;
        let debug = '';
        if (debugChecked) {
            debug = ' -d';
        }

        const openChecked = $('.cb-open').get(0).checked;
        let open = '';
        if (openChecked) {
            open = ' -o';
        }

        const testCmd = `${ID} test ${this.getSelectedNames()}${spec}${debug}${open}`;
        $('.cli-test').attr('tooltip', testCmd);

        const testAllCmd = `${ID} test${debug}${open}`;
        $('.cli-test-all').attr('tooltip', testAllCmd);

    },

    updateLintButton: function() {

        const stylelintChecked = $('.cb-stylelint').get(0).checked;
        let stylelint = '';
        if (stylelintChecked) {
            stylelint = ' -s';
        }

        const namingChecked = $('.cb-naming').get(0).checked;
        let naming = '';
        if (namingChecked) {
            naming = ' -n';
        }

        const lintCmd = `${ID} lint ${this.getSelectedNames()}${stylelint}${naming}`;
        $('.cli-lint').attr('tooltip', lintCmd);
        const lintAllCmd = `${ID} lint${stylelint}${naming}`;
        $('.cli-lint-all').attr('tooltip', lintAllCmd);
    },

    updatePreCommitButton: function() {

        const passChecked = $('.cb-pass').get(0).checked;
        let pass = '';
        if (passChecked) {
            pass = ' -p';
        }

        const minifyChecked = $('.cb-minify').get(0).checked;
        let minify = '';
        if (minifyChecked) {
            minify = ' -m';
        }

        const precommitCmd = `${ID} precommit ${this.getSelectedNames()}${pass}${minify}`;
        $('.cli-precommit').attr('tooltip', precommitCmd);

        const precommitAllCmd = `${ID} precommit${pass}${minify}`;
        $('.cli-precommit-all').attr('tooltip', precommitAllCmd);
    },

    updateDevButton: function() {
        let env = this.envComBox.getValue();
        if (env) {
            env = ` -e ${env}`;
        }
        const devCmd = `${ID} dev ${this.getSelectedNames()}${env}`;
        $('.cli-dev').attr('tooltip', devCmd);
    },

    updateListButton: function() {
        let sort = this.sortComBox.getValue();
        if (sort) {
            sort = ` -s ${sort}`;
        }
        const listCmd = `${ID} list ${this.getSelectedNames()}${sort}`;
        $('.cli-list').attr('tooltip', listCmd);
        const listAllCmd = `${ID} list${sort}`;
        $('.cli-list-all').attr('tooltip', listAllCmd);
    },

    initGrid: function() {
        const self = this;
        const container = document.querySelector('.gui-component-list');
        this.grid = new Grid(container);
        this.grid.bind('onClick', function(e, d) {
            this.unselectAll();
            this.setRowSelected(d.row, d.e);
            self.updateSelected();
        });
        this.grid.bind('onSelectedChanged', function(e, d) {
            self.updateSelected();
        }).bind('onDblClick', function(e, d) {
            // click build button
            setTimeout(function() {
                $('.cli-build').click();
            }, 100);
        }).bind('onContextMenu', function(e, d) {
            self.showContextMenu(d);
        });
        this.grid.setOption({
            rowHeight: 30,
            scrollbarSize: 10,
            showHeader: false,
            showCheckbox: true,
            rowFilter: function(rowData) {
                const keywords = self.keywords;
                if (!keywords) {
                    return true;
                }
                let name = rowData.name;
                name = name.toLowerCase();
                const arr = keywords.split(' ');
                for (let i = 0, l = arr.length; i < l; i++) {
                    const item = arr[i];
                    if (item && name.indexOf(item) !== -1) {
                        return true;
                    }
                }
                return false;
            }
        });
        this.grid.setFilter({
            tree: function(v, rowItem) {
                let className = '';
                const style = self.getCookie(`style-${rowItem.name}`);
                if (style) {
                    className = `gui-style-${style}`;
                }
                return `<div class="${className}">${v}</div>`;
            }
        });
        this.grid.showLoading();
    },

    resize: function() {
        if (this.currentTab && this.currentTab !== 'dashboard') {
            return;
        }
        this.grid.resize();
    },

    getContentMenuList: function(name) {
        let html = '';
        html += '<div class="gui-context-head">Style</div>';
        const styleList = ['', 'star', 'heart', 'check', 'error', 'question'];
        styleList.forEach(function(item) {
            let className = `gui-style-${item}`;
            if (!item) {
                className = '';
            }
            html += `<div class="gui-context-item" value="${item}">`;
            html += `<div class="${className}">${name}</div>`;
            html += '</div>';
        });
        return html;
    },

    showContextMenu: function(d) {

        const e = d.e;
        e.preventDefault();

        this.contextMenuRemoveHandler();

        this.grid.unselectAll();
        this.grid.setRowSelected(d.row, d.e);
        this.updateSelected();

        const rowItem = this.grid.getRowItem(d.row);
        const name = rowItem.name;
        const html = this.getContentMenuList(name);
        // var content = d.cellNode.innerText;

        const contextMenu = document.createElement('div');
        contextMenu.className = 'gui-context-menu';
        contextMenu.innerHTML = html;
        document.body.appendChild(contextMenu);

        const self = this;

        $(contextMenu).bind('contextmenu', function() {
            return false;
        }).delegate('.gui-context-item', 'click', function() {
            const elem = $(this);
            const value = elem.attr('value');
            // console.log(name, value);
            if (value) {
                self.setCookie(`style-${name}`, value);
            } else {
                self.delCookie(`style-${name}`);
            }
            self.contextMenuRemoveHandler();
            self.updateGridRow(rowItem);
        });

        const contextMenuLayout = function(cm, ee) {
            let top = ee.pageY;
            const ch = cm.clientHeight;
            if (top + ch > document.body.clientHeight) {
                top -= ch;
            }
            const left = ee.pageX;
            cm.style.top = `${top}px`;
            cm.style.left = `${left}px`;
        };

        contextMenuLayout(contextMenu, e);

        const contextMenuCloseHandler = function(ee) {
            if (!self.contextMenu) {
                return;
            }
            if (self.contextMenu === ee.target || self.contextMenu.contains(ee.target)) {
                return;
            }
            document.removeEventListener('click', contextMenuCloseHandler);
            self.contextMenuRemoveHandler();
        };

        document.addEventListener('click', contextMenuCloseHandler);

        this.contextMenu = contextMenu;

    },

    contextMenuRemoveHandler: function() {
        if (this.contextMenu) {
            this.contextMenu.parentNode.removeChild(this.contextMenu);
            this.contextMenu = null;
        }
    },

    updateGridRow: function(rowItem) {
        this.grid.invalidateRow(rowItem.tg_index);
        this.grid.render();
    },

    getSelectedNames: function() {
        return this.getCookie('names') || '';
    },

    updateSelectedNames: function(names) {
        this.setCookie('names', names);
        $('.gui-selected-names').html(`Selected: ${names}`);
    },

    showList: function(list) {

        this.list = list;

        const names = this.getSelectedNames();
        const previousNames = names.split(',');
        const rows = [];
        list.forEach(function(item) {
            const row = {
                name: item
            };
            if (Util.inList(item, previousNames)) {
                row.selected = true;
            }
            rows.push(row);
        });

        const gridData = {
            columns: [{
                id: 'name',
                sortable: false,
                cellClass: 'gui-grid-name',
                name: 'Components',
                width: 255
            }],
            rows: rows
        };

        const self = this;

        this.grid.onceRendered(function() {

            this.hideLoading();

            const selected = this.getSelectedRow();
            if (selected) {
                this.scrollRowIntoView(selected.tg_index);
                self.updateSelectedNames(selected);
            }

            // update button all cmd
            self.updateSelected();

            self.updateProjectRelated();

        });

        this.grid.setData(gridData);
        this.grid.render();

    },

    // ===================================================================================
    /* eslint-disable max-statements,complexity */
    bindEvents: function() {

        this.terminalComBoxHandler();
        this.specComBoxHandler();
        this.sortComBoxHandler();
        this.envComBoxHandler();

        const self = this;

        $('button').unbind().bind('click', function(e) {
            const button = $(this);
            const handler = {
                'bt-version': function(bt) {
                    self.versionHandler(bt);
                },
                'bt-version-reset': function(bt) {
                    $('.it-version').val(self.info.version);
                },
                'bt-version-major': function(bt) {
                    self.versionPlusHandler(bt, 0);
                },
                'bt-version-minor': function(bt) {
                    self.versionPlusHandler(bt, 1);
                },
                'bt-version-patch': function(bt) {
                    self.versionPlusHandler(bt, 2);
                },
                'bt-cancel': function(bt) {
                    self.cancelHandler();
                },
                'bt-clear': function(bt) {
                    self.$content.empty();
                },
                'bt-load': function(bt) {
                    self.loadFileHandler();
                },
                'bt-locate': function(bt) {
                    self.locateErrorHandler(bt);
                },
                'bt-sync-file': function() {
                    self.syncFileHandler();
                }
            };

            for (const id in handler) {
                if (button.hasClass(id)) {
                    handler[id].call(this, button);
                    return;
                }
            }
            self.buttonClickHandler(button);
        });

        $('.cb-autoscroll').unbind().change(function() {
            self.autoScrollHandler();
        });
        this.autoScrollHandler();

        $('.cb-minify').unbind().bind('change', function() {
            self.updateBuildButton();
            self.updatePreCommitButton();
        });

        $('.cb-bundle').unbind().bind('change', function() {
            self.updateBuildButton();
        });

        $('.cb-debug').unbind().bind('change', function() {
            self.updateTestButton();
        });

        $('.cb-open').unbind().bind('change', function() {
            self.updateTestButton();
        });

        $('.cb-stylelint').unbind().bind('change', function() {
            self.setCookie('lint_stylelint', this.checked);
            self.updateLintButton();
        });
        const stylelint = this.getCookie('lint_stylelint');
        if (stylelint === 'true') {
            $('.cb-stylelint').attr('checked', 'checked');
            self.updateLintButton();
        }

        $('.cb-naming').unbind().bind('change', function() {
            self.setCookie('lint_naming', this.checked);
            self.updateLintButton();
        });
        const naming = this.getCookie('lint_naming');
        if (naming === 'true') {
            $('.cb-naming').attr('checked', 'checked');
            self.updateLintButton();
        }

        $('.cb-pass').unbind().bind('change', function() {
            self.updatePreCommitButton();
        });

        this.keywords = this.getCookie('keywords');
        $('.gui-component-filter').unbind().bind('focus', function() {
            $(this).select();
        }).bind('change blur keyup', function() {
            self.keywordsHandler($(this).val());
        }).val(this.keywords);
        this.filterHandler(this.keywords);

        const syncPath = this.getCookie('sync_path');
        if (syncPath) {
            $('.it-sync-path').val(syncPath);
        }

        return this;
    },
    /* eslint-enable */

    // ===================================================================================

    terminalComBoxHandler: function() {

        if (!this.terminalComBox) {
            const self = this;
            this.terminalComBox = new ComBox($('.gui-terminal'));
            this.terminalComBox.onSelect = function(item) {
                const value = item.value;
                self.sendCmdHandler(value);
                self.addHistoryItem('suggestion', value, 5);
                self.terminalComBoxHandler();
            };
            this.terminalComBox.onEnter = function(value) {
                self.sendCmdHandler(value);
                self.addHistoryItem('suggestion', value, 5);
                self.terminalComBoxHandler();
            };
            this.terminalComBox.onDelete = function(item) {
                self.delHistoryItem('suggestion', item.value);
            };
        }

        const list = this.getHistoryList('suggestion');

        const itemList = [];
        list.forEach(function(item) {
            itemList.push({
                name: item,
                value: item,
                delete: true
            });
        });

        const defaultList = Util.defaultSuggestion.cmd;
        if (defaultList) {
            defaultList.forEach(function(item) {
                if (Util.inList(item, list)) {
                    return;
                }
                itemList.push({
                    name: item,
                    value: item
                });
            });
        }

        this.terminalComBox.setList(itemList);
    },

    specComBoxHandler: function() {
        if (!this.specComBox) {
            const self = this;
            this.specComBox = new ComBox($('.gui-spec-combox'));
            this.specComBox.onChange = function(item) {
                self.updateTestButton();
            };
        }

    },

    sortComBoxHandler: function() {

        if (!this.sortComBox) {
            const self = this;
            this.sortComBox = new ComBox($('.gui-sort-combox'));
            this.sortComBox.onChange = function(item) {
                self.setCookie('list_sort', item.value);
                self.updateListButton();
            };
            this.sortComBox.setList([
                '',
                'mSize',
                'dSize',
                'mFiles',
                'dFiles',
                'name'
            ]);
        }

        const sort = this.getCookie('list_sort');
        if (sort) {
            this.sortComBox.setValue(sort);
            this.updateListButton();
        }

    },

    envComBoxHandler: function() {

        if (!this.envComBox) {
            const self = this;
            this.envComBox = new ComBox($('.gui-env-combox'));
            this.envComBox.onChange = function(item) {
                self.setCookie('dev_env', item.value);
                self.updateDevButton();
            };
            this.envComBox.setList([
                '',
                'DEV',
                'QA',
                'STG',
                'LOCAL'
            ]);
        }

        const env = this.getCookie('dev_env');
        if (env) {
            this.envComBox.setValue(env);
            this.updateListButton();
        }

    },

    projectHistoryHandler: function() {

        if (!this.projectComBox) {
            const self = this;
            this.projectComBox = new ComBox($('.gui-project-combox'));
            this.projectComBox.onChange = function(item) {
                const project = item.value;
                if (self.info.project === project) {
                    return;
                }
                self.requestData({
                    name: 'switchProject',
                    data: project
                });
            };
            this.projectComBox.onDelete = function(item) {
                const str = `${item.value}=${item.name}`;
                self.delHistoryItem('project', str);
                self.projectHistoryHandler();
            };
        }

        const currentProject = this.info.project;
        const list = [];
        const plist = this.getHistoryList('project');
        const projects = {};
        plist.forEach(function(item) {
            if (!item) {
                return;
            }
            const arr = item.split('=');
            const value = arr[0];
            const name = arr[1];
            if (projects[value]) {
                return;
            }
            projects[value] = true;

            let selected = false;
            if (currentProject === value) {
                selected = true;
            }

            list.push({
                selected: selected,
                delete: true,
                name: name,
                value: value
            });

        });

        this.projectComBox.setList(list);

    },

    versionHandler: function(button) {

        const $version = $('.it-version');
        const version = $version.val();
        if (!version) {
            $version.focus();
            return;
        }

        this.info.version = version;

        this.requestData({
            name: 'updateVersion',
            data: version
        });

    },

    versionPlusHandler: function(button, index) {
        const $version = $('.it-version');
        const version = $version.val();
        const arr = version.split('.');
        arr[index] = (parseInt(arr[index], 10) || 0) + 1;
        arr.length = index + 1;
        const list = [];
        for (let i = 0; i < 3; i++) {
            list.push(Util.toNum(arr[i]));
        }
        $version.val(list.join('.'));
    },

    cancelHandler: function() {
        this.requestData({
            name: 'cancel'
        });
    },

    loadFileHandler: function() {
        const self = this;
        $('.it-load-file').unbind().bind('change', function() {
            self.showMessage('Loading file ...');
            const file = this.files[0];
            self.requestData({
                name: 'loadFile',
                data: file
            });
        }).click();
    },

    getLocateList: function() {

        // find all c31
        const c31s = this.$content.find('.c31');

        const locateList = [];

        const pos = {};
        // remove same row
        c31s.each(function() {
            const c31 = $(this);
            const top = c31.offset().top;
            if (pos[top]) {
                return;
            }
            pos[top] = c31;
            locateList.push(c31);
        });

        return locateList;

    },

    locateErrorHandler: function(button) {

        const locateList = this.getLocateList();
        if (!locateList.length) {
            const name = button.attr('name');
            button.html(`${name} (Nothing)`);
            setTimeout(function() {
                button.html(name);
            }, 1000);
            return;
        }

        let locateFocus = null;
        let locatePrev = null;
        locateList.forEach(function(item) {
            if (locateFocus) {
                return;
            }
            if (locatePrev) {
                locateFocus = item;
            }
            if (item.hasClass('gui-locate-focus')) {
                locatePrev = item;
                item.removeClass('gui-locate-focus');
            }
        });
        if (!locateFocus) {
            locateFocus = locateList[0];
        }

        locateFocus.addClass('gui-locate-focus');

        const $output = $('.gui-output');

        const height = locateFocus.offset().top + $output.scrollTop();

        $output.stop().scrollTop(height);

    },

    syncFileHandler: function() {
        const syncPath = $('.it-sync-path').val();
        if (!syncPath) {
            // remove saved to use default
            this.setCookie('sync_path', '');
            this.showError('Please set sync path first');
            $('.it-sync-path').focus();
            return;
        }

        this.setCookie('sync_path', syncPath);

        // get selected components

        const selectedRows = this.grid.getSelectedRows();

        const componentList = [];
        selectedRows.forEach(function(item) {
            componentList.push(item.name);
        });

        if (!componentList.length) {
            this.showError('Please select a component');
            return;
        }

        this.showMessage(`Selected sync components: ${componentList.join(', ')}`);

        this.requestData({
            name: 'syncFile',
            data: {
                syncPath: syncPath,
                componentList: componentList
            }
        });

    },

    // ===================================================================================

    buttonClickHandler: function(button) {
        const cmd = button.attr('cmd') || button.attr('tooltip');
        if (!cmd) {
            console.log('Invalid button cmd');
            return this;
        }

        if (button.hasClass('gui-button-loading')) {
            return this;
        }
        button.addClass('gui-button-loading').attr('loading-cmd', cmd);
        this.showTitleStatus(`> ${cmd}`);

        this.sendCmdHandler(cmd);
    },

    autoScrollHandler: function() {
        this.autoscroll = Boolean($('.cb-autoscroll:checked').length);
    },

    // ===================================================================================

    keywordsHandler: function(keywords) {
        const self = this;
        clearTimeout(this.time_filter);
        this.time_filter = setTimeout(function() {
            self.filterHandler(keywords);
        }, 100);
    },

    filterHandler: function(keywords) {
        keywords = $.trim(keywords);
        if (keywords === this.keywords) {
            return;
        }
        this.keywords = keywords;
        this.setCookie('keywords', keywords);
        if (this.grid) {
            this.grid.update();
        }
        return this;
    },

    sendCmdHandler: function(cmd) {
        if (!cmd) {
            return;
        }

        this.showMessage(cmd, {
            color: '#ffffff',
            padding: '8px 8px',
            margin: '0px -5px',
            background: '#272822'
        });

        this.sendCmd(cmd);
    },

    sendMessageHandler: function(message) {
        if (!message) {
            return;
        }

        // console.log(message);
        const div = document.createElement('div');
        div.innerText = message;
        const str = div.innerHTML;
        this.sendMessage(str);
    },

    // ===================================================================================

    messageHandler: function(data) {
        const str = `${data.data}`;
        if (!str) {
            return;
        }
        this.showMessage(str);
    },

    cmdInfoHandler: function(cmd, code) {
        // with error
        if (code && code !== 0) {
            this.showError(`Complete: ${cmd} (with error ${code})`);
            return;
        }

        this.showMessage(`Complete: ${cmd} (without error ${code})`, '#859900');

    },

    cmdHandler: function(data) {

        const cmd = data.cmd;
        const code = data.code;

        // when server force close will silent finish
        if (!data.silent) {
            this.cmdInfoHandler(cmd, code);
        }

        const button = $(`button[loading-cmd='${cmd}']`);
        if (!button.length) {
            return this;
        }

        // when server start run cmd
        if (data.start) {
            button.addClass('gui-button-loading').attr('loading-cmd', cmd);
            this.showTitleStatus(`> ${cmd}`);
            this.showOutputLoading();
            return this;
        }

        // when server finish cmd
        button.removeClass('gui-button-loading').attr('loading-cmd', '');
        this.showTitleStatus();
        this.hideOutputLoading();

        return this;
    },

    showOutputLoading: function() {
        $('.gui-output-loading').show();
    },

    hideOutputLoading: function() {
        $('.gui-output-loading').hide();
    },

    // ===================================================================================

    getHistoryList: function(type) {
        let list = [];
        const sugs = this.getCookie(`history_${type}`, true);
        if (sugs) {
            list = sugs.split('{|}');
        }
        return list;
    },

    addHistoryItem: function(type, value, max) {
        const newList = [value];
        const list = this.getHistoryList(type);
        list.forEach(function(item) {
            if (item !== value) {
                newList.push(item);
            }
        });
        if (max) {
            if (newList.length > max) {
                newList.length = max;
            }
        }
        const str = newList.join('{|}');
        this.setCookie(`history_${type}`, str, true);
    },

    delHistoryItem: function(type, value) {
        const newList = [];
        const list = this.getHistoryList(type);
        list.forEach(function(item) {
            if (item !== value) {
                newList.push(item);
            }
        });
        const str = newList.join('{|}');
        this.setCookie(`history_${type}`, str, true);
    },

    // ===================================================================================

    logAppendHandler: function(str, style) {
        if (!str) {
            return;
        }
        let div = $('<div/>').addClass('gui-output-line').html(str);
        div = this.logStyleHandler(div, style);

        this.$content.append(div);
        this.scrollTo();

        // debounce clean
        clearTimeout(this.timeout_clean);
        const self = this;
        this.timeout_clean = setTimeout(function() {
            self.logCleanHandler();
        }, 1000);

    },

    logStyleHandler: function(div, style) {
        if (!style) {
            return div;
        }
        if (typeof style === 'object') {
            div.css(style);
        } else if (typeof style === 'string') {
            div.css({
                color: style
            });
        }
        return div;
    },

    logCleanHandler: function() {
        if (!this.info) {
            return;
        }
        const max = this.info.history || 2000;
        const l = this.$content.children().length;
        if (l < max) {
            return this;
        }
        const n = l - max;
        for (let i = 0; i < n; i++) {
            this.$content.children().first().remove();
        }
        return this;
    },

    scrollTo: function(now) {
        if (!this.autoscroll) {
            return;
        }

        const height = this.$content.outerHeight();
        const $output = $('.gui-output');

        if (now) {
            $output.stop().scrollTop(height);
            return;
        }

        if (this.scrolling) {
            $output.stop().scrollTop(this.scrollPos);
        }

        this.scrolling = true;
        this.scrollPos = height;

        const self = this;
        $output.stop().animate({
            scrollTop: height
        }, function() {
            self.scrolling = false;
        });
    },

    // ===================================================================================

    showMessage: function(message, style) {
        this.logAppendHandler(message, style);
    },

    showError: function(message) {
        this.showMessage(message, '#ff0000');
    },

    showStatus: function(message) {
        this.showMessage(message, '#999999');
    },

    showTitleStatus: function(cmd) {
        if (cmd && cmd !== this.title) {
            document.title = cmd;
            this.showFavicon();
            return;
        }
        document.title = this.title;
        this.stopFavicon();
    },

    showFavicon: function() {
        const list = [
            [0, 0],
            [6, 0],
            [12, 0],
            [12, 6],
            [12, 12],
            [6, 12],
            [0, 12],
            [0, 6]
        ];
        this.ctx.clearRect(0, 0, 16, 16);
        const self = this;
        list.forEach(function(item, i) {
            if (i === self.faviconIndex) {
                self.ctx.fillStyle = '#335d00';
            } else {
                self.ctx.fillStyle = '#ee5d00';
            }
            self.ctx.fillRect(item[0], item[1], 4, 4);
        });
        this.faviconIndex += 1;
        if (this.faviconIndex > 7) {
            this.faviconIndex = 0;
        }
        this.favicon.href = self.canvas.toDataURL('image/png');

        clearTimeout(this.time_favicon);
        this.time_favicon = setTimeout(function() {
            self.showFavicon();
        }, 200);
    },

    stopFavicon: function() {
        clearTimeout(this.time_favicon);
        this.favicon.href = this.previousFavicon;
    },

    throttle: function(delay, callback) {
        clearTimeout(this.throttle_timeout);
        const now = new Date().getTime();
        const self = this;
        if (this.throttle_last && now < this.throttle_last + delay) {
            this.throttle_timeout = setTimeout(function() {
                self.throttle_last = now + delay;
                callback.apply(self);
            }, delay);
        } else {
            this.throttle_last = now;
            callback.apply(self);
        }
    },

    // ===================================================================================

    getCookieKey: function(key, global) {
        let pre = 'cli_';
        if (!global) {
            pre = `cli_${this.info.name}_`;
        }
        key = pre + key;
        return key;
    },

    getCookie: function(key, global) {
        key = this.getCookieKey(key, global);
        if (window.localStorage) {
            return window.localStorage.getItem(key);
        }
        const strCookie = document.cookie || '';
        const list = strCookie.split(';');
        for (let i = 0, l = list.length; i < l; i++) {
            const item = list[i];
            const arr = item.split('=');
            const k = $.trim(arr[0]);
            if (k === key) {
                return arr[1];
            }
        }
        return '';
    },

    setCookie: function(key, value, global) {
        key = this.getCookieKey(key, global);
        if (window.localStorage) {
            return window.localStorage.setItem(key, value);
        }
        const expireDays = 30;
        const date = new Date();
        date.setTime(date.getTime() + expireDays * 24 * 3600 * 1000);
        document.cookie = `${key}=${value};expires=${date.toGMTString()}`;
    },

    delCookie: function(key, global) {
        key = this.getCookieKey(key, global);
        if (window.localStorage) {
            return window.localStorage.removeItem(key);
        }
        const date = new Date();
        date.setTime(date.getTime() - 1);
        document.cookie = `${key}=;expires=${date.toGMTString()}`;
    }
};

export default Main;
