// ==UserScript== //
// @name odoosoup
// @match https://www.odoo.com/web
// @match https://www.odoo.com/web?*
// ==/UserScript==

var inject = function () {
    odoo.define('odoosoup.web', function (require) {
        var dialogs = require('web.view_dialogs');
        var FormRenderer = require('web.FormRenderer');
        var KanbanRenderer = require('web.KanbanRenderer');

        var className = 'fa fa-external-link odoosoup_task_link';
        function insertAfter(new_node, ref_node) {
          ref_node.parentNode.insertBefore(new_node, ref_node.nextSibling);
        }
        function add_link(node, needle, callback) {
          switch(node.nodeType) {
            case 3:
              break;
            case 1:
              node.childNodes.forEach(n => add_link(n, needle, callback));
            default:
              return;
          }
          if (node.nextSibling && node.nextSibling.className == className) return;
          var oval = node.nodeValue;
          var done_offset = 0;
          oval.replace(needle, function(match, offset) {
            var link = document.createElement("i");
            link.className = className;
            link.onclick = () => callback(match, link);
            node.nodeValue = oval.slice(done_offset, offset+match.length);
            done_offset = offset + match.length;
            insertAfter(link, node);
            node = document.createTextNode(oval.slice(done_offset));
            insertAfter(node, link);
          });
        }

        FormRenderer.include({
            _show_odoosoup: function () {
                var self = this;
                if (self.state.model !== 'project.task') {
                    return;
                }
                var opened = JSON.parse(localStorage['odoosoup.task.opened'] || '[]');
                var id = self.state.res_id || null;
                var currentIndex = opened.indexOf(id);
                /* add seen eye icon */
                if (currentIndex !== -1) {
                    opened.splice(currentIndex, 1);
                    $('.odoosoup_task_seen', self.$el).remove();
                    $('h1 .o_task_name', self.$el).before('<i class="fa fa-eye odoosoup_task_seen"/>');
                } else if (opened.length > 2000) {
                    delete localStorage['odoosoup.task.'+opened.splice(0, 1)[0]];
                }
                opened.push(id);
                localStorage['odoosoup.task.opened'] = JSON.stringify(opened);
                var note = localStorage['odoosoup.task.'+id] || '';
                /* add current note */
                $('textarea.odoosoup_task_note').remove();
                $('<textarea class="odoosoup_task_note"/>').val(note).insertBefore($('h1', self.$el)).on('input', function () {
                    if (this.value !== note) {
                        if (this.value.trim()) {
                            localStorage['odoosoup.task.'+id] = note = this.value;
                        } else {
                            note = '';
                            delete localStorage['odoosoup.task.'+id];
                        }
                    }
                    this.style.height = "23px";
                    this.style.height = (this.scrollHeight)+"px";
                }).trigger('input');
                /* add in description links to *.odoo.com database record and contract */
                var desc = this.$el.find('div[name="description"]')[0];
                if (desc) {
                    add_link(desc, /\bM[0-9]{7,}\b/g, (match, link) =>
                        this._rpc({
                            model: 'sale.subscription', method: 'search', kwargs: {args: [['code', '=', match]], limit: 1}
                        }).then(result => result.length ? new dialogs.FormViewDialog(this, {
                            res_model: "sale.subscription",
                            res_id: result[0],
                        }).open() : link.parentNode.removeChild(link))
                    );
                    add_link(desc, /\b[a-z][a-z0-9-]{2,}[a-z0-9]\.odoo\.com\b/gi, (match, link) =>
                        this._rpc({
                            model: 'openerp.enterprise.database', method: 'search', kwargs: {args: [['url', 'ilike', '%//'+match] ], limit: 1}
                        }).then(result => result.length ? new dialogs.FormViewDialog(this, {
                            res_model: "openerp.enterprise.database",
                            res_id: result[0],
                        }).open() : link.parentNode.removeChild(link))
                    );
                }
            },
            on_attach_callback: function () {
                var res = this._super.apply(this, arguments);
                this._show_odoosoup();
                return res;
            },
            updateState: function () {
                var res = this._super.apply(this, arguments);
                return res.then(function () {
                    this._show_odoosoup();
                    return res;
                }.bind(this));
            },
        });
        KanbanRenderer.include({
            _show_odoosoup: function (target) {
                var self = this;
                if (self.state.model !== 'project.task') {
                    return;
                }
                var opened = JSON.parse(localStorage['odoosoup.task.opened'] || '[]');
                $('.o_kanban_record', target).each(function () {
                    if (!$(this).data('record')) {
                        return;
                    }
                    var id = $(this).data('record').id;
                    if (opened.includes(id)) {
                        $('.odoosoup_task_seen', this).remove();
                        $('div[name="priority"]:first', this).after('<i class="fa fa-lg fa-eye odoosoup_task_seen"/>');
                        var note = localStorage['odoosoup.task.'+id] || '';
                        if (note) {
                            $('.odoosoup_task_note', this).remove();
                            $('<div class="odoosoup_task_note text-truncate"/>').attr('title', $('<div class="odoosoup_task_note_tooltip" />').text(note).prop('outerHTML')).tooltip({'html': true}).text(note.replace(/^\s+|\s+$/g, '').replace(/\s*\n\s*/g, '⏎')).appendTo(this);
                        }
                    }
                });
            },
            on_attach_callback: function () {
                var res = this._super.apply(this, arguments);
                this._show_odoosoup();
                return res;
            },
            updateState: function () {
                var res = this._super.apply(this, arguments);
                return res.then(function () {
                    this._show_odoosoup();
                    return res;
                }.bind(this));
            },
            updateColumn: function (localID) {
                var self = this;
                var res = this._super.apply(this, arguments);
                return res.then(function () {
                    var index = _.findIndex(this.widgets, {db_id: localID});
                    var column = this.widgets[index];
                    self._show_odoosoup(column.$el);
                    return res;
                }.bind(this));
            }
        });
    });
};
var s = document.createElement('script');
s.innerText = '('+inject.toString() + ')()';
document.getElementsByTagName('head')[0].appendChild(s);
var l = document.createElement('style');
l.innerText = `
/* style over existing odoo.com features */

nav.o_main_navbar {
    background-color: #673A5B;
}

/* feature added by odoosoup */

.odoosoup_task_note {
    border: 1px solid #60ba8a;
    color: #207a4a;
    background: #f1ffe8;
}
textarea.odoosoup_task_note {
    overflow: hidden;
    min-height: 23px;
    resize: none;
}
.odoosoup_task_note_tooltip {
    white-space: pre-wrap;
}
.odoosoup_task_seen, .odoosoup_task_link {
    color: #673A5B;
}
.odoosoup_task_link {
    margin-left: 2px;
    cursor: pointer;
}
`;
document.getElementsByTagName('head')[0].appendChild(l);