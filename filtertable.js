(function( $ ) {
    "use strict";
    function get_sign(txt) {
        var return_val = "";
        if (txt.substr(0, 1) == "g") {
            return_val += ">";
        } else if (txt.substr(0, 1) == "l") {
            return_val += "<";
        }
        if (txt.slice(-1) == "e") {
            return_val += "=";
        }
        return return_val;
    }

    function toCurrency(x) {
        var dec_split = x.toString().split("."),
            currency = "$",
            len_b4_dec = dec_split[0].length,
            remainder = len_b4_dec % 3,
            num_commas;
        if (remainder > 0) {
            num_commas = Math.floor(len_b4_dec/3);
            currency += dec_split[0].substr(0, remainder);
        } else {
            num_commas = (len_b4_dec/3) - 1;
            currency += dec_split[0].substr(0, 3);
        }
        for (var i = 0; i < num_commas; i++) {
            currency += "," + dec_split[0].substr(remainder + i * 3, 3);
        }
        if (dec_split.length > 1) {
            currency += "." + dec_split[1];
        }
        return currency;
    }

    function render_func(params) {
        var type = params.type,
            func;

        var parse_vars = function (string, data, type, row) {
            var regex = /{{\s*(data|type|row)(?:.(\w+))?\s*}}/g,
                matches = string.match(regex),
                return_string = string;

            for (var i = 0; i < matches.length; i++) {
                var capture =  matches[i].match(/^{{\s*(data|type|row)(?:.(\w+))?\s*}}$/)
                switch (capture[1]) {
                    case "data":
                        return_string.replace(matches[i], data);
                        break;
                    case "row":
                        return_string.replace(matches[i], row[capture[2]])
                        break;
                    case "type":
                        return_string.replace(matches[i], type);
                        break;
                }

            }
            return return_string;
        };
        switch(type) {
            case "html":
                func = function ( data, type, row ) {
                    var attr_str = " ",
                        element = params.element || "div",
                        inner_text = params.text || "",
                        after_text = params.after || "";
                    for (var attr in params.attrs) {
                        if (params.attrs.hasOwnProperty(attr)) {
                            attr_str += attr + '="' + params.attrs[attr] + '" '
                        }
                    }
                    var string = '<' + element + attr_str + '>' + inner_text + '</' + element + '>' + after_text,
                        regex = /{{\s*(data|type|row)(?:.(\w+))?\s*}}/g,
                        matches = string.match(regex),
                        return_string = string;

                    for (var i = 0; i < matches.length; i++) {
                        var capture =  matches[i].match(/^{{\s*(data|type|row)(?:.(\w+))?\s*}}$/)
                        switch (capture[1]) {
                            case "data":
                                return_string = return_string.replace(matches[i], data);
                                break;
                            case "row":
                                return_string = return_string.replace(matches[i], row[capture[2]])
                                break;
                            case "type":
                                return_string = return_string.replace(matches[i], type);
                                break;
                        }

                    }
                    return return_string;
                };
                break;
            case "percent":
                var decimal_places = params.decimal_places || 0;
                func =  function ( data, type, row ) {
                    if (typeof data !== undefined && data !== null && data !== "N/A") {
                        return Number(Math.round(data+'e' + decimal_places)+'e-' + decimal_places) + "%";
                    } else {
                        return "";
                    }
                };
                break;
            case "currency":
                var decimal_places = params.decimal_places || 0;
                if (decimal_places === "vary") {
                    func = function(data, type, row) {
                        if (typeof data !== undefined && data !== null && data !== "N/A") {
                            if (data < .01) {
                                data = Number(Math.round(data+'e6')+'e-6');
                            } else if (data < 1) {
                                data = Number(Math.round(data+'e4')+'e-4');
                            } else {
                                data = Number(Math.round(data+'e2')+'e-2');
                                data = data.toFixed(2).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                            }
                            return "$" + data;
                        } else {
                            return "";
                        }
                    };
                } else {
                    func = $.fn.dataTable.render.number( ',', '.', decimal_places, '$' );
                }
                break;
            case "number":
                var decimal_places = params.decimal_places || 0;
                func = $.fn.dataTable.render.number( ',', '.', decimal_places);
                break;
        }
        return func;
    }

    function create_renders(columns) {
        for(var i = 0; i < columns.length; i++) {
            if (columns[i].hasOwnProperty("render")) {
                columns[i].render = render_func(columns[i].render);
            }
            if (columns[i].hasOwnProperty("createdCell")) {
                columns[i].createdCell = function (td, cellData, rowData, row, col) {
                     if ( cellData < 0 ) {
                        $(td).css('color', 'red')
                     } else if ( cellData > 0 ) {
                         $(td).css('color', 'green')
                     }

                };
            }
        }
        return columns;
    }

    var FilterTable = function (table, data, options) {
        this.options = $.extend({data: data}, $.fn.filtertable.defaults, options);
        options.data = data;
        delete options.filters;
        options.columns = create_renders(options.columns);
        if (options.index) {
            options.columns.unshift({data: null, title: "#", searchable: false, orderable: false});
        }
        delete options.index;
        var columns = {};
        for (var i = 0; i < options.columns.length; i++) {
            columns[options.columns[i].data] = i;
        }
        this.columns = columns;
        if ("market_cap_usd" in columns) {
            options.order = [[columns["market_cap_usd"], "desc"]]
        }
        this.created_filters = {};
        $.fn.dataTable.ext.search.push(
            function( settings, data, dataIndex ) {
                function clean_data(data) {
                    if (typeof data == "string") {
                        if (data.substr(0,1) === "$") {
                            data = data.substr(1);
                        }
                        data = data.replace(",", "");
                        data = data.replace("%", "");
                    }
                    return parseFloat(data);
                }
                var created_filters = $("#created_filters").attr("data-filters");
                var data_columns = $("#created_filters").attr("data-columns");
                if (created_filters) {
                    created_filters = JSON.parse(created_filters);
                }
                if (data_columns) {
                    data_columns = JSON.parse(data_columns);
                }
                if (created_filters) {
                    for (var id in created_filters) {
                        // skip loop if the property is from prototype
                        if (!created_filters.hasOwnProperty(id)) continue;
                        var obj = created_filters[id];
                        if (id.endsWith("_gt") || id.endsWith("_lt")) {
                            id = id.substr(0, id.length - 3)
                        }
                        var input_value = clean_data(obj[1]),
                            dir = obj[0],
                            data_value = clean_data(data[data_columns[id]]);
                        if (!(isNaN( input_value ) ||
                            ((input_value == data_value) & (dir === "=")) ||
                            ((input_value > data_value) & (dir === "lt")) ||
                            ((input_value < data_value) & (dir === "gt")) ||
                            ((input_value >= data_value) & (dir === "lte")) ||
                            ((input_value <= data_value) & (dir === "gte"))
                             ))
                        {
                            return false;
                        }
                    }
                }
                return true;
            }
        );
        this.$table = table;
        this.setup();
        this.table = table.DataTable(options);
        $('#filter_select').combobox();
        this.listen();
    }

    FilterTable.prototype = {

        constructor: FilterTable
        ,
        setup: function() {
            $("#datatable_controls tbody tr").append(this.template());
            this.$table.before(this.filter_options_html);
            $("#created_filters").attr("data-columns", JSON.stringify(this.columns));
        }
        ,
        destroy: function() {
            this.table.destroy(true);
            $(".filtertable-destroy").remove();
        }
        ,
        create_select: function () {
            var select_html = '<select id="filter_select" name="table_filters" class="combobox form-control" style="display: none;"><option value="" selected="selected">Add a new filter...</option>',
                filter_keys = Object.keys(this.options.filters),
                filter_id;
            for (var i = 0; i < filter_keys.length; i++) {
                filter_id = filter_keys[i];
                select_html += '<option value="' + filter_id + '">' + this.options.columns[this.columns[filter_id]].title + '</option>';
            }
            return select_html + '</select>';
        }
        ,
        template: function() {
            return '<td class="filtertable-destroy">' + this.create_select() + '</td><td class="filtertable-destroy"><div id="created_filters" style="display: flex; flex-wrap: wrap;"></div></td><td class="filtertable-destroy"><div class="btn-group" role="group"><button id="clearFilters" class="btn btn-dark btn-sm border">Clear Filters</button><button id="screenerOptions" class="btn btn-dark btn-sm border">Show/Hide Columns</button></div></td>';
        }
        ,
        filter_options_html: '<div id="filter_options" class="modal fade filtertable-destroy" tabindex="-1" role="dialog" data-backdrop="static"><div class="modal-dialog" role="document"><div class="modal-content"><div class="modal-header"><h4 class="modal-title">New Filter</h4><button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button></div><div class="modal-body"><table class="" style="margin:0 auto"><tbody><tr><td><button id="addFilter" class="btn btn-dark border">Add Filter</button></td></tr></tbody></table></div></div></div></div>'
        ,
        greater_less: '<td class="filter-option"><select id="filter_direction" class="form-control"><option value="gt">&gt;</option><option value="gte">&gt;=</option><option value="lt">&lt;</option><option value="lte">&lt;=</option></select></td>'
        ,
        create_filter_input: function(filter_id) {
            var filter_type = this.options.filters[filter_id].type,
                values,
                filter_html;
            if (filter_type == "list") {
                values = this.table.column(this.columns[filter_id]).data().unique();
                filter_html = '<select id="filter_input" class="form-control>'
                for (var i = 0; i < values.length; i++) {
                    filter_html += '<option value="' + values[i].toLowerCase().replace(" ", "_") + '">' + values[i] + '</option>';
                }
            } else {
                filter_html = this.greater_less + '<td class="filter-option"><input id="filter_input" type="text" class="form-control filter_' + filter_type + '" placeholder="Enter criteria value..." autofocus></td>';
            }
            return filter_html;
        }
        ,
        listen: function () {
            var that = this;
            $("#filter_select").on('change', function () {
                $("#filter_options td.filter-option").remove();
                var filter_id = $(this).val(),
                    filter_name;

                if (filter_id) {
                    filter_name = that.options.columns[that.columns[filter_id]].title;
                    $("#filter_options tr").prepend('<td class="filter-option">' + filter_name + '</td>' + that.create_filter_input(filter_id));
                    $("#filter_options").modal("show");
                    setTimeout(function () {
                        $("#filter_input").focus();
                    }, 1000);

                } else {
                    $("#filter_options").modal("hide");
                }
            });
            $("#addFilter").on('click', function () {
                var $filter_input = $("#filter_input"),
                    value = $filter_input.val(),
                    filter_id = $("#filter_select").val();
                if ($filter_input.prop("tagName") == "SELECT") {
                    that.add_filter(filter_id, value, "=");
                } else {
                    var dir = $("#filter_direction").val();
                    that.add_filter(filter_id, value, dir);
                }
                that.table.draw();
                $("#filter_options").modal("hide");
            });
            $(".filtertable-destroy").on('click', "#removeFilter", function () {
                var $badge = $(this).parent();
                delete that.created_filters[$badge.prop("id")];
                $badge.remove();
                $("#created_filters").attr("data-filters", JSON.stringify(that.created_filters));
                that.table.draw();
            });
            $("#clearFilters").click(function() {
                that.created_filters = {};
                $("#created_filters").empty();
                $("#created_filters").attr("data-filters", "{}");
                that.table.draw();
            });
            if (this.options.index) {
                this.table.on( 'order.dt search.dt', function () {
                    that.table.column(0, {search:'applied', order:'applied'}).nodes().each( function (cell, i) {
                        cell.innerHTML = i+1;
                    } );
                }).draw();
            }
        }
        ,
        add_filter: function (id, value, dir) {
            var filter_id = id + "_" + dir.substr(0,2);
            $("#created_filters #" + filter_id).remove();
            this.created_filters[filter_id] = [dir, value];
            $("#created_filters").append('<span id="' + filter_id + '" class="badge badge-primary" style="margin: 2px;font-size: 10px;">' + this.options.columns[this.columns[id]].title + " " + get_sign(dir) + " " + toCurrency(value) + '<button id="removeFilter" type="button" class="close" aria-label="Close"><span aria-hidden="true">&times;</span></button></span>');
            $("#created_filters").attr("data-filters", JSON.stringify(this.created_filters));
        }
    }
        
    
    $.fn.filtertable = function (data, option) {
        var $this = $(this),
            options = typeof option == 'object' && option,
            ft;
        ft = new FilterTable($this, data, options);
        return ft;
    };
    
    $.fn.filtertable.defaults = {};
    
    $.fn.filtertable.Constructor = FilterTable;

}( window.jQuery ));